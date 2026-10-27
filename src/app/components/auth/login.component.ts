import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EmployeeAuthService } from '../../services/employee-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="cb-auth-page">
      <div class="cb-auth-split">
        <div class="cb-auth-side">
          <img src="/assets/images/transfer-illustration.png" alt="Transferts internationaux" />
          <h3>Paiements transfrontaliers sécurisés</h3>
          <p>Connectez-vous pour accéder à la plateforme de transferts internationaux de votre banque partenaire.</p>
        </div>
        <div class="cb-auth-card">
          <div class="cb-auth-card-header">
            <div class="auth-icon">🔐</div>
            <h2>Connexion Employé</h2>
          </div>
          <div class="cb-auth-card-body">
            <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
            <form (ngSubmit)="login()">
              <div class="mb-3">
                <label class="form-label">Email professionnel</label>
                <input type="email" class="form-control" [(ngModel)]="email" name="email"
                  placeholder="ex: jean.dupont@ubci.tn" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Mot de passe</label>
                <input type="password" class="form-control" [(ngModel)]="password" name="password" required />
              </div>
              <div class="mb-3 text-end">
                <a routerLink="/forgot-password" class="text-decoration-none">Mot de passe oublié ?</a>
              </div>
              <button type="submit" class="btn btn-primary w-100 py-2" [disabled]="loading">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                Se connecter
              </button>
            </form>
            <hr class="my-4" />
            <div class="text-center">
              <p class="mb-2">Pas encore de compte ? <a routerLink="/register" class="fw-semibold">S'inscrire</a></p>
              <a routerLink="/central-bank-login" class="text-muted small text-decoration-none">
                Connexion Banque Centrale →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private employeeAuth: EmployeeAuthService,
    private router: Router
  ) {}

  login(): void {
    if (!this.email || !this.password) {
      this.error = 'Veuillez remplir tous les champs';
      return;
    }
    this.loading = true;
    this.error = '';
    this.employeeAuth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.success) {
          this.router.navigate(['/banks']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur de connexion';
      }
    });
  }
}
