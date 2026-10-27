import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../services/api.service';

Chart.register(...registerables);

@Component({
  selector: 'app-rates',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './rates.component.html',
  styleUrls: ['./rates.component.css']
})
export class RatesComponent implements OnInit, OnDestroy {
  currentRates: any = { eurToTnd: 0, usdToTnd: 0 };
  eurVariation: number = 0;
  usdVariation: number = 0;
  lastUpdate: string = '';

  evolutionData: any = { labels: [], datasets: [] };
  comparisonData: any = { labels: [], datasets: [] };
  weeklySparkline: any = { labels: [], datasets: [] };

  lineChartOptions: any = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.parsed.y?.toFixed(4) ?? context.parsed} TND`
        }
      }
    }
  };

  barChartOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.parsed.x?.toFixed(4) ?? context.parsed} TND`
        }
      }
    }
  };

  updateHistory: any[] = [];

  loading: boolean = true;
  error: string | null = null;
  private refreshInterval: any;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadRates();
    this.loadHistory();
    this.refreshInterval = setInterval(() => this.loadRates(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  loadRates(): void {
    this.apiService.getRates().subscribe({
      next: (response: any) => {
        const data = response?.data ?? response;
        this.currentRates.eurToTnd = Number(data?.eurToTnd ?? this.currentRates.eurToTnd);
        this.currentRates.usdToTnd = Number(data?.usdToTnd ?? this.currentRates.usdToTnd);
        this.lastUpdate = new Date().toLocaleString('fr-FR');
        this.loading = false;
        this.computeVariations();
        this.updateComparisonData();
      },
      error: () => {
        this.error = 'Erreur chargement des taux';
        this.loading = false;
      }
    });
  }

  loadHistory(): void {
    // Récupération de l'historique (30 dernières entrées) pour toutes les monnaies
    this.apiService.getRateHistory('', 30).subscribe({
      next: (response: any) => {
        this.updateHistory = response?.data ?? response ?? [];
        this.updateHistory = this.updateHistory
          .map((item: any) => ({ ...item, created_at: new Date(item.created_at) }))
          .sort((a: any, b: any) => b.created_at - a.created_at);

        this.initCharts();
      },
      error: () => {
        this.error = 'Historique non disponible';
      }
    });
  }

  initCharts(): void {
    const eurHistory = this.updateHistory.filter((h: any) => h.currency === 'EUR').slice(0, 30).reverse();
    const usdHistory = this.updateHistory.filter((h: any) => h.currency === 'USD').slice(0, 30).reverse();
    const labels = [...new Set([...eurHistory, ...usdHistory].map((h: any) => h.created_at.toLocaleDateString('fr-FR')))].slice(-30);

    this.evolutionData = {
      labels,
      datasets: [
        {
          label: 'EUR  TND',
          data: labels.map((label: any) => {
            const item = eurHistory.find((h: any) => h.created_at.toLocaleDateString('fr-FR') === label);
            return item ? Number(item.rate) : 0;
          }),
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13, 110, 253, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'USD  TND',
          data: labels.map((label: any) => {
            const item = usdHistory.find((h: any) => h.created_at.toLocaleDateString('fr-FR') === label);
            return item ? Number(item.rate) : 0;
          }),
          borderColor: '#198754',
          backgroundColor: 'rgba(25, 135, 84, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };

    this.comparisonData = {
      labels: ['EUR/TND', 'USD/TND'],
      datasets: [
        {
          label: 'Taux actuel',
          data: [this.currentRates.eurToTnd, this.currentRates.usdToTnd],
          backgroundColor: ['#0d6efd', '#198754'],
          borderRadius: 8
        }
      ]
    };

    const sparklineEur = eurHistory.slice(-7).map((h: any) => Number(h.rate));
    const sparklineUsd = usdHistory.slice(-7).map((h: any) => Number(h.rate));

    this.weeklySparkline = {
      labels: eurHistory.slice(-7).map((h: any) => h.created_at.toLocaleDateString('fr-FR')),
      datasets: [
        {
          label: 'EUR',
          data: sparklineEur,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13, 110, 253, 0.15)',
          fill: false,
          tension: 0.3
        },
        {
          label: 'USD',
          data: sparklineUsd,
          borderColor: '#198754',
          backgroundColor: 'rgba(25, 135, 84, 0.15)',
          fill: false,
          tension: 0.3
        }
      ]
    };

    this.computeVariations();
  }

  updateComparisonData(): void {
    this.comparisonData = {
      labels: ['EUR/TND', 'USD/TND'],
      datasets: [
        {
          label: 'Taux actuel',
          data: [this.currentRates.eurToTnd, this.currentRates.usdToTnd],
          backgroundColor: ['#0d6efd', '#198754'],
          borderRadius: 8
        }
      ]
    };
  }

  computeVariations(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('fr-FR');

    const eurYesterday = this.updateHistory.find((h: any) => h.currency === 'EUR' && h.created_at.toLocaleDateString('fr-FR') === yesterdayStr);
    const usdYesterday = this.updateHistory.find((h: any) => h.currency === 'USD' && h.created_at.toLocaleDateString('fr-FR') === yesterdayStr);

    if (eurYesterday && eurYesterday.rate) {
      this.eurVariation = ((this.currentRates.eurToTnd - Number(eurYesterday.rate)) / Number(eurYesterday.rate)) * 100;
    }
    if (usdYesterday && usdYesterday.rate) {
      this.usdVariation = ((this.currentRates.usdToTnd - Number(usdYesterday.rate)) / Number(usdYesterday.rate)) * 100;
    }
  }
}
