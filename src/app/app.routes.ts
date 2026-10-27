import { Routes } from '@angular/router';
import { BanksComponent } from './components/banks/banks.component';
import { TransfersComponent } from './components/transfers/transfers.component';
import { PendingComponent } from './components/pending/pending.component';
import { LoginComponent } from './components/auth/login.component';
import { RegisterComponent } from './components/auth/register.component';
import { ForgotPasswordComponent } from './components/auth/forgot-password.component';
import { ResetPasswordComponent } from './components/auth/reset-password.component';
import { CentralBankLoginComponent } from './components/auth/central-bank-login.component';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';
import { CreateTransferComponent } from './components/transfers/create-transfer.component';
import { RatesComponent } from './components/admin/rates.component';
import { FeesComponent } from './components/admin/fees.component';
import { BlacklistComponent } from './components/admin/blacklist.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { centralBankGuard } from './guards/central-bank.guard';
import { appAccessGuard } from './guards/app-access.guard';
import { transferGuard } from './guards/transfer.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/banks', pathMatch: 'full' },

  // Auth employés
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },

  // Auth Banque Centrale
  { path: 'central-bank-login', component: CentralBankLoginComponent },

  // Routes accessibles : Banque Centrale seule OU employé
  { path: 'dashboard', component: DashboardComponent, canActivate: [centralBankGuard] },
  { path: 'banks', component: BanksComponent, canActivate: [appAccessGuard] },
  { path: 'transfers', component: TransfersComponent, canActivate: [appAccessGuard] },
  { path: 'pending', component: PendingComponent, canActivate: [appAccessGuard] },
  { path: 'create-transfer', component: CreateTransferComponent, canActivate: [transferGuard] },

  // Routes admin (Banque Centrale)
  { path: 'admin/rates', component: RatesComponent, canActivate: [centralBankGuard] },
  { path: 'admin/fees', component: FeesComponent, canActivate: [centralBankGuard] },
  { path: 'admin/blacklist', component: BlacklistComponent, canActivate: [centralBankGuard] }
];
