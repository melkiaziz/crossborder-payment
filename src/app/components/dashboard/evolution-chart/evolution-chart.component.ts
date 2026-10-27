import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-evolution-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="cb-chart-card h-100">
      <div class="card-header">📈 Évolution des transferts</div>
      <div class="card-body" style="min-height: 320px;">
        <div *ngIf="loading" class="cb-loading">
          <div class="spinner-border"></div>
        </div>
        <canvas *ngIf="!loading && lineChartData.datasets.length" baseChart
          [data]="lineChartData" [options]="lineChartOptions" [type]="'line'">
        </canvas>
        <div *ngIf="!loading && !lineChartData.datasets.length" class="cb-empty">
          <p class="text-muted mb-0">Aucune donnée disponible pour cette période.</p>
        </div>
      </div>
    </div>
  `
})
export class EvolutionChartComponent implements OnChanges {
  @Input() evolutionData: any[] = [];
  @Input() loading = false;

  lineChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };

  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,0.05)' } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: 'Montant (TND)' } }
    }
  };

  ngOnChanges(): void {
    if (!this.evolutionData?.length) {
      this.lineChartData = { labels: [], datasets: [] };
      return;
    }
    const labels = this.evolutionData.map(d => d.date);
    this.lineChartData = {
      labels,
      datasets: [
        {
          data: this.evolutionData.map(d => Number(d.volume || 0)),
          label: 'Volume (TND)',
          fill: true, tension: 0.4,
          borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.15)', pointRadius: 4
        },
        {
          data: this.evolutionData.map(d => Number(d.fees || 0)),
          label: 'Frais (TND)',
          fill: false, tension: 0.4,
          borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', pointRadius: 4
        }
      ]
    };
  }
}
