import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';
import { EmployeeAuthService } from './services/employee-auth.service';
import { RoleService } from './services/role.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: `
    <nav class="navbar navbar-expand-lg navbar-dark cb-navbar">
      <div class="container-fluid px-4">
        <a class="navbar-brand" [routerLink]="isCentralBank ? '/dashboard' : '/banks'">
          <span class="brand-logo">💰</span>
          CrossBorder Payment
        </a>
        <button class="navbar-toggler border-0" type="button" (click)="menuOpen = !menuOpen">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" [class.show]="menuOpen">
          <div class="navbar-nav me-auto ms-lg-3" *ngIf="canAccessApp">
            <a *ngIf="canAccessDashboard" class="nav-link" routerLink="/dashboard" routerLinkActive="active" (click)="menuOpen = false">📊 Dashboard</a>
            <a class="nav-link" routerLink="/banks" routerLinkActive="active" (click)="menuOpen = false">
              🏦 Banques<span class="nav-badge">{{ bankCount }}</span>
            </a>
            <a class="nav-link" routerLink="/transfers" routerLinkActive="active" (click)="menuOpen = false">💸 Transferts</a>
            <a class="nav-link" routerLink="/pending" routerLinkActive="active" (click)="menuOpen = false">⏳ En attente</a>
            <a *ngIf="canCreateTransfer" class="nav-link" routerLink="/create-transfer" routerLinkActive="active" (click)="menuOpen = false">🌍 Nouveau transfert</a>
          </div>
          <div class="navbar-nav ms-auto align-items-lg-center gap-1">
            <ng-container *ngIf="isEmployee; else guestEmployeeLinks">
              <span class="user-chip nav-link disabled mb-2 mb-lg-0">
                👤 {{ (employeeAuth.currentUser$ | async)?.full_name || 'Employé' }}
                <small *ngIf="(employeeAuth.currentUser$ | async)?.bank_name">
                  · {{ (employeeAuth.currentUser$ | async)?.bank_name }}
                </small>
              </span>
              <button class="btn btn-logout btn-outline-light btn-sm mb-2 mb-lg-0" (click)="logoutEmployee()">
                Déconnexion
              </button>
            </ng-container>
            <ng-template #guestEmployeeLinks>
              <a *ngIf="canAccessApp || !isCentralBank" class="nav-link" routerLink="/login" routerLinkActive="active" (click)="menuOpen = false">🔐 Connexion</a>
            </ng-template>
            <ng-container *ngIf="isCentralBank">
              <span class="user-chip nav-link disabled mb-2 mb-lg-0">👑 Banque Centrale</span>
              <a class="nav-link" routerLink="/admin/rates" routerLinkActive="active" (click)="menuOpen = false">💱 Taux</a>
              <a class="nav-link" routerLink="/admin/fees" routerLinkActive="active" (click)="menuOpen = false">📊 Frais</a>
              <a class="nav-link" routerLink="/admin/blacklist" routerLinkActive="active" (click)="menuOpen = false">🚫 Blacklist</a>
              <button class="btn btn-logout btn-outline-light btn-sm ms-lg-2 mb-2 mb-lg-0" (click)="logoutCentralBank()">
                Déconnexion BC
              </button>
            </ng-container>
            <a *ngIf="!isCentralBank" class="nav-link" routerLink="/central-bank-login" routerLinkActive="active" (click)="menuOpen = false">👑 BC Admin</a>
          </div>
        </div>
      </div>
    </nav>

    <main class="cb-main cb-animate-in">
      <router-outlet></router-outlet>
    </main>

    <footer class="cb-footer">
      <div class="container">
        <strong>CrossBorder Payment</strong> — Plateforme sécurisée de transferts internationaux · Blockchain Ethereum
      </div>
    </footer>
  `
})
export class AppComponent implements OnInit {
  bankCount = 0;
  menuOpen = false;

  constructor(
    public auth: AuthService,
    public employeeAuth: EmployeeAuthService,
    private api: ApiService,
    public role: RoleService
  ) {}

  get isCentralBank(): boolean {
    return this.role.isCentralBank();
  }

  get isEmployee(): boolean {
    return this.role.isEmployee();
  }

  get canAccessApp(): boolean {
    return this.role.canAccessApp();
  }

  get canAccessDashboard(): boolean {
    return this.role.canAccessDashboard();
  }

  get canCreateTransfer(): boolean {
    return this.role.canCreateTransfer();
  }

  ngOnInit(): void {
    this.loadBankCount();
    this.employeeAuth.currentUser$.subscribe(() => this.loadBankCount());
  }

  loadBankCount(): void {
    this.api.getBanks().subscribe({
      next: (res: any) => {
        const arr = Array.isArray(res) ? res : (res && res.data ? res.data : []);
        const banks = Array.isArray(arr) ? arr : [];
        this.bankCount = this.role.filterBanks(banks).length;
      }
    });
  }

  logoutEmployee(): void {
    this.employeeAuth.logout();
    this.loadBankCount();
  }

  logoutCentralBank(): void {
    this.auth.logout();
    this.loadBankCount();
  }
}
