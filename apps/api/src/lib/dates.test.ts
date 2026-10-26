import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DateStatus } from '@depositdesk/shared';
import { deriveDateStatus, daysUntil, addDays, todayInTz } from './dates';

describe('Date status calculation (Asia/Kolkata)', () => {
  const alertThreshold = 90;
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T20:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('marks an instrument with maturity > 90 days in future as ACTIVE', () => {
    const futureDate = addDays(todayInTz(), 120);
    const result = deriveDateStatus(futureDate, null, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.ACTIVE);
    expect(result.daysRemaining).toBeGreaterThan(90);
  });

  it('marks an instrument with maturity in 30 days as EXPIRING_SOON', () => {
    const futureDate = addDays(todayInTz(), 30);
    const result = deriveDateStatus(futureDate, null, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.EXPIRING_SOON);
    expect(result.daysRemaining).toBeLessThanOrEqual(90);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it('marks an instrument past maturity date as MATURED', () => {
    const pastDate = addDays(todayInTz(), -10);
    const result = deriveDateStatus(pastDate, null, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.MATURED);
    expect(result.daysRemaining).toBeLessThanOrEqual(0);
  });

  it('marks an instrument with validityEndDate past today as EXPIRED', () => {
    const pastMaturity = addDays(todayInTz(), -20);
    const pastValidity = addDays(todayInTz(), -5);
    const result = deriveDateStatus(pastMaturity, pastValidity, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.EXPIRED);
  });

  it('uses IST calendar boundaries rather than the host timezone', () => {
    vi.setSystemTime(new Date('2026-10-26T18:29:59Z'));
    const maturity = new Date('2026-10-27T00:00:00Z');
    expect(deriveDateStatus(maturity, null, 90).dateStatus).toBe(DateStatus.EXPIRING_SOON);
    expect(daysUntil(maturity)).toBe(1);
    vi.setSystemTime(new Date('2026-10-26T18:30:00Z'));
    expect(deriveDateStatus(maturity, null, 90).dateStatus).toBe(DateStatus.MATURED);
    expect(daysUntil(maturity)).toBe(0);
    expect(deriveDateStatus(new Date('2026-12-01'), maturity, 90).dateStatus).toBe(DateStatus.EXPIRING_SOON);
    vi.setSystemTime(new Date('2026-10-27T18:30:00Z'));
    expect(deriveDateStatus(new Date('2026-12-01'), maturity, 90).dateStatus).toBe(DateStatus.EXPIRED);
  });

  it('correctly calculates days remaining', () => {
    const in15Days = addDays(todayInTz(), 15);
    const diff = daysUntil(in15Days);
    expect(diff).toBe(15);
  });
});
