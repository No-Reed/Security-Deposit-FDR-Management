import { RenewalStatus, ReleaseStatus, ReleaseRequestStatus } from '@depositdesk/shared';
import { LifecycleStatus } from '@prisma/client';

/**
 * Derive renewalStatus from instrument successor's lifecycle.
 */
export function deriveRenewalStatus(
  matured: boolean,
  successorLifecycleStatus?: LifecycleStatus | null
): RenewalStatus {
  if (!matured) return RenewalStatus.NONE;
  if (!successorLifecycleStatus) return RenewalStatus.REQUIRED;
  if (successorLifecycleStatus === LifecycleStatus.VERIFIED || successorLifecycleStatus === LifecycleStatus.CLOSED) {
    return RenewalStatus.COMPLETED;
  }
  return RenewalStatus.IN_PROGRESS;
}

/**
 * Derive releaseStatus from the instrument's release requests.
 */
export function deriveReleaseStatus(
  requests: { status: ReleaseRequestStatus }[]
): ReleaseStatus {
  if (!requests || requests.length === 0) return ReleaseStatus.NONE;

  const openRequests = requests.filter(
    r =>
      r.status !== ReleaseRequestStatus.REJECTED &&
      r.status !== ReleaseRequestStatus.COMPLETED
  );

  if (openRequests.some(r => r.status === ReleaseRequestStatus.APPROVED)) {
    return ReleaseStatus.APPROVED;
  }
  if (openRequests.length > 0) {
    return ReleaseStatus.OPEN;
  }

  const completedRequests = requests.filter(r => r.status === ReleaseRequestStatus.COMPLETED);
  if (completedRequests.length > 0) {
    return ReleaseStatus.COMPLETED;
  }

  return ReleaseStatus.REJECTED;
}

/**
 * Neutralize CSV formula injection: prefix cells starting with =, +, -, @, tab, or CR with a single quote.
 */
export function sanitizeCsvCell(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Generate a human-readable reference code.
 */
export function generateReferenceCode(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Build a paginated response wrapper.
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): { data: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
