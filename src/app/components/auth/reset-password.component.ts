import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EmployeeAuthService } from '../../services/employee-auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="cb-auth-page">
      <div class="cb-auth-card">
        <div class="cb-auth-card-header">
          <div class="auth-icon">🔄</div>
          <h2>Réinitialisation du mot de passe</h2>
        </div>
        <div class="cb-auth-card-body">
          <div *ngIf="success" class="alert alert-success">{{ success }}</div>
          <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
          <form (ngSubmit)="submit()" *ngIf="!success">
            <div class="mb-3">
              <label class="form-label">Nouveau mot de passe</label>
              <input type="password" class="form-control" [(ngModel)]="newPassword"
                name="newPassword" required minlength="8" />
              <small class="text-muted">Minimum 8 caractères</small>
            </div>
            <div class="mb-4">
              <label class="form-label">Confirmer le mot de passe</label>
              <input type="password" class="form-control" [(ngModel)]="confirmPassword"
                name="confirmPassword" required />
            </div>
            <button type="submit" class="btn btn-primary w-100 py-2" [disabled]="loading">
              <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
              Réinitialiser
            </button>
          </form>
          <div class="text-center mt-3" *ngIf="success">
            <a routerLink="/login" class="btn btn-primary">Aller à la connexion</a>
          </div>
          <div class="text-center mt-3" *ngIf="!success">
            <a routerLink="/login" class="text-decoration-none">← Retour à la connexion</a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  error = '';
  success = '';

  constructor(
    private route: ActivatedRoute,
    private employeeAuth: EmployeeAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (!this.token) this.error = 'Token de réinitialisation invalide';
    });
  }

  submit(): void {
    if (!this.token) { this.error = 'Token invalide'; return; }
    if (this.newPassword !== this.confirmPassword) { this.error = 'Les mots de passe ne correspondent pas'; return; }
    if (this.newPassword.length < 8) { this.error = 'Le mot de passe doit contenir au moins 8 caractères'; return; }
    this.loading = true;
    this.error = '';
    this.employeeAuth.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de la réinitialisation';
      }
    });
  }
}
