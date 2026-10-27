import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';

import { ApiService } from '../../services/api.service';

import { AuthService } from '../../services/auth.service';

import { RoleService } from '../../services/role.service';



@Component({

  selector: 'app-pending',

  standalone: true,

  imports: [CommonModule],

  template: `

    <div class="container">

      <div class="cb-hero-banner">

        <img src="/assets/images/hero-fintech.png" alt="" aria-hidden="true" />

        <div class="hero-overlay">

          <h2>{{ pageTitle }}</h2>

          <p>Transferts en attente d'approbation par la Banque Centrale</p>

        </div>

      </div>



      <div class="cb-page-header">

        <div>

          <h2>{{ pending.length }} en attente</h2>

          <p class="subtitle">Validation requise pour les montants supérieurs à 5000 TND</p>

        </div>

      </div>



      <div *ngIf="loading" class="cb-loading">

        <div class="spinner-border"></div>

      </div>



      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>



      <div *ngIf="!loading && pending.length > 0" class="cb-table-wrap">

        <table class="table table-hover mb-0">

          <thead>

            <tr>

              <th>ID</th><th>De</th><th>Vers</th><th>Montant</th>

              <th>Statut</th><th>Date</th>

              <th *ngIf="isCentralBank">Action</th>

            </tr>

          </thead>

          <tbody>

            <tr *ngFor="let p of pending">

              <td><span class="badge bg-secondary">#{{ p.transfer_id }}</span></td>

              <td><code>{{ formatAddress(p.from_bank) }}</code></td>

              <td><code>{{ formatAddress(p.to_bank) }}</code></td>

              <td><strong>{{ p.amount }} TND</strong></td>

              <td>

                <span class="badge" [ngClass]="p.status === 'pending' ? 'bg-warning text-dark' : 'bg-success'">

                  {{ p.status }}

                </span>

              </td>

              <td>{{ p.created_at | date:'medium' }}</td>

              <td *ngIf="isCentralBank">

                <button *ngIf="p.status === 'pending'" class="btn btn-sm btn-success"

                  (click)="approveTransfer(p.transfer_id)" [disabled]="approvingId === p.transfer_id">

                  <span *ngIf="approvingId === p.transfer_id" class="spinner-border spinner-border-sm me-1"></span>

                  {{ approvingId === p.transfer_id ? 'Approbation...' : '✅ Approuver' }}

                </button>

                <span *ngIf="p.status === 'approved'" class="text-success fw-semibold">✓ Approuvé</span>

              </td>

            </tr>

          </tbody>

        </table>

      </div>



      <div *ngIf="!loading && pending.length === 0" class="cb-empty">

        <p class="display-4 mb-3">✅</p>

        <p class="text-muted">Aucun transfert en attente — tout est à jour !</p>

      </div>

    </div>

  `

})

export class PendingComponent implements OnInit {

  pending: any[] = [];

  loading: boolean = false;

  error: string | null = null;

  approvingId: number | null = null;



  constructor(

    private apiService: ApiService,

    private authService: AuthService,

    private role: RoleService

  ) {}



  get pageTitle(): string {

    return this.role.canViewFullData() ? '⏳ Transferts en attente' : '⏳ Mes transferts en attente';

  }



  get isCentralBank(): boolean { return this.authService.isCentralBank(); }



  ngOnInit(): void { this.loadPending(); }



  formatAddress(address: string): string {

    if (address && address.length > 8) return address.substring(0, 8) + '...';

    return address || 'N/A';

  }



  approveTransfer(transferId: number): void {

    this.approvingId = transferId;

    this.apiService.approveTransfer(transferId).subscribe({

      next: () => { this.approvingId = null; this.loadPending(); },

      error: (err) => {

        this.approvingId = null;

        alert('Erreur lors de l\'approbation: ' + (err.error?.error || err.message));

      }

    });

  }



  loadPending(): void {

    this.loading = true;

    this.apiService.getPendingTransfers().subscribe({

      next: (res: any) => {

        if (Array.isArray(res)) this.pending = res;

        else if (res?.data && Array.isArray(res.data)) this.pending = res.data;

        else this.pending = [];

        this.pending = this.role.filterPending(this.pending);

        this.loading = false;

      },

      error: (err: any) => {

        this.error = 'Erreur de chargement: ' + (err.message || 'inconnue');

        this.loading = false;

      }

    });

  }

}

