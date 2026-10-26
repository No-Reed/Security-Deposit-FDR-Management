import { describe, it, expect } from 'vitest';
import { DateStatus } from '@depositdesk/shared';
import { deriveDateStatus, daysUntil, addDays } from './dates';

describe('Date status calculation (Asia/Kolkata)', () => {
  const alertThreshold = 90;

  it('marks an instrument with maturity > 90 days in future as ACTIVE', () => {
    const futureDate = addDays(new Date(), 120);
    const result = deriveDateStatus(futureDate, null, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.ACTIVE);
    expect(result.daysRemaining).toBeGreaterThan(90);
  });

  it('marks an instrument with maturity in 30 days as EXPIRING_SOON', () => {
    const futureDate = addDays(new Date(), 30);
    const result = deriveDateStatus(futureDate, null, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.EXPIRING_SOON);
    expect(result.daysRemaining).toBeLessThanOrEqual(90);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it('marks an instrument past maturity date as MATURED', () => {
    const pastDate = addDays(new Date(), -10);
    const result = deriveDateStatus(pastDate, null, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.MATURED);
    expect(result.daysRemaining).toBeLessThanOrEqual(0);
  });

  it('marks an instrument with validityEndDate past today as EXPIRED', () => {
    const pastMaturity = addDays(new Date(), -20);
    const pastValidity = addDays(new Date(), -5);
    const result = deriveDateStatus(pastMaturity, pastValidity, alertThreshold);
    expect(result.dateStatus).toBe(DateStatus.EXPIRED);
  });

  it('correctly calculates days remaining', () => {
    const in15Days = addDays(new Date(), 15);
    const diff = daysUntil(in15Days);
    expect(diff).toBeCloseTo(15, 1);
  });
});
