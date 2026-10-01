import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import {
  AdminDashboardSummary,
  AdminUser,
  AdminOrder,
  AdminTransaction
} from '../../../models/admin.model';

export type AdminTab = 'OVERVIEW' | 'USERS' | 'ORDERS' | 'TRANSACTIONS';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  readonly authService = inject(AuthService);

  // Tabs & Navigation
  readonly activeTab = signal<AdminTab>('OVERVIEW');

  // Service Signals
  readonly summaryData = this.adminService.summaryData;
  readonly usersList = this.adminService.usersList;
  readonly ordersList = this.adminService.ordersList;
  readonly transactionsList = this.adminService.transactionsList;
  readonly isLoading = this.adminService.isLoading;
  readonly error = this.adminService.error;

  // Filter Signals for Users
  readonly searchQuery = signal<string>('');
  readonly selectedRole = signal<string>('ALL');
  readonly selectedStatus = signal<string>('ALL');

  // Filter Signals for Orders / Transactions
  readonly orderStatusFilter = signal<string>('ALL');
  readonly transactionTypeFilter = signal<string>('ALL');

  // Action Modals State
  readonly statusModalUser = signal<AdminUser | null>(null);
  readonly targetStatus = signal<string>('ACTIVE');

  readonly roleModalUser = signal<AdminUser | null>(null);
  readonly targetRole = signal<string>('ROLE_USER');

  readonly isActionLoading = signal<boolean>(false);
  readonly actionToast = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Computed Properties
  readonly filteredUsers = computed(() => {
    let list = this.usersList();
    const q = this.searchQuery().trim().toLowerCase();
    const r = this.selectedRole();
    const s = this.selectedStatus();

    if (q) {
      list = list.filter(
        (u) =>
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.fullName && u.fullName.toLowerCase().includes(q))
      );
    }
    if (r !== 'ALL') {
      list = list.filter((u) => u.role === r);
    }
    if (s !== 'ALL') {
      list = list.filter((u) => u.status === s);
    }

    return list;
  });

  readonly filteredOrders = computed(() => {
    let list = this.ordersList();
    const st = this.orderStatusFilter();
    if (st !== 'ALL') {
      list = list.filter((o) => o.status === st);
    }
    return list;
  });

  readonly filteredTransactions = computed(() => {
    let list = this.transactionsList();
    const t = this.transactionTypeFilter();
    if (t !== 'ALL') {
      list = list.filter((tx) => tx.transactionType === t);
    }
    return list;
  });

  ngOnInit(): void {
    this.loadSummary();
    this.loadUsers();
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    if (tab === 'OVERVIEW') {
      this.loadSummary();
    } else if (tab === 'USERS') {
      this.loadUsers();
    } else if (tab === 'ORDERS') {
      this.loadOrders();
    } else if (tab === 'TRANSACTIONS') {
      this.loadTransactions();
    }
  }

  loadSummary(): void {
    this.adminService.getDashboardSummary().subscribe({
      error: (err) => console.warn('Admin summary error:', err)
    });
  }

  loadUsers(): void {
    this.adminService.getUsers(this.searchQuery(), this.selectedRole(), this.selectedStatus()).subscribe({
      error: (err) => console.warn('Admin users error:', err)
    });
  }

  loadOrders(): void {
    this.adminService.getOrders(100).subscribe({
      error: (err) => console.warn('Admin orders error:', err)
    });
  }

  loadTransactions(): void {
    this.adminService.getTransactions(100).subscribe({
      error: (err) => console.warn('Admin transactions error:', err)
    });
  }

  onUserFilterChange(): void {
    this.loadUsers();
  }

  // User Status Modal Actions
  openStatusModal(user: AdminUser): void {
    this.statusModalUser.set(user);
    this.targetStatus.set(user.status);
  }

  closeStatusModal(): void {
    this.statusModalUser.set(null);
  }

  submitStatusUpdate(): void {
    const user = this.statusModalUser();
    const newStatus = this.targetStatus();
    if (!user || !newStatus) return;

    this.isActionLoading.set(true);
    this.adminService.updateUserStatus(user.id, newStatus).subscribe({
      next: (updated) => {
        this.isActionLoading.set(false);
        this.closeStatusModal();
        this.showToast(`User ${updated.email} status updated to ${updated.status}`, 'success');
      },
      error: (err) => {
        this.isActionLoading.set(false);
        this.showToast(err.error?.message || err.message || 'Failed to update user status', 'error');
      }
    });
  }

  // User Role Modal Actions
  openRoleModal(user: AdminUser): void {
    this.roleModalUser.set(user);
    this.targetRole.set(user.role);
  }

  closeRoleModal(): void {
    this.roleModalUser.set(null);
  }

  submitRoleUpdate(): void {
    const user = this.roleModalUser();
    const newRole = this.targetRole();
    if (!user || !newRole) return;

    this.isActionLoading.set(true);
    this.adminService.updateUserRole(user.id, newRole).subscribe({
      next: (updated) => {
        this.isActionLoading.set(false);
        this.closeRoleModal();
        this.showToast(`User ${updated.email} role updated to ${updated.role}`, 'success');
      },
      error: (err) => {
        this.isActionLoading.set(false);
        this.showToast(err.error?.message || err.message || 'Failed to update user role', 'error');
      }
    });
  }

  showToast(text: string, type: 'success' | 'error'): void {
    this.actionToast.set({ text, type });
    setTimeout(() => {
      this.actionToast.set(null);
    }, 4500);
  }

  isCurrentAdmin(user: AdminUser): boolean {
    const current = this.authService.currentUser();
    return current?.email === user.email || current?.id === user.id;
  }
}
