import { Injectable, Injector } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs';
import { EmployeeAuthService } from '../services/employee-auth.service';

const EMPLOYEE_TOKEN_KEY = 'employee_auth_token';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem(EMPLOYEE_TOKEN_KEY);

    if (token) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          // Lazy resolve to avoid circular DI: HttpClient -> interceptor -> EmployeeAuthService -> HttpClient
          this.injector.get(EmployeeAuthService).logout();
        }
        return throwError(() => error);
      })
    );
  }
}

