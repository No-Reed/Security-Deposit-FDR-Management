import { DateStatus } from '@depositdesk/shared';
import { config } from '../config/env';

/**
 * Get today's date in the configured timezone as a plain Date (midnight UTC of that calendar day).
 * This ensures consistent comparison with DATE columns from PostgreSQL.
 */
export function todayInTz(timezone = config.APP_TIMEZONE): Date {
  const now = new Date();
  // Get today's date string in the target timezone
  const localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // 'en-CA' gives YYYY-MM-DD
  return new Date(localDateStr + 'T00:00:00.000Z');
}

/**
 * Calculate days remaining until effectiveEnd from today in the configured timezone.
 * Negative means already matured/expired.
 */
export function daysUntil(date: Date, timezone = config.APP_TIMEZONE): number {
  const today = todayInTz(timezone);
  const target = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

/**
 * Derive dateStatus for an instrument.
 * Precedence: EXPIRED > MATURED > EXPIRING_SOON > ACTIVE
 * 
 * - MATURED: maturityDate <= today
 * - EXPIRED: validityEndDate exists and validityEndDate < today
 * - EXPIRING_SOON: effectiveEnd - today <= alertDays
 * - ACTIVE: everything else
 */
export function deriveDateStatus(
  maturityDate: Date,
  validityEndDate: Date | null,
  alertDays: number,
  timezone = config.APP_TIMEZONE
): { dateStatus: DateStatus; daysRemaining: number | null; effectiveEnd: Date } {
  const today = todayInTz(timezone);
  const maturity = new Date(maturityDate.toISOString().split('T')[0] + 'T00:00:00.000Z');
  const validity = validityEndDate
    ? new Date(validityEndDate.toISOString().split('T')[0] + 'T00:00:00.000Z')
    : null;

  const effectiveEnd = validity ?? maturity;
  const daysRemaining = daysUntil(effectiveEnd, timezone);

  // EXPIRED: validityEndDate exists and < today
  if (validity && validity < today) {
    return { dateStatus: DateStatus.EXPIRED, daysRemaining, effectiveEnd };
  }

  // MATURED: maturityDate <= today
  if (maturity <= today) {
    return { dateStatus: DateStatus.MATURED, daysRemaining, effectiveEnd };
  }

  // EXPIRING_SOON: within alert window
  if (daysRemaining <= alertDays) {
    return { dateStatus: DateStatus.EXPIRING_SOON, daysRemaining, effectiveEnd };
  }

  return { dateStatus: DateStatus.ACTIVE, daysRemaining, effectiveEnd };
}

/**
 * Format a UTC timestamp for display in Asia/Kolkata.
 */
export function formatISTDate(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Add days to a date (returns new Date).
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtract days from today.
 */
export function daysAgo(days: number): Date {
  return addDays(new Date(), -days);
}

/**
 * Today + N days.
 */
export function daysFromNow(days: number): Date {
  return addDays(new Date(), days);
}

/**
 * Format a Date as YYYY-MM-DD (UTC).
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}
