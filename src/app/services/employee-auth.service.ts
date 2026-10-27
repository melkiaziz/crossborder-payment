import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface EmployeeUser {
  id: number;
  email: string;
  full_name: string;
  employee_id: string;
  bank_wallet_address: string;
  bank_name: string;
  country?: string;
  currency?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeAuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private tokenKey = 'employee_auth_token';

  private currentUserSubject = new BehaviorSubject<EmployeeUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
    const token = this.getToken();
    if (!token) return;

    this.getProfile().subscribe({
      next: (res: any) => {
        if (res && res.success && res.user) {
          this.currentUserSubject.next(res.user);
        }
      },
      error: () => {
        this.logout();
      }
    });
  }

  register(data: {
    email: string;
    password: string;
    employeeId: string;
    fullName: string;
    bankWalletAddress: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, {
      email: data.email,
      password: data.password,
      employeeId: data.employeeId,
      fullName: data.fullName,
      bankWalletAddress: data.bankWalletAddress
    });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res: any) => {
        if (res && res.success && res.token) {
          localStorage.setItem(this.tokenKey, res.token);
          if (res.user) {
            this.currentUserSubject.next(res.user);
          } else {
            this.loadStoredUser();
          }
        }
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { token, newPassword });
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): EmployeeUser | null {
    return this.currentUserSubject.value;
  }
}

