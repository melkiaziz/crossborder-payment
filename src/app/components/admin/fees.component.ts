import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-fees',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="cb-hero-banner">
        <img src="/assets/images/hero-fintech.png" alt="" aria-hidden="true" />
        <div class="hero-overlay">
          <h2>📊 Frais de transfert</h2>
          <p>Configuration du pourcentage de frais appliqué aux opérations</p>
        </div>
      </div>

      <div class="cb-page-header">
        <div>
          <h2>Frais actuels : {{ feePercent }}%</h2>
          <p class="subtitle">Modifier le pourcentage de frais (0–10%)</p>
        </div>
        <div class="cb-page-actions">
          <a routerLink="/banks" class="btn btn-outline-secondary btn-sm">← Retour</a>
          <span class="cb-update-time">MAJ: {{ lastUpdate }}</span>
        </div>
      </div>

      <div *ngIf="loading" class="cb-loading"><div class="spinner-border"></div></div>
      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
      <div *ngIf="success" class="alert alert-success">{{ success }}</div>

      <div class="row justify-content-center" *ngIf="!loading">
        <div class="col-lg-6">
          <div class="cb-card cb-card-accent">
            <div class="cb-card-header">Ajuster les frais</div>
            <div class="cb-card-body">
              <div class="text-center mb-4">
                <div class="display-3 fw-bold text-primary">{{ newFeePercent }}%</div>
                <p class="text-muted">Pourcentage sélectionné</p>
              </div>
              <input type="range" class="form-range mb-3" min="0" max="10" step="0.1"
                [(ngModel)]="newFeePercent" (ngModelChange)="onSliderChange($event)" />
              <div class="d-flex justify-content-between text-muted small mb-4">
                <span>0%</span><span>5%</span><span>10%</span>
              </div>
              <div class="input-group">
                <input type="number" step="0.1" min="0" max="10" class="form-control"
                  [(ngModel)]="newFeePercent" />
                <span class="input-group-text">%</span>
                <button class="btn btn-primary" (click)="updateFee()" [disabled]="saving">
                  {{ saving ? 'Mise à jour...' : 'Mettre à jour' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class FeesComponent implements OnInit, OnDestroy {
  feePercent = 0;
  newFeePercent = 0;
  loading = true;
  saving = false;
  error = '';
  success = '';
  lastUpdate = '';
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadFees();
    this.refreshInterval = setInterval(() => this.loadFees(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  onSliderChange(val: number): void {
    this.newFeePercent = Math.max(0, Math.min(10, val));
  }

  loadFees(): void {
    this.api.getFees().subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        if (data && typeof data.transferFeePercent === 'number') {
          this.feePercent = data.transferFeePercent;
          this.newFeePercent = this.feePercent;
          this.loading = false;
          this.lastUpdate = new Date().toLocaleTimeString('fr-FR');
          return;
        }
        this.loadFromContractInfo();
      },
      error: () => this.loadFromContractInfo()
    });
  }

  private loadFromContractInfo(): void {
    this.api.getContractInfo().subscribe({
      next: (res: any) => {
        const d = res?.data ?? res;
        if (d && typeof d.transferFeePercent === 'number') {
          this.feePercent = d.transferFeePercent;
          this.newFeePercent = this.feePercent;
        }
        this.loading = false;
        this.lastUpdate = new Date().toLocaleTimeString('fr-FR');
      },
      error: () => { this.error = 'Erreur de chargement des frais'; this.loading = false; }
    });
  }

  updateFee(): void {
    this.saving = true;
    this.error = '';
    this.success = '';
    const val = Math.max(0, Math.min(10, this.newFeePercent));
    this.api.updateFees(val).subscribe({
      next: () => {
        this.feePercent = val;
        this.newFeePercent = val;
        this.success = 'Frais mis à jour avec succès.';
        this.saving = false;
      },
      error: (err: any) => {
        this.error = err?.error?.error || 'Erreur lors de la mise à jour';
        this.saving = false;
      }
    });
  }
}
