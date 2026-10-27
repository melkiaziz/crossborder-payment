import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleService } from '../services/role.service';

export const appAccessGuard = () => {
  const role = inject(RoleService);
  const router = inject(Router);
  if (role.canAccessApp()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};
