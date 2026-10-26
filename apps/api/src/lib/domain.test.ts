import { describe, it, expect } from 'vitest';
import { RenewalStatus, ReleaseStatus, ReleaseRequestStatus } from '@depositdesk/shared';
import { LifecycleStatus } from '@prisma/client';
import { deriveRenewalStatus, deriveReleaseStatus, sanitizeCsvCell, generateReferenceCode } from './domain';

describe('Domain logic and security helpers', () => {
  describe('deriveRenewalStatus', () => {
    it('returns NONE if instrument is not matured', () => {
      expect(deriveRenewalStatus(false)).toBe(RenewalStatus.NONE);
    });

    it('returns REQUIRED if matured without successor', () => {
      expect(deriveRenewalStatus(true, null)).toBe(RenewalStatus.REQUIRED);
    });

    it('returns IN_PROGRESS if successor is under review', () => {
      expect(deriveRenewalStatus(true, LifecycleStatus.UNDER_REVIEW)).toBe(RenewalStatus.IN_PROGRESS);
    });

    it('returns COMPLETED if successor is verified', () => {
      expect(deriveRenewalStatus(true, LifecycleStatus.VERIFIED)).toBe(RenewalStatus.COMPLETED);
    });
  });

  describe('deriveReleaseStatus', () => {
    it('returns NONE if no release requests', () => {
      expect(deriveReleaseStatus([])).toBe(ReleaseStatus.NONE);
    });

    it('returns OPEN if a pending request exists', () => {
      expect(deriveReleaseStatus([{ status: ReleaseRequestStatus.SUBMITTED }])).toBe(ReleaseStatus.OPEN);
    });

    it('returns APPROVED if an approved request exists', () => {
      expect(deriveReleaseStatus([{ status: ReleaseRequestStatus.APPROVED }])).toBe(ReleaseStatus.APPROVED);
    });

    it('returns COMPLETED if all are completed', () => {
      expect(deriveReleaseStatus([{ status: ReleaseRequestStatus.COMPLETED }])).toBe(ReleaseStatus.COMPLETED);
    });
  });

  describe('sanitizeCsvCell (OWASP Formula Injection Prevention)', () => {
    it('prepends single quote to dangerous symbols', () => {
      expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
      expect(sanitizeCsvCell('+cmd|')).toBe("'+cmd|");
      expect(sanitizeCsvCell('-5')).toBe("'-5");
      expect(sanitizeCsvCell('@calc')).toBe("'@calc");
    });

    it('leaves standard text unchanged', () => {
      expect(sanitizeCsvCell('State Bank of India')).toBe('State Bank of India');
      expect(sanitizeCsvCell('FDR-2024-001')).toBe('FDR-2024-001');
    });

    it('handles null and undefined', () => {
      expect(sanitizeCsvCell(null)).toBe('');
      expect(sanitizeCsvCell(undefined)).toBe('');
    });
  });

  describe('generateReferenceCode', () => {
    it('generates non-empty string starting with prefix', () => {
      const code = generateReferenceCode('FDR');
      expect(code.startsWith('FDR-')).toBe(true);
      expect(code.length).toBeGreaterThan(6);
    });
  });
});
