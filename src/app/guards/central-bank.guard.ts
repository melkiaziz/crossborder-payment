import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const centralBankGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isCentralBank()) {
    return true;
  }
  router.navigate(['/central-bank-login']);
  return false;
};
