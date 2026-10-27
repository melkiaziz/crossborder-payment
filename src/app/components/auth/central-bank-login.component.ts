import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-central-bank-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="cb-auth-page">
      <div class="cb-auth-split">
        <div class="cb-auth-side">
          <img src="/assets/images/dashboard-illustration.png" alt="Administration centrale" />
          <h3>Administration Banque Centrale</h3>
          <p>Accédez au tableau de bord, gérez les taux de change, les frais et la blacklist des banques.</p>
        </div>
        <div class="cb-auth-card">
          <div class="cb-auth-card-header">
            <div class="auth-icon">👑</div>
            <h2>Connexion Banque Centrale</h2>
          </div>
          <div class="cb-auth-card-body">
            <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
            <form (ngSubmit)="onSubmit()">
              <div class="mb-4">
                <label class="form-label">Clé privée (private key)</label>
                <input type="password" class="form-control font-monospace" [(ngModel)]="privateKey"
                  name="privateKey" placeholder="0x..." required />
                <small class="text-muted">Clé privée du propriétaire du contrat blockchain</small>
              </div>
              <button type="submit" class="btn btn-primary w-100 py-2" [disabled]="loading">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                {{ loading ? 'Connexion...' : 'Se connecter' }}
              </button>
            </form>
            <hr class="my-4" />
            <div class="text-center">
              <a routerLink="/banks" class="text-muted small text-decoration-none">← Retour aux banques</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CentralBankLoginComponent {
  privateKey = '';
  error = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.error = '';
    this.loading = true;
    if (this.auth.login(this.privateKey)) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error = 'Clé privée invalide ou vous n\'êtes pas l\'owner du contrat.';
    }
    this.loading = false;
  }
}
