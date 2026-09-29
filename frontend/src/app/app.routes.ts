import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LoginComponent } from './pages/login/login';
import { SignupComponent } from './pages/signup/signup';
import { DashboardLayoutComponent } from './pages/dashboard/dashboard-layout';
import { DashboardHomeComponent } from './pages/dashboard/dashboard-home/dashboard-home';
import { MarketComponent } from './pages/dashboard/market/market';
import { PortfolioComponent } from './pages/dashboard/portfolio/portfolio';
import { WatchlistComponent } from './pages/dashboard/watchlist/watchlist';
import { OrdersComponent } from './pages/dashboard/orders/orders';
import { TransactionsComponent } from './pages/dashboard/transactions/transactions';
import { AlertsComponent } from './pages/dashboard/alerts/alerts';
import { SettingsComponent } from './pages/dashboard/settings/settings';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardHomeComponent },
      { path: 'market', component: MarketComponent },
      { path: 'portfolio', component: PortfolioComponent },
      { path: 'watchlist', component: WatchlistComponent },
      { path: 'orders', component: OrdersComponent },
      { path: 'transactions', component: TransactionsComponent },
      { path: 'alerts', component: AlertsComponent },
      { path: 'settings', component: SettingsComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
