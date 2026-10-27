import { deriveDateStatus } from './dates';
import { deriveRenewalStatus, deriveReleaseStatus } from './domain';
import { config, MATURITY_ALERT_DAYS } from '../config/env';

export function documentView(document: any) {
  return {
    id: document.id,
    category: document.category,
    originalFilename: document.originalFilename,
    fileSizeBytes: document.sizeBytes,
    mimeType: document.mimeType,
    sha256Hash: document.sha256,
    createdAt: document.uploadedAt,
    uploader: document.uploadedBy,
    version: document.version,
    isSuperseded: document.isSuperseded,
    malwareScan: 'NOT_SCANNED',
  };
}

export function instrumentView(instrument: any, runtime = { alertDays: MATURITY_ALERT_DAYS[0] || 90, timezone: config.APP_TIMEZONE }) {
  const date = deriveDateStatus(
    instrument.maturityDate,
    instrument.validityEndDate,
    runtime.alertDays,
    runtime.timezone,
  );
  const latest = instrument.verifications?.find(
    (record: any) =>
      !instrument.submittedAt || record.createdAt >= instrument.submittedAt,
  );
  const { verifications, documents, discrepancies, snapshots, ...fields } =
    instrument;
  return {
    ...fields,
    amount: instrument.amount.toString(),
    issueDate: instrument.issueDate.toISOString().slice(0, 10),
    maturityDate: instrument.maturityDate.toISOString().slice(0, 10),
    validityEndDate:
      instrument.validityEndDate?.toISOString().slice(0, 10) ?? null,
    institutionName: instrument.institution?.name,
    aicteId: instrument.institution?.aicteId,
    dateStatus: date.dateStatus,
    daysRemaining: date.daysRemaining,
    renewalStatus: deriveRenewalStatus(
      ['MATURED', 'EXPIRED'].includes(date.dateStatus),
      instrument.successor?.lifecycleStatus,
    ),
    releaseStatus: deriveReleaseStatus(instrument.releaseRequests || []),
    independentVerificationStatus:
      latest?.independentVerificationStatus ?? 'NOT_CHECKED',
    documentReviewStatus: latest?.documentReviewStatus ?? 'NOT_STARTED',
    documentsCount: instrument._count?.documents ?? documents?.length ?? 0,
    openDiscrepanciesCount: instrument._count?.discrepancies ?? 0,
    documents: documents?.map(documentView),
    discrepancies: discrepancies?.map((item: any) => ({
      ...item,
      createdAt: item.detectedAt,
      creator: item.assignedTo,
      resolver: item.resolvedBy,
    })),
    verificationRecords: verifications?.map((item: any) => ({
      ...item,
      verifier: item.verifiedBy,
    })),
    snapshots,
    predecessorInstrument: instrument.predecessor,
    successorInstrument: instrument.successor,
  };
}

// Keep every submitted business value and its exact evidence references.
export function submissionSnapshot(instrument: any, corrections?: string) {
  return {
    referenceCode: instrument.referenceCode,
    institutionId: instrument.institutionId,
    instrumentType: instrument.instrumentType,
    instrumentNumber: instrument.instrumentNumber,
    bankName: instrument.bankName,
    bankBranch: instrument.bankBranch,
    amount: instrument.amount.toString(),
    currency: instrument.currency,
    issueDate: instrument.issueDate.toISOString().slice(0, 10),
    maturityDate: instrument.maturityDate.toISOString().slice(0, 10),
    validityEndDate:
      instrument.validityEndDate?.toISOString().slice(0, 10) ?? null,
    purpose: instrument.purpose,
    beneficiaryDetails: instrument.beneficiaryDetails,
    documents: instrument.documents.map((doc: any) => ({
      id: doc.id,
      category: doc.category,
      sha256: doc.sha256,
      version: doc.version,
    })),
    corrections: corrections ?? null,
  };
}
