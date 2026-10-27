import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { EmployeeAuthService } from '../services/employee-auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private employeeAuth: EmployeeAuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.employeeAuth.isAuthenticated()) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}

