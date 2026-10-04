import { Injectable, inject, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, Subscription, timer } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MarketTick {
  type: 'TICK' | 'STATUS' | 'PONG';
  symbol?: string;
  instrumentKey?: string;
  price?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: string;
  timestamp?: number;
  provider?: string;
  streamingSupported?: boolean;
  status?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MarketWebSocketService implements OnDestroy {
  private socket?: WebSocket;
  private readonly ticksSubject = new Subject<MarketTick>();
  readonly ticks$ = this.ticksSubject.asObservable();

  private readonly isConnectedSubject = new BehaviorSubject<boolean>(false);
  readonly isConnected$ = this.isConnectedSubject.asObservable();

  private currentSubscribedSymbol: string | null = null;
  private currentSubscribedInterval: string = '5min';
  private reconnectTimer?: Subscription;
  private pingTimer?: Subscription;
  private isIntentionallyClosed = false;
  private reconnectAttempts = 0;

  constructor() {
    this.connect();
  }

  get isConnected(): boolean {
    return this.isConnectedSubject.value;
  }

  /**
   * Connect to the Spring Boot Market Feed WebSocket endpoint
   */
  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;
    const wsUrl = this.getWebSocketUrl();

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnectedSubject.next(true);
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // Re-subscribe to the active symbol if any
        if (this.currentSubscribedSymbol) {
          this.sendSubscription(this.currentSubscribedSymbol, this.currentSubscribedInterval);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const tick: MarketTick = JSON.parse(event.data);
          this.ticksSubject.next(tick);
        } catch (e) {
          // ignore non-json
        }
      };

      this.socket.onerror = () => {
        this.isConnectedSubject.next(false);
      };

      this.socket.onclose = () => {
        this.isConnectedSubject.next(false);
        this.stopHeartbeat();
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };

    } catch (err) {
      this.isConnectedSubject.next(false);
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to live tick stream for a symbol
   */
  subscribe(symbol: string, interval: string = '5min'): void {
    if (!symbol) return;
    const cleanSymbol = symbol.trim().toUpperCase();

    if (this.currentSubscribedSymbol && this.currentSubscribedSymbol !== cleanSymbol) {
      this.unsubscribe(this.currentSubscribedSymbol);
    }

    this.currentSubscribedSymbol = cleanSymbol;
    this.currentSubscribedInterval = interval;

    if (this.isConnected) {
      this.sendSubscription(cleanSymbol, interval);
    } else {
      this.connect();
    }
  }

  /**
   * Unsubscribe from a symbol's live feed
   */
  unsubscribe(symbol: string): void {
    if (!symbol) return;
    if (this.isConnected && this.socket) {
      try {
        this.socket.send(JSON.stringify({
          action: 'unsubscribe',
          symbol: symbol.trim().toUpperCase()
        }));
      } catch (e) {
        // ignore
      }
    }
    if (this.currentSubscribedSymbol === symbol.trim().toUpperCase()) {
      this.currentSubscribedSymbol = null;
    }
  }

  private sendSubscription(symbol: string, interval: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify({
        action: 'subscribe',
        symbol: symbol,
        interval: interval
      }));
    } catch (e) {
      // ignore
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = timer(20000, 20000).subscribe(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ action: 'ping' }));
        } catch (e) {
          // ignore
        }
      }
    });
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      this.pingTimer.unsubscribe();
      this.pingTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    // Exponential backoff with jitter: 2s, 4s, 8s, 16s, up to 30s max
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 30000);
    this.reconnectTimer = timer(delay).subscribe(() => {
      this.reconnectTimer = undefined;
      this.connect();
    });
  }

  private getWebSocketUrl(): string {
    const apiBase = environment.apiUrl || 'http://localhost:8080/api';
    let host = 'localhost:8080';
    let protocol = 'ws:';

    try {
      const url = new URL(apiBase, window.location.href);
      host = url.host;
      protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    } catch (e) {
      if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        protocol = 'wss:';
      }
    }

    return `${protocol}//${host}/ws/market-feed`;
  }

  ngOnDestroy(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      this.reconnectTimer.unsubscribe();
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // ignore
      }
    }
  }
}
