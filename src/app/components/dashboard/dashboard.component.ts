import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { KpiCardsComponent } from './kpi-cards/kpi-cards.component';
import { EvolutionChartComponent } from './evolution-chart/evolution-chart.component';
import { DistributionChartsComponent } from './distribution-charts/distribution-charts.component';
import { RecentTablesComponent } from './recent-tables/recent-tables.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KpiCardsComponent,
    EvolutionChartComponent,
    DistributionChartsComponent,
    RecentTablesComponent
  ],
  template: `
    <div class="container">
      <div class="cb-hero-banner">
        <img src="/assets/images/hero-fintech.png" alt="" aria-hidden="true" />
        <img class="hero-illustration" src="/assets/images/dashboard-illustration.png" alt="" aria-hidden="true" />
        <div class="hero-overlay">
          <h2>📊 Dashboard global</h2>
          <p>Vue d'ensemble en temps réel des transferts internationaux</p>
        </div>
      </div>

      <div class="cb-page-header">
        <div>
          <h2>Indicateurs clés</h2>
          <p class="subtitle">Statistiques consolidées de la plateforme</p>
        </div>
        <div class="cb-page-actions">
          <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="rangeDays" (ngModelChange)="reloadAll()">
            <option [value]="7">7 derniers jours</option>
            <option [value]="30">30 derniers jours</option>
          </select>
          <button class="btn btn-outline-primary btn-sm" (click)="reloadAll()" [disabled]="loading">
            🔄 Actualiser
          </button>
          <span class="cb-update-time">MAJ: {{ lastUpdate }}</span>
        </div>
      </div>

      <app-kpi-cards [kpis]="kpis" [loading]="loading"></app-kpi-cards>

      <div class="row mt-4">
        <div class="col-lg-8 mb-4">
          <app-evolution-chart [evolutionData]="evolutionData" [loading]="loading"></app-evolution-chart>
        </div>
        <div class="col-lg-4 mb-4">
          <app-distribution-charts
            [currencyDistribution]="currencyDistribution"
            [countryDistribution]="countryDistribution"
            [loading]="loading">
          </app-distribution-charts>
        </div>
      </div>

      <app-recent-tables [recentActivity]="recentActivity" [loading]="loading"></app-recent-tables>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  rangeDays = 7;
  loading = true;
  lastUpdate = '';
  kpis: any = {};
  evolutionData: any[] = [];
  currencyDistribution: any[] = [];
  countryDistribution: any[] = [];
  recentActivity: {
    recentTransactions: any[];
    pendingTransfers: any[];
    activeBanks: any[];
  } = { recentTransactions: [], pendingTransfers: [], activeBanks: [] };

  constructor(private api: ApiService) {}

  ngOnInit(): void { this.reloadAll(); }

  reloadAll(): void {
    this.loading = true;
    this.loadKpis();
    this.loadEvolution();
    this.loadDistributions();
    this.loadRecent();
  }

  private loadKpis(): void {
    this.api.getDashboardKpis().subscribe({
      next: (res: any) => { this.kpis = res && res.data ? res.data : res; this.markUpdated(); },
      error: () => { this.kpis = {}; this.markUpdated(); }
    });
  }

  private loadEvolution(): void {
    this.api.getDashboardTransactionsEvolution(this.rangeDays).subscribe({
      next: (res: any) => { this.evolutionData = res && res.data ? res.data : res; this.markUpdated(); },
      error: () => { this.evolutionData = []; this.markUpdated(); }
    });
  }

  private loadDistributions(): void {
    this.api.getDashboardCurrencyDistribution().subscribe({
      next: (res: any) => { this.currencyDistribution = res && res.data ? res.data : res; this.markUpdated(); },
      error: () => { this.currencyDistribution = []; this.markUpdated(); }
    });
    this.api.getDashboardCountryDistribution().subscribe({
      next: (res: any) => { this.countryDistribution = res && res.data ? res.data : res; this.markUpdated(); },
      error: () => { this.countryDistribution = []; this.markUpdated(); }
    });
  }

  private loadRecent(): void {
    this.api.getDashboardRecentActivity().subscribe({
      next: (res: any) => {
        const data = res && res.data ? res.data : res;
        this.recentActivity = {
          recentTransactions: data?.recentTransactions || [],
          pendingTransfers: data?.pendingTransfers || [],
          activeBanks: data?.activeBanks || []
        };
        this.markUpdated();
      },
      error: () => {
        this.recentActivity = { recentTransactions: [], pendingTransfers: [], activeBanks: [] };
        this.markUpdated();
      }
    });
  }

  private markUpdated(): void {
    this.lastUpdate = new Date().toLocaleTimeString('fr-FR');
    this.loading = false;
  }
}
