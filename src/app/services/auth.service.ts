import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ethers } from 'ethers';

const SESSION_KEY = 'centralBankPrivateKey';
const FLAG_KEY = 'isCentralBank';
const LOGIN_TIME_KEY = 'centralBankLoginTime';
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 heure

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly OWNER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  private sessionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private router: Router) {
    if (typeof window !== 'undefined') {
      this.startSessionCheck();
    }
  }

  login(privateKey: string): boolean {
    try {
      const wallet = new ethers.Wallet(privateKey);
      if (wallet.address.toLowerCase() === this.OWNER_ADDRESS.toLowerCase()) {
        sessionStorage.setItem(SESSION_KEY, privateKey);
        sessionStorage.setItem(FLAG_KEY, 'true');
        sessionStorage.setItem(LOGIN_TIME_KEY, String(Date.now()));
        this.startSessionCheck();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  isCentralBank(): boolean {
    if (sessionStorage.getItem(FLAG_KEY) !== 'true') return false;
    const loginTime = sessionStorage.getItem(LOGIN_TIME_KEY);
    if (!loginTime) return false;
    if (Date.now() - parseInt(loginTime, 10) > SESSION_DURATION_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(FLAG_KEY);
      sessionStorage.removeItem(LOGIN_TIME_KEY);
      this.stopSessionCheck();
      return false;
    }
    return true;
  }

  getPrivateKey(): string | null {
    return sessionStorage.getItem(SESSION_KEY);
  }

  getSessionRemainingMs(): number {
    const loginTime = sessionStorage.getItem(LOGIN_TIME_KEY);
    if (!loginTime) return 0;
    const elapsed = Date.now() - parseInt(loginTime, 10);
    return Math.max(0, SESSION_DURATION_MS - elapsed);
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(FLAG_KEY);
    sessionStorage.removeItem(LOGIN_TIME_KEY);
    this.stopSessionCheck();
    this.router.navigate(['/login']);
  }

  private startSessionCheck(): void {
    this.stopSessionCheck();
    this.sessionTimer = setInterval(() => {
      if (!this.isCentralBank()) {
        this.stopSessionCheck();
        if (sessionStorage.getItem(FLAG_KEY)) {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(FLAG_KEY);
          sessionStorage.removeItem(LOGIN_TIME_KEY);
        }
        this.router.navigate(['/login']);
      }
    }, 60000); // Vérifier toutes les minutes
  }

  private stopSessionCheck(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }
}
