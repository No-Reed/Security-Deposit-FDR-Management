import { Router, Request, Response, NextFunction } from 'express';
import {
  Role,
  UpdateInstrumentSchema,
  LifecycleStatus,
  InstrumentFiltersSchema,
  CreateInstrumentSchema,
  SubmitTransitionSchema,
  ReviewTransitionSchema,
  RejectTransitionSchema,
  ResubmitTransitionSchema,
  CloseTransitionSchema,
  CreateRenewalSchema,
} from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import {
  requireAuth,
  requireRole,
  AuthenticatedRequest,
  requireInstitutionAccess,
} from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { deriveDateStatus } from '../../lib/dates';
import {
  deriveRenewalStatus,
  deriveReleaseStatus,
  generateReferenceCode,
  paginate,
} from '../../lib/domain';
import { config, MATURITY_ALERT_DAYS } from '../../config/env';
import { LifecycleStatus as PrismaLifecycle } from '@prisma/client';

import { instrumentView, submissionSnapshot } from '../../lib/instruments';

export const instrumentsRouter = Router();
instrumentsRouter.use(requireAuth as any);

// Build where clause based on role/scope
async function buildInstrumentWhere(
  authReq: AuthenticatedRequest,
  filters: any,
) {
  const { role, institutionId } = authReq.user;
  const where: any = {};

  if (role === Role.INSTITUTION_USER) {
    if (!institutionId) return null;
    where.institutionId = institutionId;
  } else if (
    role === Role.SCRUTINY_OFFICER ||
    role === Role.APPROVING_AUTHORITY
  ) {
    const scopes = await prisma.staffInstitutionScope.findMany({
      where: { userId: authReq.user.id },
      select: { institutionId: true },
    });
    where.institutionId = { in: scopes.map((s) => s.institutionId) };
  }
  // SA: no institution filter

  // Apply filters
  if (filters.institutionId) {
    // Narrow the authorized scope; never replace it with client input.
    where.AND = [{ institutionId: filters.institutionId }];
  }
  if (filters.queue === 'true')
    where.lifecycleStatus = {
      in: ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESUBMITTED'],
    };
  if (filters.lifecycleStatus) {
    if (
      filters.queue === 'true' &&
      !['SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESUBMITTED'].includes(
        filters.lifecycleStatus,
      )
    )
      where.AND = [...(where.AND || []), { id: { in: [] } }];
    where.lifecycleStatus = filters.lifecycleStatus;
  }
  if (filters.instrumentType) where.instrumentType = filters.instrumentType;
  if (filters.bankName)
    where.bankName = { contains: filters.bankName, mode: 'insensitive' };
  if (filters.search) {
    where.OR = [
      { referenceCode: { contains: filters.search, mode: 'insensitive' } },
      { instrumentNumber: { contains: filters.search, mode: 'insensitive' } },
      { bankName: { contains: filters.search, mode: 'insensitive' } },
      {
        institution: {
          name: { contains: filters.search, mode: 'insensitive' },
        },
      },
    ];
  }
  if (filters.issueDateFrom)
    where.issueDate = {
      ...(where.issueDate || {}),
      gte: new Date(filters.issueDateFrom),
    };
  if (filters.issueDateTo)
    where.issueDate = {
      ...(where.issueDate || {}),
      lte: new Date(filters.issueDateTo),
    };
  if (filters.maturityDateFrom)
    where.maturityDate = {
      ...(where.maturityDate || {}),
      gte: new Date(filters.maturityDateFrom),
    };
  if (filters.maturityDateTo)
    where.maturityDate = {
      ...(where.maturityDate || {}),
      lte: new Date(filters.maturityDateTo),
    };

  return where;
}

const attachDerivedStatus = instrumentView;

// GET /instruments
instrumentsRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const filters = InstrumentFiltersSchema.parse(req.query);
      const { page, pageSize } = filters;
      const skip = (page - 1) * pageSize;

      const where = await buildInstrumentWhere(authReq, filters);
      if (where === null) return res.json(paginate([], 0, page, pageSize));

      const instruments = await prisma.instrument.findMany({
        where,
        orderBy: [
          filters.sortBy ? { [filters.sortBy]: filters.sortOrder || 'desc' } : { createdAt: 'desc' },
          { id: 'asc' },
        ],
        include: {
          institution: { select: { id: true, name: true, aicteId: true } },
          successor: { select: { id: true, lifecycleStatus: true } },
          releaseRequests: { select: { status: true } },
          verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: {
            select: {
              documents: true,
              discrepancies: {
                where: { status: { in: ['OPEN', 'RESPONDED'] } },
              },
              verifications: true,
            },
          },
        },
      });

      const withDerived = instruments.map(attachDerivedStatus);

      // Filter by dateStatus if requested (post-process since it's derived)
      const filtered = filters.dateStatus
        ? withDerived.filter((i) => i.dateStatus === filters.dateStatus)
        : withDerived;

      res.json(
        paginate(
          filtered.slice(skip, skip + pageSize),
          filtered.length,
          page,
          pageSize,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments
instrumentsRouter.post(
  '/',
  requireRole(Role.INSTITUTION_USER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = CreateInstrumentSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      // IU can only create for own institution
      if (authReq.user.institutionId !== body.data.institutionId) {
        return next(
          createError(
            403,
            'FORBIDDEN',
            'Cannot create instrument for another institution',
          ),
        );
      }

      // Check for likely duplicate
      const duplicate = await prisma.instrument.findFirst({
        where: {
          bankName: body.data.bankName,
          instrumentNumber: body.data.instrumentNumber,
        },
      });
      if (duplicate) {
        return next(
          createError(
            409,
            'DUPLICATE_DETECTED',
            'An instrument with this bank + instrument number already exists',
            {},
          ),
        );
      }

      const instrument = await prisma.$transaction(async (tx) => {
        const created = await tx.instrument.create({
          data: {
            referenceCode: generateReferenceCode('DD'),
            institutionId: body.data.institutionId,
            instrumentType: body.data.instrumentType as any,
            instrumentNumber: body.data.instrumentNumber,
            bankName: body.data.bankName,
            bankBranch: body.data.bankBranch,
            amount: body.data.amount,
            currency: body.data.currency || 'INR',
            issueDate: new Date(body.data.issueDate),
            maturityDate: new Date(body.data.maturityDate),
            validityEndDate: body.data.validityEndDate
              ? new Date(body.data.validityEndDate)
              : null,
            purpose: body.data.purpose,
            beneficiaryDetails: body.data.beneficiaryDetails,
            lifecycleStatus: PrismaLifecycle.DRAFT,
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_CREATED',
          entityType: 'Instrument',
          entityId: created.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            referenceCode: created.referenceCode,
            lifecycleStatus: 'DRAFT',
          },
        });
        return created;
      });

      res.status(201).json(instrument);
    } catch (err) {
      next(err);
    }
  },
);

// GET /instruments/:id
instrumentsRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const instrument = await prisma.instrument.findUnique({
        where: { id: req.params.id },
        include: {
          institution: {
            select: {
              id: true,
              name: true,
              aicteId: true,
              state: true,
              contactEmail: true,
            },
          },
          submittedBy: { select: { id: true, name: true, email: true } },
          successor: {
            select: {
              id: true,
              referenceCode: true,
              lifecycleStatus: true,
              bankName: true,
              instrumentNumber: true,
              maturityDate: true,
            },
          },
          predecessor: {
            select: {
              id: true,
              referenceCode: true,
              lifecycleStatus: true,
              bankName: true,
              instrumentNumber: true,
              maturityDate: true,
            },
          },
          releaseRequests: {
            select: {
              id: true,
              referenceCode: true,
              status: true,
              requestType: true,
              submittedAt: true,
            },
          },
          verifications: {
            orderBy: { createdAt: 'desc' },
            include: {
              verifiedBy: { select: { id: true, name: true, role: true } },
            },
          },
          discrepancies: {
            orderBy: { detectedAt: 'desc' },
            include: {
              assignedTo: { select: { id: true, name: true } },
              resolvedBy: { select: { id: true, name: true } },
            },
          },
          documents: {
            orderBy: { uploadedAt: 'desc' },
            include: { uploadedBy: { select: { id: true, name: true } } },
          },
          snapshots: { orderBy: { submittedAt: 'desc' } },
          _count: { select: { documents: true } },
        },
      });

      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));

      // Authorization check
      await requireInstitutionAccess(instrument.institutionId, req);

      res.json(attachDerivedStatus(instrument));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /instruments/:id — edit draft
instrumentsRouter.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;

      const instrument = await prisma.instrument.findUnique({ where: { id } });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));

      await requireInstitutionAccess(instrument.institutionId, req);

      // Only IU can edit, and only in DRAFT or ACTION_REQUIRED
      if (authReq.user.role !== Role.INSTITUTION_USER) {
        return next(
          createError(
            403,
            'FORBIDDEN',
            'Only institution users can edit instruments',
          ),
        );
      }
      if (
        !(
          [
            PrismaLifecycle.DRAFT,
            PrismaLifecycle.ACTION_REQUIRED,
          ] as PrismaLifecycle[]
        ).includes(instrument.lifecycleStatus)
      ) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            'Instrument can only be edited in DRAFT or ACTION_REQUIRED state',
          ),
        );
      }

      const body = UpdateInstrumentSchema.parse(req.body);
      if (body.version !== instrument.version) {
        return next(
          createError(
            409,
            'VERSION_CONFLICT',
            'Record has been modified. Please refresh.',
          ),
        );
      }
      const { version, ...changes } = body;
      CreateInstrumentSchema.parse({
        ...instrument,
        amount: instrument.amount.toString(),
        issueDate: instrument.issueDate.toISOString().slice(0, 10),
        maturityDate: instrument.maturityDate.toISOString().slice(0, 10),
        validityEndDate:
          instrument.validityEndDate?.toISOString().slice(0, 10) ?? null,
        ...changes,
      });
      const duplicate = await prisma.instrument.findFirst({
        where: {
          id: { not: id },
          bankName: changes.bankName ?? instrument.bankName,
          instrumentNumber:
            changes.instrumentNumber ?? instrument.instrumentNumber,
        },
      });
      if (duplicate)
        return next(
          createError(
            409,
            'DUPLICATE_DETECTED',
            'A matching bank and instrument number already exists.',
          ),
        );

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            instrumentType: body.instrumentType as any,
            instrumentNumber: body.instrumentNumber,
            bankName: body.bankName,
            bankBranch: body.bankBranch,
            amount: body.amount,
            issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
            maturityDate: body.maturityDate
              ? new Date(body.maturityDate)
              : undefined,
            validityEndDate:
              body.validityEndDate === undefined
                ? undefined
                : body.validityEndDate
                  ? new Date(body.validityEndDate)
                  : null,
            purpose: body.purpose,
            beneficiaryDetails: body.beneficiaryDetails,
            version: { increment: 1 },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          changedFields: { fields: Object.keys(changes) },
          action: 'INSTRUMENT_UPDATED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/submit
instrumentsRouter.post(
  '/:id/submit',
  requireRole(Role.INSTITUTION_USER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = SubmitTransitionSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const instrument = await prisma.instrument.findUnique({
        where: { id },
        include: { documents: { where: { isSuperseded: false } } },
      });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      if (
        instrument.lifecycleStatus === PrismaLifecycle.SUBMITTED &&
        instrument.version === body.data.version + 1
      ) {
        return res.json(instrument); // Safe retry of this exact submission.
      }
      if (instrument.lifecycleStatus !== PrismaLifecycle.DRAFT) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            `Cannot submit from state ${instrument.lifecycleStatus}`,
          ),
        );
      }
      if (body.data.version !== instrument.version) {
        return next(
          createError(409, 'VERSION_CONFLICT', 'Record version mismatch'),
        );
      }
      if (instrument.documents.length === 0) {
        return next(
          createError(
            422,
            'MISSING_DOCUMENT',
            'At least one supporting document is required before submission',
          ),
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            lifecycleStatus: PrismaLifecycle.SUBMITTED,
            submittedAt: new Date(),
            submittedById: authReq.user.id,
            version: { increment: 1 },
          },
        });
        // Snapshot
        await tx.instrumentSubmissionSnapshot.create({
          data: {
            instrumentId: id,
            submittedById: authReq.user.id,
            payload: submissionSnapshot(instrument),
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_SUBMITTED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: { lifecycleStatus: 'SUBMITTED' },
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/resubmit
instrumentsRouter.post(
  '/:id/resubmit',
  requireRole(Role.INSTITUTION_USER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = ResubmitTransitionSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const instrument = await prisma.instrument.findUnique({
        where: { id },
        include: { documents: { where: { isSuperseded: false } } },
      });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      if (instrument.lifecycleStatus !== PrismaLifecycle.ACTION_REQUIRED) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            `Cannot resubmit from state ${instrument.lifecycleStatus}`,
          ),
        );
      }
      if (body.data.version !== instrument.version) {
        return next(
          createError(409, 'VERSION_CONFLICT', 'Record version mismatch'),
        );
      }

      if (!instrument.documents.length)
        return next(
          createError(
            422,
            'MISSING_DOCUMENT',
            'Attach supporting evidence before resubmitting.',
          ),
        );

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            lifecycleStatus: PrismaLifecycle.RESUBMITTED,
            submittedAt: new Date(),
            submittedById: authReq.user.id,
            version: { increment: 1 },
          },
        });
        await tx.instrumentSubmissionSnapshot.create({
          data: {
            instrumentId: id,
            submittedById: authReq.user.id,
            payload: submissionSnapshot(instrument, body.data.corrections),
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_RESUBMITTED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            lifecycleStatus: 'RESUBMITTED',
            corrections: body.data.corrections,
          },
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/review — SO picks up the record
instrumentsRouter.post(
  '/:id/review',
  requireRole(Role.SCRUTINY_OFFICER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = SubmitTransitionSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const instrument = await prisma.instrument.findUnique({ where: { id } });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      if (
        !(
          [
            PrismaLifecycle.SUBMITTED,
            PrismaLifecycle.RESUBMITTED,
          ] as PrismaLifecycle[]
        ).includes(instrument.lifecycleStatus)
      ) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            `Cannot move to review from ${instrument.lifecycleStatus}`,
          ),
        );
      }
      if (body.data.version !== instrument.version) {
        return next(
          createError(409, 'VERSION_CONFLICT', 'Record version mismatch'),
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            lifecycleStatus: PrismaLifecycle.UNDER_REVIEW,
            version: { increment: 1 },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_UNDER_REVIEW',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/verify — SO marks as VERIFIED
instrumentsRouter.post(
  '/:id/verify',
  requireRole(Role.SCRUTINY_OFFICER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = ReviewTransitionSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const instrument = await prisma.instrument.findUnique({
        where: { id },
        include: {
          verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
          discrepancies: { where: { status: { in: ['OPEN', 'RESPONDED'] } } },
        },
      });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      if (instrument.lifecycleStatus !== PrismaLifecycle.UNDER_REVIEW) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            `Cannot verify from state ${instrument.lifecycleStatus}`,
          ),
        );
      }
      if (instrument.discrepancies.length > 0) {
        return next(
          createError(
            422,
            'OPEN_DISCREPANCIES',
            'Cannot verify: there are unresolved blocking discrepancies',
          ),
        );
      }
      if (body.data.version !== instrument.version) {
        return next(
          createError(409, 'VERSION_CONFLICT', 'Record version mismatch'),
        );
      }

      const latest = instrument.verifications[0];
      if (
        !latest ||
        latest.createdAt < instrument.submittedAt! ||
        latest.documentReviewStatus !== 'COMPLETE' ||
        !latest.result?.trim() ||
        ['NOT_CHECKED', 'PENDING', 'DISCREPANCY_FOUND'].includes(
          latest.independentVerificationStatus,
        )
      ) {
        return next(
          createError(
            422,
            'REVIEW_INCOMPLETE',
            'Record a completed document review and verification outcome for the current submission first.',
          ),
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            lifecycleStatus: PrismaLifecycle.VERIFIED,
            version: { increment: 1 },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_VERIFIED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          reason: body.data.reason,
          changedFields: { lifecycleStatus: 'VERIFIED' },
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/action-required — SO flags for correction
instrumentsRouter.post(
  '/:id/action-required',
  requireRole(Role.SCRUTINY_OFFICER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = ReviewTransitionSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const instrument = await prisma.instrument.findUnique({ where: { id } });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      if (instrument.lifecycleStatus !== PrismaLifecycle.UNDER_REVIEW) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            `Cannot flag from state ${instrument.lifecycleStatus}`,
          ),
        );
      }
      if (body.data.version !== instrument.version) {
        return next(
          createError(409, 'VERSION_CONFLICT', 'Record version mismatch'),
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            lifecycleStatus: PrismaLifecycle.ACTION_REQUIRED,
            version: { increment: 1 },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_ACTION_REQUIRED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          reason: body.data.reason,
          changedFields: { lifecycleStatus: 'ACTION_REQUIRED' },
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/reject — SO rejects (terminal)
instrumentsRouter.post(
  '/:id/reject',
  requireRole(Role.SCRUTINY_OFFICER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = RejectTransitionSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const instrument = await prisma.instrument.findUnique({ where: { id } });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      if (instrument.lifecycleStatus !== PrismaLifecycle.UNDER_REVIEW) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            `Cannot reject from state ${instrument.lifecycleStatus}`,
          ),
        );
      }
      if (body.data.version !== instrument.version) {
        return next(
          createError(409, 'VERSION_CONFLICT', 'Record version mismatch'),
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            lifecycleStatus: PrismaLifecycle.REJECTED,
            version: { increment: 1 },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_REJECTED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          reason: body.data.reason,
          changedFields: { lifecycleStatus: 'REJECTED' },
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/close — AA closes
instrumentsRouter.post(
  '/:id/close',
  requireRole(Role.APPROVING_AUTHORITY) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = CloseTransitionSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const instrument = await prisma.instrument.findUnique({
        where: { id },
        include: {
          releaseRequests: {
            where: { status: { notIn: ['REJECTED', 'COMPLETED'] } },
          },
        },
      });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));

      await requireInstitutionAccess(instrument.institutionId, req);

      if (instrument.lifecycleStatus !== PrismaLifecycle.VERIFIED) {
        return next(
          createError(
            409,
            'INVALID_STATE',
            `Cannot close from state ${instrument.lifecycleStatus}`,
          ),
        );
      }
      if (instrument.releaseRequests.length > 0) {
        return next(
          createError(
            409,
            'OPEN_RELEASE_REQUEST',
            'Cannot close: there is an open release request',
          ),
        );
      }
      if (body.data.version !== instrument.version) {
        return next(
          createError(409, 'VERSION_CONFLICT', 'Record version mismatch'),
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.instrument.update({
          where: { id, version: instrument.version },
          data: {
            lifecycleStatus: PrismaLifecycle.CLOSED,
            version: { increment: 1 },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_CLOSED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          reason: body.data.reason,
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// GET /instruments/:id/history
instrumentsRouter.get(
  '/:id/history',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const instrument = await prisma.instrument.findUnique({
        where: { id },
        select: {
          id: true,
          institutionId: true,
          documents: { select: { id: true } },
          verifications: { select: { id: true } },
          discrepancies: { select: { id: true } },
        },
      });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      const [auditEvents, snapshots] = await Promise.all([
        prisma.auditEvent.findMany({
          where: {
            OR: [
              { entityType: 'Instrument', entityId: id },
              {
                entityType: 'Document',
                entityId: { in: instrument.documents.map((item) => item.id) },
              },
              {
                entityType: 'Verification',
                entityId: {
                  in: instrument.verifications.map((item) => item.id),
                },
              },
              {
                entityType: 'Discrepancy',
                entityId: {
                  in: instrument.discrepancies.map((item) => item.id),
                },
              },
            ],
          },
          orderBy: { timestamp: 'desc' },
          include: { actor: { select: { id: true, name: true, role: true } } },
        }),
        prisma.instrumentSubmissionSnapshot.findMany({
          where: { instrumentId: id },
          orderBy: { submittedAt: 'desc' },
          include: { submittedBy: { select: { id: true, name: true } } },
        }),
      ]);

      res.json({ auditEvents, snapshots });
    } catch (err) {
      next(err);
    }
  },
);

// POST /instruments/:id/renewal — IU creates linked replacement
instrumentsRouter.post(
  '/:id/renewal',
  requireRole(Role.INSTITUTION_USER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;

      const predecessor = await prisma.instrument.findUnique({ where: { id } });
      if (!predecessor)
        return next(
          createError(404, 'NOT_FOUND', 'Predecessor instrument not found'),
        );
      await requireInstitutionAccess(predecessor.institutionId, req);

      // Check no existing successor
      const existingSuccessor = await prisma.instrument.findFirst({
        where: { predecessorInstrumentId: id },
      });
      if (existingSuccessor) {
        return next(
          createError(
            409,
            'RENEWAL_EXISTS',
            'A renewal/replacement already exists for this instrument',
          ),
        );
      }

      const body = {
        ...req.body,
        predecessorInstrumentId: id,
        institutionId: predecessor.institutionId,
      };
      const parsed = CreateRenewalSchema.safeParse(body);
      if (!parsed.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            parsed.error.errors,
          ),
        );

      // Duplicate check
      const duplicate = await prisma.instrument.findFirst({
        where: {
          bankName: parsed.data.bankName,
          instrumentNumber: parsed.data.instrumentNumber,
        },
      });
      if (duplicate) {
        return next(
          createError(
            409,
            'DUPLICATE_DETECTED',
            'An instrument with this bank + instrument number already exists',
          ),
        );
      }

      const renewal = await prisma.$transaction(async (tx) => {
        const created = await tx.instrument.create({
          data: {
            referenceCode: generateReferenceCode('DD'),
            institutionId: predecessor.institutionId,
            instrumentType: parsed.data.instrumentType as any,
            instrumentNumber: parsed.data.instrumentNumber,
            bankName: parsed.data.bankName,
            bankBranch: parsed.data.bankBranch,
            amount: parsed.data.amount,
            currency: parsed.data.currency || 'INR',
            issueDate: new Date(parsed.data.issueDate),
            maturityDate: new Date(parsed.data.maturityDate),
            validityEndDate: parsed.data.validityEndDate
              ? new Date(parsed.data.validityEndDate)
              : null,
            purpose: parsed.data.purpose,
            predecessorInstrumentId: id,
            lifecycleStatus: PrismaLifecycle.DRAFT,
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_RENEWAL_CREATED',
          entityType: 'Instrument',
          entityId: created.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            predecessorId: id,
            referenceCode: created.referenceCode,
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_SUCCESSOR_LINKED',
          entityType: 'Instrument',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: { successorId: created.id },
        });
        return created;
      });

      res.status(201).json(renewal);
    } catch (err) {
      next(err);
    }
  },
);

// GET /instruments/:id/verification-queue helper
instrumentsRouter.get(
  '/queue/verification',
  requireRole(Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { page, pageSize } = { page: 1, pageSize: 20, ...req.query };
      const skip = (+page - 1) * +pageSize;

      const scopes = await prisma.staffInstitutionScope.findMany({
        where: { userId: authReq.user.id },
        select: { institutionId: true },
      });

      const [total, instruments] = await Promise.all([
        prisma.instrument.count({
          where: {
            institutionId: { in: scopes.map((s) => s.institutionId) },
            lifecycleStatus: {
              in: [
                PrismaLifecycle.SUBMITTED,
                PrismaLifecycle.RESUBMITTED,
                PrismaLifecycle.UNDER_REVIEW,
              ],
            },
          },
        }),
        prisma.instrument.findMany({
          where: {
            institutionId: { in: scopes.map((s) => s.institutionId) },
            lifecycleStatus: {
              in: [
                PrismaLifecycle.SUBMITTED,
                PrismaLifecycle.RESUBMITTED,
                PrismaLifecycle.UNDER_REVIEW,
              ],
            },
          },
          skip,
          take: +pageSize,
          orderBy: { submittedAt: 'asc' },
          include: {
            institution: { select: { id: true, name: true } },
            _count: { select: { discrepancies: true, documents: true } },
          },
        }),
      ]);

      res.json(paginate(instruments, total, +page, +pageSize));
    } catch (err) {
      next(err);
    }
  },
);
