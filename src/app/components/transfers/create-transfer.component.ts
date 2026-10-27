import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { RouterModule } from '@angular/router';

import { ApiService } from '../../services/api.service';

import { RoleService } from '../../services/role.service';

import { ethers } from 'ethers';



@Component({

  selector: 'app-create-transfer',

  standalone: true,

  imports: [CommonModule, FormsModule, RouterModule],

  template: `

    <div class="container">

      <div class="cb-hero-banner">

        <img src="/assets/images/hero-fintech.png" alt="" aria-hidden="true" />

        <img class="hero-illustration" src="/assets/images/transfer-illustration.png" alt="" aria-hidden="true" />

        <div class="hero-overlay">

          <h2>💰 Nouveau transfert international</h2>

          <p>Envoyez des fonds depuis votre banque tunisienne vers l'étranger</p>

        </div>

      </div>



      <div class="row justify-content-center">

        <div class="col-lg-8">

          <div class="cb-card cb-card-accent">

            <div class="cb-card-header">Formulaire de transfert</div>

            <div class="cb-card-body">

              <div class="alert alert-info">

                Transfert international : depuis votre banque tunisienne vers une banque étrangère enregistrée.

              </div>

              <div *ngIf="error" class="alert alert-danger">{{ error }}</div>

              <div *ngIf="success" class="alert alert-success">{{ success }}</div>

              <form (ngSubmit)="createTransfer()">

                <div class="mb-3">

                  <label class="form-label">Banque émettrice</label>

                  <input type="text" class="form-control" [value]="sourceBankLabel" readonly disabled />

                  <small class="text-muted">Votre banque (fixée selon votre compte employé)</small>

                </div>

                <div class="mb-3">

                  <label class="form-label">Clé privée de la banque émettrice</label>

                  <input type="password" class="form-control font-monospace"

                    [(ngModel)]="transfer.fromBankPrivateKey" name="fromBankPrivateKey" placeholder="0x..." required />

                  <small class="text-muted">Doit correspondre à {{ sourceBankLabel }}</small>

                </div>

                <div class="mb-3">

                  <label class="form-label">Banque destinataire (étranger)</label>

                  <select class="form-select font-monospace" [(ngModel)]="transfer.toAddress" name="toAddress" required>

                    <option value="">-- Sélectionner une banque étrangère --</option>

                    <option *ngFor="let b of destinationBanks" [value]="getBankAddress(b)">

                      {{ b.name }} — {{ b.country }} ({{ getBankAddress(b).substring(0, 10) }}...)

                    </option>

                  </select>

                </div>

                <div class="mb-4">

                  <label class="form-label">Montant (TND)</label>

                  <input type="number" step="0.01" min="0" class="form-control"

                    [(ngModel)]="transfer.amount" name="amount" placeholder="1000" required />

                  <small class="text-muted">Montant &gt; 5000 TND : approbation requise par la Banque Centrale</small>

                </div>

                <div class="d-flex gap-2">

                  <button type="submit" class="btn btn-primary px-4" [disabled]="loading">

                    {{ loading ? 'Traitement...' : '💸 Transférer' }}

                  </button>

                  <a routerLink="/banks" class="btn btn-outline-secondary">Annuler</a>

                </div>

              </form>

            </div>

          </div>

        </div>

      </div>

    </div>

  `

})

export class CreateTransferComponent implements OnInit {

  transfer = { fromBankPrivateKey: '', toAddress: '', amount: '' };

  allBanks: any[] = [];

  destinationBanks: any[] = [];

  sourceBankLabel = '';

  employeeBankAddress = '';

  employeeBank: any = null;

  loading = false;

  error = '';

  success = '';



  constructor(private api: ApiService, private role: RoleService) {}



  ngOnInit(): void {

    const user = this.role.getEmployeeUser();

    this.employeeBankAddress = user?.bank_wallet_address || '';

    this.sourceBankLabel = user?.bank_name

      ? `${user.bank_name} (${this.employeeBankAddress.substring(0, 10)}...)`

      : this.employeeBankAddress;



    this.api.getBanks(true).subscribe({

      next: (res: any) => {

        const arr = Array.isArray(res) ? res : (res?.data ? res.data : []);

        this.allBanks = Array.isArray(arr) ? arr : [];

        this.employeeBank = this.allBanks.find(

          (b) => this.getBankAddress(b).toLowerCase() === this.employeeBankAddress.toLowerCase()

        );

        if (this.employeeBank && !this.role.isTunisianBank(this.employeeBank)) {

          this.error = 'Seules les banques tunisiennes peuvent initier un transfert international.';

        }

        this.destinationBanks = this.role.getInternationalDestinations(this.allBanks, this.employeeBankAddress);

      }

    });

  }



  getBankAddress(bank: any): string { return this.role.getBankAddress(bank); }



  createTransfer(): void {

    this.error = '';

    this.success = '';

    if (!this.transfer.toAddress) { this.error = 'Veuillez sélectionner une banque destinataire étrangère.'; return; }

    const destBank = this.allBanks.find(

      (b) => this.getBankAddress(b).toLowerCase() === this.transfer.toAddress.toLowerCase()

    );

    if (!destBank || this.role.isTunisianBank(destBank)) {

      this.error = 'Le transfert doit être international (Tunisie → étranger).'; return;

    }

    if (!this.employeeBank || !this.role.isTunisianBank(this.employeeBank)) {

      this.error = 'Votre banque doit être une banque tunisienne.'; return;

    }

    if (!this.transfer.fromBankPrivateKey) { this.error = 'Clé privée requise.'; return; }

    try {

      const wallet = new ethers.Wallet(this.transfer.fromBankPrivateKey);

      if (wallet.address.toLowerCase() !== this.employeeBankAddress.toLowerCase()) {

        this.error = 'La clé privée ne correspond pas à votre banque émettrice.'; return;

      }

    } catch { this.error = 'Clé privée invalide.'; return; }

    const amount = parseFloat(this.transfer.amount);

    if (isNaN(amount) || amount <= 0) { this.error = 'Montant invalide.'; return; }

    this.loading = true;



    this.api.createTransfer({

      fromBankPrivateKey: this.transfer.fromBankPrivateKey,

      toAddress: this.transfer.toAddress,

      amount: this.transfer.amount

    }).subscribe({

      next: (res: any) => {

        this.loading = false;

        if (res && res.success !== false) {

          this.success = amount > 5000

            ? 'Transfert en attente d\'approbation par la Banque Centrale (montant > 5000 TND).'

            : 'Transfert international effectué avec succès.';

          this.transfer = { fromBankPrivateKey: '', toAddress: '', amount: '' };

          this.api.invalidateCache();

        } else {

          this.error = res?.error || 'Une erreur est survenue.';

        }

      },

      error: (err: any) => {

        this.loading = false;

        this.error = err?.error?.error || err?.message || 'Erreur de transfert';

      }

    });

  }

}

