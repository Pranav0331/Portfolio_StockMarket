import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WatchlistService } from '../../../services/watchlist.service';
import { MarketService } from '../../../services/market.service';
import { WatchlistItem, AddWatchlistRequest } from '../../../models/watchlist.model';
import { StockSearchItem } from '../../../models/market.model';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './watchlist.html',
  styleUrls: ['./watchlist.css']
})
export class WatchlistComponent implements OnInit {
  private readonly watchlistService = inject(WatchlistService);
  private readonly marketService = inject(MarketService);
  private readonly router = inject(Router);

  readonly watchlistData = this.watchlistService.watchlistData;
  readonly isLoading = this.watchlistService.isLoading;
  readonly error = this.watchlistService.error;

  // Search & Filtering
  readonly filterQuery = signal<string>('');
  readonly selectedCategory = signal<string>('ALL');
  readonly collapsedCategories = signal<Record<string, boolean>>({});

  // Add Symbol Bar & Autocomplete
  readonly addSymbolQuery = signal<string>('');
  readonly selectedAddCategory = signal<string>('AUTO');
  readonly searchResults = signal<StockSearchItem[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly isAdding = signal<boolean>(false);
  readonly addMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Drag & Drop
  readonly draggedItemId = signal<number | null>(null);

  readonly categoriesList = ['INDICES', 'STOCKS', 'FOREX', 'CRYPTO'];

  // Filtered & Grouped Items
  readonly filteredItems = computed(() => {
    const data = this.watchlistData();
    if (!data || !data.items) return [];

    let items = data.items;
    const cat = this.selectedCategory();
    if (cat !== 'ALL') {
      items = items.filter(i => i.category === cat);
    }

    const q = this.filterQuery().trim().toLowerCase();
    if (q) {
      items = items.filter(i =>
        i.symbol.toLowerCase().includes(q) ||
        (i.companyName && i.companyName.toLowerCase().includes(q)) ||
        (i.exchange && i.exchange.toLowerCase().includes(q))
      );
    }

    return items;
  });

  // Grouped by Category for Sectional Display
  readonly groupedCategories = computed(() => {
    const items = this.filteredItems();
    const groups: { category: string; title: string; items: WatchlistItem[] }[] = [];

    const categoryTitles: Record<string, string> = {
      INDICES: 'Market Indices',
      STOCKS: 'Equities & Stocks',
      FOREX: 'Currency Pairs (Forex)',
      CRYPTO: 'Cryptocurrencies'
    };

    for (const cat of this.categoriesList) {
      const catItems = items.filter(i => i.category === cat);
      if (catItems.length > 0 || this.selectedCategory() === cat) {
        groups.push({
          category: cat,
          title: categoryTitles[cat] || cat,
          items: catItems
        });
      }
    }

    return groups;
  });

  ngOnInit(): void {
    this.loadWatchlist();
  }

  loadWatchlist(): void {
    this.watchlistService.getWatchlist().subscribe();
  }

  refreshPrices(): void {
    this.loadWatchlist();
  }

  setCategoryFilter(cat: string): void {
    this.selectedCategory.set(cat);
  }

  toggleCategoryCollapse(category: string): void {
    this.collapsedCategories.update(current => ({
      ...current,
      [category]: !current[category]
    }));
  }

  isCategoryCollapsed(category: string): boolean {
    return !!this.collapsedCategories()[category];
  }

  getCategoryCount(category: string): number {
    const data = this.watchlistData();
    if (!data || !data.items) return 0;
    return data.items.filter(i => i.category === category).length;
  }

  // ==========================================================================
  // SYMBOL SEARCH & ADD
  // ==========================================================================
  onAddSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const q = input?.value || '';
    this.addSymbolQuery.set(q);
    this.addMessage.set(null);

    if (q.trim().length >= 2) {
      this.isSearching.set(true);
      this.marketService.searchSymbols(q.trim()).subscribe({
        next: (resp) => {
          this.searchResults.set(resp.bestMatches || []);
          this.isSearching.set(false);
        },
        error: () => {
          this.searchResults.set([]);
          this.isSearching.set(false);
        }
      });
    } else {
      this.searchResults.set([]);
      this.isSearching.set(false);
    }
  }

  selectSearchResult(item: StockSearchItem): void {
    if (!item || !item.symbol) return;
    this.addSymbolQuery.set(item.symbol);
    this.searchResults.set([]);
    this.submitAddSymbol();
  }

  submitAddSymbol(): void {
    const sym = this.addSymbolQuery().trim().toUpperCase();
    if (!sym) return;

    this.isAdding.set(true);
    this.addMessage.set(null);

    const req: AddWatchlistRequest = {
      symbol: sym,
      category: this.selectedAddCategory() === 'AUTO' ? undefined : this.selectedAddCategory()
    };

    this.watchlistService.addToWatchlist(req).subscribe({
      next: (item) => {
        this.isAdding.set(false);
        this.addSymbolQuery.set('');
        this.searchResults.set([]);
        this.addMessage.set({
          text: `Successfully added ${item.symbol} to watchlist.`,
          type: 'success'
        });
        setTimeout(() => this.addMessage.set(null), 4000);
      },
      error: (err) => {
        this.isAdding.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to add symbol to watchlist.';
        this.addMessage.set({
          text: msg,
          type: 'error'
        });
      }
    });
  }

  removeItem(item: WatchlistItem, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    this.watchlistService.removeFromWatchlist(item.id).subscribe({
      next: () => {
        this.addMessage.set({
          text: `Removed ${item.symbol} from watchlist.`,
          type: 'success'
        });
        setTimeout(() => this.addMessage.set(null), 3000);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Failed to remove item.';
        this.addMessage.set({ text: msg, type: 'error' });
      }
    });
  }

  // ==========================================================================
  // DRAG & DROP REORDERING
  // ==========================================================================
  onDragStart(item: WatchlistItem, event: DragEvent): void {
    this.draggedItemId.set(item.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id.toString());
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(targetItem: WatchlistItem, event: DragEvent): void {
    event.preventDefault();
    const draggedId = this.draggedItemId();
    if (draggedId === null || draggedId === targetItem.id) return;

    const currentData = this.watchlistData();
    if (!currentData || !currentData.items) return;

    const items = [...currentData.items];
    const fromIndex = items.findIndex(i => i.id === draggedId);
    const toIndex = items.findIndex(i => i.id === targetItem.id);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [movedItem] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, movedItem);

      // Re-assign displayOrder
      const orderedIds = items.map(i => i.id);

      // Optimistic update
      this.watchlistService.watchlistData.set({
        ...currentData,
        items
      });

      this.watchlistService.reorderWatchlist({ orderedIds }).subscribe({
        error: () => {
          this.loadWatchlist();
        }
      });
    }

    this.draggedItemId.set(null);
  }

  onDragEnd(): void {
    this.draggedItemId.set(null);
  }

  navigateToStock(symbol: string): void {
    if (!symbol) return;
    this.router.navigate(['/dashboard/stock', symbol]);
  }

  getCurrencySymbol(currency?: string): string {
    if (currency === 'INR') return '₹';
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    return '$';
  }

  isPositiveChange(changePercent: string | null): boolean {
    if (!changePercent) return false;
    return changePercent.startsWith('+') || (!changePercent.startsWith('-') && parseFloat(changePercent) > 0);
  }

  isNegativeChange(changePercent: string | null): boolean {
    if (!changePercent) return false;
    return changePercent.startsWith('-') || parseFloat(changePercent) < 0;
  }
}
