import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-blacklist',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="cb-hero-banner">
        <img src="/assets/images/hero-fintech.png" alt="" aria-hidden="true" />
        <div class="hero-overlay">
          <h2>🚫 Blacklist</h2>
          <p>Gérer les banques bloquées sur la plateforme</p>
        </div>
      </div>

      <div class="cb-page-header">
        <div>
          <h2>{{ banksWithStatus.length }} banque(s)</h2>
          <p class="subtitle">Bloquer ou débloquer des institutions financières</p>
        </div>
        <div class="cb-page-actions">
          <a routerLink="/banks" class="btn btn-outline-secondary btn-sm">← Retour</a>
          <span class="cb-update-time">MAJ: {{ lastUpdate }}</span>
        </div>
      </div>

      <div *ngIf="loading" class="cb-loading"><div class="spinner-border"></div></div>
      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
      <div *ngIf="success" class="alert alert-success">{{ success }}</div>

      <div *ngIf="!loading && banksWithStatus.length > 0" class="cb-table-wrap">
        <table class="table table-hover mb-0">
          <thead>
            <tr><th>Banque</th><th>Adresse</th><th>Statut</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of banksWithStatus">
              <td><strong>{{ b.name }}</strong></td>
              <td><code>{{ formatAddr(b.address) }}</code></td>
              <td>
                <span class="badge" [ngClass]="b.blacklisted ? 'bg-danger' : 'bg-success'">
                  {{ b.blacklisted ? '🚫 Blacklisté' : '✅ Actif' }}
                </span>
              </td>
              <td>
                <button *ngIf="!b.blacklisted" class="btn btn-sm btn-danger"
                  (click)="blacklist(b.address)" [disabled]="actioning">Blacklister</button>
                <button *ngIf="b.blacklisted" class="btn btn-sm btn-success"
                  (click)="unblacklist(b.address)" [disabled]="actioning">Retirer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class BlacklistComponent implements OnInit, OnDestroy {
  banks: any[] = [];
  banksWithStatus: { name: string; address: string; blacklisted: boolean }[] = [];
  loading = true;
  actioning = false;
  error = '';
  success = '';
  lastUpdate = '';
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
    this.refreshInterval = setInterval(() => this.load(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  load(): void {
    this.api.getBanks(true).subscribe({
      next: (res: any) => {
        const arr = Array.isArray(res) ? res : (res?.data ? res.data : []);
        this.banks = Array.isArray(arr) ? arr : [];
        this.checkBlacklistStatus();
        this.loading = false;
        this.lastUpdate = new Date().toLocaleTimeString('fr-FR');
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  private checkBlacklistStatus(): void {
    if (this.banks.length === 0) { this.banksWithStatus = []; return; }
    let done = 0;
    this.banksWithStatus = this.banks.map((b) => ({
      name: b.name,
      address: b.wallets || b.wallet_address || '',
      blacklisted: false
    }));
    this.banksWithStatus.forEach((b, i) => {
      if (!b.address) { done++; if (done === this.banks.length) this.cdr.detectChanges(); return; }
      this.api.checkBlacklist(b.address).subscribe({
        next: (r: any) => {
          const d = r?.data ?? r;
          this.banksWithStatus[i].blacklisted = !!(d?.isBlacklisted);
          done++;
          if (done === this.banks.length) this.cdr.detectChanges();
        },
        error: () => { done++; if (done === this.banks.length) this.cdr.detectChanges(); }
      });
    });
  }

  formatAddr(a: string): string {
    return a && a.length > 12 ? a.substring(0, 12) + '...' : (a || 'N/A');
  }

  blacklist(address: string): void {
    this.actioning = true; this.error = ''; this.success = '';
    this.api.addToBlacklist(address).subscribe({
      next: () => { this.success = 'Banque blacklistée.'; this.actioning = false; this.load(); },
      error: (err: any) => { this.error = err?.error?.error || 'Erreur'; this.actioning = false; this.cdr.detectChanges(); }
    });
  }

  unblacklist(address: string): void {
    this.actioning = true; this.error = ''; this.success = '';
    this.api.removeFromBlacklist(address).subscribe({
      next: () => { this.success = 'Banque retirée de la blacklist.'; this.actioning = false; this.load(); },
      error: (err: any) => { this.error = err?.error?.error || 'Erreur'; this.actioning = false; this.cdr.detectChanges(); }
    });
  }
}
