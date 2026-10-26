import { z } from 'zod';
import {
  Role,
  InstrumentType,
  DocumentCategory,
  DiscrepancySeverity,
  IndependentVerificationStatus,
  DocumentReviewStatus,
  ReleaseRequestStatus,
  LifecycleStatus,
  DateStatus,
} from './types';

// ─── Auth ────────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
});

// ─── Institution ─────────────────────────────────────────────────────────────
export const CreateInstitutionSchema = z.object({
  aicteId: z.string().optional().nullable(),
  name: z.string().min(2).max(255),
  institutionType: z.string().min(1).max(100),
  address: z.string().min(5).max(500),
  state: z.string().min(2).max(100),
  contactName: z.string().min(2).max(255),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable(),
});

export const UpdateInstitutionSchema = CreateInstitutionSchema.partial().extend(
  {
    isActive: z.boolean().optional(),
  },
);

export const BusinessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00Z');
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Enter a valid calendar date');

// ─── Instrument ──────────────────────────────────────────────────────────────
export const CreateInstrumentBaseSchema = z.object({
  institutionId: z.string().cuid(),
  instrumentType: z.nativeEnum(InstrumentType),
  instrumentNumber: z.string().trim().min(1).max(255),
  bankName: z.string().trim().min(1).max(255),
  bankBranch: z.string().trim().min(1).max(255),
  amount: z
    .string()
    .max(16)
    .regex(/^\d{1,13}(\.\d{1,2})?$/, 'Amount must be a positive decimal'),
  currency: z.literal('INR').default('INR'),
  issueDate: BusinessDateSchema,
  maturityDate: BusinessDateSchema,
  validityEndDate: BusinessDateSchema.optional().nullable(),
  purpose: z.string().trim().min(1).max(500),
  beneficiaryDetails: z.string().max(500).optional().nullable(),
});

export const CreateInstrumentSchema = CreateInstrumentBaseSchema.refine(
  (data) => new Date(data.issueDate) <= new Date(data.maturityDate),
  { message: 'Issue date cannot be after maturity date', path: ['issueDate'] },
).refine((data) => parseFloat(data.amount) > 0, {
  message: 'Amount must be positive',
  path: ['amount'],
});

export const UpdateInstrumentSchema = CreateInstrumentBaseSchema.partial()
  .omit({ institutionId: true })
  .extend({ version: z.number().int().positive() })
  .strict();

// ─── Document ─────────────────────────────────────────────────────────────────
export const DocumentUploadMetaSchema = z.object({
  instrumentId: z.string().cuid().optional(),
  releaseRequestId: z.string().cuid().optional(),
  category: z.nativeEnum(DocumentCategory),
});

// ─── Verification ─────────────────────────────────────────────────────────────
export const RecordVerificationSchema = z
  .object({
    version: z.number().int().positive(),
    documentReviewStatus: z.nativeEnum(DocumentReviewStatus),
    independentVerificationStatus: z.nativeEnum(IndependentVerificationStatus),
    sourceType: z.string().optional().nullable(),
    sourceName: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    result: z.string().trim().min(1),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.independentVerificationStatus ===
        IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE
      ) {
        return data.sourceName && data.referenceNumber;
      }
      return true;
    },
    {
      message:
        'Source name and reference number are required for CONFIRMED_BY_AUTHORIZED_SOURCE',
      path: ['sourceName'],
    },
  );

// ─── Discrepancy ──────────────────────────────────────────────────────────────
export const CreateDiscrepancySchema = z.object({
  version: z.number().int().positive(),
  instrumentId: z.string().cuid(),
  releaseRequestId: z.string().cuid().optional(),
  code: z.string().min(1).max(100),
  severity: z.nativeEnum(DiscrepancySeverity),
  description: z.string().min(1).max(1000),
  reason: z.string().trim().min(1).max(1000),
});

export const ResolveDiscrepancySchema = z.object({
  version: z.number().int().positive(),
  resolutionNotes: z.string().trim().min(1).max(1000),
  status: z.enum(['RESPONDED', 'RESOLVED', 'DISMISSED']),
});

// ─── Release Request ─────────────────────────────────────────────────────────
export const CreateReleaseRequestSchema = z.object({
  instrumentId: z.string().cuid(),
  requestType: z.string().min(1).max(100),
  reason: z.string().trim().min(1).max(2000),
});

export const ReleaseDecisionSchema = z.object({
  decisionReason: z.string().min(1).max(2000),
  notes: z.string().optional().nullable(),
  version: z.number().int().positive(),
});

export const ReleaseCompletionSchema = z.object({
  completionReference: z.string().min(1).max(500),
  completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().nullable(),
  version: z.number().int().positive(),
});

// ─── User Management ─────────────────────────────────────────────────────────
export const CreateUserSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  institutionId: z.string().cuid().optional().nullable(),
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ─── Instrument Transition ───────────────────────────────────────────────────
export const InstrumentTransitionSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Pagination ───────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Instrument Filters ───────────────────────────────────────────────────────
export const InstrumentFiltersSchema = PaginationSchema.extend({
  search: z.string().optional(),
  institutionId: z.string().cuid().optional(),
  lifecycleStatus: z.nativeEnum(LifecycleStatus).optional(),
  queue: z.enum(['true', 'false']).optional(),
  instrumentType: z.nativeEnum(InstrumentType).optional(),
  bankName: z.string().optional(),
  dateStatus: z.nativeEnum(DateStatus).optional(),
  issueDateFrom: BusinessDateSchema.optional(),
  issueDateTo: BusinessDateSchema.optional(),
  maturityDateFrom: BusinessDateSchema.optional(),
  maturityDateTo: BusinessDateSchema.optional(),
  sortBy: z
    .enum([
      'createdAt',
      'maturityDate',
      'issueDate',
      'amount',
      'instrumentNumber',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ─── Renewal ──────────────────────────────────────────────────────────────────
export const CreateRenewalSchema = CreateInstrumentBaseSchema.extend({
  predecessorInstrumentId: z.string().cuid(),
})
  .refine((data) => new Date(data.issueDate) <= new Date(data.maturityDate), {
    message: 'Issue date cannot be after maturity date',
    path: ['issueDate'],
  })
  .refine((data) => parseFloat(data.amount) > 0, {
    message: 'Amount must be positive',
    path: ['amount'],
  });

// ─── System Settings ─────────────────────────────────────────────────────────
export const UpdateSystemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(0),
});

// ─── Checklist Item ───────────────────────────────────────────────────────────
export const ChecklistItemSchema = z.object({
  label: z.string().min(1).max(500),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

// ─── Instrument Submit Transition ─────────────────────────────────────────────
export const SubmitTransitionSchema = z.object({
  version: z.number().int().positive(),
});

export const ReviewTransitionSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(2000),
  notes: z.string().optional().nullable(),
});

export const RejectTransitionSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().min(1, 'Rejection reason is required').max(2000),
});

export const ResubmitTransitionSchema = z.object({
  version: z.number().int().positive(),
  corrections: z.string().trim().min(1).max(2000),
});

export const CloseTransitionSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().min(1, 'Closure reason is required').max(2000),
});

// Release request transitions
export const ReleaseReviewSchema = z.object({
  notes: z.string().optional().nullable(),
  version: z.number().int().positive(),
});

export const ReleaseReturnSchema = z.object({
  reason: z.string().min(1, 'Return reason is required').max(2000),
  observations: z.string().optional().nullable(),
  version: z.number().int().positive(),
});

export const ReleaseForwardSchema = z.object({
  notes: z.string().optional().nullable(),
  version: z.number().int().positive(),
});

export const ReleaseResubmitSchema = z.object({
  information: z.string().min(1).max(2000),
  version: z.number().int().positive(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateInstitutionInput = z.infer<typeof CreateInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof UpdateInstitutionSchema>;
export type CreateInstrumentInput = z.infer<typeof CreateInstrumentSchema>;
export type UpdateInstrumentInput = z.infer<typeof UpdateInstrumentSchema>;
export type RecordVerificationInput = z.infer<typeof RecordVerificationSchema>;
export type CreateDiscrepancyInput = z.infer<typeof CreateDiscrepancySchema>;
export type ResolveDiscrepancyInput = z.infer<typeof ResolveDiscrepancySchema>;
export type CreateReleaseRequestInput = z.infer<
  typeof CreateReleaseRequestSchema
>;
export type ReleaseDecisionInput = z.infer<typeof ReleaseDecisionSchema>;
export type ReleaseCompletionInput = z.infer<typeof ReleaseCompletionSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type InstrumentFiltersInput = z.infer<typeof InstrumentFiltersSchema>;
export type CreateRenewalInput = z.infer<typeof CreateRenewalSchema>;
