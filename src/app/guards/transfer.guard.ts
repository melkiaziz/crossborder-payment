import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleService } from '../services/role.service';

export const transferGuard = () => {
  const role = inject(RoleService);
  const router = inject(Router);
  if (role.canCreateTransfer()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};
