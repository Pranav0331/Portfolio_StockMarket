import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ElementRef,
  viewChild,
  effect,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { timer, Subscription } from 'rxjs';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  Time,
  CandlestickData,
  LineData,
  HistogramData,
  SeriesMarker,
  createSeriesMarkers,
  ISeriesMarkersPluginApi
} from 'lightweight-charts';
import { MarketService } from '../../../services/market.service';
import { MarketWebSocketService, MarketTick } from '../../../services/market-websocket.service';
import { AuthService } from '../../../services/auth.service';
import { TradingService } from '../../../services/trading.service';
import { AlertService } from '../../../services/alert.service';
import { StockQuote, Candle } from '../../../models/market.model';
import {
  TradeResponse,
  VirtualWallet,
  UserHolding,
  TradingMode,
  PositionSide,
  PositionItem
} from '../../../models/trading.model';
import { AlertConditionType } from '../../../models/alert.model';
import { calculateSMA, calculateEMA } from '../../../utils/technical-analysis.utils';

export type ChartType = 'candles' | 'line' | 'area';
export type StockDetailInterval = '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' | '1week';
export type TimeframeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

export interface IntervalOption {
  label: string;
  value: StockDetailInterval;
  outputsize: number;
}

export interface HoveredBarData {
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export interface TopInstrumentItem {
  symbol: string;
  name: string;
  marketType: string;
}

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

@Component({
  selector: 'app-stock-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './stock-details.html',
  styleUrl: './stock-details.css'
})
export class StockDetailsComponent implements OnInit, OnDestroy {
  readonly marketService = inject(MarketService);
  readonly marketWebSocketService = inject(MarketWebSocketService);
  readonly authService = inject(AuthService);
  readonly tradingService = inject(TradingService);
  readonly alertService = inject(AlertService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Chart Container DOM Reference
  readonly chartContainerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');
  readonly drawingSvgRef = viewChild<ElementRef<SVGSVGElement>>('drawingSvg');

  // Active Symbol & State
  readonly symbol = signal<string>('BTC/USD');
  readonly companyName = signal<string>('Bitcoin / US Dollar');
  readonly exchange = signal<string>('Crypto');
  readonly instrumentType = signal<string>('Crypto');
  readonly currentQuote = signal<StockQuote | null>(null);
  readonly Math = Math;

  static readonly DEFAULT_INSTRUMENTS: TopInstrumentItem[] = [
    { symbol: 'BTC/USD', name: 'Bitcoin', marketType: 'Crypto' },
    { symbol: 'ETH/USD', name: 'Ethereum', marketType: 'Crypto' },
    { symbol: 'SOL/USD', name: 'Solana', marketType: 'Crypto' },
    { symbol: 'USOIL', name: 'WTI Crude Oil', marketType: 'Commodity' },
    { symbol: 'XAU/USD', name: 'Gold / USD', marketType: 'Commodity' },
    { symbol: 'AAPL', name: 'Apple Inc.', marketType: 'US Stock' },
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', marketType: 'Index' },
    { symbol: 'SENSEX', name: 'BSE Sensex', marketType: 'Index' },
    { symbol: 'EUR/USD', name: 'Euro / USD', marketType: 'Forex' }
  ];

  // Top Symbol Bar Instruments List (with localStorage sync)
  readonly topInstruments = signal<TopInstrumentItem[]>(this.loadOpenInstruments());

  // =========================================================================
  // 14 MAIN TOOLBAR TOOL GROUPS (EXNESS-STYLE GROUPED SYSTEM)
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

  // =========================================================================
  // DRAWING ENGINE STATE SIGNALS
  // =========================================================================
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

  readonly activeColor = signal<string>('#2563eb');
  readonly activeLineWidth = signal<number>(2);
  readonly availableColors = ['#2563eb', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#0f172a', '#64748b'];

  // Symbol Search Modal State
  readonly isSearchModalOpen = signal<boolean>(false);
  readonly symbolSearchQuery = signal<string>('');
  readonly isSearchingSymbols = signal<boolean>(false);
  readonly searchResults = signal<any[]>([]);

  // Provider routing identification
  readonly currentProvider = computed(() => {
    return this.marketService.isIndianSymbol(this.symbol()) ? 'Upstox' : 'Twelve Data';
  });

  // Loading and Error states
  readonly isLoadingQuote = signal<boolean>(false);
  readonly isLoadingCandles = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal<boolean>(false);
  readonly isMarketDataUnavailable = signal<boolean>(false);

  // Real-time Live Market Feed & WebSocket Streaming States
  readonly isWebSocketConnected = signal<boolean>(false);
  readonly isReceivingRealTicks = signal<boolean>(false);
  readonly isStreamingUnavailable = signal<boolean>(false);
  readonly streamStatusMessage = signal<string | null>(null);
  readonly lastLiveTimestamp = signal<number>(Date.now());

  readonly isLiveConnected = computed(() => {
    return this.isWebSocketConnected() && this.isReceivingRealTicks() && !this.isStreamingUnavailable();
  });

  readonly hasTradableQuote = computed(() => {
    const q = this.currentQuote();
    return !!q && q.price != null && q.price > 0 && !this.isMarketDataUnavailable();
  });

  // Chart Controls State
  readonly currentChartType = signal<ChartType>('candles');
  readonly currentInterval = signal<StockDetailInterval>('5min');
  readonly currentTimeframe = signal<TimeframeRange>('1D');
  readonly isFullscreen = signal<boolean>(false);

  // Technical Indicators Toggles
  readonly activeIndicators = signal<{
    ema9: boolean;
    ema21: boolean;
    sma50: boolean;
    volume: boolean;
  }>({
    ema9: true,
    ema21: true,
    sma50: false,
    volume: true
  });

  // Live Hovered Candle / Bar Info
  readonly hoveredBar = signal<HoveredBarData | null>(null);

  // Real Candlestick Data Cache
  readonly candleData = signal<Candle[]>([]);

  // Timeframe / Interval Options Available (1m, 5m, 15m, 30m, 1H, 4H, 1D)
  readonly intervals: IntervalOption[] = [
    { label: '1m', value: '1min', outputsize: 100 },
    { label: '5m', value: '5min', outputsize: 100 },
    { label: '15m', value: '15min', outputsize: 100 },
    { label: '30m', value: '30min', outputsize: 100 },
    { label: '1H', value: '1h', outputsize: 120 },
    { label: '4H', value: '4h', outputsize: 120 },
    { label: '1D', value: '1day', outputsize: 180 }
  ];

  // =========================================================================
  // PRICE ALERT MODAL STATE
  // =========================================================================
  readonly isAlertModalOpen = signal<boolean>(false);
  readonly alertCondition = signal<AlertConditionType>('ABOVE');
  readonly alertTargetPrice = signal<number>(100);
  readonly alertNotes = signal<string>('');
  readonly isSavingAlert = signal<boolean>(false);
  readonly alertErrorMessage = signal<string | null>(null);
  readonly alertSuccessMessage = signal<string | null>(null);

  // Left Toolbar popover menus state
  readonly isIndicatorMenuOpen = signal<boolean>(false);
  readonly isChartTypeMenuOpen = signal<boolean>(false);
  readonly isTimeframeMenuOpen = signal<boolean>(false);

  // =========================================================================
  // EXNESS-INSPIRED ORDER PANEL & TRADING STATE
  // =========================================================================
  readonly openNewOrderMode = signal<boolean>(false);
  readonly tradeSide = signal<PositionSide>('LONG');
  readonly tradeQuantity = signal<number>(0.10);
  readonly selectedTradingMode = signal<TradingMode>('INTRADAY');
  readonly selectedLeverage = signal<number>(10);
  readonly orderType = signal<'MARKET' | 'PENDING'>('MARKET');
  readonly pendingPrice = signal<number | null>(null);
  readonly activeBottomTab = signal<'OPEN' | 'PENDING' | 'CLOSED'>('OPEN');
  readonly isTerminalCollapsed = signal<boolean>(false);
  readonly isTerminalExpanded = signal<boolean>(false);

  readonly stopLossPrice = signal<number | null>(null);
  readonly takeProfitPrice = signal<number | null>(null);
  readonly slInputMode = signal<'PRICE' | 'PERCENT'>('PRICE');
  readonly tpInputMode = signal<'PRICE' | 'PERCENT'>('PRICE');

  readonly isSubmittingTrade = signal<boolean>(false);
  readonly isClosingPositionId = signal<number | null>(null);
  readonly tradeSuccessReceipt = signal<TradeResponse | null>(null);
  readonly tradeErrorMessage = signal<string | null>(null);
  readonly tradeToast = signal<{ show: boolean; type: 'success' | 'error'; message: string; sub?: string } | null>(null);
  private toastTimeout: any = null;

  readonly userWallet = signal<VirtualWallet | null>(null);
  readonly userHolding = signal<UserHolding | null>(null);
  readonly userPositions = signal<PositionItem[]>([]);
  readonly closedPositions = signal<PositionItem[]>([]);

  readonly leverageOptions = [1, 2, 5, 10, 20, 50, 100];

  readonly spreadValue = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    if (price <= 0) return 0;
    const isCrypto = this.symbol().includes('/') || this.symbol().includes('BTC') || this.symbol().includes('ETH');
    const isForex = this.symbol().includes('EUR') || this.symbol().includes('USD') || this.symbol().includes('GBP');
    const pct = isCrypto ? 0.0002 : isForex ? 0.0001 : 0.0005;
    const spread = price * pct;
    return price > 100 ? Number(spread.toFixed(2)) : Number(spread.toFixed(4));
  });

  readonly bidPrice = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    const spread = this.spreadValue();
    return Math.max(0, price - (spread / 2));
  });

  readonly askPrice = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    const spread = this.spreadValue();
    return price + (spread / 2);
  });

  readonly tradingModesList: { mode: TradingMode; label: string; desc: string; badge: string; icon: string }[] = [
    { mode: 'SCALPING', label: 'Scalping', desc: '1m - 15m fast momentum execution', badge: '1m - 15m', icon: '⚡' },
    { mode: 'INTRADAY', label: 'Intraday', desc: 'Same-day leveraged session trading', badge: 'Same Day', icon: '⏱️' },
    { mode: 'SWING', label: 'Swing', desc: 'Multi-day spot trend trading', badge: 'Multi-Day', icon: '📈' },
    { mode: 'LONG_TERM', label: 'Long Term', desc: 'Long-term investment portfolio holding', badge: 'Long Hold', icon: '💎' }
  ];

  readonly currentTradingModeInfo = computed(() => {
    return this.tradingModesList.find(m => m.mode === this.selectedTradingMode()) || this.tradingModesList[1];
  });

  readonly isLeverageEnabled = computed(() => {
    return this.selectedTradingMode() === 'SCALPING' || this.selectedTradingMode() === 'INTRADAY';
  });

  readonly effectiveLeverage = computed(() => {
    return this.isLeverageEnabled() ? this.selectedLeverage() : 1;
  });

  // Effective execution price (pending or market)
  readonly effectiveEntryPrice = computed(() => {
    if (this.orderType() === 'PENDING' && this.pendingPrice() && this.pendingPrice()! > 0) {
      return this.pendingPrice()!;
    }
    return this.currentQuote()?.price ?? 0;
  });

  // Position Value = Quantity * Price
  readonly positionValue = computed(() => {
    const price = this.effectiveEntryPrice();
    const qty = this.tradeQuantity() ?? 0;
    return price * qty;
  });

  // Required Margin = Position Value / Leverage
  readonly requiredMargin = computed(() => {
    const lev = this.effectiveLeverage();
    return lev > 0 ? this.positionValue() / lev : this.positionValue();
  });

  // Validation Computed Properties
  readonly hasInsufficientMargin = computed(() => {
    const balance = this.userWallet()?.cashBalance ?? 0;
    return this.requiredMargin() > balance;
  });

  readonly hasInsufficientHoldings = computed(() => {
    if (this.tradeSide() !== 'SHORT' || this.isLeverageEnabled()) return false;
    const owned = this.userHolding()?.quantity ?? 0;
    return (this.tradeQuantity() ?? 0) > owned;
  });

  // SL / TP projected P&L calculations
  readonly slProjection = computed(() => {
    const sl = this.stopLossPrice();
    const curP = this.effectiveEntryPrice();
    const qty = this.tradeQuantity();
    const margin = this.requiredMargin();
    if (!sl || !curP || !qty || sl <= 0 || curP <= 0 || margin <= 0) return null;

    let pnl = 0;
    if (this.tradeSide() === 'LONG') {
      pnl = (sl - curP) * qty;
    } else {
      pnl = (curP - sl) * qty;
    }
    const roi = (pnl / margin) * 100;
    return { pnl, roi, valid: this.tradeSide() === 'LONG' ? sl < curP : sl > curP };
  });

  readonly tpProjection = computed(() => {
    const tp = this.takeProfitPrice();
    const curP = this.effectiveEntryPrice();
    const qty = this.tradeQuantity();
    const margin = this.requiredMargin();
    if (!tp || !curP || !qty || tp <= 0 || curP <= 0 || margin <= 0) return null;

    let pnl = 0;
    if (this.tradeSide() === 'LONG') {
      pnl = (tp - curP) * qty;
    } else {
      pnl = (curP - tp) * qty;
    }
    const roi = (pnl / margin) * 100;
    return { pnl, roi, valid: this.tradeSide() === 'LONG' ? tp > curP : tp < curP };
  });

  // REAL-TIME CONTINUOUS FLOATING P&L FOR ALL OPEN POSITIONS
  readonly liveOpenPositions = computed(() => {
    const curSym = this.symbol();
    const curP = this.currentQuote()?.price;

    return this.userPositions()
      .filter(p => p.status === 'OPEN')
      .map(p => {
        const livePrice = (p.symbol === curSym && curP && curP > 0) ? curP : (p.currentPrice || p.entryPrice);
        let floatingPnl = 0;
        if (p.side === 'LONG') {
          floatingPnl = (livePrice - p.entryPrice) * p.quantity;
        } else {
          floatingPnl = (p.entryPrice - livePrice) * p.quantity;
        }
        const margin = p.marginUsed > 0 ? p.marginUsed : (p.entryPrice * p.quantity);
        const floatingPnlPercent = margin > 0 ? (floatingPnl / margin) * 100 : 0;

        return {
          ...p,
          currentPrice: livePrice,
          unrealizedPnl: floatingPnl,
          unrealizedPnlPercent: floatingPnlPercent
        };
      });
  });

  // Active open positions for currently selected symbol
  readonly activeSymbolPositions = computed(() => {
    const curSym = this.symbol();
    return this.liveOpenPositions().filter(p => p.symbol === curSym);
  });

  readonly activeSymbolPosition = computed(() => {
    const symPositions = this.activeSymbolPositions();
    return symPositions.length > 0 ? symPositions[0] : null;
  });

  readonly hasActivePosition = computed(() => {
    return this.activeSymbolPosition() !== null;
  });

  readonly isShowingPositionCard = computed(() => {
    return this.hasActivePosition() && !this.openNewOrderMode();
  });

  // Total floating P&L across all open positions
  readonly totalFloatingPnl = computed(() => {
    return this.liveOpenPositions().reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  });

  // Total floating P&L for currently selected symbol
  readonly totalSymbolFloatingPnl = computed(() => {
    return this.activeSymbolPositions().reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  });

  // Margin & Account Analytics
  readonly usedMargin = computed(() => {
    const fromWallet = this.userWallet()?.marginUsed;
    if (fromWallet != null && fromWallet > 0) return fromWallet;
    return this.liveOpenPositions().reduce((acc, p) => acc + (p.marginUsed || 0), 0);
  });

  readonly freeMargin = computed(() => {
    const fromWallet = this.userWallet()?.freeMargin;
    if (fromWallet != null && fromWallet > 0) return fromWallet;
    return this.userWallet()?.cashBalance ?? 0;
  });

  readonly totalEquity = computed(() => {
    const cash = this.userWallet()?.cashBalance ?? 0;
    const used = this.usedMargin();
    return cash + used + this.totalFloatingPnl();
  });

  readonly marginLevelPercent = computed(() => {
    const used = this.usedMargin();
    if (used <= 0) return 9999;
    return (this.totalEquity() / used) * 100;
  });

  // Live Terminal Session Clock
  readonly currentSessionTime = signal<string>('');
  private sessionClockTimer: any = null;

  // =========================================================================
  // MODIFY POSITION MODAL STATE
  // =========================================================================
  readonly isModifyModalOpen = signal<boolean>(false);
  readonly modifyingPosition = signal<PositionItem | null>(null);
  readonly modifyStopLoss = signal<number | null>(null);
  readonly modifyTakeProfit = signal<number | null>(null);
  readonly isSavingModify = signal<boolean>(false);
  readonly modifyErrorMessage = signal<string | null>(null);
  readonly modifySuccessMessage = signal<string | null>(null);

  // =========================================================================
  // CLOSE POSITION MODAL STATE & PARTIAL CLOSE
  // =========================================================================
  readonly isCloseConfirmModalOpen = signal<boolean>(false);
  readonly closingPositionTarget = signal<PositionItem | null>(null);
  readonly closeQuantity = signal<number>(1);

  readonly closeQuantityValid = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    const curP = this.currentQuote()?.price;
    if (!pos || !qty || qty <= 0 || !curP || curP <= 0) return false;
    return qty <= pos.quantity + 0.00001;
  });

  readonly closeMarginToRelease = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    if (!pos || !qty || qty <= 0 || pos.quantity <= 0) return 0;
    const ratio = Math.min(1, qty / pos.quantity);
    return (pos.marginUsed || 0) * ratio;
  });

  readonly closeEstimatedPnl = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    const curP = this.currentQuote()?.price;
    if (!pos || !qty || qty <= 0 || !curP) return 0;

    if (pos.side === 'LONG') {
      return (curP - pos.entryPrice) * qty;
    } else {
      return (pos.entryPrice - curP) * qty;
    }
  });

  readonly closeEstimatedPnlPercent = computed(() => {
    const margin = this.closeMarginToRelease();
    const pnl = this.closeEstimatedPnl();
    if (margin <= 0) return 0;
    return (pnl / margin) * 100;
  });

  readonly closeRemainingQty = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    if (!pos) return 0;
    return Math.max(0, Number((pos.quantity - (qty || 0)).toFixed(4)));
  });

  readonly closeSettlementAmount = computed(() => {
    const margin = this.closeMarginToRelease();
    const pnl = this.closeEstimatedPnl();
    return Math.max(0, margin + pnl);
  });

  // Lightweight Charts Instances
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private ema9Series: ISeriesApi<'Line'> | null = null;
  private ema21Series: ISeriesApi<'Line'> | null = null;
  private sma50Series: ISeriesApi<'Line'> | null = null;
  private seriesMarkersPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private chartPriceLines: IPriceLine[] = [];
  private livePriceLine: IPriceLine | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private paramSub?: Subscription;
  private wsTickSub?: Subscription;
  private wsConnectedSub?: Subscription;
  private livePollingSub?: Subscription;
  private boundOnVisibilityChange?: () => void;

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

    // Effect to sync price lines and markers on chart when open positions change
    effect(() => {
      const positions = this.activeSymbolPositions();
      const quote = this.currentQuote();
      if (this.candlestickSeries || this.lineSeries || this.areaSeries) {
        this.updateChartPriceLines(positions);
        this.updateLivePriceLine(quote?.price ?? 0);
      }
    });
  }

  ngOnInit(): void {
    this.updateSessionClock();
    if (typeof window !== 'undefined') {
      this.sessionClockTimer = setInterval(() => this.updateSessionClock(), 1000);
    }

    // 1. Subscribe to real-time WebSocket ticks from Spring Boot Gateway
    this.wsTickSub = this.marketWebSocketService.ticks$.subscribe((tick) => {
      this.handleLiveTick(tick);
    });

    this.wsConnectedSub = this.marketWebSocketService.isConnected$.subscribe((connected) => {
      this.isWebSocketConnected.set(connected);
      if (!connected) {
        this.isReceivingRealTicks.set(false);
      }
    });

    // 2. Handle tab visibility change
    if (typeof document !== 'undefined') {
      this.boundOnVisibilityChange = () => {
        if (document.hidden) {
          if (this.livePollingSub) {
            this.livePollingSub.unsubscribe();
            this.livePollingSub = undefined;
          }
        } else {
          this.startPollingFallback(this.symbol());
        }
      };
      document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
    }

    // 3. Handle route parameter changes
    this.paramSub = this.route.paramMap.subscribe(params => {
      const sym = params.get('symbol');
      if (sym && sym.trim().length > 0) {
        this.loadInstrumentData(decodeURIComponent(sym.trim()));
      } else {
        this.loadInstrumentData(this.symbol());
      }
    });

    if (this.authService.isAuthenticated()) {
      this.refreshTradingState();
    }
  }

  ngOnDestroy(): void {
    this.stopLiveStream();
    this.paramSub?.unsubscribe();
    this.wsTickSub?.unsubscribe();
    this.wsConnectedSub?.unsubscribe();

    if (this.boundOnVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
    }

    if (this.sessionClockTimer) {
      clearInterval(this.sessionClockTimer);
      this.sessionClockTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.seriesMarkersPlugin = null;
      this.chart.remove();
      this.chart = null;
    }
  }

  private updateSessionClock(): void {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
    this.currentSessionTime.set(timeStr);
  }

  // =========================================================================
  // INSTRUMENT SELECTION, TABS & SYMBOL SEARCH
  // =========================================================================

  private loadOpenInstruments(): TopInstrumentItem[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('exness_open_instruments');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return StockDetailsComponent.DEFAULT_INSTRUMENTS;
  }

  private saveOpenInstruments(list: TopInstrumentItem[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('exness_open_instruments', JSON.stringify(list));
      } catch (e) {}
    }
  }

  selectSymbol(sym: string): void {
    const cleanSym = sym.trim().toUpperCase();
    if (!cleanSym) return;

    // Check if symbol is in top bar; if not, add it
    const exists = this.topInstruments().some(i => i.symbol === cleanSym);
    if (!exists) {
      let marketType = 'Stock';
      if (cleanSym.includes('NIFTY') || cleanSym.includes('SENSEX')) marketType = 'Index';
      else if (cleanSym === 'XAU/USD' || cleanSym === 'USOIL') marketType = 'Commodity';
      else if (cleanSym.includes('/') && (cleanSym.startsWith('BTC') || cleanSym.startsWith('ETH') || cleanSym.startsWith('SOL'))) marketType = 'Crypto';
      else if (cleanSym.includes('/')) marketType = 'Forex';

      const updated = [
        ...this.topInstruments(),
        { symbol: cleanSym, name: cleanSym, marketType }
      ];
      this.topInstruments.set(updated);
      this.saveOpenInstruments(updated);
    }

    if (cleanSym === this.symbol()) return;
    this.navigateToStock(cleanSym);
  }

  closeInstrumentTab(symToClose: string, event: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const currentList = this.topInstruments();
    const targetIdx = currentList.findIndex(i => i.symbol === symToClose);
    if (targetIdx === -1) return;

    // Filter out the closed tab
    const updatedList = currentList.filter(i => i.symbol !== symToClose);

    // If active tab was closed
    if (this.symbol() === symToClose) {
      if (updatedList.length > 0) {
        // Pick next available tab (same index if within bounds, otherwise last item)
        const nextIdx = targetIdx < updatedList.length ? targetIdx : updatedList.length - 1;
        const nextSymbol = updatedList[nextIdx].symbol;
        this.topInstruments.set(updatedList);
        this.saveOpenInstruments(updatedList);
        this.selectSymbol(nextSymbol);
      } else {
        // Fallback to default instrument if all tabs closed
        const fallback = StockDetailsComponent.DEFAULT_INSTRUMENTS[0];
        const fallbackList = [fallback];
        this.topInstruments.set(fallbackList);
        this.saveOpenInstruments(fallbackList);
        this.selectSymbol(fallback.symbol);
      }
    } else {
      // Non-active tab closed
      if (updatedList.length === 0) {
        const fallback = StockDetailsComponent.DEFAULT_INSTRUMENTS[0];
        const fallbackList = [fallback];
        this.topInstruments.set(fallbackList);
        this.saveOpenInstruments(fallbackList);
      } else {
        this.topInstruments.set(updatedList);
        this.saveOpenInstruments(updatedList);
      }
    }
  }

  openSearchModal(): void {
    this.symbolSearchQuery.set('');
    this.searchResults.set([]);
    this.isSearchModalOpen.set(true);
  }

  closeSearchModal(): void {
    this.isSearchModalOpen.set(false);
  }

  onSearchQueryChange(query: string): void {
    this.symbolSearchQuery.set(query);
    const q = query.trim();
    if (!q) {
      this.searchResults.set([]);
      return;
    }

    this.isSearchingSymbols.set(true);
    this.marketService.searchSymbols(q).subscribe({
      next: (results) => {
        this.searchResults.set(results?.bestMatches || []);
        this.isSearchingSymbols.set(false);
      },
      error: () => {
        this.isSearchingSymbols.set(false);
      }
    });
  }

  selectSearchResult(item: any): void {
    const sym = item.symbol || item;
    this.closeSearchModal();
    this.selectSymbol(sym);
  }

  // =========================================================================
  // INSTRUMENT DATA LOADING & REAL-TIME STREAMING
  // =========================================================================

  loadInstrumentData(symbol: string): void {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    this.symbol.set(cleanSym);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.isMarketDataUnavailable.set(false);
    this.tradeSuccessReceipt.set(null);
    this.tradeErrorMessage.set(null);
    this.stopLossPrice.set(null);
    this.takeProfitPrice.set(null);

    // Derive display metadata
    if (cleanSym.includes('NIFTY') || cleanSym.includes('SENSEX')) {
      this.instrumentType.set('Index');
      this.exchange.set(cleanSym.includes('SENSEX') ? 'BSE' : 'NSE');
      this.companyName.set(cleanSym.includes('SENSEX') ? 'BSE SENSEX Index' : 'NIFTY 50 Index');
    } else if (cleanSym === 'XAU/USD') {
      this.instrumentType.set('Commodity');
      this.exchange.set('Metals');
      this.companyName.set('Gold / US Dollar');
    } else if (cleanSym === 'USOIL') {
      this.instrumentType.set('Commodity');
      this.exchange.set('Energy');
      this.companyName.set('WTI Crude Oil');
    } else if (cleanSym.includes('/')) {
      this.instrumentType.set(cleanSym.startsWith('BTC') || cleanSym.startsWith('ETH') || cleanSym.startsWith('SOL') ? 'Crypto' : 'Forex');
      this.exchange.set(this.instrumentType() === 'Crypto' ? 'Binance' : 'Forex');
      this.companyName.set(cleanSym);
    } else if (this.marketService.isIndianSymbol(cleanSym)) {
      this.instrumentType.set('Stock');
      this.exchange.set('NSE');
      this.companyName.set(cleanSym);
    } else {
      this.instrumentType.set('Stock');
      this.exchange.set('NASDAQ');
      this.companyName.set(cleanSym);
    }

    // Ensure tab exists in open tabs list
    const exists = this.topInstruments().some(i => i.symbol === cleanSym);
    if (!exists) {
      const updated = [
        ...this.topInstruments(),
        { symbol: cleanSym, name: cleanSym, marketType: this.instrumentType() }
      ];
      this.topInstruments.set(updated);
      this.saveOpenInstruments(updated);
    }

    // Fetch initial quote & candles
    this.fetchQuote(cleanSym);
    const opt = this.intervals.find(i => i.value === this.currentInterval());
    this.fetchCandlesByInterval(cleanSym, this.currentInterval(), opt ? opt.outputsize : 100);

    // Start WebSocket stream + fallback
    this.startLiveStream(cleanSym);

    // Load persisted drawings for this symbol
    this.loadDrawingsForSymbol(cleanSym);

    if (this.authService.isAuthenticated()) {
      this.refreshTradingState();
    }
  }

  private startLiveStream(symbol: string): void {
    this.stopLiveStream();
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    this.isReceivingRealTicks.set(false);
    this.isStreamingUnavailable.set(false);
    this.streamStatusMessage.set(null);

    this.marketWebSocketService.subscribe(cleanSym, this.currentInterval());
    this.startPollingFallback(cleanSym);
  }

  private startPollingFallback(symbol: string): void {
    if (this.livePollingSub) {
      this.livePollingSub.unsubscribe();
      this.livePollingSub = undefined;
    }

    this.livePollingSub = timer(3000, 3000).subscribe(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const timeSinceLastTick = Date.now() - this.lastLiveTimestamp();
      if (timeSinceLastTick >= 2500) {
        this.pollFreshQuote(symbol);
      }
    });
  }

  private stopLiveStream(): void {
    const curSym = this.symbol();
    if (curSym) {
      this.marketWebSocketService.unsubscribe(curSym);
    }
    if (this.livePollingSub) {
      this.livePollingSub.unsubscribe();
      this.livePollingSub = undefined;
    }
  }

  private handleLiveTick(tick: MarketTick): void {
    if (!tick) return;
    const currentSym = this.symbol();

    if (tick.type === 'STATUS') {
      if (!tick.symbol || this.isMatchingSymbol(currentSym, tick.symbol, tick.instrumentKey)) {
        if (tick.status === 'DATA_UNAVAILABLE' || tick.streamingSupported === false) {
          this.isStreamingUnavailable.set(true);
          this.isReceivingRealTicks.set(false);
          this.streamStatusMessage.set(tick.message || 'Streaming unavailable');
        } else if (tick.status === 'CONNECTED') {
          this.isWebSocketConnected.set(true);
        }
      }
      return;
    }

    if (tick.type === 'PONG' || tick.price == null) return;

    if (tick.symbol && !this.isMatchingSymbol(currentSym, tick.symbol, tick.instrumentKey)) {
      return;
    }

    this.isReceivingRealTicks.set(true);
    this.isStreamingUnavailable.set(false);
    this.streamStatusMessage.set(null);
    this.isMarketDataUnavailable.set(false);
    this.lastLiveTimestamp.set(Date.now());

    if (this.errorMessage() === 'Live market data unavailable') {
      this.errorMessage.set(null);
    }

    const prev = this.currentQuote();
    const price = tick.price;
    const prevClose = prev?.previousClose || prev?.price || price;
    const change = tick.change != null ? tick.change : (price - prevClose);
    const changePercent = tick.changePercent || (prevClose > 0 ? `${change >= 0 ? '+' : ''}${((change / prevClose) * 100).toFixed(2)}%` : '+0.00%');

    const updatedQuote: StockQuote = {
      symbol: currentSym,
      name: prev?.name || this.companyName(),
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
    this.processLiveCandleTick(price, tick.volume, tick.timestamp);
  }

  private pollFreshQuote(symbol: string): void {
    this.marketService.getQuote(symbol, true).subscribe({
      next: (quote) => {
        if (quote && quote.price != null && quote.price > 0) {
          this.isMarketDataUnavailable.set(false);
          if (this.errorMessage() === 'Live market data unavailable') {
            this.errorMessage.set(null);
          }
          this.currentQuote.set(quote);
          if (quote.name && quote.name !== symbol) {
            this.companyName.set(quote.name);
          }
          this.processLiveCandleTick(quote.price, quote.volume, quote.timestamp ? quote.timestamp * 1000 : Date.now());
        }
      },
      error: () => {
        if (!this.currentQuote() || this.currentQuote()?.price == null) {
          this.isMarketDataUnavailable.set(true);
          this.errorMessage.set('Live market data unavailable');
        }
      }
    });
  }

  private processLiveCandleTick(livePrice: number, liveVolume?: number | null, tickTsMs?: number | null): void {
    const candles = this.candleData();
    if (!candles || candles.length === 0 || livePrice == null || livePrice <= 0) return;

    const intervalSec = this.getIntervalSeconds(this.currentInterval());
    const tickTsSec = tickTsMs ? Math.floor(tickTsMs / 1000) : Math.floor(Date.now() / 1000);
    const currentBucket = Math.floor(tickTsSec / intervalSec) * intervalSec;

    const lastIdx = candles.length - 1;
    const last = { ...candles[lastIdx] };
    const lastBucket = Math.floor(last.timestamp / intervalSec) * intervalSec;

    if (currentBucket > lastBucket) {
      const newCandle: Candle = {
        timestamp: currentBucket,
        datetime: new Date(currentBucket * 1000).toISOString(),
        open: livePrice,
        high: livePrice,
        low: livePrice,
        close: livePrice,
        volume: liveVolume || 0
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
    } else {
      const updatedCandle: Candle = {
        ...last,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
        close: livePrice,
        volume: (last.volume || 0) + (liveVolume || 0)
      };

      const updatedCandles = [...candles.slice(0, lastIdx), updatedCandle];
      this.candleData.set(updatedCandles);

      if (this.candlestickSeries) {
        try {
          this.candlestickSeries.update({
            time: (updatedCandle.timestamp as unknown) as Time,
            open: updatedCandle.open,
            high: updatedCandle.high,
            low: updatedCandle.low,
            close: updatedCandle.close
          });
        } catch (e) {}
      } else if (this.lineSeries) {
        try {
          this.lineSeries.update({
            time: (updatedCandle.timestamp as unknown) as Time,
            value: updatedCandle.close
          });
        } catch (e) {}
      } else if (this.areaSeries) {
        try {
          this.areaSeries.update({
            time: (updatedCandle.timestamp as unknown) as Time,
            value: updatedCandle.close
          });
        } catch (e) {}
      }
    }
  }

  private isMatchingSymbol(currentSymbol: string, tickSymbol?: string, instrumentKey?: string): boolean {
    if (!currentSymbol) return false;
    const c = currentSymbol.trim().toUpperCase();
    if (tickSymbol) {
      const t = tickSymbol.trim().toUpperCase();
      if (c === t || c.replace(/[\s\/\-_]+/g, '') === t.replace(/[\s\/\-_]+/g, '')) return true;
    }
    if (instrumentKey) {
      const ik = instrumentKey.toUpperCase();
      if (ik.includes(c) || ik.includes(c.replace(/[\s\/\-_]+/g, ''))) return true;
    }
    return false;
  }

  private getIntervalSeconds(interval: StockDetailInterval): number {
    switch (interval) {
      case '1min': return 60;
      case '5min': return 300;
      case '15min': return 900;
      case '30min': return 1800;
      case '1h': return 3600;
      case '4h': return 14400;
      case '1day': return 86400;
      case '1week': return 604800;
      default: return 300;
    }
  }

  fetchQuote(symbol: string): void {
    this.isLoadingQuote.set(true);
    this.marketService.getQuote(symbol).subscribe({
      next: (quote) => {
        this.currentQuote.set(quote);
        if (quote.name && quote.name !== symbol) {
          this.companyName.set(quote.name);
        }
        this.isLoadingQuote.set(false);
        this.isMarketDataUnavailable.set(false);
      },
      error: (err) => {
        this.isLoadingQuote.set(false);
        this.handleError(err, symbol);
      }
    });
  }

  fetchCandlesByInterval(symbol: string, interval: StockDetailInterval, outputsize: number): void {
    this.isLoadingCandles.set(true);
    this.errorMessage.set(null);

    this.marketService.getCandles(symbol, interval, outputsize).subscribe({
      next: (res) => {
        this.candleData.set(res?.candles || []);
        this.isLoadingCandles.set(false);
      },
      error: (err) => {
        this.isLoadingCandles.set(false);
        this.handleError(err, symbol);
      }
    });
  }

  refreshTradingState(): void {
    const sym = this.symbol();
    this.tradingService.getWallet().subscribe({
      next: (wallet) => this.userWallet.set(wallet),
      error: () => {}
    });

    this.tradingService.getHoldingForSymbol(sym).subscribe({
      next: (holding) => this.userHolding.set(holding),
      error: () => this.userHolding.set(null)
    });

    this.tradingService.getPositions(undefined, 'OPEN').subscribe({
      next: (positions) => this.userPositions.set(positions || []),
      error: () => this.userPositions.set([])
    });

    this.tradingService.getPositions(undefined, 'CLOSED').subscribe({
      next: (closed) => this.closedPositions.set(closed || []),
      error: () => this.closedPositions.set([])
    });
  }

  readonly activeSymbolClosedPositions = computed(() => {
    const curSym = this.symbol();
    return this.closedPositions().filter(p => p.symbol === curSym);
  });

  private handleError(err: any, symbol: string): void {
    if (err.status === 429) {
      this.isRateLimited.set(true);
      this.errorMessage.set('Market data rate limit reached. Please try again shortly.');
    } else if (err.status === 404) {
      this.errorMessage.set('Data unavailable');
    } else if (err.status === 504) {
      this.errorMessage.set('Market data request timed out.');
    } else {
      this.errorMessage.set(err.error?.message || err.message || 'Data unavailable');
    }
  }

  // =========================================================================
  // LIGHTWEIGHT CHARTS RENDERING & OVERLAYS
  // =========================================================================

  formatBarDateTime(timeVal: any): string {
    if (!timeVal) return '';
    if (typeof timeVal === 'number') {
      const d = new Date(timeVal * 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (typeof timeVal === 'string') {
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
      return timeVal;
    }
    return String(timeVal);
  }

  private initOrUpdateChart(container: HTMLDivElement, candles: Candle[], chartType: ChartType): void {
    if (!container || candles.length === 0 || typeof window === 'undefined') return;

    try {
      if (!this.chart) {
        const bgColor = '#ffffff';
        const textColor = '#334155';
        const gridColor = '#f1f5f9';
        const borderColor = '#e2e8f0';

        this.chart = createChart(container, {
          width: container.clientWidth || 800,
          height: container.clientHeight || 500,
          layout: {
            background: { type: ColorType.Solid, color: bgColor },
            textColor: textColor,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 11
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              width: 1,
              color: '#0284c7',
              style: LineStyle.Dashed,
              labelBackgroundColor: '#0f172a'
            },
            horzLine: {
              width: 1,
              color: '#0284c7',
              style: LineStyle.Dashed,
              labelBackgroundColor: '#0f172a'
            }
          },
          rightPriceScale: {
            borderColor: borderColor,
            visible: true,
            autoScale: true,
            scaleMargins: {
              top: 0.06,
              bottom: 0.18
            }
          },
          timeScale: {
            borderColor: borderColor,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 10
          }
        });

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

        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !this.chart) return;
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
              this.chart.applyOptions({ width, height });
              setTimeout(() => this.syncDrawingCoordinates(), 30);
            }
          });
          this.resizeObserver.observe(container);
        }
      }

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
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
      }));

      // Clear existing series
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
      if (this.ema9Series) {
        this.chart.removeSeries(this.ema9Series);
        this.ema9Series = null;
      }
      if (this.ema21Series) {
        this.chart.removeSeries(this.ema21Series);
        this.ema21Series = null;
      }
      if (this.sma50Series) {
        this.chart.removeSeries(this.sma50Series);
        this.sma50Series = null;
      }

      // Add Volume Series
      if (this.activeIndicators().volume) {
        this.volumeSeries = this.chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: ''
        });
        this.volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 }
        });
        this.volumeSeries.setData(volumeData);
      }

      // Add Main Series
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
          color: '#38bdf8',
          lineWidth: 2
        });
        this.lineSeries.setData(lineData);
      } else if (chartType === 'area') {
        this.areaSeries = this.chart.addSeries(AreaSeries, {
          topColor: 'rgba(56, 189, 248, 0.4)',
          bottomColor: 'rgba(56, 189, 248, 0.02)',
          lineColor: '#38bdf8',
          lineWidth: 2
        });
        this.areaSeries.setData(lineData);
      }

      // Add Indicator Overlay Series
      if (this.activeIndicators().ema9) {
        const ema9Result = calculateEMA(candles, 9);
        if (ema9Result.isSufficient) {
          this.ema9Series = this.chart.addSeries(LineSeries, {
            color: '#06b6d4',
            lineWidth: 1,
            title: 'EMA 9'
          });
          this.ema9Series.setData(ema9Result.data.map(d => ({ time: (d.time as unknown) as Time, value: d.value })));
        }
      }

      if (this.activeIndicators().ema21) {
        const ema21Result = calculateEMA(candles, 21);
        if (ema21Result.isSufficient) {
          this.ema21Series = this.chart.addSeries(LineSeries, {
            color: '#ec4899',
            lineWidth: 1,
            title: 'EMA 21'
          });
          this.ema21Series.setData(ema21Result.data.map(d => ({ time: (d.time as unknown) as Time, value: d.value })));
        }
      }

      if (this.activeIndicators().sma50) {
        const sma50Result = calculateSMA(candles, 50);
        if (sma50Result.isSufficient) {
          this.sma50Series = this.chart.addSeries(LineSeries, {
            color: '#eab308',
            lineWidth: 1,
            title: 'SMA 50'
          });
          this.sma50Series.setData(sma50Result.data.map(d => ({ time: (d.time as unknown) as Time, value: d.value })));
        }
      }

      this.chart.timeScale().fitContent();
      this.updateChartPriceLines(this.activeSymbolPositions());
      this.updateLivePriceLine(this.currentQuote()?.price ?? 0);
      setTimeout(() => this.syncDrawingCoordinates(), 50);
    } catch (e) {}
  }

  toggleIndicator(name: 'ema9' | 'ema21' | 'sma50' | 'volume'): void {
    this.activeIndicators.update(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
    const container = this.chartContainerRef()?.nativeElement;
    const data = this.candleData();
    if (container && data.length > 0) {
      this.initOrUpdateChart(container, data, this.currentChartType());
    }
  }

  private updateLivePriceLine(price: number): void {
    const activeSeries = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (!activeSeries || !price || price <= 0) return;

    try {
      if (this.livePriceLine) {
        activeSeries.removePriceLine(this.livePriceLine);
        this.livePriceLine = null;
      }
      this.livePriceLine = activeSeries.createPriceLine({
        price: price,
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'LIVE'
      });
    } catch {}
  }

  private updateChartPriceLines(positions: any[]): void {
    const activeSeries = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (!activeSeries) return;

    try {
      for (const pl of this.chartPriceLines) {
        try {
          activeSeries.removePriceLine(pl);
        } catch {}
      }
      this.chartPriceLines = [];

      const markers: SeriesMarker<Time>[] = [];

      for (const pos of positions) {
        if (!pos || pos.status !== 'OPEN') continue;

        const isLong = pos.side === 'LONG';
        const pnl = pos.unrealizedPnl || 0;
        const pnlSign = pnl >= 0 ? '+' : '-';
        const pnlStr = `${pnlSign}$${Math.abs(pnl).toFixed(2)} (${pos.unrealizedPnlPercent >= 0 ? '+' : ''}${(pos.unrealizedPnlPercent || 0).toFixed(2)}%)`;
        const label = `${pos.side} ${pos.quantity}L @ ${pos.entryPrice.toFixed(2)} | ${pnlStr}`;

        // Entry Line
        const entryLine = activeSeries.createPriceLine({
          price: pos.entryPrice,
          color: isLong ? '#10b981' : '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: label
        });
        this.chartPriceLines.push(entryLine);

        // SL Line
        if (pos.stopLoss && pos.stopLoss > 0) {
          const slLine = activeSeries.createPriceLine({
            price: pos.stopLoss,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `SL @ ${pos.stopLoss.toFixed(2)}`
          });
          this.chartPriceLines.push(slLine);
        }

        // TP Line
        if (pos.takeProfit && pos.takeProfit > 0) {
          const tpLine = activeSeries.createPriceLine({
            price: pos.takeProfit,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `TP @ ${pos.takeProfit.toFixed(2)}`
          });
          this.chartPriceLines.push(tpLine);
        }

        // Position Marker
        if (pos.createdAt && this.candleData().length > 0) {
          const tsSec = Math.floor(new Date(pos.createdAt).getTime() / 1000);
          const candles = this.candleData();
          // Find closest candle time
          const matchCandle = candles.find(c => Math.abs(c.timestamp - tsSec) < 1800) || candles[candles.length - 1];
          if (matchCandle) {
            markers.push({
              time: (matchCandle.timestamp as unknown) as Time,
              position: isLong ? 'belowBar' : 'aboveBar',
              color: isLong ? '#10b981' : '#f43f5e',
              shape: isLong ? 'arrowUp' : 'arrowDown',
              text: `${pos.side} ${pos.quantity}L @ ${pos.entryPrice.toFixed(2)}`
            });
          }
        }
      }

      if (this.candlestickSeries) {
        try {
          if (!this.seriesMarkersPlugin) {
            this.seriesMarkersPlugin = createSeriesMarkers(this.candlestickSeries, markers);
          } else {
            this.seriesMarkersPlugin.setMarkers(markers);
          }
        } catch {}
      }
    } catch {}
  }

  // =========================================================================
  // SIMULATED TRADING ACTIONS
  // =========================================================================

  setTradeSide(side: PositionSide): void {
    this.tradeSide.set(side);
    this.tradeErrorMessage.set(null);
  }

  setTradingMode(mode: TradingMode): void {
    this.selectedTradingMode.set(mode);
    if (mode === 'SCALPING') {
      this.setInterval('1min');
    } else if (mode === 'INTRADAY') {
      this.setInterval('5min');
    }
  }

  setLeverage(lev: number): void {
    this.selectedLeverage.set(lev);
  }

  setTradeQuantity(qty: number): void {
    const val = Math.max(0.0001, Number(qty) || 0.1);
    this.tradeQuantity.set(val);
  }

  adjustQuantity(delta: number): void {
    const cur = this.tradeQuantity() || 0.1;
    const nextVal = Math.max(0.0001, Number((cur + delta).toFixed(4)));
    this.tradeQuantity.set(nextVal);
  }

  setQuickLot(lot: number): void {
    this.tradeQuantity.set(lot);
  }

  setMaxQuantity(): void {
    const currentPrice = this.effectiveEntryPrice();
    if (!currentPrice || currentPrice <= 0) return;

    const balance = this.userWallet()?.cashBalance ?? 0;
    const leverage = this.effectiveLeverage();
    const maxAffordable = (balance * leverage) / currentPrice;
    this.tradeQuantity.set(Number(Math.max(0.01, maxAffordable).toFixed(2)));
  }

  setQuickSlPercent(percent: number): void {
    const curP = this.effectiveEntryPrice();
    if (!curP) return;

    if (this.tradeSide() === 'LONG') {
      const sl = curP * (1 - percent / 100);
      this.stopLossPrice.set(Number(sl.toFixed(2)));
    } else {
      const sl = curP * (1 + percent / 100);
      this.stopLossPrice.set(Number(sl.toFixed(2)));
    }
  }

  setQuickTpPercent(percent: number): void {
    const curP = this.effectiveEntryPrice();
    if (!curP) return;

    if (this.tradeSide() === 'LONG') {
      const tp = curP * (1 + percent / 100);
      this.takeProfitPrice.set(Number(tp.toFixed(2)));
    } else {
      const tp = curP * (1 - percent / 100);
      this.takeProfitPrice.set(Number(tp.toFixed(2)));
    }
  }

  showToast(type: 'success' | 'error', message: string, sub?: string): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.tradeToast.set({ show: true, type, message, sub });
    if (typeof window !== 'undefined') {
      this.toastTimeout = setTimeout(() => {
        this.tradeToast.set(null);
      }, 4500);
    }
  }

  dismissToast(): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.tradeToast.set(null);
  }

  setOrderType(type: 'MARKET' | 'PENDING'): void {
    this.orderType.set(type);
    if (type === 'PENDING' && !this.pendingPrice()) {
      this.pendingPrice.set(this.currentQuote()?.price || 100);
    }
  }

  setActiveBottomTab(tab: 'OPEN' | 'PENDING' | 'CLOSED'): void {
    this.activeBottomTab.set(tab);
    if (this.isTerminalCollapsed()) {
      this.isTerminalCollapsed.set(false);
    }
  }

  toggleTerminalCollapse(): void {
    this.isTerminalCollapsed.update(v => !v);
  }

  toggleTerminalExpand(): void {
    this.isTerminalExpanded.update(v => !v);
  }

  submitTrade(): void {
    if (!this.authService.isAuthenticated()) {
      this.tradeErrorMessage.set('Please log in to execute simulated trades.');
      this.showToast('error', 'Authentication required', 'Please log in to trade');
      return;
    }

    const qty = this.tradeQuantity();
    if (!qty || qty <= 0) {
      this.tradeErrorMessage.set('Quantity must be greater than zero.');
      return;
    }

    if (!this.hasTradableQuote()) {
      this.tradeErrorMessage.set('Live market data unavailable');
      this.showToast('error', 'Market data unavailable', 'Live market data unavailable');
      return;
    }

    if (this.hasInsufficientMargin()) {
      const errMsg = `Insufficient virtual balance. Required: $${this.requiredMargin().toFixed(2)}, Available: $${this.freeMargin().toFixed(2)}`;
      this.tradeErrorMessage.set(errMsg);
      this.showToast('error', 'Insufficient margin', errMsg);
      return;
    }

    const sym = this.symbol();
    const mode = this.selectedTradingMode();
    const side = this.tradeSide();
    const leverage = this.effectiveLeverage();
    const sl = this.stopLossPrice() || undefined;
    const tp = this.takeProfitPrice() || undefined;

    this.isSubmittingTrade.set(true);
    this.tradeErrorMessage.set(null);

    const action$ = side === 'LONG'
      ? this.tradingService.buy({
          symbol: sym,
          quantity: qty,
          tradingMode: mode,
          side: 'LONG',
          leverage: leverage,
          stopLoss: sl,
          takeProfit: tp
        })
      : this.tradingService.sell({
          symbol: sym,
          quantity: qty,
          tradingMode: mode,
          side: 'SHORT',
          leverage: leverage,
          stopLoss: sl,
          takeProfit: tp
        });

    action$.subscribe({
      next: (receipt) => {
        this.isSubmittingTrade.set(false);
        this.tradeSuccessReceipt.set(receipt);
        this.showToast(
          'success',
          `✓ ${receipt.orderType === 'BUY' ? 'BUY / LONG' : 'SELL / SHORT'} executed successfully`,
          `${receipt.quantity} LOT on ${receipt.symbol} at ${this.formatCurrencySymbol(receipt.symbol)}${receipt.executionPrice != null ? receipt.executionPrice.toFixed(2) : ''}`
        );
        this.refreshTradingState();
      },
      error: (err) => {
        this.isSubmittingTrade.set(false);
        const errMsg = err.error?.message || err.message || 'Trade execution failed';
        this.tradeErrorMessage.set(errMsg);
        this.showToast('error', 'Trade rejected', errMsg);
      }
    });
  }

  closePosition(pos: PositionItem, quantity?: number): void {
    if (!pos || !pos.id) return;

    if (!this.hasTradableQuote()) {
      this.tradeErrorMessage.set('Live market data unavailable');
      this.showToast('error', 'Market data unavailable', 'Live market data unavailable');
      return;
    }

    const qtyToClose = quantity != null && quantity > 0 ? quantity : undefined;
    this.isClosingPositionId.set(pos.id);
    this.tradingService.closePosition(pos.id, qtyToClose).subscribe({
      next: (closedPos) => {
        this.isClosingPositionId.set(null);
        this.showToast(
          'success',
          `✓ Position closed successfully`,
          `${qtyToClose || pos.quantity} LOT on ${pos.symbol} at ${this.formatCurrencySymbol(pos.symbol)}${closedPos.closePrice != null ? closedPos.closePrice.toFixed(2) : ''}`
        );
        this.refreshTradingState();
      },
      error: (err) => {
        this.isClosingPositionId.set(null);
        const errMsg = err.error?.message || err.message || 'Failed to close position';
        this.tradeErrorMessage.set(errMsg);
        this.showToast('error', 'Close failed', errMsg);
      }
    });
  }

  openCloseConfirmModal(pos: PositionItem, defaultQty?: number): void {
    this.closingPositionTarget.set(pos);
    const initialQty = defaultQty != null && defaultQty > 0 ? Math.min(defaultQty, pos.quantity) : pos.quantity;
    this.closeQuantity.set(initialQty);
    this.isCloseConfirmModalOpen.set(true);
  }

  closeCloseConfirmModal(): void {
    this.isCloseConfirmModalOpen.set(false);
    this.closingPositionTarget.set(null);
  }

  setClosePercent(percent: number): void {
    const pos = this.closingPositionTarget();
    if (!pos || !pos.quantity) return;
    const qty = Number(((pos.quantity * percent) / 100).toFixed(4));
    this.closeQuantity.set(Math.max(0.0001, qty));
  }

  setCloseQuantity(qty: number): void {
    const pos = this.closingPositionTarget();
    const maxQty = pos?.quantity || 999999;
    const val = Math.max(0.0001, Math.min(Number(qty) || 0.01, maxQty));
    this.closeQuantity.set(val);
  }

  adjustCloseQuantity(delta: number): void {
    const cur = this.closeQuantity() || 0.1;
    const pos = this.closingPositionTarget();
    const maxQty = pos?.quantity || 999999;
    const nextVal = Math.max(0.0001, Math.min(Number((cur + delta).toFixed(4)), maxQty));
    this.closeQuantity.set(nextVal);
  }

  confirmClosePosition(): void {
    const pos = this.closingPositionTarget();
    if (!pos || !pos.id) return;
    const qty = this.closeQuantity();
    this.closeCloseConfirmModal();
    this.closePosition(pos, qty);
  }

  openModifyModal(pos: PositionItem): void {
    this.modifyingPosition.set(pos);
    this.modifyStopLoss.set(pos.stopLoss || null);
    this.modifyTakeProfit.set(pos.takeProfit || null);
    this.modifyErrorMessage.set(null);
    this.modifySuccessMessage.set(null);
    this.isModifyModalOpen.set(true);
  }

  closeModifyModal(): void {
    this.isModifyModalOpen.set(false);
    this.modifyingPosition.set(null);
    this.modifyErrorMessage.set(null);
    this.modifySuccessMessage.set(null);
  }

  setModifySlPercent(percent: number): void {
    const pos = this.modifyingPosition();
    const curP = this.currentQuote()?.price || pos?.entryPrice;
    if (!pos || !curP) return;

    if (pos.side === 'LONG') {
      const sl = curP * (1 - percent / 100);
      this.modifyStopLoss.set(Number(sl.toFixed(2)));
    } else {
      const sl = curP * (1 + percent / 100);
      this.modifyStopLoss.set(Number(sl.toFixed(2)));
    }
  }

  setModifyTpPercent(percent: number): void {
    const pos = this.modifyingPosition();
    const curP = this.currentQuote()?.price || pos?.entryPrice;
    if (!pos || !curP) return;

    if (pos.side === 'LONG') {
      const tp = curP * (1 + percent / 100);
      this.modifyTakeProfit.set(Number(tp.toFixed(2)));
    } else {
      const tp = curP * (1 - percent / 100);
      this.modifyTakeProfit.set(Number(tp.toFixed(2)));
    }
  }

  submitModifyPosition(): void {
    const pos = this.modifyingPosition();
    if (!pos || !pos.id) return;

    this.isSavingModify.set(true);
    this.modifyErrorMessage.set(null);
    this.modifySuccessMessage.set(null);

    const sl = this.modifyStopLoss() || undefined;
    const tp = this.modifyTakeProfit() || undefined;

    this.tradingService.updateSlTp(pos.id, sl, tp).subscribe({
      next: () => {
        this.isSavingModify.set(false);
        this.modifySuccessMessage.set('Position SL/TP updated successfully.');
        this.refreshTradingState();
        setTimeout(() => {
          this.closeModifyModal();
        }, 900);
      },
      error: (err) => {
        this.isSavingModify.set(false);
        this.modifyErrorMessage.set(err.error?.message || err.message || 'Failed to update position SL/TP');
      }
    });
  }

  // =========================================================================
  // PRICE ALERT ACTIONS
  // =========================================================================

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
      symbol: this.symbol(),
      condition: this.alertCondition(),
      targetPrice: price,
      notes: this.alertNotes().trim() || undefined
    }).subscribe({
      next: () => {
        this.isSavingAlert.set(false);
        this.alertSuccessMessage.set(`Alert set: ${this.symbol()} ${this.alertCondition()} ${this.formatCurrencySymbol(this.symbol())}${price.toFixed(2)}`);
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

  // =========================================================================
  // USER ACTIONS
  // =========================================================================

  setInterval(iv: StockDetailInterval): void {
    this.currentInterval.set(iv);
    const opt = this.intervals.find(i => i.value === iv);
    const outputsize = opt ? opt.outputsize : 100;
    this.fetchCandlesByInterval(this.symbol(), iv, outputsize);
    this.marketWebSocketService.subscribe(this.symbol(), iv);
  }

  setTimeframe(tf: TimeframeRange): void {
    this.currentTimeframe.set(tf);
    let interval: StockDetailInterval = '5min';
    let outputsize = 100;
    switch (tf) {
      case '1D': interval = '5min'; outputsize = 78; break;
      case '1W': interval = '15min'; outputsize = 130; break;
      case '1M': interval = '1h'; outputsize = 160; break;
      case '3M': interval = '1day'; outputsize = 90; break;
      case '6M': interval = '1day'; outputsize = 180; break;
      case '1Y': interval = '1day'; outputsize = 365; break;
    }
    this.currentInterval.set(interval);
    this.fetchCandlesByInterval(this.symbol(), interval, outputsize);
    this.marketWebSocketService.subscribe(this.symbol(), interval);
  }

  setChartType(type: ChartType): void {
    this.currentChartType.set(type);
  }

  fitChart(): void {
    if (this.chart) {
      this.chart.timeScale().fitContent();
      this.chart.priceScale('right').applyOptions({ autoScale: true });
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    setTimeout(() => {
      if (this.chart && this.chartContainerRef()) {
        const container = this.chartContainerRef()!.nativeElement;
        this.chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight
        });
        this.chart.timeScale().fitContent();
      }
    }, 150);
  }

  refreshData(): void {
    this.loadInstrumentData(this.symbol());
  }

  toggleOpenNewOrder(force?: boolean): void {
    if (force !== undefined) {
      this.openNewOrderMode.set(force);
    } else {
      this.openNewOrderMode.update(v => !v);
    }
  }

  toggleIndicatorMenu(): void {
    this.isIndicatorMenuOpen.update(v => !v);
    this.isTimeframeMenuOpen.set(false);
    this.isChartTypeMenuOpen.set(false);
  }

  toggleChartTypeMenu(): void {
    this.isChartTypeMenuOpen.update(v => !v);
    this.isIndicatorMenuOpen.set(false);
    this.isTimeframeMenuOpen.set(false);
  }

  toggleTimeframeMenu(): void {
    this.isTimeframeMenuOpen.update(v => !v);
    this.isIndicatorMenuOpen.set(false);
    this.isChartTypeMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.left-vertical-toolbar') && !target.closest('.header-chart-type-picker') && !target.closest('.header-indicators-toggles')) {
      this.closeAllToolMenus();
    }
  }

  closeAllToolMenus(): void {
    this.isIndicatorMenuOpen.set(false);
    this.isChartTypeMenuOpen.set(false);
    this.isTimeframeMenuOpen.set(false);
    this.openToolGroupId.set(null);
  }

  // =========================================================================
  // DRAWING TOOL INTERACTIONS & SVG OVERLAY ENGINE
  // =========================================================================

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
      this.isIndicatorMenuOpen.set(false);
      this.isChartTypeMenuOpen.set(false);
      this.isTimeframeMenuOpen.set(false);
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
    const targetSym = sym || this.symbol();
    if (!targetSym) return;
    try {
      localStorage.setItem('stock_drawings_' + targetSym.toUpperCase(), JSON.stringify(this.drawings()));
    } catch (e) {}
  }

  loadDrawingsForSymbol(sym?: string): void {
    if (typeof localStorage === 'undefined') return;
    const targetSym = sym || this.symbol();
    if (!targetSym) return;
    try {
      const saved = localStorage.getItem('stock_drawings_' + targetSym.toUpperCase());
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

  selectDrawingTool(group: DrawingToolGroup, tool: DrawingToolOption, event?: Event): void {
    if (event) event.stopPropagation();
    group.activeToolId = tool.id;
    this.activeToolGroupId.set(group.id);
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
    const currSym = this.formatCurrencySymbol(this.symbol());
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
    const currSym = this.formatCurrencySymbol(this.symbol());
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

  navigateToStock(sym: string): void {
    this.router.navigate(['/dashboard/stock', sym]);
  }

  formatCurrencySymbol(symbol?: string | null): string {
    if (!symbol) return '$';
    if (this.marketService.isIndianSymbol(symbol)) {
      return '₹';
    }
    if (symbol.includes('/')) {
      const parts = symbol.split('/');
      return parts[1] === 'USD' ? '$' : parts[1];
    }
    return '$';
  }
}
