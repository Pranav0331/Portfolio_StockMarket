import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  OnDestroy,
  ElementRef,
  viewChild,
  effect,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, of, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  Time,
  CandlestickData,
  LineData,
  HistogramData
} from 'lightweight-charts';
import { MarketService } from '../../../services/market.service';
import { MarketWebSocketService, MarketTick } from '../../../services/market-websocket.service';
import { AuthService } from '../../../services/auth.service';
import { AlertService } from '../../../services/alert.service';
import { TradingService } from '../../../services/trading.service';
import { StockQuote, StockSearchItem, Candle, CandleSeries } from '../../../models/market.model';
import { AlertConditionType } from '../../../models/alert.model';
import { UserHolding } from '../../../models/trading.model';
import {
  IndicatorCategory,
  IndicatorDefinition,
  ActiveIndicator,
  INDICATOR_LIBRARY,
  INDICATOR_CATEGORIES
} from '../../../models/indicator.model';
import {
  calculateIndicatorSeries,
  IndicatorRenderSeries
} from '../../../utils/indicator-calc';

export interface DrawingPoint {
  x: number;
  y: number;
  time?: any;
  price?: number;
  logical?: number;
}

export interface DrawingItem {
  id: string;
  toolId: string;
  category: string;
  name: string;
  points: DrawingPoint[];
  color: string;
  fillColor?: string;
  lineWidth: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  text?: string;
  price?: number;
  locked?: boolean;
  extraStats?: string;
}

export interface DrawingToolOption {
  id: string;
  name: string;
  pointsRequired: number; // 0, 1, 2, 3, 4, 5, 7, -1
  icon?: string;
  shortcut?: string;
}

export interface DrawingToolGroup {
  id: string;
  name: string;
  iconName: string;
  activeToolId: string;
  tools: DrawingToolOption[];
}

export type MarketCategory = 'all' | 'indices' | 'stocks' | 'forex' | 'crypto';
export type ChartType = 'candles' | 'line' | 'area';
export type ChartInterval = '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day';
export type TimeframeRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

export interface WatchlistItem {
  symbol: string;
  name: string;
  category: 'indices' | 'stocks' | 'forex' | 'crypto';
  price?: number | null;
  change?: number | null;
  changePercent?: string | null;
  exchange?: string | null;
}

export interface HoveredBarData {
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './market.html',
  styleUrl: './market.css'
})
export class MarketComponent implements OnInit, OnDestroy {
  private readonly marketService = inject(MarketService);
  readonly marketWebSocketService = inject(MarketWebSocketService);
  readonly authService = inject(AuthService);
  readonly alertService = inject(AlertService);
  readonly tradingService = inject(TradingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Price Alert Modal State
  readonly isAlertModalOpen = signal<boolean>(false);
  readonly alertCondition = signal<AlertConditionType>('ABOVE');
  readonly alertTargetPrice = signal<number>(100);
  readonly alertNotes = signal<string>('');
  readonly isSavingAlert = signal<boolean>(false);
  readonly alertErrorMessage = signal<string | null>(null);
  readonly alertSuccessMessage = signal<string | null>(null);

  // Chart & Drawing Canvas DOM References
  readonly chartContainerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');
  readonly drawingSvgRef = viewChild<ElementRef<SVGSVGElement>>('drawingSvg');
  readonly drawingCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('drawingCanvas');
  readonly Math = Math;

  // Active Category Tab
  readonly activeCategory = signal<MarketCategory>('all');

  // Search State
  readonly searchQuery = signal<string>('');
  readonly isSearching = signal<boolean>(false);
  readonly searchResults = signal<StockSearchItem[]>([]);
  readonly showDropdown = signal<boolean>(false);

  // Selected Instrument State
  readonly selectedSymbol = signal<string>('AAPL');
  readonly selectedCompanyName = signal<string>('Apple Inc.');
  readonly selectedExchange = signal<string>('NASDAQ');
  readonly selectedType = signal<string>('Stocks');
  readonly currentQuote = signal<StockQuote | null>(null);

  readonly currentProvider = computed(() => {
    return this.marketService.isIndianSymbol(this.selectedSymbol()) ? 'Upstox' : 'Twelve Data';
  });

  // Current active symbol user holding position (if owned)
  readonly currentSymbolHolding = computed(() => {
    const sym = this.selectedSymbol();
    if (!sym) return null;
    return this.tradingService.holdingsMap().get(sym.trim().toUpperCase()) || null;
  });

  getHolding(symbol: string): UserHolding | undefined {
    if (!symbol) return undefined;
    return this.tradingService.holdingsMap().get(symbol.trim().toUpperCase());
  }

  // Loading and Error states
  readonly isLoadingQuote = signal<boolean>(false);
  readonly isLoadingCandles = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal<boolean>(false);

  // Chart Controls State
  readonly currentChartType = signal<ChartType>('candles');
  readonly currentInterval = signal<ChartInterval>('5min');
  readonly currentTimeframe = signal<TimeframeRange>('1D');
  readonly isFullscreen = signal<boolean>(false);

  // Live Hovered Candle / Bar Info
  readonly hoveredBar = signal<HoveredBarData | null>(null);

  // Live Streaming / Polling Status
  readonly isWebSocketConnected = signal<boolean>(false);
  readonly isReceivingRealTicks = signal<boolean>(false);
  readonly isStreamingUnavailable = signal<boolean>(false);
  readonly streamStatusMessage = signal<string | null>(null);
  readonly lastLiveTimestamp = signal<number>(Date.now());

  // Show LIVE strictly ONLY when real ticks are actually being received
  readonly isLiveConnected = computed(() => {
    return this.isWebSocketConnected() && this.isReceivingRealTicks() && !this.isStreamingUnavailable();
  });

  // Watchlist Local Search / Filter & Section Collapsing
  readonly watchlistSearch = signal<string>('');
  readonly isIndicesCollapsed = signal<boolean>(false);
  readonly isStocksCollapsed = signal<boolean>(false);
  readonly isForexCollapsed = signal<boolean>(false);
  readonly isCryptoCollapsed = signal<boolean>(false);

  // Resizable Watchlist Pane
  readonly watchlistWidth = signal<number>(330);
  readonly isResizingWatchlist = signal<boolean>(false);
  private resizeStartX = 0;
  private resizeStartWidth = 330;
  private boundOnMouseMove?: (e: MouseEvent) => void;
  private boundOnMouseUp?: (e: MouseEvent) => void;
  private boundOnVisibilityChange?: () => void;

  // Real Candlestick Data Cache
  readonly candleData = signal<Candle[]>([]);

  // =========================================================================
  // 12 MAIN TOOLBAR TOOL GROUPS (SYNCED WITH STOCK DETAILS)
  // =========================================================================
  readonly drawingToolGroups = signal<DrawingToolGroup[]>([
    {
      id: 'cursor',
      name: 'Cursor',
      iconName: 'cursor',
      activeToolId: 'crosshair',
      tools: [
        { id: 'crosshair', name: 'Crosshair', pointsRequired: 0, icon: '┼' },
        { id: 'cursor', name: 'Cursor / Arrow', pointsRequired: 0, icon: '↖' },
        { id: 'dot', name: 'Dot', pointsRequired: 0, icon: '•' },
        { id: 'eraser', name: 'Eraser', pointsRequired: 0, icon: '⌫' }
      ]
    },
    {
      id: 'lines',
      name: 'Lines',
      iconName: 'lines',
      activeToolId: 'trend_line',
      tools: [
        { id: 'trend_line', name: 'Trend Line', pointsRequired: 2, shortcut: 'Alt+T', icon: '╱' },
        { id: 'ray', name: 'Ray', pointsRequired: 2, icon: '↗' },
        { id: 'info_line', name: 'Info Line', pointsRequired: 2, icon: 'ℹ' },
        { id: 'extended_line', name: 'Extended Line', pointsRequired: 2, icon: '↔' },
        { id: 'trend_angle', name: 'Trend Angle', pointsRequired: 2, icon: '∠' },
        { id: 'horizontal_line', name: 'Horizontal Line', pointsRequired: 1, shortcut: 'Alt+H', icon: '―' },
        { id: 'horizontal_ray', name: 'Horizontal Ray', pointsRequired: 1, icon: '→' },
        { id: 'vertical_line', name: 'Vertical Line', pointsRequired: 1, shortcut: 'Alt+V', icon: '│' },
        { id: 'cross_line', name: 'Cross Line', pointsRequired: 1, icon: '✛' }
      ]
    },
    {
      id: 'fibonacci',
      name: 'Fibonacci',
      iconName: 'fibonacci',
      activeToolId: 'fib_retracement',
      tools: [
        { id: 'fib_retracement', name: 'Fib Retracement', pointsRequired: 2, shortcut: 'Alt+F', icon: '≡' },
        { id: 'trend_fib_extension', name: 'Trend-Based Fib Extension', pointsRequired: 3, icon: '≚' },
        { id: 'fib_channel', name: 'Fib Channel', pointsRequired: 3, icon: '⫽' },
        { id: 'fib_speed_fan', name: 'Fib Fan', pointsRequired: 2, icon: '⌔' },
        { id: 'fib_time_zone', name: 'Fib Time Zone', pointsRequired: 2, icon: '⧉' },
        { id: 'fib_circles', name: 'Fib Circles', pointsRequired: 2, icon: '◎' },
        { id: 'fib_spiral', name: 'Fib Spiral', pointsRequired: 2, icon: '🌀' },
        { id: 'fib_speed_arcs', name: 'Fib Arcs', pointsRequired: 2, icon: '⌒' },
        { id: 'fib_wedge', name: 'Fib Wedge', pointsRequired: 2, icon: '◬' },
        { id: 'pitchfan', name: 'Pitchfan', pointsRequired: 3, icon: '⋒' },
        { id: 'trend_fib_time', name: 'Trend-Based Fib Time', pointsRequired: 2, icon: '⏱' }
      ]
    },
    {
      id: 'gann',
      name: 'Gann',
      iconName: 'gann',
      activeToolId: 'gann_box',
      tools: [
        { id: 'gann_box', name: 'Gann Box', pointsRequired: 2, icon: '⊞' },
        { id: 'gann_square_fixed', name: 'Gann Square Fixed', pointsRequired: 2, icon: '⊡' },
        { id: 'gann_square', name: 'Gann Square', pointsRequired: 2, icon: '◫' },
        { id: 'gann_fan', name: 'Gann Fan', pointsRequired: 2, icon: '∠' }
      ]
    },
    {
      id: 'patterns',
      name: 'Patterns',
      iconName: 'patterns',
      activeToolId: 'xabcd_pattern',
      tools: [
        { id: 'xabcd_pattern', name: 'XABCD Pattern', pointsRequired: 5, icon: '⧎' },
        { id: 'cypher_pattern', name: 'Cypher Pattern', pointsRequired: 5, icon: '◬' },
        { id: 'head_and_shoulders', name: 'Head and Shoulders', pointsRequired: 7, icon: '⩕' },
        { id: 'abcd_pattern', name: 'ABCD Pattern', pointsRequired: 4, icon: '⫽' },
        { id: 'triangle_pattern', name: 'Triangle Pattern', pointsRequired: 4, icon: '⊿' },
        { id: 'three_drives_pattern', name: 'Three Drives Pattern', pointsRequired: 7, icon: '⋕' }
      ]
    },
    {
      id: 'projection',
      name: 'Projection & Ranges',
      iconName: 'projection',
      activeToolId: 'long_position',
      tools: [
        { id: 'long_position', name: 'Long Position', pointsRequired: 2, icon: '⤊' },
        { id: 'short_position', name: 'Short Position', pointsRequired: 2, icon: '⤋' },
        { id: 'forecast', name: 'Forecast', pointsRequired: 2, icon: '🔮' },
        { id: 'date_range', name: 'Date Range', pointsRequired: 2, icon: '↔' },
        { id: 'price_range', name: 'Price Range', pointsRequired: 2, icon: '↕' },
        { id: 'date_price_range', name: 'Date and Price Range', pointsRequired: 2, icon: '⤧' },
        { id: 'bars_pattern', name: 'Bars Pattern', pointsRequired: 2, icon: '▥' },
        { id: 'ghost_feed', name: 'Ghost Feed', pointsRequired: 2, icon: '👻' },
        { id: 'projection', name: 'Projection', pointsRequired: 2, icon: '📈' }
      ]
    },
    {
      id: 'brushes',
      name: 'Brushes',
      iconName: 'brushes',
      activeToolId: 'brush',
      tools: [
        { id: 'brush', name: 'Brush', pointsRequired: -1, icon: '✎' },
        { id: 'highlighter', name: 'Highlighter', pointsRequired: -1, icon: '🖍' }
      ]
    },
    {
      id: 'arrows',
      name: 'Arrows',
      iconName: 'arrows',
      activeToolId: 'arrow',
      tools: [
        { id: 'arrow_marker', name: 'Arrow Marker', pointsRequired: 1, icon: '📍' },
        { id: 'arrow', name: 'Arrow', pointsRequired: 2, icon: '➔' },
        { id: 'arrow_up', name: 'Arrow Mark Up', pointsRequired: 1, icon: '⬆' },
        { id: 'arrow_down', name: 'Arrow Mark Down', pointsRequired: 1, icon: '⬇' },
        { id: 'arrow_left', name: 'Arrow Mark Left', pointsRequired: 1, icon: '⬅' },
        { id: 'arrow_right', name: 'Arrow Mark Right', pointsRequired: 1, icon: '➡' }
      ]
    },
    {
      id: 'shapes',
      name: 'Shapes',
      iconName: 'shapes',
      activeToolId: 'rectangle',
      tools: [
        { id: 'rectangle', name: 'Rectangle', pointsRequired: 2, icon: '▭' },
        { id: 'rotated_rectangle', name: 'Rotated Rectangle', pointsRequired: 3, icon: '▱' },
        { id: 'path', name: 'Path', pointsRequired: -1, icon: '〰' },
        { id: 'circle', name: 'Circle', pointsRequired: 2, icon: '○' },
        { id: 'ellipse', name: 'Ellipse', pointsRequired: 2, icon: '⬭' },
        { id: 'polyline', name: 'Polyline', pointsRequired: 3, icon: '☡' },
        { id: 'triangle', name: 'Triangle', pointsRequired: 3, icon: '△' },
        { id: 'arc', name: 'Arc', pointsRequired: 3, icon: '⌒' },
        { id: 'curve', name: 'Curve', pointsRequired: 3, icon: '∿' }
      ]
    },
    {
      id: 'text_notes',
      name: 'Text & Notes',
      iconName: 'text_notes',
      activeToolId: 'text',
      tools: [
        { id: 'text', name: 'Text', pointsRequired: 1, icon: 'T' },
        { id: 'anchored_text', name: 'Anchored Text', pointsRequired: 1, icon: '⚓' },
        { id: 'note', name: 'Note', pointsRequired: 1, icon: '📝' },
        { id: 'price_note', name: 'Price Note', pointsRequired: 1, icon: '🏷' },
        { id: 'pin', name: 'Pin', pointsRequired: 1, icon: '📌' },
        { id: 'table', name: 'Table', pointsRequired: 1, icon: '▦' },
        { id: 'callout', name: 'Callout', pointsRequired: 2, icon: '💬' },
        { id: 'comment', name: 'Comment', pointsRequired: 1, icon: '🗨' },
        { id: 'price_label', name: 'Price Label', pointsRequired: 1, icon: '💲' },
        { id: 'signpost', name: 'Signpost', pointsRequired: 1, icon: '🪧' },
        { id: 'flag_mark', name: 'Flag Mark', pointsRequired: 1, icon: '🚩' }
      ]
    },
    {
      id: 'volume',
      name: 'Volume & VWAP',
      iconName: 'volume',
      activeToolId: 'fixed_range_volume',
      tools: [
        { id: 'fixed_range_volume', name: 'Fixed Range Volume Profile', pointsRequired: 2, icon: '📊' },
        { id: 'anchored_vwap', name: 'Anchored VWAP', pointsRequired: 1, icon: '⚓' },
        { id: 'volume_profile', name: 'Volume Profile', pointsRequired: 2, icon: '📶' }
      ]
    },
    {
      id: 'emoji_stickers',
      name: 'Emoji & Stickers',
      iconName: 'emoji_stickers',
      activeToolId: 'emoji_marker',
      tools: [
        { id: 'emoji_marker', name: 'Emoji / Sticker', pointsRequired: 1, icon: '😀' }
      ]
    }
  ]);

  // Drawing Engine State Signals
  readonly activeDrawingTool = signal<DrawingToolOption | null>(null);
  readonly activeToolGroupId = signal<string>('cursor');
  readonly openToolGroupId = signal<string | null>(null);

  // Emoji / Sticker / Icons panel state (Exness Charcoal Theme System)
  readonly activeEmojiTab = signal<'emoji' | 'stickers' | 'icons'>('emoji');
  readonly activeEmojiCategory = signal<string>('smiles_people');

  readonly emojiCategories = [
    { id: 'smiles_people', label: 'SMILES & PEOPLE', icon: '😊' },
    { id: 'animals_nature', label: 'ANIMALS & NATURE', icon: '🐻' },
    { id: 'food_drink', label: 'FOOD & DRINK', icon: '🍔' },
    { id: 'activities', label: 'ACTIVITIES', icon: '⚽' },
    { id: 'travel_places', label: 'TRAVEL & PLACES', icon: '✈️' },
    { id: 'objects', label: 'OBJECTS', icon: '💡' },
    { id: 'symbols', label: 'SYMBOLS', icon: '🔣' },
    { id: 'flags', label: 'FLAGS', icon: '🚩' }
  ];

  readonly emojisByCategory: Record<string, string[]> = {
    smiles_people: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝',
      '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
      '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
      '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠',
      '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮',
      '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰',
      '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
      '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
      '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻'
    ],
    animals_nature: [
      '🐂', '🐻', '🐋', '🦈', '🦅', '🦁', '🐯', '🐺',
      '🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🐼', '🐨',
      '🐵', '🐒', '🦍', '🦧', '🐮', '🐷', '🐗', '🐴',
      '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟',
      '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
      '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
      '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍',
      '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷', '🌹',
      '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛',
      '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔',
      '🌙', '🌎', '🪐', '💫', '⭐', '🌟', '✨', '⚡',
      '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '☁️', '🌊'
    ],
    food_drink: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
      '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
      '🥝', '🍅', '🥑', '🍆', '🥦', '🥬', '🥒', '🌶️',
      '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯',
      '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞',
      '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔',
      '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯',
      '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛',
      '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥',
      '🎂', '🍰', '🧁', '🥧', '🍫', '🍿', '🍩', '🍪',
      '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻',
      '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'
    ],
    activities: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌',
      '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
      '🤺', '🤾', '🧗', '🏌️', '🏇', '🧘', '🏄', '🏊',
      '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
      '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬',
      '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸',
      '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰'
    ],
    travel_places: [
      '🚗', '🚙', '🚚', '🚛', '🚜', '🏎️', '🏍️', '🛵',
      '🚲', '🛴', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡',
      '🚠', '🚟', '🚃', '🚋', '🚄', '🚅', '🚆', '🚇',
      '🚈', '🚉', '🚊', '🚂', '🚁', '🛩️', '✈️', '🛫',
      '🛬', '🚀', '🛸', '🛰️', '⛵', '🚤', '🛥️', '🚢',
      '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🗽', '🗼',
      '🏰', '🏯', '🏟️', '🎡', '🎢', '⛲', '🏖️', '🏝️',
      '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠',
      '🏢', '🏥', '🏦', '🏨', '🏫', '🏬', '🏭', '🏛️'
    ],
    objects: [
      '💡', '🔦', '🕯️', '🧯', '🛢️', '💸', '💵', '💴',
      '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜',
      '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪓',
      '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫',
      '💣', '🧨', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️',
      '🔮', '📿', '🧿', '💈', '🪞', '🪟', '🪑', '🚪',
      '🛒', '📦', '📫', '📬', '📭', '📮', '🏷️', '✉️',
      '📊', '📈', '📉', '🗒️', '🗓️', '📅', '📆', '📇',
      '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📕',
      '📗', '📘', '📙', '📚', '📖', '🔖', '🔗', '📎',
      '📐', '📏', '📌', '📍', '✂️', '🖊️', '🖋️', '📝',
      '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓', '🔑'
    ],
    symbols: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
      '💯', '💢', '♨️', '❗️', '❕', '❓', '❔', '‼️',
      '⚠️', '🔱', '⚜️', '🔰', '♻️', '✅', '💹', '❇️',
      '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧',
      '🚾', '♿', '🅿️', '📶', '🈁', '🔣', 'ℹ️', '🔤',
      '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣',
      '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣',
      '🔟', '🔢', '▶️', '⏸️', '⏹️', '⏺️', '⏭️', '⏮️',
      '⏩', '⏪', '⏫', '⏬', '➡️', '⬅️', '⬆️', '⬇️',
      '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '🔄', '🔃',
      '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱'
    ],
    flags: [
      '🚩', '🏁', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏴‍☠️', '🇺🇸',
      '🇬🇧', '🇪🇺', '🇯🇵', '🇩🇪', '🇫🇷', '🇮🇳', '🇨🇦', '🇦🇺',
      '🇨🇳', '🇧🇷', '🇷🇺', '🇰🇷', '🇮🇹', '🇪🇸', '🇲🇽', '🇨🇭',
      '🇸🇪', '🇳🇱', '🇸🇬', '🇦🇪', '🇿🇦', '🇹🇷', '🇸🇦', '🇳🇿'
    ]
  };

  readonly currentCategoryEmojis = computed(() => {
    const cat = this.activeEmojiCategory();
    return this.emojisByCategory[cat] || this.emojisByCategory['smiles_people'];
  });

  readonly currentCategoryLabel = computed(() => {
    const catId = this.activeEmojiCategory();
    const found = this.emojiCategories.find(c => c.id === catId);
    return found ? found.label : 'SMILES & PEOPLE';
  });

  readonly availableStickers = [
    'Bullish Trend 🐂',
    'Bearish Drop 🐻',
    'Breakout 🚀',
    'Stop Out 🛑',
    'To The Moon 🌕',
    'Diamond Hands 💎',
    'Buy The Dip 📉',
    'Take Profit 🎯',
    'Whale Alert 🐋',
    'Support Level 🛡️',
    'Resistance 🚧',
    'Pump It 🔥',
    'HODL ✊',
    'FOMO ⚡',
    'Golden Cross ✨',
    'Death Cross ☠️'
  ];

  readonly availableIcons = [
    { label: 'Star', icon: '⭐' },
    { label: 'Heart', icon: '❤️' },
    { label: 'Checkmark', icon: '✅' },
    { label: 'Cross', icon: '❌' },
    { label: 'Bullish', icon: '👍' },
    { label: 'Bearish', icon: '👎' },
    { label: 'Target', icon: '🎯' },
    { label: 'Alert Bell', icon: '🔔' },
    { label: 'Fire', icon: '🔥' },
    { label: 'Rocket', icon: '🚀' },
    { label: 'Flash / Lightning', icon: '⚡' },
    { label: 'Diamond', icon: '💎' },
    { label: 'Lock', icon: '🔒' },
    { label: 'Shield', icon: '🛡️' },
    { label: 'Warning', icon: '⚠️' },
    { label: 'Idea / Light', icon: '💡' }
  ];

  readonly activeEmojiMarker = signal<{ text: string; type: 'emoji' | 'sticker' | 'icon' }>({ text: '🚀', type: 'emoji' });

  readonly drawings = signal<DrawingItem[]>([]);
  readonly selectedDrawingId = signal<string | null>(null);
  readonly isDraggingDrawing = signal<boolean>(false);
  private dragStartMouse: { x: number; y: number } = { x: 0, y: 0 };
  private initialDragPoints: DrawingPoint[] = [];
  readonly selectedDrawing = computed(() => {
    const selId = this.selectedDrawingId();
    if (!selId) return null;
    return this.drawings().find(d => d.id === selId) || null;
  });
  readonly inProgressPoints = signal<DrawingPoint[]>([]);
  readonly isDrawingActive = signal<boolean>(false);

  readonly isMagnetEnabled = signal<boolean>(false);
  readonly areDrawingsLocked = signal<boolean>(false);
  readonly areDrawingsHidden = signal<boolean>(false);

  readonly activeColor = signal<string>('#3b82f6');
  readonly activeLineWidth = signal<number>(2);
  readonly availableColors = ['#2563eb', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#0f172a', '#64748b'];

  // Backward-compatibility aliases
  readonly selectedDrawingTool = computed<any>(() => this.activeDrawingTool()?.id || 'cursor');
  readonly isMagnetMode = this.isMagnetEnabled;
  readonly isDrawingsLocked = this.areDrawingsLocked;
  readonly isDrawingsHidden = this.areDrawingsHidden;
  readonly activeDrawingColor = this.activeColor;
  readonly floatingToolbarPos = signal<{ x: number; y: number }>({ x: 100, y: 100 });
  readonly isColorPickerOpen = signal<boolean>(false);
  readonly isLineStyleMenuOpen = signal<boolean>(false);
  readonly isLineWidthMenuOpen = signal<boolean>(false);
  readonly isMoreOptionsMenuOpen = signal<boolean>(false);
  readonly drawingColorPalette = [
    '#38bdf8', '#818cf8', '#6366f1', '#10b981', '#f59e0b',
    '#f43f5e', '#ec4899', '#a855f7', '#ffffff', '#94a3b8', '#1e293b'
  ];

  // ==========================================
  // INDICATOR LIBRARY & ACTIVE STATE
  // ==========================================
  readonly indicatorCategories = INDICATOR_CATEGORIES;
  readonly isIndicatorModalOpen = signal<boolean>(false);
  readonly indicatorSearchQuery = signal<string>('');
  readonly selectedIndicatorCategory = signal<string>('all');
  readonly indicatorLibrary = signal<IndicatorDefinition[]>(INDICATOR_LIBRARY);
  readonly activeIndicators = signal<ActiveIndicator[]>([]);

  // Editing Settings Modal State
  readonly editingIndicator = signal<ActiveIndicator | null>(null);
  readonly editingParams = signal<Record<string, any>>({});
  readonly editingColor = signal<string>('#3b82f6');
  readonly editingLineWidth = signal<number>(2);

  // Filtered Indicators in Library Modal
  readonly filteredIndicators = computed(() => {
    const query = this.indicatorSearchQuery().trim().toLowerCase();
    const cat = this.selectedIndicatorCategory();

    return this.indicatorLibrary().filter(ind => {
      const matchCat = cat === 'all' || ind.category === cat;
      const matchQuery =
        !query ||
        ind.name.toLowerCase().includes(query) ||
        ind.shortName.toLowerCase().includes(query) ||
        ind.description.toLowerCase().includes(query) ||
        ind.tags.some(t => t.toLowerCase().includes(query));
      return matchCat && matchQuery;
    });
  });

  getCategoryCount(catId: string): number {
    if (catId === 'all') return this.indicatorLibrary().length;
    return this.indicatorLibrary().filter(i => i.category === catId).length;
  }

  // Intervals Available
  readonly intervals: { label: string; value: ChartInterval }[] = [
    { label: '1m', value: '1min' },
    { label: '5m', value: '5min' },
    { label: '15m', value: '15min' },
    { label: '30m', value: '30min' },
    { label: '1H', value: '1h' },
    { label: '4H', value: '4h' },
    { label: '1D', value: '1day' }
  ];

  // Timeframe Ranges Available
  readonly timeframes: TimeframeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

  // Popular Market Quick Chips
  readonly popularShortcuts = [
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', category: 'indices' as const },
    { symbol: 'SENSEX', name: 'BSE Sensex Index', category: 'indices' as const },
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', category: 'stocks' as const },
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'stocks' as const },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks' as const },
    { symbol: 'NVDA', name: 'Nvidia Corp.', category: 'stocks' as const },
    { symbol: 'EUR/USD', name: 'Euro / USD', category: 'forex' as const },
    { symbol: 'BTC/USD', name: 'Bitcoin / USD', category: 'crypto' as const }
  ];

  // Watchlist Catalog
  readonly watchlist = signal<WatchlistItem[]>([
    // Indian Indices (Upstox)
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'SENSEX', name: 'BSE Sensex Index', category: 'indices', exchange: 'BSE' },
    { symbol: 'BANK NIFTY', name: 'Nifty Bank Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'NIFTY IT', name: 'Nifty IT Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'NIFTY AUTO', name: 'Nifty Auto Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'NIFTY FIN SERVICE', name: 'Nifty Financial Services Index', category: 'indices', exchange: 'NSE' },

    // Indian Stocks (Upstox)
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'stocks', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', category: 'stocks', exchange: 'NSE' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', category: 'stocks', exchange: 'NSE' },

    // US Stocks (Twelve Data)
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'stocks', exchange: 'NASDAQ' },

    // Forex (Twelve Data)
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'forex', exchange: 'Forex' },
    { symbol: 'GBP/USD', name: 'British Pound / USD', category: 'forex', exchange: 'Forex' },
    { symbol: 'USD/JPY', name: 'US Dollar / Yen', category: 'forex', exchange: 'Forex' },
    { symbol: 'AUD/USD', name: 'Australian Dollar / USD', category: 'forex', exchange: 'Forex' },

    // Crypto (Twelve Data)
    { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', category: 'crypto', exchange: 'Coinbase' },
    { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', category: 'crypto', exchange: 'Coinbase' },
    { symbol: 'SOL/USD', name: 'Solana / US Dollar', category: 'crypto', exchange: 'Binance' }
  ]);

  // Watchlist Drag and Drop State
  readonly draggedItem = signal<{ symbol: string; category: string } | null>(null);
  readonly dragOverTarget = signal<string | null>(null);
  readonly dragOverPosition = signal<'above' | 'below' | null>(null);

  // Filtered Watchlist based on Category and Search
  readonly filteredWatchlist = computed(() => {
    const cat = this.activeCategory();
    const query = this.watchlistSearch().trim().toLowerCase();

    return this.watchlist().filter(item => {
      const matchCat = (cat === 'all') || (item.category === cat);
      const matchQuery = !query ||
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });
  });

  readonly indicesWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'indices'));
  readonly stockWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'stocks'));
  readonly forexWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'forex'));
  readonly cryptoWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'crypto'));

  readonly indicesCount = computed(() => this.watchlist().filter(w => w.category === 'indices').length);
  readonly stockCount = computed(() => this.watchlist().filter(w => w.category === 'stocks').length);
  readonly forexCount = computed(() => this.watchlist().filter(w => w.category === 'forex').length);
  readonly cryptoCount = computed(() => this.watchlist().filter(w => w.category === 'crypto').length);

  // Lightweight Charts Instances
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private indicatorSeriesMap = new Map<string, ISeriesApi<any>>();
  private resizeObserver: ResizeObserver | null = null;

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private queryParamSub?: Subscription;
  private wsTickSub?: Subscription;
  private wsConnectedSub?: Subscription;

  constructor() {
    // Effect to render or re-render chart whenever chartContainerRef and candleData become available
    effect(() => {
      const container = this.chartContainerRef()?.nativeElement;
      const data = this.candleData();
      const chartType = this.currentChartType();

      if (container && data && data.length > 0) {
        this.initOrUpdateChart(container, data, chartType);
      }
    });

    // Effect to re-render indicators when activeIndicators change
    effect(() => {
      this.activeIndicators();
      const data = this.candleData();
      if (this.chart && data && data.length > 0) {
        this.renderAllIndicators();
      }
    });
  }

  ngOnInit(): void {
    // Setup debounced search for keyword suggestions
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((keywords) => {
        if (!keywords || keywords.trim().length < 2) {
          this.isSearching.set(false);
          this.searchResults.set([]);
          this.showDropdown.set(false);
          return of({ bestMatches: [], query: keywords });
        }
        this.isSearching.set(true);
        return this.marketService.searchSymbols(keywords).pipe(
          catchError(() => {
            this.isSearching.set(false);
            return of({ bestMatches: [], query: keywords });
          })
        );
      })
    ).subscribe({
      next: (res) => {
        this.isSearching.set(false);
        if (res && res.bestMatches && res.bestMatches.length > 0) {
          this.searchResults.set(res.bestMatches);
          this.showDropdown.set(true);
        } else {
          this.searchResults.set([]);
          this.showDropdown.set(false);
        }
      }
    });

    // Subscribe to real-time WebSocket ticks from Spring Boot / Upstox
    this.wsTickSub = this.marketWebSocketService.ticks$.subscribe((tick) => {
      this.handleLiveTick(tick);
    });

    this.wsConnectedSub = this.marketWebSocketService.isConnected$.subscribe((connected) => {
      this.isWebSocketConnected.set(connected);
      if (!connected) {
        this.isReceivingRealTicks.set(false);
      }
    });

    // Load saved watchlist state & drawings
    this.loadSavedWatchlistState();
    this.loadDrawingsForSymbol(this.selectedSymbol());

    // Fetch user portfolio holdings to display live P&L on watchlist if authenticated
    if (this.authService.isAuthenticated()) {
      this.tradingService.getHoldings().subscribe({ error: () => {} });
    }

    // Handle query params e.g. /dashboard/market?symbol=BTC/USD
    this.queryParamSub = this.route.queryParams.subscribe((params) => {
      const symbolParam = params['symbol'] || params['q'];
      if (symbolParam) {
        this.loadInstrument(symbolParam);
      } else {
        this.loadInstrument(this.selectedSymbol());
      }
    });

    // Start live candle updates loop
    this.startLiveCandleStream();

    // Listen for tab visibility changes to save background API limits
    if (typeof document !== 'undefined') {
      this.boundOnVisibilityChange = () => {
        if (document.hidden) {
          this.stopLiveCandleStream();
        } else {
          this.startLiveCandleStream();
        }
      };
      document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    this.stopLiveCandleStream();
    this.searchSubscription?.unsubscribe();
    this.queryParamSub?.unsubscribe();
    this.wsTickSub?.unsubscribe();
    this.wsConnectedSub?.unsubscribe();
    if (this.boundOnMouseMove) {
      document.removeEventListener('mousemove', this.boundOnMouseMove);
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener('mouseup', this.boundOnMouseUp);
    }
    if (this.boundOnVisibilityChange) {
      document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  }

  // =========================================================================
  // INSTRUMENT SELECTION & DATA FETCHING
  // =========================================================================

  loadInstrument(symbol: string, name?: string, exchange?: string, type?: string, forceRefresh = false): void {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    this.selectedSymbol.set(cleanSym);
    if (name) this.selectedCompanyName.set(name);
    if (exchange) this.selectedExchange.set(exchange);
    if (type) this.selectedType.set(type);

    this.showDropdown.set(false);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.isReceivingRealTicks.set(false);
    this.isStreamingUnavailable.set(false);
    this.streamStatusMessage.set(null);

    // Load saved drawings for this symbol
    this.loadDrawingsForSymbol(cleanSym);

    // Fetch both Quote and Candles
    this.fetchQuote(cleanSym, name, forceRefresh);
    this.fetchCandles(cleanSym, this.currentInterval(), forceRefresh);

    // Restart live candle polling stream for newly selected symbol
    this.startLiveCandleStream();
  }

  fetchQuote(symbol: string, companyName?: string, forceRefresh = false): void {
    this.isLoadingQuote.set(true);

    this.marketService.getQuote(symbol, forceRefresh).subscribe({
      next: (quote) => {
        this.isLoadingQuote.set(false);
        this.currentQuote.set(quote);
        if (quote.name) {
          this.selectedCompanyName.set(quote.name);
        }
        this.updateWatchlistItem(symbol, quote.price, quote.change, quote.changePercent);
      },
      error: (err) => {
        this.isLoadingQuote.set(false);
        this.handleError(err, symbol);
      }
    });
  }

  fetchCandles(symbol: string, interval: ChartInterval, forceRefresh = false): void {
    this.isLoadingCandles.set(true);

    const size = this.getOutputSizeForTimeframe(this.currentTimeframe());

    this.marketService.getCandles(symbol, interval, size, forceRefresh).subscribe({
      next: (series) => {
        this.isLoadingCandles.set(false);
        if (series && series.candles && series.candles.length > 0) {
          this.candleData.set(series.candles);
          if (series.exchange) this.selectedExchange.set(series.exchange);
          if (series.type) this.selectedType.set(series.type);
        } else {
          this.candleData.set([]);
          this.errorMessage.set('No chart data available for this instrument.');
        }
      },
      error: (err) => {
        this.isLoadingCandles.set(false);
        this.candleData.set([]);
        this.handleError(err, symbol);
      }
    });
  }

  private handleError(err: any, symbol: string): void {
    const errorMsg = err.error?.message || err.message || '';
    if (err.status === 429 || errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('api limit') || errorMsg.toLowerCase().includes('limit reached')) {
      this.isRateLimited.set(true);
      this.errorMessage.set('Twelve Data rate limit reached. Please wait for the next minute.');
    } else if (err.status === 504) {
      this.errorMessage.set('Market data request timed out. Please check your connection and try again.');
    } else if (err.status === 404) {
      this.errorMessage.set(`No market data found for symbol "${symbol}". Please verify the symbol.`);
    } else {
      this.errorMessage.set(errorMsg || 'Market data temporarily unavailable. Please try again.');
    }
  }

  private getOutputSizeForTimeframe(tf: TimeframeRange): number {
    switch (tf) {
      case '1D':
        return 78;
      case '5D':
        return 120;
      case '1M':
        return 180;
      case '3M':
        return 240;
      case '6M':
        return 300;
      case '1Y':
      case '5Y':
      case 'ALL':
      default:
        return 365;
    }
  }

  // =========================================================================
  // REAL-TIME LIVE CANDLE UPDATES (UPSTOX WEBSOCKET V3 -> SPRING BOOT -> ANGULAR)
  // =========================================================================

  private startLiveCandleStream(): void {
    const symbol = this.selectedSymbol();
    const interval = this.currentInterval();
    if (symbol) {
      this.marketWebSocketService.subscribe(symbol, interval);
    }
  }

  private stopLiveCandleStream(): void {
    const symbol = this.selectedSymbol();
    if (symbol) {
      this.marketWebSocketService.unsubscribe(symbol);
    }
  }

  private handleLiveTick(tick: MarketTick): void {
    if (!tick) {
      return;
    }

    const currentSym = this.selectedSymbol();

    if (tick.type === 'STATUS') {
      if (!tick.symbol || this.isMatchingSymbol(currentSym, tick.symbol, tick.instrumentKey)) {
        if (tick.status === 'DATA_UNAVAILABLE' || tick.streamingSupported === false) {
          this.isStreamingUnavailable.set(true);
          this.isReceivingRealTicks.set(false);
          this.streamStatusMessage.set(tick.message || 'Streaming unavailable for current market/plan');
        } else if (tick.status === 'CONNECTED') {
          this.isWebSocketConnected.set(true);
        }
      }
      return;
    }

    if (tick.type === 'PONG') {
      return;
    }

    if (tick.price == null) {
      return;
    }

    if (tick.symbol && !this.isMatchingSymbol(currentSym, tick.symbol, tick.instrumentKey)) {
      return;
    }

    // Real tick received for currently selected instrument
    this.isReceivingRealTicks.set(true);
    this.isStreamingUnavailable.set(false);
    this.streamStatusMessage.set(null);
    this.lastLiveTimestamp.set(Date.now());

    const prev = this.currentQuote();
    const price = tick.price;
    const prevClose = prev?.previousClose || prev?.price || price;
    const change = tick.change != null ? tick.change : (price - prevClose);
    const changePercent = tick.changePercent || (prevClose > 0 ? `${change >= 0 ? '+' : ''}${((change / prevClose) * 100).toFixed(2)}%` : '+0.00%');

    const updatedQuote: StockQuote = {
      symbol: currentSym,
      name: prev?.name || this.selectedCompanyName(),
      price: price,
      change: change,
      changePercent: changePercent,
      previousClose: prevClose,
      open: tick.open || prev?.open || price,
      high: tick.high ? Math.max(tick.high, prev?.high || price) : (prev ? Math.max(price, prev.high || price) : price),
      low: tick.low ? Math.min(tick.low, prev?.low || price) : (prev ? Math.min(price, prev.low || price) : price),
      volume: tick.volume != null ? tick.volume : prev?.volume || 0,
      latestTradingDay: new Date().toISOString().split('T')[0],
      timestamp: tick.timestamp ? Math.floor(tick.timestamp / 1000) : Math.floor(Date.now() / 1000)
    };

    this.currentQuote.set(updatedQuote);
    this.updateWatchlistItem(currentSym, price, change, changePercent);

    // Update the live moving candlestick in real time
    this.processLiveCandleTick(price, tick.volume, tick.timestamp);
  }

  private getIntervalSeconds(interval: ChartInterval): number {
    switch (interval) {
      case '1min': return 60;
      case '5min': return 300;
      case '15min': return 900;
      case '30min': return 1800;
      case '1h': return 3600;
      case '4h': return 14400;
      case '1day': return 86400;
      default: return 300;
    }
  }

  private isMatchingSymbol(currentSymbol: string, tickSymbol: string, instrumentKey?: string): boolean {
    if (!currentSymbol || !tickSymbol) return false;
    const c = currentSymbol.trim().toUpperCase();
    const t = tickSymbol.trim().toUpperCase();
    if (c === t || c.replace(/\s+/g, '') === t.replace(/\s+/g, '')) return true;
    if (instrumentKey) {
      const ik = instrumentKey.toUpperCase();
      if (ik.includes(c) || ik.includes(c.replace(/\s+/g, ''))) return true;
    }
    return false;
  }

  private processLiveCandleTick(livePrice: number, liveVolume?: number | null, tickTsMs?: number | null): void {
    const candles = this.candleData();
    if (!candles || candles.length === 0) return;

    const intervalSec = this.getIntervalSeconds(this.currentInterval());
    const tickTsSec = tickTsMs ? Math.floor(tickTsMs / 1000) : Math.floor(Date.now() / 1000);
    const currentBucket = Math.floor(tickTsSec / intervalSec) * intervalSec;

    const lastIdx = candles.length - 1;
    const last = { ...candles[lastIdx] };
    const lastBucket = Math.floor(last.timestamp / intervalSec) * intervalSec;

    if (currentBucket > lastBucket) {
      // Interval completed! Finalize current candle and create the next live candle
      const newCandle: Candle = {
        timestamp: currentBucket,
        datetime: new Date(currentBucket * 1000).toISOString(),
        open: livePrice,
        high: livePrice,
        low: livePrice,
        close: livePrice,
        volume: 0
      };

      const updatedCandles = [...candles, newCandle];
      this.candleData.set(updatedCandles);

      if (this.candlestickSeries) {
        try {
          this.candlestickSeries.update({
            time: (newCandle.timestamp as unknown) as Time,
            open: newCandle.open,
            high: newCandle.high,
            low: newCandle.low,
            close: newCandle.close
          });
        } catch (e) {}
      } else if (this.lineSeries) {
        try {
          this.lineSeries.update({
            time: (newCandle.timestamp as unknown) as Time,
            value: newCandle.close
          });
        } catch (e) {}
      } else if (this.areaSeries) {
        try {
          this.areaSeries.update({
            time: (newCandle.timestamp as unknown) as Time,
            value: newCandle.close
          });
        } catch (e) {}
      }

      if (this.volumeSeries) {
        try {
          this.volumeSeries.update({
            time: (newCandle.timestamp as unknown) as Time,
            value: 0,
            color: 'rgba(16, 185, 129, 0.45)'
          });
        } catch (e) {}
      }
    } else {
      // Dynamic movement: update high, low, close of current candle
      last.close = livePrice;
      if (livePrice > last.high) last.high = livePrice;
      if (livePrice < last.low) last.low = livePrice;
      if (liveVolume != null && liveVolume > 0) last.volume = liveVolume;

      const updatedCandles = [...candles];
      updatedCandles[lastIdx] = last;
      this.candleData.set(updatedCandles);

      // Apply immediate update to Lightweight Charts series
      if (this.candlestickSeries) {
        try {
          this.candlestickSeries.update({
            time: (last.timestamp as unknown) as Time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close
          });
        } catch (e) {}
      } else if (this.lineSeries) {
        try {
          this.lineSeries.update({
            time: (last.timestamp as unknown) as Time,
            value: last.close
          });
        } catch (e) {}
      } else if (this.areaSeries) {
        try {
          this.areaSeries.update({
            time: (last.timestamp as unknown) as Time,
            value: last.close
          });
        } catch (e) {}
      }

      if (this.volumeSeries && last.volume != null) {
        try {
          this.volumeSeries.update({
            time: (last.timestamp as unknown) as Time,
            value: last.volume,
            color: last.close >= last.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'
          });
        } catch (e) {}
      }
    }

    // Re-render drawings on canvas so measurements/rays remain synchronized
    this.renderDrawings();
  }

  // =========================================================================
  // LIGHTWEIGHT CHARTS INTEGRATION
  // =========================================================================

  private initOrUpdateChart(container: HTMLDivElement, candles: Candle[], chartType: ChartType): void {
    if (!candles || candles.length === 0 || typeof window === 'undefined') return;

    try {
      const isDark = !document.documentElement.getAttribute('data-theme')?.includes('light');

      const bgColor = 'transparent';
      const textColor = isDark ? '#a1a1aa' : '#64748b';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.05)';
      const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

      if (!this.chart) {
        container.innerHTML = '';

        this.chart = createChart(container, {
          width: container.clientWidth || 800,
          height: container.clientHeight || 560,
          layout: {
            background: { type: ColorType.Solid, color: bgColor },
            textColor: textColor,
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: '#818cf8',
              width: 1,
              style: LineStyle.Dotted,
              visible: true,
              labelVisible: true,
              labelBackgroundColor: '#4f46e5'
            },
            horzLine: {
              visible: false,
              labelVisible: true,
              labelBackgroundColor: '#4f46e5'
            }
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: {
              time: true,
              price: true
            },
            axisDoubleClickReset: {
              time: true,
              price: true
            }
          },
          rightPriceScale: {
            borderColor: borderColor,
            visible: true,
            autoScale: true,
            scaleMargins: {
              top: 0.08,
              bottom: 0.22
            }
          },
          timeScale: {
            borderColor: borderColor,
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: false,
            fixRightEdge: false,
            shiftVisibleRangeOnNewBar: true,
            rightOffset: 12,
            barSpacing: 10,
            minBarSpacing: 0.5
          }
        });

        // Re-render drawings on time scale changes (pan/zoom)
        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          this.renderDrawings();
        });
        this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          this.renderDrawings();
        });

        // Track crosshair move for dynamic OHLC display
        this.chart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.point) {
            const latest = candles[candles.length - 1];
            if (latest) {
              this.hoveredBar.set({
                timeStr: this.formatBarDateTime(latest.datetime || latest.timestamp),
                open: latest.open,
                high: latest.high,
                low: latest.low,
                close: latest.close,
                volume: latest.volume
              });
            }
            return;
          }

          let bar: any = null;
          if (this.candlestickSeries && param.seriesData.has(this.candlestickSeries)) {
            bar = param.seriesData.get(this.candlestickSeries);
          } else if (this.lineSeries && param.seriesData.has(this.lineSeries)) {
            bar = param.seriesData.get(this.lineSeries);
          } else if (this.areaSeries && param.seriesData.has(this.areaSeries)) {
            bar = param.seriesData.get(this.areaSeries);
          }

          if (bar) {
            let vol: number | null = null;
            if (this.volumeSeries && param.seriesData.has(this.volumeSeries)) {
              const vData: any = param.seriesData.get(this.volumeSeries);
              vol = vData?.value ?? null;
            }

            this.hoveredBar.set({
              timeStr: this.formatBarDateTime(param.time),
              open: bar.open ?? bar.value ?? 0,
              high: bar.high ?? bar.value ?? 0,
              low: bar.low ?? bar.value ?? 0,
              close: bar.close ?? bar.value ?? 0,
              volume: vol
            });
          }
        });

        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          this.syncDrawingCoordinates();
        });
        this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          this.syncDrawingCoordinates();
        });

        // Auto-resize observer
        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !this.chart) return;
            const { width, height } = entries[0].contentRect;
            this.chart.applyOptions({ width, height: height || 460 });
            setTimeout(() => this.syncDrawingCoordinates(), 30);
          });
          this.resizeObserver.observe(container);
        }
      }

      // Prepare Series Data
      const candleData: CandlestickData<Time>[] = candles.map(c => ({
        time: (c.timestamp as unknown) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

      const lineData: LineData<Time>[] = candles.map(c => ({
        time: (c.timestamp as unknown) as Time,
        value: c.close
      }));

      const volumeData: HistogramData<Time>[] = candles.map(c => ({
        time: (c.timestamp as unknown) as Time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'
      }));

      // Remove existing series
      if (this.candlestickSeries) {
        this.chart.removeSeries(this.candlestickSeries);
        this.candlestickSeries = null;
      }
      if (this.lineSeries) {
        this.chart.removeSeries(this.lineSeries);
        this.lineSeries = null;
      }
      if (this.areaSeries) {
        this.chart.removeSeries(this.areaSeries);
        this.areaSeries = null;
      }
      if (this.volumeSeries) {
        this.chart.removeSeries(this.volumeSeries);
        this.volumeSeries = null;
      }

      // Add Volume Series
      this.volumeSeries = this.chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: ''
      });
      this.volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0
        }
      });
      this.volumeSeries.setData(volumeData);

      // Add Main Chart Series
      if (chartType === 'candles') {
        this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#f43f5e',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#f43f5e'
        });
        this.candlestickSeries.setData(candleData);
      } else if (chartType === 'line') {
        this.lineSeries = this.chart.addSeries(LineSeries, {
          color: '#6366f1',
          lineWidth: 2
        });
        this.lineSeries.setData(lineData);
      } else if (chartType === 'area') {
        this.areaSeries = this.chart.addSeries(AreaSeries, {
          topColor: 'rgba(99, 102, 241, 0.4)',
          bottomColor: 'rgba(99, 102, 241, 0.02)',
          lineColor: '#6366f1',
          lineWidth: 2
        });
        this.areaSeries.setData(lineData);
      }

      const latest = candles[candles.length - 1];
      if (latest) {
        this.hoveredBar.set({
          timeStr: this.formatBarDateTime(latest.datetime || latest.timestamp),
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
          volume: latest.volume
        });
      }

      this.renderAllIndicators();
      this.chart.timeScale().fitContent();

      // Sync and render drawing overlay
      setTimeout(() => this.syncDrawingCoordinates(), 50);
    } catch (e) {
      // ignore headless test environments
    }
  }

  formatBarDateTime(timeVal: any): string {
    if (!timeVal) return '';
    if (typeof timeVal === 'number') {
      const d = new Date(timeVal * 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (typeof timeVal === 'object' && timeVal !== null && 'year' in timeVal) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const h = 'hour' in timeVal ? ` ${pad((timeVal as any).hour)}:${pad((timeVal as any).minute)}:${pad((timeVal as any).second || 0)}` : ' 00:00:00';
      return `${timeVal.year}-${pad(timeVal.month)}-${pad(timeVal.day)}${h}`;
    }
    if (typeof timeVal === 'string') {
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeVal)) {
        return timeVal;
      }
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(timeVal)) {
        return `${timeVal}:00`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(timeVal)) {
        return `${timeVal} 00:00:00`;
      }
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
      return timeVal;
    }
    return String(timeVal);
  }

  // =========================================================================
  // DRAWING ENGINE (SYNCED WITH STOCK DETAILS)
  // =========================================================================


  // Compatibility stubs
  syncCanvasSize(): void {
    this.syncDrawingCoordinates();
  }

  renderDrawings(): void {
    this.syncDrawingCoordinates();
  }

  getGroupById(groupId: string): DrawingToolGroup | undefined {
    return this.drawingToolGroups().find(g => g.id === groupId);
  }

  closeFlyout(event?: Event): void {
    if (event) event.stopPropagation();
    this.openToolGroupId.set(null);
  }

  selectToolGroup(groupId: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.openToolGroupId() === groupId) {
      this.openToolGroupId.set(null);
    } else {
      this.openToolGroupId.set(groupId);
      this.isIndicatorModalOpen.set(false);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      if (this.selectedDrawingId()) {
        this.deleteSelectedDrawing();
      }
    } else if (event.key === 'Escape') {
      this.cancelCurrentDrawing();
    }
  }

  cancelCurrentDrawing(): void {
    this.activeDrawingTool.set(null);
    this.isDrawingActive.set(false);
    this.inProgressPoints.set([]);
    this.selectedDrawingId.set(null);
  }

  saveDrawingsForSymbol(sym?: string): void {
    if (typeof localStorage === 'undefined') return;
    const targetSym = sym || this.selectedSymbol();
    if (!targetSym) return;
    try {
      localStorage.setItem('market_drawings_' + targetSym.toUpperCase(), JSON.stringify(this.drawings()));
    } catch (e) {}
  }

  loadDrawingsForSymbol(sym?: string): void {
    if (typeof localStorage === 'undefined') return;
    const targetSym = sym || this.selectedSymbol();
    if (!targetSym) return;
    try {
      const saved = localStorage.getItem('market_drawings_' + targetSym.toUpperCase());
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.drawings.set(parsed);
          setTimeout(() => this.syncDrawingCoordinates(), 50);
          return;
        }
      }
    } catch (e) {}
    this.drawings.set([]);
  }

  syncDrawingCoordinates(): void {
    const activeSer = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (!activeSer || !this.chart) return;

    this.drawings.update(list => list.map(d => {
      const updatedPoints = d.points.map(pt => {
        let newX = pt.x;
        let newY = pt.y;

        if (pt.price != null && typeof (activeSer as any).priceToCoordinate === 'function') {
          const coordY = (activeSer as any).priceToCoordinate(pt.price);
          if (coordY != null && !isNaN(coordY)) {
            newY = coordY;
          }
        }

        let coordX: number | null = null;
        if (pt.time != null) {
          coordX = this.chart?.timeScale().timeToCoordinate(pt.time as any) ?? null;
          if (coordX == null && typeof pt.time === 'string') {
            try {
              const parsedDate = new Date(pt.time);
              if (!isNaN(parsedDate.getTime())) {
                const ts = Math.floor(parsedDate.getTime() / 1000);
                coordX = this.chart?.timeScale().timeToCoordinate(ts as any) ?? null;
              }
            } catch (e) {}
          }
        }

        if ((coordX == null || isNaN(coordX)) && pt.logical != null) {
          coordX = this.chart?.timeScale().logicalToCoordinate(pt.logical as any) ?? null;
        }

        if (coordX != null && !isNaN(coordX)) {
          newX = coordX;
        }

        return { ...pt, x: newX, y: newY };
      });
      return { ...d, points: updatedPoints };
    }));
  }

  selectEmojiMarkerItem(text: string, type: 'emoji' | 'sticker' | 'icon', event?: Event): void {
    if (event) event.stopPropagation();
    this.activeEmojiMarker.set({ text, type });
    this.activeDrawingTool.set({
      id: 'emoji_marker',
      name: text,
      pointsRequired: 1,
      icon: text
    });
    this.activeToolGroupId.set('emoji_stickers');
    this.openToolGroupId.set(null);
  }

  activateMeasureTool(event?: Event): void {
    if (event) event.stopPropagation();
    this.activeDrawingTool.set({
      id: 'measure',
      name: 'Measure',
      pointsRequired: 2,
      icon: '📏'
    });
    this.activeToolGroupId.set('measure');
    this.openToolGroupId.set(null);
    this.inProgressPoints.set([]);
    this.isDrawingActive.set(false);
    this.selectedDrawingId.set(null);
  }

  zoomInChart(event?: Event): void {
    if (event) event.stopPropagation();
    if (this.chart) {
      const timeScale = this.chart.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        const delta = (range.to - range.from) * 0.2;
        timeScale.setVisibleLogicalRange({ from: range.from + delta, to: range.to - delta });
      }
    }
  }

  confirmClearAllDrawings(event?: Event): void {
    if (event) event.stopPropagation();
    const count = this.drawings().length;
    if (count === 0) return;
    if (confirm(`Delete all ${count} drawings from the chart?`)) {
      this.clearAllDrawings();
    }
  }

  getPointWithMagnet(x: number, y: number): { x: number; y: number; priceVal?: number; timeVal?: any; logicalVal?: number } {
    let priceVal: number | undefined = undefined;
    let timeVal: any = undefined;
    let logicalVal: number | undefined = undefined;
    let finalX = x;
    let finalY = y;

    const activeSer = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (activeSer && typeof (activeSer as any).coordinateToPrice === 'function') {
      priceVal = (activeSer as any).coordinateToPrice(y) ?? undefined;
    }
    if (!priceVal && this.currentQuote()) {
      priceVal = this.currentQuote()?.price;
    }
    if (this.chart) {
      try {
        const rawTime: any = this.chart.timeScale().coordinateToTime(x);
        if (typeof rawTime === 'object' && rawTime !== null && rawTime.year) {
          timeVal = `${rawTime.year}-${String(rawTime.month).padStart(2, '0')}-${String(rawTime.day).padStart(2, '0')}`;
        } else {
          timeVal = rawTime ?? undefined;
        }
        logicalVal = this.chart.timeScale().coordinateToLogical(x) ?? undefined;
      } catch (e) {}
    }

    if (this.isMagnetEnabled() && this.candleData().length > 0 && this.chart && activeSer) {
      const candles = this.candleData();
      let closestCandle: Candle | null = null;
      let minDistance = Infinity;

      for (const c of candles) {
        try {
          const rawTs = (c as any).timestamp ?? (c as any).time;
          const cTime = typeof rawTs === 'string' ? Math.floor(new Date(rawTs).getTime() / 1000) : rawTs;
          if (cTime) {
            const cx = this.chart.timeScale().timeToCoordinate(cTime as any);
            if (cx !== null) {
              const dist = Math.abs(cx - x);
              if (dist < minDistance && dist < 60) {
                minDistance = dist;
                closestCandle = c;
                finalX = cx;
                timeVal = cTime;
              }
            }
          }
        } catch (e) {}
      }

      if (closestCandle && priceVal !== undefined) {
        const o = closestCandle.open;
        const h = closestCandle.high;
        const l = closestCandle.low;
        const cl = closestCandle.close;
        const ohlc = [o, h, l, cl];
        let nearestOhlc = ohlc[0];
        let minPriceDiff = Math.abs(priceVal - nearestOhlc);
        for (const p of ohlc) {
          const diff = Math.abs(priceVal - p);
          if (diff < minPriceDiff) {
            minPriceDiff = diff;
            nearestOhlc = p;
          }
        }
        priceVal = nearestOhlc;
        try {
          const cy = (activeSer as any).priceToCoordinate(nearestOhlc);
          if (cy !== null && cy !== undefined) {
            finalY = cy;
          }
        } catch (e) {}
      }
    }

    return { x: finalX, y: finalY, priceVal, timeVal, logicalVal };
  }

  selectDrawingTool(groupOrTool: any, toolOption?: DrawingToolOption, event?: Event): void {
    if (event) event.stopPropagation();

    let group: DrawingToolGroup | undefined;
    let tool: DrawingToolOption;

    if (toolOption) {
      group = groupOrTool as DrawingToolGroup;
      tool = toolOption;
    } else if (typeof groupOrTool === 'string') {
      const foundGroup = this.drawingToolGroups().find((g: DrawingToolGroup) => g.tools.some((t: DrawingToolOption) => t.id === groupOrTool));
      const foundTool = foundGroup?.tools.find((t: DrawingToolOption) => t.id === groupOrTool);
      if (foundGroup && foundTool) {
        group = foundGroup;
        tool = foundTool;
      } else {
        tool = { id: groupOrTool, name: groupOrTool, pointsRequired: 2, icon: '✏️' };
      }
    } else {
      tool = groupOrTool;
    }

    if (group) {
      group.activeToolId = tool.id;
      this.activeToolGroupId.set(group.id);
    }
    this.openToolGroupId.set(null);

    if (tool.id === 'crosshair' || tool.id === 'cursor' || tool.id === 'dot') {
      this.activeDrawingTool.set(null);
      this.inProgressPoints.set([]);
      this.isDrawingActive.set(false);
      return;
    }

    if (tool.id === 'eraser' || tool.id === 'delete_drawings') {
      this.clearAllDrawings();
      this.activeDrawingTool.set(null);
      return;
    }

    if (tool.id === 'zoom_in') {
      this.zoomInChart();
      return;
    }

    if (tool.id === 'zoom_out') {
      if (this.chart) {
        const timeScale = this.chart.timeScale();
        const range = timeScale.getVisibleLogicalRange();
        if (range) {
          const delta = (range.to - range.from) * 0.25;
          timeScale.setVisibleLogicalRange({ from: range.from - delta, to: range.to + delta });
        }
      }
      return;
    }

    if (tool.id === 'lock_drawings') {
      this.toggleLockDrawings();
      return;
    }

    if (tool.id === 'hide_drawings') {
      this.toggleHideDrawings();
      return;
    }

    if (tool.id === 'magnet') {
      this.toggleMagnet();
      return;
    }

    this.activeDrawingTool.set(tool);
    this.inProgressPoints.set([]);
    this.isDrawingActive.set(false);
    this.selectedDrawingId.set(null);
  }

  onDrawingSvgMouseDown(event: MouseEvent): void {
    if (this.areDrawingsLocked()) return;
    const tool = this.activeDrawingTool();

    const svg = this.drawingSvgRef()?.nativeElement;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;

    if (!tool) {
      if ((event.target as HTMLElement).tagName === 'svg') {
        this.selectedDrawingId.set(null);
      } else {
        const selDrawing = this.selectedDrawing();
        if (selDrawing) {
          this.isDraggingDrawing.set(true);
          this.dragStartMouse = { x: rawX, y: rawY };
          this.initialDragPoints = selDrawing.points.map(p => ({ ...p }));
        }
      }
      return;
    }

    const { x, y, priceVal, timeVal, logicalVal } = this.getPointWithMagnet(rawX, rawY);

    const newPt: DrawingPoint = { x, y, price: priceVal, time: timeVal, logical: logicalVal };
    const currSym = this.formatCurrencySymbol(this.selectedSymbol());
    const formattedPrice = priceVal ? `${currSym}${priceVal.toFixed(2)}` : `${currSym}0.00`;

    if (tool.id === 'emoji_marker') {
      const markerInfo = this.activeEmojiMarker();
      const newItem: DrawingItem = {
        id: 'draw_' + Date.now(),
        toolId: 'emoji_marker',
        category: 'emoji_stickers',
        name: markerInfo.text,
        points: [newPt],
        color: this.activeColor(),
        fillColor: this.activeColor() + '22',
        lineWidth: this.activeLineWidth(),
        lineStyle: 'solid',
        text: markerInfo.text,
        extraStats: markerInfo.type,
        price: priceVal
      };
      this.drawings.update(list => [...list, newItem]);
      this.saveDrawingsForSymbol();
      this.selectedDrawingId.set(newItem.id);
      this.activeDrawingTool.set(null);
      this.isDrawingActive.set(false);
      this.inProgressPoints.set([]);
      return;
    }

    if (tool.pointsRequired === 1) {
      let defaultText: string | undefined = undefined;
      if (tool.id === 'text') defaultText = 'Text Annotation';
      else if (tool.id === 'anchored_text') defaultText = 'Anchored Note';
      else if (tool.id === 'note') defaultText = 'Memo Note';
      else if (tool.id === 'price_note') defaultText = `${formattedPrice} — Key Level`;
      else if (tool.id === 'price_label') defaultText = formattedPrice;
      else if (tool.id === 'pin') defaultText = 'Key Pivot';
      else if (tool.id === 'table') defaultText = 'Metric: Entry | Value: ' + formattedPrice;
      else if (tool.id === 'comment') defaultText = 'Trade Comment';
      else if (tool.id === 'signpost') defaultText = 'Bullish Zone';
      else if (tool.id === 'flag_mark') defaultText = 'Target 1';
      else if (tool.id === 'anchored_vwap') defaultText = 'VWAP';

      const newItem: DrawingItem = {
        id: 'draw_' + Date.now(),
        toolId: tool.id,
        category: this.activeToolGroupId(),
        name: tool.name,
        points: [newPt],
        color: this.activeColor(),
        fillColor: this.activeColor() + '22',
        lineWidth: this.activeLineWidth(),
        lineStyle: 'solid',
        text: defaultText,
        price: priceVal
      };
      this.drawings.update(list => [...list, newItem]);
      this.saveDrawingsForSymbol();
      this.selectedDrawingId.set(newItem.id);
      this.activeDrawingTool.set(null);
      this.isDrawingActive.set(false);
      this.inProgressPoints.set([]);
      return;
    }

    if (!this.isDrawingActive()) {
      this.isDrawingActive.set(true);
      this.inProgressPoints.set([newPt, { ...newPt }]);
    } else {
      const currentPts = this.inProgressPoints();
      if (tool.pointsRequired > 0 && currentPts.length >= tool.pointsRequired) {
        const finalPts = [...currentPts.slice(0, -1), newPt];
        const newItem: DrawingItem = {
          id: 'draw_' + Date.now(),
          toolId: tool.id,
          category: this.activeToolGroupId(),
          name: tool.name,
          points: finalPts,
          color: this.activeColor(),
          fillColor: this.activeColor() + '22',
          lineWidth: this.activeLineWidth(),
          lineStyle: 'solid',
          text: tool.id === 'callout' ? 'Callout Note' : undefined,
          price: priceVal
        };
        this.drawings.update(list => [...list, newItem]);
        this.saveDrawingsForSymbol();
        this.selectedDrawingId.set(newItem.id);
        this.activeDrawingTool.set(null);
        this.isDrawingActive.set(false);
        this.inProgressPoints.set([]);
      } else {
        this.inProgressPoints.update(pts => [...pts, { ...newPt }]);
      }
    }
  }

  onDrawingSvgMouseMove(event: MouseEvent): void {
    const svg = this.drawingSvgRef()?.nativeElement;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isDraggingDrawing() && this.selectedDrawingId()) {
      const dx = x - this.dragStartMouse.x;
      const dy = y - this.dragStartMouse.y;
      const selId = this.selectedDrawingId();
      const activeSer = this.candlestickSeries || this.lineSeries || this.areaSeries;

      this.drawings.update(list => list.map(d => {
        if (d.id !== selId) return d;
        const newPoints = this.initialDragPoints.map(p => {
          const nx = p.x + dx;
          const ny = p.y + dy;
          let newPrice = p.price;
          let newTime = p.time;
          let newLogical = p.logical;
          if (activeSer && typeof (activeSer as any).coordinateToPrice === 'function') {
            newPrice = (activeSer as any).coordinateToPrice(ny) ?? p.price;
          }
          if (this.chart) {
            try {
              const rawT: any = this.chart.timeScale().coordinateToTime(nx);
              if (typeof rawT === 'object' && rawT !== null && rawT.year) {
                newTime = `${rawT.year}-${String(rawT.month).padStart(2, '0')}-${String(rawT.day).padStart(2, '0')}`;
              } else {
                newTime = rawT ?? p.time;
              }
              newLogical = this.chart.timeScale().coordinateToLogical(nx) ?? p.logical;
            } catch (e) {}
          }
          return { x: nx, y: ny, price: newPrice, time: newTime, logical: newLogical };
        });
        return { ...d, points: newPoints };
      }));
      return;
    }

    if (!this.isDrawingActive()) return;

    const tool = this.activeDrawingTool();
    if (tool && tool.pointsRequired === -1) {
      this.inProgressPoints.update(pts => [...pts, { x, y }]);
    } else {
      this.inProgressPoints.update(pts => {
        if (pts.length === 0) return pts;
        const copy = [...pts];
        copy[copy.length - 1] = { x, y };
        return copy;
      });
    }
  }

  onDrawingSvgMouseUp(event: MouseEvent): void {
    if (this.isDraggingDrawing()) {
      this.isDraggingDrawing.set(false);
      this.saveDrawingsForSymbol();
      return;
    }

    const tool = this.activeDrawingTool();
    if (!tool || !this.isDrawingActive()) return;

    const svg = this.drawingSvgRef()?.nativeElement;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let priceVal: number | undefined = undefined;
    let timeVal: any = undefined;
    let logicalVal: number | undefined = undefined;

    const activeSer = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (activeSer && typeof (activeSer as any).coordinateToPrice === 'function') {
      priceVal = (activeSer as any).coordinateToPrice(y) ?? undefined;
    }
    if (this.chart) {
      try {
        const rawT: any = this.chart.timeScale().coordinateToTime(x);
        if (typeof rawT === 'object' && rawT !== null && rawT.year) {
          timeVal = `${rawT.year}-${String(rawT.month).padStart(2, '0')}-${String(rawT.day).padStart(2, '0')}`;
        } else {
          timeVal = rawT ?? undefined;
        }
        logicalVal = this.chart.timeScale().coordinateToLogical(x) ?? undefined;
      } catch (e) {}
    }

    if (tool.pointsRequired === -1) {
      const pts = this.inProgressPoints();
      if (pts.length > 2) {
        const newItem: DrawingItem = {
          id: 'draw_' + Date.now(),
          toolId: tool.id,
          category: this.activeToolGroupId(),
          name: tool.name,
          points: pts,
          color: tool.id === 'highlighter' ? this.activeColor() + '66' : this.activeColor(),
          fillColor: 'transparent',
          lineWidth: tool.id === 'highlighter' ? 12 : this.activeLineWidth(),
          lineStyle: 'solid'
        };
        this.drawings.update(list => [...list, newItem]);
        this.saveDrawingsForSymbol();
        this.selectedDrawingId.set(newItem.id);
      }
      this.activeDrawingTool.set(null);
      this.isDrawingActive.set(false);
      this.inProgressPoints.set([]);
      return;
    }

    if (tool.pointsRequired === 2) {
      const pts = this.inProgressPoints();
      if (pts.length >= 2) {
        const dist = Math.hypot(x - pts[0].x, y - pts[0].y);
        if (dist > 6) {
          const p1 = pts[0];
          const p2 = { x, y, price: priceVal, time: timeVal, logical: logicalVal };
          const newItem: DrawingItem = {
            id: 'draw_' + Date.now(),
            toolId: tool.id,
            category: this.activeToolGroupId(),
            name: tool.name,
            points: [p1, p2],
            color: this.activeColor(),
            fillColor: this.activeColor() + '22',
            lineWidth: this.activeLineWidth(),
            lineStyle: 'solid'
          };
          this.drawings.update(list => [...list, newItem]);
          this.saveDrawingsForSymbol();
          this.selectedDrawingId.set(newItem.id);
          this.activeDrawingTool.set(null);
          this.isDrawingActive.set(false);
          this.inProgressPoints.set([]);
        }
      }
    }
  }

  selectDrawing(item: DrawingItem, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.areDrawingsLocked()) return;
    this.selectedDrawingId.set(item.id);
  }

  deleteSelectedDrawing(): void {
    const selId = this.selectedDrawingId();
    if (!selId) return;
    this.drawings.update(list => list.filter(d => d.id !== selId));
    this.saveDrawingsForSymbol();
    this.selectedDrawingId.set(null);
  }

  clearAllDrawings(): void {
    this.drawings.set([]);
    this.saveDrawingsForSymbol();
    this.selectedDrawingId.set(null);
    this.inProgressPoints.set([]);
    this.isDrawingActive.set(false);
  }

  toggleLockDrawings(event?: Event): void {
    if (event) event.stopPropagation();
    this.areDrawingsLocked.update(v => !v);
  }

  toggleHideDrawings(event?: Event): void {
    if (event) event.stopPropagation();
    this.areDrawingsHidden.update(v => !v);
  }

  toggleMagnet(event?: Event): void {
    if (event) event.stopPropagation();
    this.isMagnetEnabled.update(v => !v);
  }

  setDrawingColor(color: string): void {
    this.activeColor.set(color);
    const selId = this.selectedDrawingId();
    if (selId) {
      this.drawings.update(list => list.map(d => d.id === selId ? { ...d, color: color, fillColor: color + '22' } : d));
      this.saveDrawingsForSymbol();
    }
  }

  setDrawingLineWidth(width: number): void {
    this.activeLineWidth.set(width);
    const selId = this.selectedDrawingId();
    if (selId) {
      this.drawings.update(list => list.map(d => d.id === selId ? { ...d, lineWidth: width } : d));
      this.saveDrawingsForSymbol();
    }
  }

  updateSelectedDrawingText(text: string): void {
    const selId = this.selectedDrawingId();
    if (!selId) return;
    this.drawings.update(list => list.map(d => d.id === selId ? { ...d, text } : d));
    this.saveDrawingsForSymbol();
  }

  onDrawingDoubleClick(d: DrawingItem, event: MouseEvent): void {
    event.stopPropagation();
    const promptText = prompt('Edit annotation text / value:', d.text || '');
    if (promptText !== null) {
      this.drawings.update(list => list.map(item => item.id === d.id ? { ...item, text: promptText } : item));
      this.saveDrawingsForSymbol();
    }
  }

  getForecast(d: DrawingItem): { x1: number; y1: number; x2: number; y2: number; cone: string; targetPrice: string; changePct: string } {
    if (!d.points || d.points.length < 2) return { x1: 0, y1: 0, x2: 0, y2: 0, cone: '', targetPrice: '0.00', changePct: '0.00%' };
    const p1 = d.points[0];
    const p2 = d.points[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const spread = Math.max(15, Math.abs(dx) * 0.35);
    const cone = `${p1.x},${p1.y} ${p2.x},${p2.y - spread} ${p2.x},${p2.y + spread}`;
    const price1 = d.points[0].price || 0;
    const price2 = d.points[1].price || 0;
    const pct = price1 > 0 ? (((price2 - price1) / price1) * 100).toFixed(2) : '0.00';
    return {
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      cone,
      targetPrice: price2.toFixed(2),
      changePct: `${Number(pct) >= 0 ? '+' : ''}${pct}%`
    };
  }

  getDateRange(d: DrawingItem): { x: number; y: number; w: number; h: number; bars: number; timeText: string } {
    if (!d.points || d.points.length < 2) return { x: 0, y: 0, w: 0, h: 0, bars: 0, timeText: '' };
    const p1 = d.points[0];
    const p2 = d.points[1];
    const x = Math.min(p1.x, p2.x);
    const w = Math.max(10, Math.abs(p2.x - p1.x));
    const bars = Math.max(1, Math.round(w / 10));
    return { x, y: 0, w, h: 2000, bars, timeText: `${bars} bars` };
  }

  getPriceRange(d: DrawingItem): { x: number; y: number; w: number; h: number; deltaPrice: string; deltaPct: string; isPositive: boolean } {
    if (!d.points || d.points.length < 2) return { x: 0, y: 0, w: 0, h: 0, deltaPrice: '0.00', deltaPct: '0.00%', isPositive: true };
    const p1 = d.points[0];
    const p2 = d.points[1];
    const y = Math.min(p1.y, p2.y);
    const h = Math.max(10, Math.abs(p2.y - p1.y));
    const price1 = p1.price || 0;
    const price2 = p2.price || 0;
    const dp = price2 - price1;
    const pct = price1 > 0 ? (dp / price1) * 100 : 0;
    return {
      x: 0,
      y,
      w: 3000,
      h,
      deltaPrice: (dp >= 0 ? '+' : '') + dp.toFixed(2),
      deltaPct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
      isPositive: dp >= 0
    };
  }

  getDatePriceRange(d: DrawingItem): { x: number; y: number; w: number; h: number; deltaPrice: string; deltaPct: string; bars: number; isPositive: boolean } {
    if (!d.points || d.points.length < 2) return { x: 0, y: 0, w: 0, h: 0, deltaPrice: '0.00', deltaPct: '0.00%', bars: 0, isPositive: true };
    const p1 = d.points[0];
    const p2 = d.points[1];
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.max(10, Math.abs(p2.x - p1.x));
    const h = Math.max(10, Math.abs(p2.y - p1.y));
    const price1 = p1.price || 0;
    const price2 = p2.price || 0;
    const dp = price2 - price1;
    const pct = price1 > 0 ? (dp / price1) * 100 : 0;
    const bars = Math.max(1, Math.round(w / 10));
    return {
      x,
      y,
      w,
      h,
      deltaPrice: (dp >= 0 ? '+' : '') + dp.toFixed(2),
      deltaPct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
      bars,
      isPositive: dp >= 0
    };
  }

  getVolumeProfile(d: DrawingItem): { x: number; y: number; w: number; h: number; pocY: number; bars: { y: number; w1: number; w2: number }[] } {
    if (!d.points || d.points.length < 2) return { x: 0, y: 0, w: 0, h: 0, pocY: 0, bars: [] };
    const p1 = d.points[0];
    const p2 = d.points[1];
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.max(20, Math.abs(p2.x - p1.x));
    const h = Math.max(20, Math.abs(p2.y - p1.y));
    const rowCount = 8;
    const rowH = h / rowCount;
    const bars: { y: number; w1: number; w2: number }[] = [];
    const midRow = Math.floor(rowCount / 2);
    for (let i = 0; i < rowCount; i++) {
      const dist = Math.abs(i - midRow);
      const intensity = Math.max(0.2, 1 - (dist / rowCount));
      const totalW = (w * 0.85) * intensity;
      const w1 = totalW * 0.55;
      const w2 = totalW * 0.45;
      bars.push({ y: y + i * rowH, w1, w2 });
    }
    const pocY = y + midRow * rowH + rowH / 2;
    return { x, y, w, h, pocY, bars };
  }

  getAnchoredVwap(d: DrawingItem): { x1: number; y1: number; path: string; label: string } {
    if (!d.points || d.points.length < 1) return { x1: 0, y1: 0, path: '', label: 'VWAP' };
    const p1 = d.points[0];
    const width = 3000;
    const path = `M ${p1.x} ${p1.y} C ${p1.x + 100} ${p1.y + 5}, ${p1.x + 250} ${p1.y - 10}, ${p1.x + width} ${p1.y - 15}`;
    const currSym = this.formatCurrencySymbol(this.selectedSymbol());
    const priceStr = d.points[0].price ? `${currSym}${d.points[0].price.toFixed(2)}` : 'VWAP';
    return { x1: p1.x, y1: p1.y, path, label: `Anchored VWAP (${priceStr})` };
  }

  getMeasureData(d: DrawingItem): { x: number; y: number; w: number; h: number; deltaPrice: string; deltaPct: string; bars: number; pxDist: number; isPositive: boolean } {
    if (!d.points || d.points.length < 2) return { x: 0, y: 0, w: 0, h: 0, deltaPrice: '0.00', deltaPct: '0.00%', bars: 0, pxDist: 0, isPositive: true };
    const p1 = d.points[0];
    const p2 = d.points[1];
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.max(10, Math.abs(p2.x - p1.x));
    const h = Math.max(10, Math.abs(p2.y - p1.y));
    const price1 = p1.price || 0;
    const price2 = p2.price || 0;
    const dp = price2 - price1;
    const pct = price1 > 0 ? (dp / price1) * 100 : 0;
    const bars = Math.max(1, Math.round(w / 10));
    const pxDist = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));
    return {
      x,
      y,
      w,
      h,
      deltaPrice: (dp >= 0 ? '+' : '') + dp.toFixed(2),
      deltaPct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
      bars,
      pxDist,
      isPositive: dp >= 0
    };
  }

  getCalloutPath(d: DrawingItem): { bubble: { x: number; y: number; w: number; h: number }; pointer: string } {
    if (!d.points || d.points.length < 2) {
      const p = d.points?.[0] || { x: 0, y: 0 };
      return { bubble: { x: p.x + 20, y: p.y - 40, w: 120, h: 36 }, pointer: '' };
    }
    const p0 = d.points[0]; // Target point
    const p1 = d.points[1]; // Bubble position
    const w = Math.max(100, Math.min(220, (d.text?.length || 12) * 8 + 24));
    const h = 38;
    const bubble = { x: p1.x, y: p1.y, w, h };

    const pointer = `M ${p0.x} ${p0.y} L ${p1.x + 10} ${p1.y + h} L ${p1.x + 25} ${p1.y + h} Z`;
    return { bubble, pointer };
  }

  getTableRows(d: DrawingItem): { metric: string; val: string }[] {
    const text = d.text || 'Metric: Entry | Value: $150';
    if (text.includes('\n')) {
      return text.split('\n').map(line => {
        const parts = line.split(/[:|]/).map(s => s.trim());
        return { metric: parts[0] || 'Key', val: parts[1] || '-' };
      });
    }
    const parts = text.split('|').map(s => s.trim());
    return parts.map(p => {
      const sub = p.split(':').map(s => s.trim());
      return { metric: sub[0] || 'Metric', val: sub[1] || '-' };
    });
  }

  getPointsPolyline(points: DrawingPoint[]): string {
    if (!points || points.length === 0) return '';
    return points.map(p => `${p.x},${p.y}`).join(' ');
  }

  getRayEnd(p1: DrawingPoint, p2: DrawingPoint, width = 3000): { x: number; y: number } {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: p2.x, y: p2.y };
    return {
      x: p1.x + (dx / len) * width,
      y: p1.y + (dy / len) * width
    };
  }

  getExtendedLinePoints(p1: DrawingPoint, p2: DrawingPoint, width = 3000): { x1: number; y1: number; x2: number; y2: number } {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    return {
      x1: p1.x - (dx / len) * width,
      y1: p1.y - (dy / len) * width,
      x2: p1.x + (dx / len) * width,
      y2: p1.y + (dy / len) * width
    };
  }

  getTrendAngle(p1: DrawingPoint, p2: DrawingPoint): number {
    const dx = p2.x - p1.x;
    const dy = -(p2.y - p1.y);
    const rad = Math.atan2(dy, dx);
    const deg = Math.round((rad * 180) / Math.PI);
    return deg;
  }

  getFibLevels(d: DrawingItem): { y: number; pct: string; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const y1 = d.points[0].y;
    const y2 = d.points[1].y;
    const dy = y2 - y1;
    const ratios = [
      { r: 0, pct: '0.0%', color: '#64748b' },
      { r: 0.236, pct: '23.6%', color: '#ef4444' },
      { r: 0.382, pct: '38.2%', color: '#f59e0b' },
      { r: 0.5, pct: '50.0%', color: '#10b981' },
      { r: 0.618, pct: '61.8%', color: '#06b6d4' },
      { r: 0.786, pct: '78.6%', color: '#3b82f6' },
      { r: 1.0, pct: '100.0%', color: '#8b5cf6' }
    ];
    return ratios.map(item => ({
      y: y1 + dy * item.r,
      pct: item.pct,
      color: item.color
    }));
  }

  getFibExtensionLevels(d: DrawingItem): { y: number; pct: string; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const p3 = d.points[2] || p2;
    const swing = p2.y - p1.y;
    const ratios = [
      { r: 0.382, pct: '38.2%', color: '#f59e0b' },
      { r: 0.618, pct: '61.8%', color: '#06b6d4' },
      { r: 1.0, pct: '100.0%', color: '#10b981' },
      { r: 1.618, pct: '161.8%', color: '#3b82f6' },
      { r: 2.618, pct: '261.8%', color: '#8b5cf6' }
    ];
    return ratios.map(item => ({
      y: p3.y + swing * item.r,
      pct: item.pct,
      color: item.color
    }));
  }

  getFibChannelLines(d: DrawingItem): { p1: DrawingPoint; p2: DrawingPoint; color: string; label: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const p3 = d.points[2] || { x: p1.x + 40, y: p1.y + 40 };
    const ox = p3.x - p1.x;
    const oy = p3.y - p1.y;
    const ratios = [
      { r: 0, label: '0.0', color: '#64748b' },
      { r: 0.5, label: '0.5', color: '#10b981' },
      { r: 0.618, label: '0.618', color: '#06b6d4' },
      { r: 1.0, label: '1.0', color: '#3b82f6' },
      { r: 1.618, label: '1.618', color: '#8b5cf6' }
    ];
    return ratios.map(item => ({
      p1: { x: p1.x + ox * item.r, y: p1.y + oy * item.r },
      p2: { x: p2.x + ox * item.r, y: p2.y + oy * item.r },
      color: item.color,
      label: item.label
    }));
  }

  getFibTimeZones(d: DrawingItem): { x: number; label: string; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const dx = Math.max(15, Math.abs(p2.x - p1.x));
    const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34];
    return fibs.map(f => ({
      x: p1.x + dx * f,
      label: String(f),
      color: f === 0 ? '#64748b' : f % 2 === 0 ? '#3b82f6' : '#10b981'
    }));
  }

  getFibSpeedFans(d: DrawingItem): { x2: number; y2: number; label: string; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const ratios = [
      { r: 0.382, label: '0.382', color: '#f59e0b' },
      { r: 0.5, label: '0.5', color: '#10b981' },
      { r: 0.618, label: '0.618', color: '#06b6d4' },
      { r: 0.786, label: '0.786', color: '#3b82f6' }
    ];
    return ratios.map(item => ({
      x2: p1.x + dx * 2,
      y2: p1.y + dy * item.r * 2,
      label: item.label,
      color: item.color
    }));
  }

  getFibTrendTimes(d: DrawingItem): { x: number; label: string; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const dx = p2.x - p1.x;
    const ratios = [
      { r: 0.382, label: '38.2%', color: '#f59e0b' },
      { r: 0.5, label: '50.0%', color: '#10b981' },
      { r: 0.618, label: '61.8%', color: '#06b6d4' },
      { r: 1.0, label: '100.0%', color: '#3b82f6' },
      { r: 1.618, label: '161.8%', color: '#8b5cf6' }
    ];
    return ratios.map(item => ({
      x: p1.x + dx * item.r,
      label: item.label,
      color: item.color
    }));
  }

  getFibCircles(d: DrawingItem): { r: number; label: string; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const baseR = Math.hypot(d.points[1].x - d.points[0].x, d.points[1].y - d.points[0].y);
    const ratios = [
      { r: 0.382, label: '0.382', color: '#f59e0b' },
      { r: 0.618, label: '0.618', color: '#06b6d4' },
      { r: 1.0, label: '1.0', color: '#10b981' },
      { r: 1.618, label: '1.618', color: '#3b82f6' },
      { r: 2.618, label: '2.618', color: '#8b5cf6' }
    ];
    return ratios.map(item => ({
      r: baseR * item.r,
      label: item.label,
      color: item.color
    }));
  }

  getFibSpiralPath(d: DrawingItem): string {
    if (!d.points || d.points.length < 2) return '';
    const p1 = d.points[0];
    const p2 = d.points[1];
    const baseR = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const points: string[] = [];
    const turns = 4;
    const steps = 60;
    const b = 0.3063489;
    const baseAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * (turns * Math.PI);
      const r = (baseR / 10) * Math.exp(b * theta);
      const x = p1.x + r * Math.cos(theta + baseAngle);
      const y = p1.y + r * Math.sin(theta + baseAngle);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join(' ');
  }

  getFibArcs(d: DrawingItem): { r: number; label: string; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const baseR = Math.hypot(d.points[1].x - d.points[0].x, d.points[1].y - d.points[0].y);
    const ratios = [
      { r: 0.382, label: '38.2%', color: '#f59e0b' },
      { r: 0.5, label: '50.0%', color: '#10b981' },
      { r: 0.618, label: '61.8%', color: '#06b6d4' },
      { r: 0.786, label: '78.6%', color: '#3b82f6' }
    ];
    return ratios.map(item => ({
      r: baseR * item.r,
      label: item.label,
      color: item.color
    }));
  }

  getFibWedgeLines(d: DrawingItem): { x2: number; y2: number; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return [
      { x2: p1.x + dx * 1.5, y2: p1.y + dy * 0.618 * 1.5, color: '#f59e0b' },
      { x2: p1.x + dx * 1.5, y2: p1.y + dy * 1.5, color: '#10b981' },
      { x2: p1.x + dx * 1.5, y2: p1.y + dy * 1.618 * 1.5, color: '#3b82f6' }
    ];
  }

  getPitchfanLines(d: DrawingItem): { x1: number; y1: number; x2: number; y2: number; color: string }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const p3 = d.points[2] || { x: p2.x + 30, y: p2.y + 30 };
    const mid = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
    return [
      { x1: p1.x, y1: p1.y, x2: mid.x + (mid.x - p1.x), y2: mid.y + (mid.y - p1.y), color: '#10b981' },
      { x1: p1.x, y1: p1.y, x2: p2.x + (p2.x - p1.x), y2: p2.y + (p2.y - p1.y), color: '#3b82f6' },
      { x1: p1.x, y1: p1.y, x2: p3.x + (p3.x - p1.x), y2: p3.y + (p3.y - p1.y), color: '#ef4444' }
    ];
  }

  getMeasureBox(d: DrawingItem): { x: number; y: number; w: number; h: number; p1: DrawingPoint; p2: DrawingPoint } {
    if (!d.points || d.points.length < 2) return { x: 0, y: 0, w: 0, h: 0, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } };
    const p1 = d.points[0];
    const p2 = d.points[1];
    return {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      w: Math.abs(p2.x - p1.x),
      h: Math.abs(p2.y - p1.y),
      p1,
      p2
    };
  }

  getPositionBox(d: DrawingItem): { entryY: number; targetY: number; slY: number; x: number; w: number } {
    if (!d.points || d.points.length < 2) return { entryY: 0, targetY: 0, slY: 0, x: 0, w: 0 };
    const p1 = d.points[0];
    const p2 = d.points[1];
    const dy = Math.abs(p2.y - p1.y);
    return {
      entryY: p1.y,
      targetY: d.toolId === 'short_position' ? p1.y + dy : p1.y - dy,
      slY: d.toolId === 'short_position' ? p1.y - (dy * 0.5) : p1.y + (dy * 0.5),
      x: Math.min(p1.x, p2.x),
      w: Math.max(120, Math.abs(p2.x - p1.x))
    };
  }

  getGannBox(d: DrawingItem): {
    x: number;
    y: number;
    w: number;
    h: number;
    hLevels: { y: number; label: string; color: string }[];
    vLevels: { x: number; label: string; color: string }[];
    diagonals: { x1: number; y1: number; x2: number; y2: number; color: string }[];
  } {
    if (!d.points || d.points.length < 2) {
      return { x: 0, y: 0, w: 0, h: 0, hLevels: [], vLevels: [], diagonals: [] };
    }
    const p1 = d.points[0];
    const p2 = d.points[1];
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.max(10, Math.abs(p2.x - p1.x));
    const h = Math.max(10, Math.abs(p2.y - p1.y));

    const ratios = [
      { r: 0.0, label: '0%', color: '#64748b' },
      { r: 0.25, label: '25%', color: '#3b82f6' },
      { r: 0.382, label: '38.2%', color: '#f59e0b' },
      { r: 0.5, label: '50%', color: '#10b981' },
      { r: 0.618, label: '61.8%', color: '#06b6d4' },
      { r: 0.75, label: '75%', color: '#8b5cf6' },
      { r: 1.0, label: '100%', color: '#64748b' }
    ];

    const hLevels = ratios.map(item => ({
      y: y + h * item.r,
      label: item.label,
      color: item.color
    }));

    const vLevels = ratios.map(item => ({
      x: x + w * item.r,
      label: item.label,
      color: item.color
    }));

    const diagonals = [
      { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, color: '#2563eb' },
      { x1: p1.x, y1: p2.y, x2: p2.x, y2: p1.y, color: '#2563eb' },
      { x1: x, y1: y + h * 0.5, x2: x + w * 0.5, y2: y, color: '#94a3b8' },
      { x1: x + w * 0.5, y1: y, x2: x + w, y2: y + h * 0.5, color: '#94a3b8' },
      { x1: x + w, y1: y + h * 0.5, x2: x + w * 0.5, y2: y + h, color: '#94a3b8' },
      { x1: x + w * 0.5, y1: y + h, x2: x, y2: y + h * 0.5, color: '#94a3b8' }
    ];

    return { x, y, w, h, hLevels, vLevels, diagonals };
  }

  getGannSquareFixed(d: DrawingItem): {
    x: number;
    y: number;
    size: number;
    hLevels: { y: number; label: string; color: string }[];
    vLevels: { x: number; label: string; color: string }[];
    diagonals: { x1: number; y1: number; x2: number; y2: number; color: string }[];
    diamond: string;
  } {
    if (!d.points || d.points.length < 2) {
      return { x: 0, y: 0, size: 0, hLevels: [], vLevels: [], diagonals: [], diamond: '' };
    }
    const p1 = d.points[0];
    const p2 = d.points[1];
    const size = Math.max(10, Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)));
    const x = p2.x >= p1.x ? p1.x : p1.x - size;
    const y = p2.y >= p1.y ? p1.y : p1.y - size;

    const ratios = [
      { r: 0.0, label: '0.0', color: '#64748b' },
      { r: 0.25, label: '1/4', color: '#3b82f6' },
      { r: 0.382, label: '0.382', color: '#f59e0b' },
      { r: 0.5, label: '1/2', color: '#10b981' },
      { r: 0.618, label: '0.618', color: '#06b6d4' },
      { r: 0.75, label: '3/4', color: '#8b5cf6' },
      { r: 1.0, label: '1.0', color: '#64748b' }
    ];

    const hLevels = ratios.map(item => ({
      y: y + size * item.r,
      label: item.label,
      color: item.color
    }));

    const vLevels = ratios.map(item => ({
      x: x + size * item.r,
      label: item.label,
      color: item.color
    }));

    const diagonals = [
      { x1: x, y1: y, x2: x + size, y2: y + size, color: '#2563eb' },
      { x1: x, y1: y + size, x2: x + size, y2: y, color: '#2563eb' }
    ];

    const midX = x + size / 2;
    const midY = y + size / 2;
    const diamond = `${midX},${y} ${x + size},${midY} ${midX},${y + size} ${x},${midY}`;

    return { x, y, size, hLevels, vLevels, diagonals, diamond };
  }

  getGannSquare(d: DrawingItem): {
    x: number;
    y: number;
    w: number;
    h: number;
    hLevels: { y: number; label: string; color: string }[];
    vLevels: { x: number; label: string; color: string }[];
    diagonals: { x1: number; y1: number; x2: number; y2: number; color: string }[];
  } {
    if (!d.points || d.points.length < 2) {
      return { x: 0, y: 0, w: 0, h: 0, hLevels: [], vLevels: [], diagonals: [] };
    }
    const p1 = d.points[0];
    const p2 = d.points[1];
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.max(10, Math.abs(p2.x - p1.x));
    const h = Math.max(10, Math.abs(p2.y - p1.y));

    const ratios = [
      { r: 0.0, label: '0.0', color: '#64748b' },
      { r: 0.25, label: '0.25', color: '#3b82f6' },
      { r: 0.382, label: '0.382', color: '#f59e0b' },
      { r: 0.5, label: '0.50', color: '#10b981' },
      { r: 0.618, label: '0.618', color: '#06b6d4' },
      { r: 0.75, label: '0.75', color: '#8b5cf6' },
      { r: 1.0, label: '1.00', color: '#64748b' }
    ];

    const hLevels = ratios.map(item => ({
      y: y + h * item.r,
      label: item.label,
      color: item.color
    }));

    const vLevels = ratios.map(item => ({
      x: x + w * item.r,
      label: item.label,
      color: item.color
    }));

    const diagonals = [
      { x1: x, y1: y, x2: x + w, y2: y + h, color: '#2563eb' },
      { x1: x, y1: y + h, x2: x + w, y2: y, color: '#2563eb' },
      { x1: x, y1: y, x2: x + w, y2: y + h * 0.5, color: '#94a3b8' },
      { x1: x, y1: y, x2: x + w * 0.5, y2: y + h, color: '#94a3b8' },
      { x1: x, y1: y + h, x2: x + w, y2: y + h * 0.5, color: '#94a3b8' },
      { x1: x, y1: y + h, x2: x + w * 0.5, y2: y, color: '#94a3b8' }
    ];

    return { x, y, w, h, hLevels, vLevels, diagonals };
  }

  getGannFanLines(d: DrawingItem): { x1: number; y1: number; x2: number; y2: number; label: string; color: string; isMain?: boolean }[] {
    if (!d.points || d.points.length < 2) return [];
    const p1 = d.points[0];
    const p2 = d.points[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    const fanConfigs = [
      { ratio: 0.125, label: '1/8', color: '#64748b' },
      { ratio: 0.25, label: '1/4', color: '#f59e0b' },
      { ratio: 0.333, label: '1/3', color: '#eab308' },
      { ratio: 0.5, label: '1/2', color: '#10b981' },
      { ratio: 1.0, label: '1/1 (45°)', color: '#2563eb', isMain: true },
      { ratio: 2.0, label: '2/1', color: '#06b6d4' },
      { ratio: 3.0, label: '3/1', color: '#6366f1' },
      { ratio: 4.0, label: '4/1', color: '#8b5cf6' },
      { ratio: 8.0, label: '8/1', color: '#ec4899' }
    ];

    const scale = 3.0;

    return fanConfigs.map(cfg => {
      let x2: number;
      let y2: number;

      if (cfg.ratio <= 1.0) {
        x2 = p1.x + dx * scale;
        y2 = p1.y + (dy * cfg.ratio) * scale;
      } else {
        x2 = p1.x + (dx / cfg.ratio) * scale;
        y2 = p1.y + dy * scale;
      }

      return {
        x1: p1.x,
        y1: p1.y,
        x2,
        y2,
        label: cfg.label,
        color: cfg.color,
        isMain: cfg.isMain
      };
    });
  }

  getXabcdPattern(d: DrawingItem): {
    points: { pt: DrawingPoint; label: string }[];
    polyline: string;
    tri1: string;
    tri2: string;
    ratioXB: string;
    ratioAC: string;
    ratioBD: string;
    ratioXD: string;
    midXB: DrawingPoint;
    midAC: DrawingPoint;
    midBD: DrawingPoint;
    midXD: DrawingPoint;
  } {
    const pts = d.points || [];
    const labels = ['X', 'A', 'B', 'C', 'D'];
    const points = pts.map((p, i) => ({ pt: p, label: labels[i] || `P${i + 1}` }));
    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

    if (pts.length < 5) {
      return {
        points,
        polyline,
        tri1: '',
        tri2: '',
        ratioXB: '',
        ratioAC: '',
        ratioBD: '',
        ratioXD: '',
        midXB: { x: 0, y: 0 },
        midAC: { x: 0, y: 0 },
        midBD: { x: 0, y: 0 },
        midXD: { x: 0, y: 0 }
      };
    }

    const [X, A, B, C, D] = pts;
    const tri1 = `${X.x},${X.y} ${A.x},${A.y} ${B.x},${B.y}`;
    const tri2 = `${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`;

    const xa = Math.abs(A.y - X.y) || 1;
    const ab = Math.abs(B.y - A.y) || 1;
    const bc = Math.abs(C.y - B.y) || 1;
    const cd = Math.abs(D.y - C.y) || 1;

    const ratioXB = (ab / xa).toFixed(3);
    const ratioAC = (bc / ab).toFixed(3);
    const ratioBD = (cd / bc).toFixed(3);
    const ratioXD = (Math.abs(D.y - X.y) / xa).toFixed(3);

    const midXB = { x: (X.x + B.x) / 2, y: (X.y + B.y) / 2 };
    const midAC = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
    const midBD = { x: (B.x + D.x) / 2, y: (B.y + D.y) / 2 };
    const midXD = { x: (X.x + D.x) / 2, y: (X.y + D.y) / 2 };

    return { points, polyline, tri1, tri2, ratioXB, ratioAC, ratioBD, ratioXD, midXB, midAC, midBD, midXD };
  }

  getCypherPattern(d: DrawingItem): {
    points: { pt: DrawingPoint; label: string }[];
    polyline: string;
    tri1: string;
    tri2: string;
    ratioXB: string;
    ratioXC: string;
    ratioCD: string;
    midXB: DrawingPoint;
    midXC: DrawingPoint;
    midCD: DrawingPoint;
  } {
    const pts = d.points || [];
    const labels = ['X', 'A', 'B', 'C', 'D'];
    const points = pts.map((p, i) => ({ pt: p, label: labels[i] || `P${i + 1}` }));
    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

    if (pts.length < 5) {
      return {
        points,
        polyline,
        tri1: '',
        tri2: '',
        ratioXB: '',
        ratioXC: '',
        ratioCD: '',
        midXB: { x: 0, y: 0 },
        midXC: { x: 0, y: 0 },
        midCD: { x: 0, y: 0 }
      };
    }

    const [X, A, B, C, D] = pts;
    const tri1 = `${X.x},${X.y} ${A.x},${A.y} ${C.x},${C.y}`;
    const tri2 = `${C.x},${C.y} ${B.x},${B.y} ${D.x},${D.y}`;

    const xa = Math.abs(A.y - X.y) || 1;
    const ab = Math.abs(B.y - A.y) || 1;
    const xc = Math.abs(C.y - X.y) || 1;
    const cd = Math.abs(D.y - C.y) || 1;

    const ratioXB = (ab / xa).toFixed(3);
    const ratioXC = (xc / xa).toFixed(3);
    const ratioCD = (cd / xc).toFixed(3);

    const midXB = { x: (X.x + B.x) / 2, y: (X.y + B.y) / 2 };
    const midXC = { x: (X.x + C.x) / 2, y: (X.y + C.y) / 2 };
    const midCD = { x: (C.x + D.x) / 2, y: (C.y + D.y) / 2 };

    return { points, polyline, tri1, tri2, ratioXB, ratioXC, ratioCD, midXB, midXC, midCD };
  }

  getHeadAndShoulders(d: DrawingItem): {
    points: { pt: DrawingPoint; label: string }[];
    polyline: string;
    fillPolygon: string;
    neckline: { x1: number; y1: number; x2: number; y2: number };
    ls: DrawingPoint;
    head: DrawingPoint;
    rs: DrawingPoint;
  } {
    const pts = d.points || [];
    const labels = ['Start', 'LS', 'NL1', 'Head', 'NL2', 'RS', 'End'];
    const points = pts.map((p, i) => ({ pt: p, label: labels[i] || `P${i + 1}` }));
    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

    if (pts.length < 7) {
      return {
        points,
        polyline,
        fillPolygon: '',
        neckline: { x1: 0, y1: 0, x2: 0, y2: 0 },
        ls: pts[1] || { x: 0, y: 0 },
        head: pts[3] || { x: 0, y: 0 },
        rs: pts[5] || { x: 0, y: 0 }
      };
    }

    const [p0, p1, p2, p3, p4, p5, p6] = pts;
    const fillPolygon = `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`;

    // Neckline extended line across
    const dx = p4.x - p2.x || 1;
    const dy = p4.y - p2.y;
    const slope = dy / dx;

    const x1 = Math.min(p0.x, p2.x) - 20;
    const y1 = p2.y + slope * (x1 - p2.x);
    const x2 = Math.max(p6.x, p4.x) + 40;
    const y2 = p2.y + slope * (x2 - p2.x);

    return {
      points,
      polyline,
      fillPolygon,
      neckline: { x1, y1, x2, y2 },
      ls: p1,
      head: p3,
      rs: p5
    };
  }

  getAbcdPattern(d: DrawingItem): {
    points: { pt: DrawingPoint; label: string }[];
    polyline: string;
    ratioBC: string;
    ratioCD: string;
    midAC: DrawingPoint;
    midBD: DrawingPoint;
  } {
    const pts = d.points || [];
    const labels = ['A', 'B', 'C', 'D'];
    const points = pts.map((p, i) => ({ pt: p, label: labels[i] || `P${i + 1}` }));
    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

    if (pts.length < 4) {
      return {
        points,
        polyline,
        ratioBC: '',
        ratioCD: '',
        midAC: { x: 0, y: 0 },
        midBD: { x: 0, y: 0 }
      };
    }

    const [A, B, C, D] = pts;
    const ab = Math.abs(B.y - A.y) || 1;
    const bc = Math.abs(C.y - B.y) || 1;
    const cd = Math.abs(D.y - C.y) || 1;

    const ratioBC = (bc / ab).toFixed(3);
    const ratioCD = (cd / bc).toFixed(3);

    const midAC = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
    const midBD = { x: (B.x + D.x) / 2, y: (B.y + D.y) / 2 };

    return { points, polyline, ratioBC, ratioCD, midAC, midBD };
  }

  getTrianglePattern(d: DrawingItem): {
    points: { pt: DrawingPoint; label: string }[];
    polyline: string;
    fillPolygon: string;
    upperLine: { x1: number; y1: number; x2: number; y2: number };
    lowerLine: { x1: number; y1: number; x2: number; y2: number };
  } {
    const pts = d.points || [];
    const labels = ['A', 'B', 'C', 'D'];
    const points = pts.map((p, i) => ({ pt: p, label: labels[i] || `P${i + 1}` }));
    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

    if (pts.length < 4) {
      return {
        points,
        polyline,
        fillPolygon: '',
        upperLine: { x1: 0, y1: 0, x2: 0, y2: 0 },
        lowerLine: { x1: 0, y1: 0, x2: 0, y2: 0 }
      };
    }

    const [A, B, C, D] = pts;
    const fillPolygon = `${A.x},${A.y} ${B.x},${B.y} ${D.x},${D.y} ${C.x},${C.y}`;

    // Extended upper trendline (through A and C)
    const upperDx = C.x - A.x || 1;
    const upperSlope = (C.y - A.y) / upperDx;
    const upperX2 = C.x + 80;
    const upperY2 = C.y + upperSlope * 80;

    // Extended lower trendline (through B and D)
    const lowerDx = D.x - B.x || 1;
    const lowerSlope = (D.y - B.y) / lowerDx;
    const lowerX2 = D.x + 80;
    const lowerY2 = D.y + lowerSlope * 80;

    return {
      points,
      polyline,
      fillPolygon,
      upperLine: { x1: A.x, y1: A.y, x2: upperX2, y2: upperY2 },
      lowerLine: { x1: B.x, y1: B.y, x2: lowerX2, y2: lowerY2 }
    };
  }

  getThreeDrivesPattern(d: DrawingItem): {
    points: { pt: DrawingPoint; label: string }[];
    polyline: string;
    ratioDrive2: string;
    ratioDrive3: string;
    d1: DrawingPoint;
    d2: DrawingPoint;
    d3: DrawingPoint;
    midD1D2: DrawingPoint;
    midD2D3: DrawingPoint;
  } {
    const pts = d.points || [];
    const labels = ['0', 'Drive 1', 'Pullback 1', 'Drive 2', 'Pullback 2', 'Drive 3', 'End'];
    const points = pts.map((p, i) => ({ pt: p, label: labels[i] || `P${i + 1}` }));
    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

    if (pts.length < 7) {
      return {
        points,
        polyline,
        ratioDrive2: '',
        ratioDrive3: '',
        d1: pts[1] || { x: 0, y: 0 },
        d2: pts[3] || { x: 0, y: 0 },
        d3: pts[5] || { x: 0, y: 0 },
        midD1D2: { x: 0, y: 0 },
        midD2D3: { x: 0, y: 0 }
      };
    }

    const [, p1, , p3, , p5] = pts;
    const swing1 = Math.abs(p1.y - pts[0].y) || 1;
    const swing2 = Math.abs(p3.y - pts[2].y) || 1;
    const swing3 = Math.abs(p5.y - pts[4].y) || 1;

    const ratioDrive2 = (swing2 / swing1).toFixed(3);
    const ratioDrive3 = (swing3 / swing2).toFixed(3);

    const midD1D2 = { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2 };
    const midD2D3 = { x: (p3.x + p5.x) / 2, y: (p3.y + p5.y) / 2 };

    return {
      points,
      polyline,
      ratioDrive2,
      ratioDrive3,
      d1: p1,
      d2: p3,
      d3: p5,
      midD1D2,
      midD2D3
    };
  }

  getRotatedRectangle(d: DrawingItem): string {
    if (!d.points || d.points.length < 2) return '';
    const p0 = d.points[0];
    const p1 = d.points[1];
    const p2 = d.points[2] || { x: p1.x, y: p1.y - 30 };

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const proj = (p2.x - p1.x) * nx + (p2.y - p1.y) * ny;
    const hx = nx * proj;
    const hy = ny * proj;

    const corner2 = { x: p1.x + hx, y: p1.y + hy };
    const corner3 = { x: p0.x + hx, y: p0.y + hy };

    return `${p0.x},${p0.y} ${p1.x},${p1.y} ${corner2.x},${corner2.y} ${corner3.x},${corner3.y}`;
  }

  getTrianglePoints(d: DrawingItem): string {
    if (!d.points || d.points.length < 3) {
      if (d.points && d.points.length === 2) {
        return `${d.points[0].x},${d.points[0].y} ${d.points[1].x},${d.points[1].y} ${d.points[0].x},${d.points[1].y}`;
      }
      return '';
    }
    return `${d.points[0].x},${d.points[0].y} ${d.points[1].x},${d.points[1].y} ${d.points[2].x},${d.points[2].y}`;
  }

  getArcPath(d: DrawingItem): string {
    if (!d.points || d.points.length < 2) return '';
    const p0 = d.points[0];
    const p1 = d.points[1];
    const p2 = d.points[2] || { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 - 30 };
    return `M ${p0.x} ${p0.y} Q ${p2.x} ${p2.y} ${p1.x} ${p1.y}`;
  }

  getCurvePath(d: DrawingItem): string {
    if (!d.points || d.points.length < 2) return '';
    const p0 = d.points[0];
    const p1 = d.points[1];
    const p2 = d.points[2] || { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 - 30 };
    return `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`;
  }

  getEllipseData(d: DrawingItem): { cx: number; cy: number; rx: number; ry: number } {
    if (!d.points || d.points.length < 2) return { cx: 0, cy: 0, rx: 0, ry: 0 };
    const p0 = d.points[0];
    const p1 = d.points[1];
    return {
      cx: p0.x,
      cy: p0.y,
      rx: Math.max(10, Math.abs(p1.x - p0.x)),
      ry: Math.max(10, Math.abs(p1.y - p0.y))
    };
  }

  // =========================================================================
  // INDICATOR ENGINE & MANAGEMENT
  // =========================================================================

  renderAllIndicators(): void {
    if (!this.chart || typeof window === 'undefined') return;

    try {
      const candles = this.candleData();
      if (!candles || candles.length === 0) return;

      const active = this.activeIndicators();
      const currentActiveIds = new Set<string>();

      active.forEach(ind => {
        if (!ind.enabled) return;

        const renderSeriesList = calculateIndicatorSeries(ind, candles);
        renderSeriesList.forEach(rs => {
          currentActiveIds.add(rs.id);

          let series = this.indicatorSeriesMap.get(rs.id);
          if (!series) {
            if (rs.type === 'histogram') {
              series = this.chart!.addSeries(HistogramSeries, {
                color: rs.color,
                priceScaleId: rs.priceScaleId || ''
              });
            } else {
              series = this.chart!.addSeries(LineSeries, {
                color: rs.color,
                lineWidth: (rs.lineWidth || 2) as any,
                lineStyle: rs.lineStyle || 0,
                priceScaleId: rs.overlay ? 'right' : (rs.priceScaleId || '')
              });
            }

            if (rs.scaleMargins) {
              series.priceScale().applyOptions({ scaleMargins: rs.scaleMargins });
            }

            this.indicatorSeriesMap.set(rs.id, series);
          } else {
            series.applyOptions({
              color: rs.color,
              lineWidth: (rs.lineWidth || 2) as any
            });
          }

          if (rs.data && rs.data.length > 0) {
            series.setData(rs.data as any);
          }
        });
      });

      this.indicatorSeriesMap.forEach((series, id) => {
        if (!currentActiveIds.has(id)) {
          try {
            this.chart!.removeSeries(series);
          } catch (e) {
            // ignore
          }
          this.indicatorSeriesMap.delete(id);
        }
      });
    } catch (e) {
      // ignore
    }
  }

  openIndicatorModal(): void {
    this.isIndicatorModalOpen.set(true);
  }

  closeIndicatorModal(): void {
    this.isIndicatorModalOpen.set(false);
  }

  setIndicatorCategory(catId: string): void {
    this.selectedIndicatorCategory.set(catId);
  }

  addIndicator(def: IndicatorDefinition): void {
    const defaultParams: Record<string, any> = { ...def.defaultParams };

    const instanceId = `${def.id}_${Date.now()}`;
    const newActive: ActiveIndicator = {
      instanceId,
      defId: def.id,
      name: def.name,
      shortName: def.shortName,
      category: def.category,
      color: def.defaultColor,
      lineWidth: 2,
      enabled: true,
      params: defaultParams,
      isOverlay: def.isOverlay
    };

    this.activeIndicators.update(list => [...list, newActive]);
  }

  removeIndicator(instanceId: string): void {
    this.activeIndicators.update(list => list.filter(i => i.instanceId !== instanceId));
  }

  toggleIndicatorEnabled(instanceId: string): void {
    this.activeIndicators.update(list =>
      list.map(i => i.instanceId === instanceId ? { ...i, enabled: !i.enabled } : i)
    );
  }

  clearAllIndicators(): void {
    this.activeIndicators.set([]);
  }

  openIndicatorSettings(indicator: ActiveIndicator): void {
    this.editingIndicator.set(indicator);
    this.editingParams.set({ ...indicator.params });
    this.editingColor.set(indicator.color);
    this.editingLineWidth.set(indicator.lineWidth);
  }

  updateEditingParam(paramKey: string, value: any): void {
    const current = this.editingParams();
    this.editingParams.set({ ...current, [paramKey]: value });
  }

  closeIndicatorSettings(): void {
    this.editingIndicator.set(null);
  }

  saveIndicatorSettings(): void {
    const current = this.editingIndicator();
    if (!current) return;

    this.activeIndicators.update(list =>
      list.map(i => {
        if (i.instanceId === current.instanceId) {
          return {
            ...i,
            params: { ...this.editingParams() },
            color: this.editingColor(),
            lineWidth: this.editingLineWidth()
          };
        }
        return i;
      })
    );

    this.closeIndicatorSettings();
  }

  getEditingDefinition(): IndicatorDefinition | undefined {
    const ind = this.editingIndicator();
    if (!ind) return undefined;
    return this.indicatorLibrary().find(d => d.id === ind.defId);
  }

  isIndicatorActive(defId: string): boolean {
    return this.activeIndicators().some(i => i.defId === defId);
  }

  // =========================================================================
  // WATCHLIST, SEARCH, NAVIGATION & HELPERS
  // =========================================================================

  setCategory(cat: MarketCategory): void {
    this.activeCategory.set(cat);
  }

  setInterval(iv: ChartInterval): void {
    this.currentInterval.set(iv);
    this.fetchCandles(this.selectedSymbol(), iv);
  }

  setTimeframe(tf: TimeframeRange): void {
    this.currentTimeframe.set(tf);
    this.fetchCandles(this.selectedSymbol(), this.currentInterval());
  }

  setChartType(type: ChartType): void {
    this.currentChartType.set(type);
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    setTimeout(() => {
      if (this.chart) {
        this.chart.timeScale().fitContent();
      }
      this.syncCanvasSize();
      this.renderDrawings();
    }, 100);
  }

  fitChart(): void {
    if (this.chart) {
      this.chart.timeScale().fitContent();
      this.renderDrawings();
    }
  }

  refreshCurrentInstrument(): void {
    const sym = this.selectedSymbol();
    this.fetchQuote(sym, undefined, true);
    this.fetchCandles(sym, this.currentInterval(), true);
  }

  retryFetch(): void {
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.refreshCurrentInstrument();
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  onSearchSubmit(): void {
    const q = this.searchQuery().trim();
    if (q) {
      this.loadInstrument(q);
      this.searchQuery.set('');
      this.showDropdown.set(false);
    }
  }

  selectSearchResult(item: StockSearchItem): void {
    this.loadInstrument(item.symbol, item.name, item.region, item.type);
    this.searchQuery.set('');
    this.showDropdown.set(false);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showDropdown.set(false);
  }

  selectWatchlistItem(item: WatchlistItem): void {
    this.loadInstrument(item.symbol, item.name, item.exchange ?? undefined, item.category);
  }

  updateWatchlistItem(symbol: string, price?: number | null, change?: number | null, changePercent?: string | null): void {
    this.watchlist.update(list =>
      list.map(item => {
        if (item.symbol.toUpperCase() === symbol.toUpperCase()) {
          return {
            ...item,
            price: price ?? item.price,
            change: change ?? item.change,
            changePercent: changePercent ?? item.changePercent
          };
        }
        return item;
      })
    );
  }

  refreshWatchlist(): void {
    this.refreshWatchlistQuotes();
  }

  refreshWatchlistQuotes(): void {
    const items = this.watchlist();
    const batch = items.slice(0, 10);
    batch.forEach(item => {
      this.marketService.getQuote(item.symbol).subscribe({
        next: (quote) => {
          this.updateWatchlistItem(item.symbol, quote.price, quote.change, quote.changePercent);
        },
        error: () => {}
      });
    });
  }

  getExchangeLabel(item: WatchlistItem): string {
    if (item.exchange) return item.exchange;
    if (item.category === 'indices') {
      return item.symbol.toUpperCase().includes('SENSEX') ? 'BSE' : 'NSE';
    }
    if (item.category === 'stocks') {
      return this.marketService.isIndianSymbol(item.symbol) ? 'NSE' : 'NASDAQ';
    }
    if (item.category === 'forex') return 'FX';
    if (item.category === 'crypto') return 'Coinbase';
    return 'NSE';
  }

  // Watchlist collapsing
  toggleSectionCollapse(sec: 'indices' | 'stocks' | 'forex' | 'crypto'): void {
    if (sec === 'indices') this.isIndicesCollapsed.update(v => !v);
    if (sec === 'stocks') this.isStocksCollapsed.update(v => !v);
    if (sec === 'forex') this.isForexCollapsed.update(v => !v);
    if (sec === 'crypto') this.isCryptoCollapsed.update(v => !v);
    this.saveWatchlistState();
  }

  toggleIndicesCollapse(): void {
    this.toggleSectionCollapse('indices');
  }

  toggleStocksCollapse(): void {
    this.toggleSectionCollapse('stocks');
  }

  toggleForexCollapse(): void {
    this.toggleSectionCollapse('forex');
  }

  toggleCryptoCollapse(): void {
    this.toggleSectionCollapse('crypto');
  }

  startWatchlistResize(e: MouseEvent): void {
    this.startResizeWatchlist(e);
  }

  // Watchlist Drag and Drop
  onDragStart(e: DragEvent, item: WatchlistItem): void {
    this.draggedItem.set({ symbol: item.symbol, category: item.category });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.symbol);
    }
  }

  onDragOver(e: DragEvent, targetItem: WatchlistItem): void {
    e.preventDefault();
    const dragged = this.draggedItem();
    if (!dragged || dragged.symbol === targetItem.symbol || dragged.category !== targetItem.category) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';

    this.dragOverTarget.set(targetItem.symbol);
    this.dragOverPosition.set(pos);
  }

  onDragLeave(e: DragEvent): void {
    const related = e.relatedTarget as HTMLElement;
    const current = e.currentTarget as HTMLElement;
    if (!current.contains(related)) {
      this.dragOverTarget.set(null);
      this.dragOverPosition.set(null);
    }
  }

  onDrop(e: DragEvent, targetItem: WatchlistItem): void {
    e.preventDefault();
    const dragged = this.draggedItem();
    if (!dragged || dragged.symbol === targetItem.symbol || dragged.category !== targetItem.category) {
      this.clearDragState();
      return;
    }

    const pos = this.dragOverPosition();
    const currentList = this.watchlist();
    const draggedIdx = currentList.findIndex(i => i.symbol === dragged.symbol);
    const targetIdx = currentList.findIndex(i => i.symbol === targetItem.symbol);

    if (draggedIdx === -1 || targetIdx === -1) {
      this.clearDragState();
      return;
    }

    const [moved] = currentList.splice(draggedIdx, 1);
    const insertIdx = pos === 'above' ? targetIdx : targetIdx + 1;
    currentList.splice(insertIdx > draggedIdx ? insertIdx - 1 : insertIdx, 0, moved);

    this.watchlist.set([...currentList]);
    this.clearDragState();
    this.saveWatchlistState();
  }

  onDragEnd(): void {
    this.clearDragState();
  }

  private clearDragState(): void {
    this.draggedItem.set(null);
    this.dragOverTarget.set(null);
    this.dragOverPosition.set(null);
  }

  // Resizable Watchlist Pane
  startResizeWatchlist(e: MouseEvent): void {
    if (e.preventDefault) e.preventDefault();
    this.isResizingWatchlist.set(true);
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.watchlistWidth();

    this.boundOnMouseMove = (moveEvent: MouseEvent) => {
      const delta = this.resizeStartX - moveEvent.clientX;
      const newWidth = Math.min(600, Math.max(260, this.resizeStartWidth + delta));
      this.watchlistWidth.set(newWidth);
      this.syncCanvasSize();
      this.renderDrawings();
    };

    this.boundOnMouseUp = () => {
      this.isResizingWatchlist.set(false);
      if (this.boundOnMouseMove) document.removeEventListener('mousemove', this.boundOnMouseMove);
      if (this.boundOnMouseUp) document.removeEventListener('mouseup', this.boundOnMouseUp);
      this.saveWatchlistState();
      if (this.chart) {
        this.chart.timeScale().fitContent();
      }
      this.syncCanvasSize();
      this.renderDrawings();
    };

    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
  }

  private saveWatchlistState(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const collapsedState = {
        indices: this.isIndicesCollapsed(),
        stocks: this.isStocksCollapsed(),
        forex: this.isForexCollapsed(),
        crypto: this.isCryptoCollapsed()
      };
      localStorage.setItem('portfolio_market_watchlist_collapsed', JSON.stringify(collapsedState));
      localStorage.setItem('portfolio_watchlist_width', this.watchlistWidth().toString());

      const state = {
        width: this.watchlistWidth(),
        collapsed: collapsedState,
        order: this.watchlist().map(w => w.symbol)
      };
      localStorage.setItem('market_watchlist_pref', JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  private loadSavedWatchlistState(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('market_watchlist_pref');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.width && typeof state.width === 'number') {
        this.watchlistWidth.set(state.width);
      }
      if (state.collapsed) {
        this.isIndicesCollapsed.set(!!state.collapsed.indices);
        this.isStocksCollapsed.set(!!state.collapsed.stocks);
        this.isForexCollapsed.set(!!state.collapsed.forex);
        this.isCryptoCollapsed.set(!!state.collapsed.crypto);
      }
      if (state.order && Array.isArray(state.order)) {
        const map = new Map(this.watchlist().map(i => [i.symbol, i]));
        const sorted: WatchlistItem[] = [];
        state.order.forEach((sym: string) => {
          const item = map.get(sym);
          if (item) {
            sorted.push(item);
            map.delete(sym);
          }
        });
        map.forEach(item => sorted.push(item));
        this.watchlist.set(sorted);
      }
    } catch (e) {
      // ignore
    }
  }

  formatCurrencySymbol(symbol: string): string {
    if (this.marketService.isIndianSymbol(symbol)) return '₹';
    if (symbol.startsWith('EUR/')) return '€';
    if (symbol.startsWith('GBP/')) return '£';
    return '$';
  }

  // ==========================================
  // PRICE ALERT ACTIONS
  // ==========================================

  openAlertModal(): void {
    const currentP = this.currentQuote()?.price ?? 100;
    this.alertTargetPrice.set(Number(currentP.toFixed(2)));
    this.alertCondition.set('ABOVE');
    this.alertNotes.set('');
    this.alertErrorMessage.set(null);
    this.alertSuccessMessage.set(null);
    this.isAlertModalOpen.set(true);
  }

  closeAlertModal(): void {
    this.isAlertModalOpen.set(false);
    this.alertErrorMessage.set(null);
    this.alertSuccessMessage.set(null);
  }

  setAlertCondition(cond: AlertConditionType): void {
    this.alertCondition.set(cond);
  }

  saveAlert(): void {
    if (!this.authService.isAuthenticated()) {
      this.alertErrorMessage.set('Please log in to create price alerts.');
      return;
    }

    const price = this.alertTargetPrice();
    if (!price || price <= 0) {
      this.alertErrorMessage.set('Please enter a valid target price greater than 0.');
      return;
    }

    this.isSavingAlert.set(true);
    this.alertErrorMessage.set(null);
    this.alertSuccessMessage.set(null);

    this.alertService.createAlert({
      symbol: this.selectedSymbol(),
      condition: this.alertCondition(),
      targetPrice: price,
      notes: this.alertNotes().trim() || undefined
    }).subscribe({
      next: () => {
        this.isSavingAlert.set(false);
        this.alertSuccessMessage.set(`Alert set: ${this.selectedSymbol()} ${this.alertCondition()} ${this.formatCurrencySymbol(this.selectedSymbol())}${price.toFixed(2)}`);
        setTimeout(() => {
          this.closeAlertModal();
        }, 1200);
      },
      error: (err) => {
        this.isSavingAlert.set(false);
        this.alertErrorMessage.set(err.error?.message || err.message || 'Failed to create price alert');
      }
    });
  }
}
