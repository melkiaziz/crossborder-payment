import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-recent-tables',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row mt-2">
      <div class="col-lg-6 mb-4">
        <div class="cb-card h-100">
          <div class="cb-card-header">🔁 Dernières transactions</div>
          <div *ngIf="loading" class="cb-loading py-4"><div class="spinner-border"></div></div>
          <div class="cb-table-wrap" *ngIf="!loading && recentActivity.recentTransactions.length">
            <table class="table table-sm mb-0">
              <thead><tr>
                <th>Date</th><th>De</th><th>Vers</th><th>Montant</th><th>Frais</th>
              </tr></thead>
              <tbody>
                <tr *ngFor="let t of recentActivity.recentTransactions">
                  <td>{{ t.created_at | date:'short' }}</td>
                  <td><code>{{ (t.from_bank || '').substring(0, 8) }}...</code></td>
                  <td><code>{{ (t.to_bank || '').substring(0, 8) }}...</code></td>
                  <td>{{ t.original_amount || 0 }} TND</td>
                  <td>{{ t.fee || 0 }} TND</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="!loading && !recentActivity.recentTransactions.length" class="p-4 text-muted text-center">
            Aucune transaction récente.
          </div>
        </div>
      </div>
      <div class="col-lg-6 mb-4">
        <div class="cb-card h-100">
          <div class="cb-card-header">⏳ Transferts en attente</div>
          <div *ngIf="loading" class="cb-loading py-4"><div class="spinner-border"></div></div>
          <div class="cb-table-wrap" *ngIf="!loading && recentActivity.pendingTransfers.length">
            <table class="table table-sm mb-0">
              <thead><tr>
                <th>ID</th><th>De</th><th>Vers</th><th>Montant</th><th>Statut</th>
              </tr></thead>
              <tbody>
                <tr *ngFor="let p of recentActivity.pendingTransfers">
                  <td>{{ p.transfer_id || p.id }}</td>
                  <td><code>{{ (p.from_bank || '').substring(0, 8) }}...</code></td>
                  <td><code>{{ (p.to_bank || '').substring(0, 8) }}...</code></td>
                  <td>{{ p.amount || 0 }} TND</td>
                  <td><span class="badge bg-warning text-dark">{{ p.status || 'pending' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="!loading && !recentActivity.pendingTransfers.length" class="p-4 text-muted text-center">
            Aucun transfert en attente récent.
          </div>
        </div>
      </div>
    </div>
    <div class="row mb-4">
      <div class="col-12">
        <div class="cb-card">
          <div class="cb-card-header">🏦 Banques les plus actives</div>
          <div *ngIf="loading" class="cb-loading py-4"><div class="spinner-border"></div></div>
          <div class="cb-table-wrap" *ngIf="!loading && recentActivity.activeBanks.length">
            <table class="table table-sm mb-0">
              <thead><tr><th>Banque</th><th>Adresse</th><th>Transactions</th></tr></thead>
              <tbody>
                <tr *ngFor="let b of recentActivity.activeBanks">
                  <td><strong>{{ b.name }}</strong></td>
                  <td><code>{{ (b.wallet_address || '').substring(0, 10) }}...</code></td>
                  <td><span class="badge bg-primary">{{ b.transaction_count }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="!loading && !recentActivity.activeBanks.length" class="p-4 text-muted text-center">
            Aucune activité récente.
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecentTablesComponent {
  @Input() recentActivity!: {
    recentTransactions: any[];
    pendingTransfers: any[];
    activeBanks: any[];
  };
  @Input() loading = false;
}
