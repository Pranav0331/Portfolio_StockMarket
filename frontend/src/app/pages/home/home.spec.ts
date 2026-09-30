import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();
  });

  it('should create the home component', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should render hero title, CTAs, and 4 core feature cards', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-title')?.textContent).toContain('Smart Portfolio Management');
    expect(compiled.querySelector('#hero-get-started-btn')).toBeTruthy();
    expect(compiled.querySelector('#hero-explore-market-btn')).toBeTruthy();
    
    const featureCards = compiled.querySelectorAll('.feature-card');
    expect(featureCards.length).toBe(4);
    expect(compiled.textContent).toContain('Real-Time Market Tracking');
    expect(compiled.textContent).toContain('Portfolio Management');
    expect(compiled.textContent).toContain('Risk & Analytics');
    expect(compiled.textContent).toContain('Secure Authentication');
  });
});
