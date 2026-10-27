import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';

import { ApiService } from '../../services/api.service';

import { RoleService } from '../../services/role.service';

import { PdfService } from '../../services/pdf.service';



@Component({

  selector: 'app-transfers',

  standalone: true,

  imports: [CommonModule],

  template: `

    <div class="container">

      <div class="cb-hero-banner">

        <img src="/assets/images/hero-fintech.png" alt="" aria-hidden="true" />

        <img class="hero-illustration" src="/assets/images/transfer-illustration.png" alt="" aria-hidden="true" />

        <div class="hero-overlay">

          <h2>{{ pageTitle }}</h2>

          <p>Historique complet des opérations transfrontalières</p>

        </div>

      </div>



      <div class="cb-page-header">

        <div>

          <h2>{{ transactions.length }} transaction(s)</h2>

          <p class="subtitle">Consultez et exportez vos transferts</p>

        </div>

        <div class="cb-page-actions">

          <button class="btn btn-outline-primary btn-sm" (click)="exportMonthlyReport()">

            📄 Rapport mensuel

          </button>

        </div>

      </div>



      <div *ngIf="loading" class="cb-loading">

        <div class="spinner-border"></div>

        <p>Chargement des transactions...</p>

      </div>



      <div *ngIf="!loading && transactions.length > 0" class="cb-table-wrap">

        <table class="table table-hover mb-0">

          <thead>

            <tr>

              <th>#</th><th>De</th><th>Vers</th><th>Montant</th>

              <th>Converti</th><th>Frais</th><th>Date</th><th>Actions</th>

            </tr>

          </thead>

          <tbody>

            <tr *ngFor="let tx of transactions; let i = index">

              <td>{{ i + 1 }}</td>

              <td><code>{{ formatAddress(tx.from_bank, 6) }}</code></td>

              <td><code>{{ formatAddress(tx.to_bank, 6) }}</code></td>

              <td><strong>{{ tx.original_amount }} TND</strong></td>

              <td>{{ tx.converted_amount }} TND</td>

              <td><span class="badge bg-warning text-dark">{{ tx.fee }} TND</span></td>

              <td>{{ tx.created_at | date:'short' }}</td>

              <td>

                <button class="btn btn-sm btn-outline-primary" (click)="exportReceipt(tx)">🧾 Reçu</button>

              </td>

            </tr>

          </tbody>

        </table>

      </div>



      <div *ngIf="!loading && transactions.length === 0" class="cb-empty">

        <img src="/assets/images/transfer-illustration.png" alt="" />

        <p class="text-muted">Aucune transaction enregistrée</p>

      </div>

    </div>

  `

})

export class TransfersComponent implements OnInit {

  transactions: any[] = [];

  loading: boolean = false;



  constructor(

    private apiService: ApiService,

    private pdfService: PdfService,

    private role: RoleService

  ) {}



  get pageTitle(): string {

    return this.role.canViewFullData()

      ? '📊 Historique des transferts'

      : '📊 Transferts de ma banque';

  }



  ngOnInit(): void { this.loadTransactions(); }



  formatAddress(address: string, length: number = 6): string {

    if (address && address.length > length) return address.substring(0, length) + '...';

    return address || 'N/A';

  }



  loadTransactions(): void {

    this.loading = true;

    this.apiService.getTransactions().subscribe({

      next: (res: any) => {

        if (Array.isArray(res)) this.transactions = res;

        else if (res?.data && Array.isArray(res.data)) this.transactions = res.data;

        else this.transactions = [];

        this.transactions = this.role.filterTransactions(this.transactions);

        this.loading = false;

      },

      error: () => { this.transactions = []; this.loading = false; }

    });

  }



  exportReceipt(transaction: any): void {

    if (!transaction) return;

    this.pdfService.exportTransferReceipt(transaction);

  }



  exportMonthlyReport(): void {

    if (!this.transactions?.length) {

      alert('Aucune transaction disponible pour générer le rapport mensuel.');

      return;

    }

    this.pdfService.exportMonthlyReport(this.transactions);

  }

}

