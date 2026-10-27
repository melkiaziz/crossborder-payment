import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-distribution-charts',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="cb-chart-card mb-3">
      <div class="card-header">💱 Répartition par devise</div>
      <div class="card-body">
        <canvas *ngIf="!loading && currencyChartData.labels?.length" baseChart
          [data]="currencyChartData" [type]="'doughnut'">
        </canvas>
        <div *ngIf="loading" class="cb-loading py-4"><div class="spinner-border"></div></div>
        <div *ngIf="!loading && !currencyChartData.labels?.length" class="text-muted text-center py-3">
          Aucune donnée disponible.
        </div>
      </div>
    </div>
    <div class="cb-chart-card">
      <div class="card-header">🌍 Banques par pays</div>
      <div class="card-body">
        <canvas *ngIf="!loading && countryChartData.labels?.length" baseChart
          [data]="countryChartData" [type]="'bar'">
        </canvas>
        <div *ngIf="loading" class="cb-loading py-4"><div class="spinner-border"></div></div>
        <div *ngIf="!loading && !countryChartData.labels?.length" class="text-muted text-center py-3">
          Aucune donnée disponible.
        </div>
      </div>
    </div>
  `
})
export class DistributionChartsComponent implements OnChanges {
  @Input() currencyDistribution: any[] = [];
  @Input() countryDistribution: any[] = [];
  @Input() loading = false;

  currencyChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  countryChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };

  ngOnChanges(): void {
    if (this.currencyDistribution?.length) {
      this.currencyChartData = {
        labels: this.currencyDistribution.map(d => d.currency || 'N/A'),
        datasets: [{
          data: this.currencyDistribution.map(d => Number(d.total_balance || 0)),
          backgroundColor: ['#0891b2', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']
        }]
      };
    } else {
      this.currencyChartData = { labels: [], datasets: [] };
    }

    if (this.countryDistribution?.length) {
      this.countryChartData = {
        labels: this.countryDistribution.map(d => d.country || 'N/A'),
        datasets: [{
          data: this.countryDistribution.map(d => Number(d.bank_count || 0)),
          label: 'Banques',
          backgroundColor: '#0891b2', borderRadius: 8
        }]
      };
    } else {
      this.countryChartData = { labels: [], datasets: [] };
    }
  }
}
