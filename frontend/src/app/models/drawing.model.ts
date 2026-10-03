export type DrawingTool = 
  | 'cursor'
  | 'trendline'
  | 'horizontal'
  | 'vertical'
  | 'ray'
  | 'rectangle'
  | 'brush'
  | 'text'
  | 'measure';

export interface DrawingPoint {
  time?: number | string;
  price: number;
  // Screen pixel caches computed during render
  screenX?: number;
  screenY?: number;
}

export interface ChartDrawing {
  id: string;
  type: DrawingTool;
  symbol: string;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  filled?: boolean;
  text?: string;
  locked?: boolean;
  createdAt: number;
}

export interface DrawingToolOption {
  id: DrawingTool;
  label: string;
  iconSvg: string;
  group: 'lines' | 'shapes' | 'annot' | 'measure' | 'nav';
}
