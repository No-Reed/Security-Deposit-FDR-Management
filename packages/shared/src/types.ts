// Shared enums and types for DepositDesk
// These are used on both frontend and backend via shared Zod schemas

export enum Role {
  INSTITUTION_USER = 'INSTITUTION_USER',
  SCRUTINY_OFFICER = 'SCRUTINY_OFFICER',
  APPROVING_AUTHORITY = 'APPROVING_AUTHORITY',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export enum LifecycleStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  RESUBMITTED = 'RESUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export enum IndependentVerificationStatus {
  NOT_CHECKED = 'NOT_CHECKED',
  PENDING = 'PENDING',
  CONFIRMED_BY_AUTHORIZED_SOURCE = 'CONFIRMED_BY_AUTHORIZED_SOURCE',
  DISCREPANCY_FOUND = 'DISCREPANCY_FOUND',
  UNAVAILABLE = 'UNAVAILABLE',
  DEMO_SIMULATED = 'DEMO_SIMULATED',
}

export enum DocumentReviewStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETE = 'COMPLETE',
  REQUIRES_RESUBMISSION = 'REQUIRES_RESUBMISSION',
}

export enum DateStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING_SOON = 'EXPIRING_SOON',
  MATURED = 'MATURED',
  EXPIRED = 'EXPIRED',
}

export enum RenewalStatus {
  NONE = 'NONE',
  REQUIRED = 'REQUIRED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum ReleaseStatus {
  NONE = 'NONE',
  OPEN = 'OPEN',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum ReleaseRequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RETURNED_FOR_INFORMATION = 'RETURNED_FOR_INFORMATION',
  RESUBMITTED = 'RESUBMITTED',
  PENDING_AUTHORITY_DECISION = 'PENDING_AUTHORITY_DECISION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum DiscrepancySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum DiscrepancyStatus {
  OPEN = 'OPEN',
  RESPONDED = 'RESPONDED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum DocumentCategory {
  FDR_COPY = 'FDR_COPY',
  DEPOSIT_CONFIRMATION = 'DEPOSIT_CONFIRMATION',
  BANK_COMMUNICATION = 'BANK_COMMUNICATION',
  RENEWAL_DOCUMENT = 'RENEWAL_DOCUMENT',
  INSTITUTION_AUTHORIZATION = 'INSTITUTION_AUTHORIZATION',
  RELEASE_SUPPORTING = 'RELEASE_SUPPORTING',
  OTHER = 'OTHER',
}

export enum InstrumentType {
  FDR = 'FDR',
  SECURITY_DEPOSIT = 'SECURITY_DEPOSIT',
  OTHER = 'OTHER',
}

export enum NotificationDeliveryChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

// Derived status computation types
export interface DerivedStatuses {
  dateStatus: DateStatus;
  renewalStatus: RenewalStatus;
  releaseStatus: ReleaseStatus;
  daysRemaining: number | null;
}
