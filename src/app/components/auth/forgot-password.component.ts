import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EmployeeAuthService } from '../../services/employee-auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="cb-auth-page">
      <div class="cb-auth-card">
        <div class="cb-auth-card-header" style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);">
          <div class="auth-icon">🔑</div>
          <h2>Mot de passe oublié</h2>
        </div>
        <div class="cb-auth-card-body">
          <div *ngIf="success" class="alert alert-success">{{ success }}</div>
          <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
          <p class="text-muted mb-4">
            Saisissez votre email professionnel. Vous recevrez un lien pour réinitialiser votre mot de passe.
          </p>
          <form (ngSubmit)="submit()">
            <div class="mb-3">
              <label class="form-label">Email professionnel</label>
              <input type="email" class="form-control" [(ngModel)]="email" name="email"
                placeholder="ex: jean.dupont@ubci.tn" required />
            </div>
            <button type="submit" class="btn btn-primary w-100 py-2" [disabled]="loading">
              <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
              Envoyer le lien
            </button>
          </form>
          <hr class="my-4" />
          <div class="text-center">
            <a routerLink="/login" class="text-decoration-none">← Retour à la connexion</a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  error = '';
  success = '';

  constructor(
    private employeeAuth: EmployeeAuthService,
    private router: Router
  ) {}

  submit(): void {
    if (!this.email) {
      this.error = 'Veuillez saisir votre email';
      return;
    }
    this.loading = true;
    this.error = '';
    this.employeeAuth.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.success = res.message || 'Email de réinitialisation envoyé (si le compte existe).';
        this.email = '';
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de l\'envoi';
      }
    });
  }
}
