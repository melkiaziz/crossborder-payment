import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="cb-auth-page">
      <div class="cb-auth-card">
        <div class="cb-auth-card-header" [style.background]="headerGradient">
          <div class="auth-icon">{{ statusIcon }}</div>
          <h2>{{ statusTitle }}</h2>
        </div>
        <div class="cb-auth-card-body text-center">
          <div *ngIf="status === 'loading'" class="py-4">
            <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
            <p>Vérification de votre compte en cours...</p>
          </div>
          <div *ngIf="status === 'success'" class="py-3">
            <div class="display-1 mb-3">✅</div>
            <h3 class="mb-3">{{ message }}</h3>
            <p class="text-muted">Vous pouvez maintenant vous connecter à votre compte.</p>
            <a routerLink="/login" class="btn btn-success btn-lg mt-3 px-5">Aller à la connexion</a>
          </div>
          <div *ngIf="status === 'alreadyVerified'" class="py-3">
            <div class="display-1 mb-3">ℹ️</div>
            <h3 class="mb-3">{{ message }}</h3>
            <p class="text-muted">Votre compte a déjà été vérifié.</p>
            <a routerLink="/login" class="btn btn-primary btn-lg mt-3 px-5">Aller à la connexion</a>
          </div>
          <div *ngIf="status === 'error'" class="py-3">
            <div class="display-1 mb-3">❌</div>
            <h3 class="mb-3">{{ message }}</h3>
            <p class="text-muted">Le lien de vérification est peut-être expiré ou invalide.</p>
            <a routerLink="/login" class="btn btn-primary btn-lg mt-3 px-5">Retour à la connexion</a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' | 'alreadyVerified' = 'loading';
  message = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  get statusTitle(): string {
    const titles: Record<string, string> = {
      loading: 'Vérification en cours...',
      success: 'Vérification réussie',
      alreadyVerified: 'Compte déjà vérifié',
      error: 'Erreur de vérification'
    };
    return titles[this.status];
  }

  get statusIcon(): string {
    const icons: Record<string, string> = {
      loading: '⏳', success: '✅', alreadyVerified: 'ℹ️', error: '❌'
    };
    return icons[this.status];
  }

  get headerGradient(): string {
    if (this.status === 'success' || this.status === 'alreadyVerified') {
      return 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
    }
    if (this.status === 'error') return 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
    return 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (!token) { this.status = 'error'; this.message = 'Token de vérification manquant'; return; }
      this.verifyEmail(token);
    });
  }

  verifyEmail(token: string): void {
    this.status = 'loading';
    this.http.get(`${environment.apiUrl}/auth/verify-email?token=${token}`).subscribe({
      next: (res: any) => {
        if (res.alreadyVerified) { this.status = 'alreadyVerified'; this.message = res.message; }
        else if (res.success) { this.status = 'success'; this.message = res.message; }
        else { this.status = 'error'; this.message = res.error || 'Erreur inconnue'; }
      },
      error: (err) => {
        this.status = 'error';
        this.message = err.error?.error || 'Erreur lors de la vérification';
      }
    });
  }
}
