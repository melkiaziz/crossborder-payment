import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row">
      <div class="col-md-4 col-xl-2 mb-3" *ngFor="let card of cards">
        <div class="cb-kpi-card">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="cb-kpi-icon" [style.background]="card.color">{{ card.icon }}</div>
          </div>
          <div class="cb-kpi-value">{{ loading ? '...' : formatValue(card.key) }}</div>
          <div class="cb-kpi-label mt-1">{{ card.label }}</div>
        </div>
      </div>
    </div>
  `
})
export class KpiCardsComponent {
  @Input() kpis: any = {};
  @Input() loading = false;

  cards = [
    { key: 'total_banks', label: 'Banques', icon: '🏦', color: 'linear-gradient(135deg, #0c4a6e, #0891b2)' },
    { key: 'total_transactions', label: 'Transferts', icon: '🔁', color: 'linear-gradient(135deg, #059669, #10b981)' },
    { key: 'total_volume', label: 'Volume (TND)', icon: '💰', color: 'linear-gradient(135deg, #7c3aed, #a78bfa)' },
    { key: 'total_fees', label: 'Frais (TND)', icon: '💸', color: 'linear-gradient(135deg, #d97706, #f59e0b)' },
    { key: 'pending_count', label: 'En attente', icon: '⏳', color: 'linear-gradient(135deg, #dc2626, #f87171)' },
    { key: 'total_employees', label: 'Employés', icon: '👥', color: 'linear-gradient(135deg, #0891b2, #22d3ee)' }
  ];

  formatValue(key: string): string {
    const value = this.kpis ? this.kpis[key] : null;
    if (value == null) return '0';
    if (key === 'total_volume' || key === 'total_fees') {
      return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    }
    return Number(value).toLocaleString('fr-FR');
  }
}
