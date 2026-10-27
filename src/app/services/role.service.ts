import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { EmployeeAuthService, EmployeeUser } from './employee-auth.service';

@Injectable({ providedIn: 'root' })
export class RoleService {
  constructor(
    private auth: AuthService,
    private employeeAuth: EmployeeAuthService
  ) {}

  isCentralBank(): boolean {
    return this.auth.isCentralBank();
  }

  isEmployee(): boolean {
    return this.employeeAuth.isAuthenticated();
  }

  getEmployeeUser(): EmployeeUser | null {
    return this.employeeAuth.getCurrentUser();
  }

  getEmployeeBankAddress(): string | null {
    const user = this.getEmployeeUser();
    return user?.bank_wallet_address?.toLowerCase() ?? null;
  }

  /** Liste complète banques / transactions : Banque Centrale seule (sans session employé). */
  canViewFullData(): boolean {
    return this.isCentralBank() && !this.isEmployee();
  }

  canAccessDashboard(): boolean {
    return this.isCentralBank();
  }

  canAccessApp(): boolean {
    return this.isCentralBank() || this.isEmployee();
  }

  /** Transfert : employé d'une banque tunisienne enregistrée. */
  canCreateTransfer(): boolean {
    return this.isEmployee();
  }

  filterBanks<T extends { wallet_address?: string; wallets?: string }>(banks: T[]): T[] {
    if (this.canViewFullData()) {
      return banks;
    }
    const addr = this.getEmployeeBankAddress();
    if (!addr) {
      return [];
    }
    return banks.filter((b) => {
      const bankAddr = (b.wallet_address || b.wallets || '').toLowerCase();
      return bankAddr === addr;
    });
  }

  filterTransactions<T extends { from_bank?: string }>(transactions: T[]): T[] {
    if (this.canViewFullData()) {
      return transactions;
    }
    const addr = this.getEmployeeBankAddress();
    if (!addr) {
      return [];
    }
    return transactions.filter(
      (tx) => (tx.from_bank || '').toLowerCase() === addr
    );
  }

  filterPending<T extends { from_bank?: string }>(pending: T[]): T[] {
    if (this.canViewFullData()) {
      return pending;
    }
    const addr = this.getEmployeeBankAddress();
    if (!addr) {
      return [];
    }
    return pending.filter(
      (p) => (p.from_bank || '').toLowerCase() === addr
    );
  }

  isTunisianBank(bank: { country?: string }): boolean {
    const country = (bank.country || '').toLowerCase();
    return country === 'tunisia' || country === 'tunisie';
  }

  /** Destinations internationales : banques étrangères (hors Tunisie). */
  getInternationalDestinations<T extends { wallet_address?: string; wallets?: string; country?: string }>(
    banks: T[],
    excludeAddress?: string
  ): T[] {
    const exclude = excludeAddress?.toLowerCase();
    return banks.filter((b) => {
      const addr = (b.wallet_address || b.wallets || '').toLowerCase();
      if (exclude && addr === exclude) {
        return false;
      }
      return !this.isTunisianBank(b);
    });
  }

  getBankAddress(bank: { wallet_address?: string; wallets?: string }): string {
    return bank.wallet_address || bank.wallets || '';
  }
}
