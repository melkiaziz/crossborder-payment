import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EmployeeAuthService } from '../../services/employee-auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="cb-auth-page">
      <div class="cb-auth-split">
        <div class="cb-auth-side">
          <img src="/assets/images/banks-illustration.png" alt="Réseau bancaire" />
          <h3>Rejoignez le réseau</h3>
          <p>Inscrivez-vous en tant qu'employé bancaire pour accéder aux services de transferts internationaux.</p>
        </div>
        <div class="cb-auth-card wide">
          <div class="cb-auth-card-header">
            <div class="auth-icon">📝</div>
            <h2>Inscription Employé</h2>
          </div>
          <div class="cb-auth-card-body">
            <div *ngIf="success" class="alert alert-success">{{ success }}</div>
            <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
            <form (ngSubmit)="register()" #registerForm="ngForm">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Nom complet</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.fullName" name="fullName" required />
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Email professionnel</label>
                  <input type="email" class="form-control" [(ngModel)]="formData.email" name="email"
                    placeholder="ex: jean.dupont@ubci.tn" required />
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Identifiant employé</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.employeeId" name="employeeId"
                    placeholder="Matricule" required />
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Banque</label>
                  <select class="form-select" [(ngModel)]="formData.bankWalletAddress" name="bankWalletAddress" required>
                    <option value="">Sélectionnez votre banque</option>
                    <option *ngFor="let bank of banks" [value]="bank.wallet_address">
                      {{ bank.name }} ({{ bank.country }})
                    </option>
                  </select>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Mot de passe</label>
                  <input type="password" class="form-control" [(ngModel)]="formData.password" name="password"
                    required minlength="8" />
                  <small class="text-muted">Minimum 8 caractères</small>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Confirmer le mot de passe</label>
                  <input type="password" class="form-control" [(ngModel)]="confirmPassword" name="confirmPassword" required />
                </div>
              </div>
              <div class="alert alert-info">
                Votre compte devra être vérifié par email avant utilisation.
              </div>
              <button type="submit" class="btn btn-success w-100 py-2" [disabled]="loading || !registerForm.form.valid">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                S'inscrire
              </button>
            </form>
            <hr class="my-4" />
            <div class="text-center">
              <p>Déjà un compte ? <a routerLink="/login" class="fw-semibold">Se connecter</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegisterComponent implements OnInit {
  formData = { email: '', password: '', employeeId: '', fullName: '', bankWalletAddress: '' };
  confirmPassword = '';
  banks: any[] = [];
  loading = false;
  error = '';
  success = '';

  constructor(
    private employeeAuth: EmployeeAuthService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBanks();
  }

  loadBanks(): void {
    this.apiService.getBanks().subscribe({
      next: (res: any) => {
        const arr = Array.isArray(res) ? res : (res && res.data ? res.data : []);
        this.banks = Array.isArray(arr) ? arr : [];
      }
    });
  }

  register(): void {
    if (this.formData.password !== this.confirmPassword) {
      this.error = 'Les mots de passe ne correspondent pas';
      return;
    }
    if (this.formData.password.length < 8) {
      this.error = 'Le mot de passe doit contenir au moins 8 caractères';
      return;
    }
    this.loading = true;
    this.error = '';
    this.employeeAuth.register(this.formData).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.success) {
          this.success = 'Inscription réussie ! Vérifiez votre email pour activer votre compte.';
          setTimeout(() => this.router.navigate(['/login']), 3000);
        } else {
          this.error = res.error || 'Erreur lors de l\'inscription';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Erreur lors de l\'inscription';
      }
    });
  }
}
