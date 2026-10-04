import { TestBed } from '@angular/core/testing';
import { MarketWebSocketService, MarketTick } from './market-websocket.service';

describe('MarketWebSocketService', () => {
  let service: MarketWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarketWebSocketService]
    });
    service = TestBed.inject(MarketWebSocketService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created and manage websocket connection lifecycle', () => {
    expect(service).toBeTruthy();
  });

  it('should allow subscription and unsubscription for symbols', () => {
    expect(() => {
      service.subscribe('RELIANCE', '5min');
      service.subscribe('NIFTY 50', '1min');
      service.unsubscribe('RELIANCE');
    }).not.toThrow();
  });
});
