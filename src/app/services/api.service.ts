import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  Bank, 
  Transaction, 
  PendingTransfer, 
  Stats, 
  ContractInfo,
  ApiResponse 
} from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 secondes

  constructor(private http: HttpClient) {}

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  // ============================================
  // 📊 INFO & STATS
  // ============================================

  getContractInfo(forceRefresh = false): Observable<ApiResponse<ContractInfo>> {
    const cached = !forceRefresh && this.getCached<ApiResponse<ContractInfo>>('info');
    if (cached) {
      return of(cached);
    }
    return this.http
      .get<ApiResponse<ContractInfo>>(`${this.apiUrl}/info`)
      .pipe(tap((data) => this.setCache('info', data)));
  }

  getStats(): Observable<ApiResponse<Stats>> {
    return this.http.get<ApiResponse<Stats>>(`${this.apiUrl}/db/stats`);
  }

  // ============================================
  // 📊 DASHBOARD
  // ============================================

  getDashboardKpis(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/kpis`);
  }

  getDashboardTransactionsEvolution(days = 7): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/transactions-evolution`, {
      params: { days: String(days) }
    });
  }

  getDashboardCurrencyDistribution(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/currency-distribution`);
  }

  getDashboardCountryDistribution(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/country-distribution`);
  }

  getDashboardTopBanks(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/top-banks`);
  }

  getDashboardRecentActivity(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/recent-activity`);
  }

  // ============================================
  // 🏦 BANKS
  // ============================================

  getBanks(forceRefresh = false): Observable<ApiResponse<Bank[]> | Bank[]> {
    const cached = !forceRefresh && this.getCached<ApiResponse<Bank[]> | Bank[]>('banks');
    if (cached) {
      return of(cached);
    }
    return this.http
      .get<ApiResponse<Bank[]> | Bank[]>(`${this.apiUrl}/db/banks`)
      .pipe(tap((data) => this.setCache('banks', data)));
  }

  getBank(address: string): Observable<ApiResponse<Bank>> {
    return this.http.get<ApiResponse<Bank>>(`${this.apiUrl}/banks/${address}`);
  }

  registerBank(bank: {
    address: string;
    name: string;
    country: string;
    currency: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/banks/register`, bank);
  }

  addBalance(address: string, amount: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/banks/${address}/balance`, { amount });
  }

  getBalance(address: string): Observable<ApiResponse<{ bankAddress: string; balance: string }>> {
    return this.http.get<ApiResponse<{ bankAddress: string; balance: string }>>(`${this.apiUrl}/banks/${address}/balance`);
  }

  // ============================================
  // 💸 TRANSFERS
  // ============================================

  createTransfer(transfer: {
    fromBankPrivateKey: string;
    toAddress: string;
    amount: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/transfers`, transfer);
  }

  getTransactions(limit = 50, offset = 0, forceRefresh = false): Observable<ApiResponse<Transaction[]> | Transaction[]> {
    const cacheKey = `transactions_${limit}_${offset}`;
    const cached = !forceRefresh && this.getCached<ApiResponse<Transaction[]> | Transaction[]>(cacheKey);
    if (cached) {
      return of(cached);
    }
    return this.http
      .get<ApiResponse<Transaction[]> | Transaction[]>(`${this.apiUrl}/db/transactions?limit=${limit}&offset=${offset}`)
      .pipe(tap((data) => this.setCache(cacheKey, data)));
  }

  getTransactionHistory(limit = 10, offset = 0): Observable<any> {
    return this.http.get(`${this.apiUrl}/transfers/history?limit=${limit}&offset=${offset}`);
  }

  // ============================================
  // ⏳ PENDING TRANSFERS
  // ============================================

  getPendingTransfers(forceRefresh = false): Observable<ApiResponse<PendingTransfer[]> | PendingTransfer[]> {
    const cached = !forceRefresh && this.getCached<ApiResponse<PendingTransfer[]> | PendingTransfer[]>('pending');
    if (cached) {
      return of(cached);
    }
    return this.http
      .get<ApiResponse<PendingTransfer[]> | PendingTransfer[]>(`${this.apiUrl}/db/pending`)
      .pipe(tap((data) => this.setCache('pending', data)));
  }

  getPendingFromBlockchain(): Observable<any> {
    return this.http.get(`${this.apiUrl}/transfers/pending`);
  }

  approveTransfer(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/transfers/approve/${id}`, {});
  }

  // ============================================
  // 💱 RATES & FEES
  // ============================================

  getRates(forceRefresh = false): Observable<ApiResponse<{ eurToTnd: string; usdToTnd: string }>> {
    const cached = !forceRefresh && this.getCached<ApiResponse<{ eurToTnd: string; usdToTnd: string }>>('rates');
    if (cached) {
      return of(cached);
    }
    return this.http
      .get<ApiResponse<{ eurToTnd: string; usdToTnd: string }>>(`${this.apiUrl}/rates`)
      .pipe(tap((data) => this.setCache('rates', data)));
  }

  updateEurRate(rate: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/rates/eur`, { rate }).pipe(
      tap(() => {
        this.invalidateCache('info');
        this.invalidateCache('rates');
      })
    );
  }

  updateUsdRate(rate: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/rates/usd`, { rate }).pipe(
      tap(() => {
        this.invalidateCache('info');
        this.invalidateCache('rates');
      })
    );
  }

  getFees(forceRefresh = false): Observable<ApiResponse<{ transferFeePercent: number }>> {
    const cached = !forceRefresh && this.getCached<ApiResponse<{ transferFeePercent: number }>>('fees');
    if (cached) {
      return of(cached);
    }
    return this.http
      .get<ApiResponse<{ transferFeePercent: number }>>(`${this.apiUrl}/fees`)
      .pipe(tap((data) => this.setCache('fees', data)));
  }

  updateFees(fee: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/fees`, { fee }).pipe(
      tap(() => {
        this.invalidateCache('info');
        this.invalidateCache('fees');
      })
    );
  }

  getRateHistory(currency: 'EUR' | 'USD' | '' = '', limit = 100): Observable<any> {
    const qs = [];
    if (currency) qs.push(`currency=${encodeURIComponent(currency)}`);
    qs.push(`limit=${limit}`);
    return this.http.get(`${this.apiUrl}/rates/history?${qs.join('&')}`);
  }

  createRateAlert(currency: 'EUR' | 'USD', threshold: number, direction: 'above' | 'below', email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/rates/alerts`, { currency, threshold, direction, email });
  }

  getRateAlerts(): Observable<any> {
    return this.http.get(`${this.apiUrl}/rates/alerts`);
  }

  // ============================================
  // 🚫 BLACKLIST
  // ============================================

  addToBlacklist(address: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/blacklist/${address}`, {});
  }

  removeFromBlacklist(address: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/blacklist/${address}`);
  }

  checkBlacklist(address: string): Observable<ApiResponse<{ address: string; isBlacklisted: boolean }>> {
    return this.http.get<ApiResponse<{ address: string; isBlacklisted: boolean }>>(`${this.apiUrl}/blacklist/${address}`);
  }

  // ============================================
  // 🗄️ DATABASE
  // ============================================

  resetDatabase(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/db/reset`);
  }
}
