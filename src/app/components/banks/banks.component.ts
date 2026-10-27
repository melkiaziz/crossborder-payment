import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { PdfService } from '../../services/pdf.service';

@Component({
  selector: 'app-banks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="cb-hero-banner">
        <img src="/assets/images/hero-fintech.png" alt="" aria-hidden="true" />
        <img class="hero-illustration" src="/assets/images/banks-illustration.png" alt="" aria-hidden="true" />
        <div class="hero-overlay">
          <h2>{{ pageTitle }}</h2>
          <p>Réseau bancaire partenaire enregistré sur la blockchain</p>
        </div>
      </div>

      <div class="cb-page-header">
        <div>
          <h2>{{ banks.length }} banque(s) active(s)</h2>
          <p class="subtitle">Gestion et suivi des institutions financières</p>
        </div>
        <div class="cb-page-actions">
          <button class="btn btn-outline-primary btn-sm" (click)="exportBanks()">📄 Exporter PDF</button>
          <button class="btn btn-outline-primary btn-sm" (click)="loadBanks(true)" [disabled]="loading">🔄 Actualiser</button>
          <span class="cb-update-time">MAJ: {{ lastUpdate }}</span>
        </div>
      </div>

      <div *ngIf="isCentralBank" class="cb-card cb-card-accent mb-4">
        <div class="cb-card-header">➕ Ajouter une nouvelle banque</div>
        <div class="cb-card-body">
          <form (ngSubmit)="registerBank()">
            <div class="row g-2">
              <div class="col-md-3">
                <input class="form-control" [(ngModel)]="newBank.address" name="address"
                  placeholder="Adresse wallet (0x...)" required />
              </div>
              <div class="col-md-2">
                <input class="form-control" [(ngModel)]="newBank.name" name="name"
                  placeholder="Nom de la banque" required />
              </div>
              <div class="col-md-2">
                <select class="form-select" [(ngModel)]="newBank.country" name="country">
                  <option value="Tunisia">Tunisie</option>
                  <option value="France">France</option>
                  <option value="Italy">Italie</option>
                  <option value="Spain">Espagne</option>
                  <option value="Germany">Allemagne</option>
                  <option value="USA">États-Unis</option>
                  <option value="United Kingdom">Royaume-Uni</option>
                </select>
              </div>
              <div class="col-md-2">
                <select class="form-select" [(ngModel)]="newBank.currency" name="currency">
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div class="col-md-2">
                <button type="submit" class="btn btn-success" [disabled]="submitting">
                  {{ submitting ? '...' : 'Enregistrer' }}
                </button>
              </div>
            </div>
          </form>
          <div *ngIf="registerError" class="alert alert-danger mt-2">{{ registerError }}</div>
        </div>
      </div>

      <div *ngIf="loading" class="cb-loading">
        <div class="spinner-border"></div>
        <p>Chargement des banques...</p>
      </div>

      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>

      <div *ngIf="!loading && !error && banks.length > 0" class="cb-table-wrap">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Nom</th>
                <th>Pays</th>
                <th>Devise</th>
                <th>Balance</th>
                <th>Limite quotidienne</th>
                <th>Adresse</th>
                <th>Créé le</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let bank of banks; let i = index">
                <td>{{ i + 1 }}</td>
                <td><strong>{{ bank.name }}</strong></td>
                <td>{{ getCountry(bank) }}</td>
                <td>{{ getCurrency(bank) }}</td>
                <td>
                  <span class="badge bg-success">{{ bank.balance || 0 }} TND</span>
                  <button *ngIf="isCentralBank" class="btn btn-sm btn-outline-success ms-1"
                    (click)="openAddBalanceModal(bank)" title="Ajouter du solde">➕</button>
                </td>
                <td>
                  <div class="progress" style="min-width: 100px; max-width: 150px; height: 20px;">
                    <div class="progress-bar" [ngClass]="getLimitClass(bank)" [style.width.%]="getDailyLimitPercent(bank)">
                      {{ getDailyTransferred(bank) }}/{{ dailyLimit }} TND
                    </div>
                  </div>
                  <small *ngIf="getDailyLimitPercent(bank) >= 80" class="text-warning">Proche limite</small>
                </td>
                <td><code>{{ getWalletAddress(bank) }}</code></td>
                <td>{{ bank.created_at | date:'dd/MM/yyyy HH:mm' }}</td>
              </tr>
            </tbody>
          </table>
      </div>

      <div *ngIf="!loading && !error && banks.length === 0" class="cb-empty">
        <img src="/assets/images/banks-illustration.png" alt="" />
        <p class="text-muted">Aucune banque trouvée</p>
      </div>

      <div *ngIf="showBalanceModal" class="cb-modal-backdrop" (click)="closeAddBalanceModal()">
        <div class="cb-modal" (click)="$event.stopPropagation()">
            <div class="cb-modal-header">
              <h5>💰 Ajouter du solde — {{ selectedBank?.name }}</h5>
              <button type="button" class="btn-close btn-close-white" (click)="closeAddBalanceModal()"></button>
            </div>
            <div class="cb-modal-body">
              <p>Balance actuelle: <strong>{{ selectedBank?.balance || 0 }} TND</strong></p>
              <div class="mb-3">
                <label class="form-label">Montant à ajouter (TND)</label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="addBalanceAmount"
                  placeholder="Ex: 10000"
                  min="1"
                  step="0.01"
                />
              </div>
              <div *ngIf="balanceError" class="alert alert-danger">{{ balanceError }}</div>
            </div>
            <div class="cb-modal-footer">
              <button class="btn btn-secondary" (click)="closeAddBalanceModal()">Annuler</button>
              <button class="btn btn-success" (click)="submitAddBalance()" [disabled]="addingBalance || !addBalanceAmount">
                <span *ngIf="addingBalance" class="spinner-border spinner-border-sm me-2"></span>
                {{ addingBalance ? 'Ajout en cours...' : 'Ajouter ' + (addBalanceAmount || 0) + ' TND' }}
              </button>
            </div>
        </div>
      </div>
    </div>
  `
})
export class BanksComponent implements OnInit, OnDestroy {
  banks: any[] = [];
  loading = true;
  error: string | null = null;
  registerError = '';
  submitting = false;
  showBalanceModal = false;
  selectedBank: any = null;
  addBalanceAmount: number = 0;
  addingBalance = false;
  balanceError: string | null = null;
  dailyLimit = 10000;
  lastUpdate = '';

  newBank = { address: '', name: '', country: 'Tunisia', currency: 'TND' };
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private apiService: ApiService,
    private auth: AuthService,
    private role: RoleService,
    private cdr: ChangeDetectorRef,
    private pdfService: PdfService
  ) {}

  get pageTitle(): string {
    return this.role.canViewFullData()
      ? '🏦 Banques enregistrées'
      : '🏦 Ma banque';
  }

  get isCentralBank(): boolean {
    return this.auth.isCentralBank();
  }

  ngOnInit(): void {
    this.loadBanks();
    this.apiService.getContractInfo().subscribe({
      next: (r: any) => {
        const d = r && r.data ? r.data : r;
        if (d && d.dailyLimit) this.dailyLimit = parseFloat(String(d.dailyLimit)) || 10000;
      }
    });
    this.refreshInterval = setInterval(() => this.loadBanks(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  getCountry(bank: any): string {
    if (bank.country) return bank.country;
    const c = bank.currency || '';
    const map: Record<string, string> = {
      Tunisia: 'Tunisie', France: 'France', Italy: 'Italie', Spain: 'Espagne',
      Germany: 'Allemagne', USA: 'États-Unis', 'United Kingdom': 'Royaume-Uni'
    };
    return map[c] || 'N/A';
  }

  getCurrency(bank: any): string {
    const c = bank.currency;
    const map: Record<string, string> = {
      Tunisia: 'TND', France: 'EUR', Italy: 'EUR', Spain: 'EUR',
      Germany: 'EUR', USA: 'USD', 'United Kingdom': 'GBP'
    };
    return (c && c.length <= 3) ? c : (map[c || ''] || 'N/A');
  }

  getWalletAddress(bank: any): string {
    const a = bank.wallets || bank.wallet_address || '';
    return (a && a.length > 10) ? a.substring(0, 10) + '...' : (a || 'N/A');
  }

  getDailyTransferred(bank: any): number {
    return parseFloat(bank.daily_transferred || bank.dailyTransferred || '0') || 0;
  }

  getDailyLimitPercent(bank: any): number {
    const used = this.getDailyTransferred(bank);
    return this.dailyLimit > 0 ? Math.min(100, (used / this.dailyLimit) * 100) : 0;
  }

  getLimitClass(bank: any): string {
    const pct = this.getDailyLimitPercent(bank);
    if (pct >= 90) return 'bg-danger';
    if (pct >= 80) return 'bg-warning';
    return 'bg-info';
  }

  registerBank(): void {
    this.registerError = '';
    this.submitting = true;
    this.apiService.registerBank(this.newBank).subscribe({
      next: () => {
        this.submitting = false;
        this.newBank = { address: '', name: '', country: 'Tunisia', currency: 'TND' };
        this.apiService.invalidateCache('banks');
        this.loadBanks(true);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.submitting = false;
        this.registerError = err && err.error && err.error.error ? err.error.error : 'Erreur d\'enregistrement';
        this.cdr.detectChanges();
      }
    });
  }

  openAddBalanceModal(bank: any): void {
    this.selectedBank = bank;
    this.addBalanceAmount = 0;
    this.balanceError = null;
    this.showBalanceModal = true;
  }

  closeAddBalanceModal(): void {
    this.showBalanceModal = false;
    this.selectedBank = null;
    this.addBalanceAmount = 0;
    this.balanceError = null;
  }

  submitAddBalance(): void {
    if (!this.selectedBank) {
      this.balanceError = 'Aucune banque sélectionnée';
      return;
    }

    const address = this.selectedBank.wallets || this.selectedBank.wallet_address;
    if (!address) {
      this.balanceError = 'Adresse de banque invalide';
      return;
    }

    if (!this.addBalanceAmount || this.addBalanceAmount <= 0) {
      this.balanceError = 'Veuillez entrer un montant valide (supérieur à 0)';
      return;
    }

    this.addingBalance = true;
    this.balanceError = null;

    this.apiService.addBalance(address, String(this.addBalanceAmount)).subscribe({
      next: () => {
        this.addingBalance = false;
        this.closeAddBalanceModal();
        this.apiService.invalidateCache('banks');
        this.loadBanks(true);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.addingBalance = false;
        this.balanceError = err && err.error && err.error.error ? err.error.error : (err && err.message ? err.message : 'Erreur lors de l\'ajout de solde');
        this.cdr.detectChanges();
      }
    });
  }

  loadBanks(forceRefresh = false): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();
    console.log('Loading banks...', forceRefresh ? '(forced refresh)' : '');

    this.apiService.getBanks(forceRefresh).subscribe({
      next: (response: any) => {
        console.log('Banks response:', response);
        if (Array.isArray(response)) {
          this.banks = [...response];
        } else if (response && response.data && Array.isArray(response.data)) {
          this.banks = [...response.data];
        } else if (response && response.results && Array.isArray(response.results)) {
          this.banks = [...response.results];
        } else {
          this.banks = [];
        }
        this.banks = this.role.filterBanks(this.banks);
        console.log('Loaded', this.banks.length, 'banks (filtered)');

        this.loading = false;
        this.lastUpdate = new Date().toLocaleTimeString('fr-FR');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = 'Erreur: ' + (err && err.message ? err.message : 'inconnue');
        console.error('Erreur chargement banques:', err);
        this.banks = [];
        this.loading = false;
        this.lastUpdate = new Date().toLocaleTimeString('fr-FR');
        this.cdr.detectChanges();
      }
    });
  }

  exportBanks(): void {
    console.log('📄 Export PDF déclenché depuis banks component', this.banks);
    if (!this.banks || this.banks.length === 0) {
      console.error('❌ Aucune banque disponible pour l\'export');
      alert('Aucune banque disponible pour générer la liste PDF.');
      return;
    }
    console.log('✅ Données valides, appel du service PDF');
    this.pdfService.exportBanksList(this.banks);
  }
}
