import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@depositdesk/shared';
import {
  CreateReleaseRequestSchema,
  ReleaseDecisionSchema,
  ReleaseCompletionSchema,
  ReleaseReviewSchema,
  ReleaseReturnSchema,
  ReleaseForwardSchema,
  ReleaseResubmitSchema,
  SubmitTransitionSchema,
} from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { requireAuth, requireRole, AuthenticatedRequest, requireInstitutionAccess } from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { generateReferenceCode, paginate } from '../../lib/domain';
import { ReleaseRequestStatus as PrismaRRStatus, LifecycleStatus } from '@prisma/client';

export const releaseRequestsRouter = Router();
releaseRequestsRouter.use(requireAuth as any);

const OPEN_STATUSES = [
  PrismaRRStatus.DRAFT,
  PrismaRRStatus.SUBMITTED,
  PrismaRRStatus.UNDER_REVIEW,
  PrismaRRStatus.RETURNED_FOR_INFORMATION,
  PrismaRRStatus.RESUBMITTED,
  PrismaRRStatus.PENDING_AUTHORITY_DECISION,
  PrismaRRStatus.APPROVED,
];

// GET /release-requests
releaseRequestsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const skip = (page - 1) * pageSize;
    const { role, institutionId } = authReq.user;

    const where: any = {};
    if (role === Role.INSTITUTION_USER) {
      if (!institutionId) return res.json(paginate([], 0, page, pageSize));
      where.institutionId = institutionId;
    } else if (role === Role.SCRUTINY_OFFICER || role === Role.APPROVING_AUTHORITY) {
      const scopes = await prisma.staffInstitutionScope.findMany({ where: { userId: authReq.user.id }, select: { institutionId: true } });
      where.institutionId = { in: scopes.map(s => s.institutionId) };
    }

    if (req.query.status) where.status = req.query.status;

    const [total, requests] = await Promise.all([
      prisma.releaseRequest.count({ where }),
      prisma.releaseRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          institution: { select: { id: true, name: true } },
          instrument: { select: { id: true, referenceCode: true, bankName: true, amount: true } },
          submittedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json(paginate(requests, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// POST /release-requests — IU creates
releaseRequestsRouter.post(
  '/',
  requireRole(Role.INSTITUTION_USER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = CreateReleaseRequestSchema.safeParse(req.body);
      if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

      const instrument = await prisma.instrument.findUnique({ where: { id: body.data.instrumentId } });
      if (!instrument) return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      // Only for VERIFIED instruments
      if (instrument.lifecycleStatus !== LifecycleStatus.VERIFIED) {
        return next(createError(422, 'INVALID_STATE', 'Release requests can only be created for VERIFIED instruments'));
      }

      // One open request per instrument
      const openRequest = await prisma.releaseRequest.findFirst({
        where: { instrumentId: body.data.instrumentId, status: { in: OPEN_STATUSES } },
      });
      if (openRequest) {
        return next(createError(409, 'OPEN_REQUEST_EXISTS', 'An open release request already exists for this instrument'));
      }

      // Load checklist items
      const checklistItems = await prisma.releaseChecklistItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });

      const rr = await prisma.$transaction(async (tx) => {
        const created = await tx.releaseRequest.create({
          data: {
            referenceCode: generateReferenceCode('RR'),
            instrumentId: body.data.instrumentId,
            institutionId: instrument.institutionId,
            requestType: body.data.requestType,
            reason: body.data.reason,
            submittedById: authReq.user.id,
            checklistSnapshot: checklistItems.map(item => ({
              id: item.id,
              label: item.label,
              isRequired: item.isRequired,
              sortOrder: item.sortOrder,
              completed: false,
            })),
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'RELEASE_REQUEST_CREATED',
          entityType: 'ReleaseRequest',
          entityId: created.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: { referenceCode: created.referenceCode, instrumentId: body.data.instrumentId },
        });
        return created;
      });

      res.status(201).json(rr);
    } catch (err) {
      next(err);
    }
  }
);

// GET /release-requests/:id
releaseRequestsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rr = await prisma.releaseRequest.findUnique({
      where: { id: req.params.id },
      include: {
        institution: { select: { id: true, name: true } },
        instrument: { select: { id: true, referenceCode: true, bankName: true, amount: true, lifecycleStatus: true } },
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        documents: { where: { isSuperseded: false } },
        discrepancies: true,
      },
    });

    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    res.json(rr);
  } catch (err) {
    next(err);
  }
});

// POST /release-requests/:id/submit — IU submits
releaseRequestsRouter.post('/:id/submit', requireRole(Role.INSTITUTION_USER) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = SubmitTransitionSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (rr.status !== PrismaRRStatus.DRAFT) {
      return next(createError(409, 'INVALID_STATE', `Cannot submit from state ${rr.status}`));
    }
    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: { status: PrismaRRStatus.SUBMITTED, submittedAt: new Date(), version: { increment: 1 } },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_SUBMITTED',
        entityType: 'ReleaseRequest',
        entityId: id,
        requestId: req.headers['x-request-id'] as string,
      });
      return u;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /release-requests/:id/review — SO picks up
releaseRequestsRouter.post('/:id/review', requireRole(Role.SCRUTINY_OFFICER) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = ReleaseReviewSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (!([PrismaRRStatus.SUBMITTED, PrismaRRStatus.RESUBMITTED] as PrismaRRStatus[]).includes(rr.status)) {
      return next(createError(409, 'INVALID_STATE', `Cannot review from state ${rr.status}`));
    }
    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: {
          status: PrismaRRStatus.UNDER_REVIEW,
          reviewedById: authReq.user.id,
          reviewedAt: new Date(),
          scrutinyNotes: body.data.notes,
          version: { increment: 1 },
        },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_UNDER_REVIEW',
        entityType: 'ReleaseRequest',
        entityId: id,
        requestId: req.headers['x-request-id'] as string,
      });
      return u;
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /release-requests/:id/return — SO returns for info
releaseRequestsRouter.post('/:id/return', requireRole(Role.SCRUTINY_OFFICER) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = ReleaseReturnSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (rr.status !== PrismaRRStatus.UNDER_REVIEW) {
      return next(createError(409, 'INVALID_STATE', `Cannot return from state ${rr.status}`));
    }
    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: {
          status: PrismaRRStatus.RETURNED_FOR_INFORMATION,
          returnReason: body.data.reason,
          scrutinyNotes: body.data.observations,
          version: { increment: 1 },
          history: [...(rr.history as any[]), { action: 'RETURNED', reason: body.data.reason, at: new Date().toISOString(), byUserId: authReq.user.id }],
        },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_RETURNED',
        entityType: 'ReleaseRequest',
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
});

// POST /release-requests/:id/resubmit — IU resubmits after return
releaseRequestsRouter.post('/:id/resubmit', requireRole(Role.INSTITUTION_USER) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = ReleaseResubmitSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (rr.status !== PrismaRRStatus.RETURNED_FOR_INFORMATION) {
      return next(createError(409, 'INVALID_STATE', `Cannot resubmit from state ${rr.status}`));
    }
    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: { status: PrismaRRStatus.RESUBMITTED, version: { increment: 1 } },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_RESUBMITTED',
        entityType: 'ReleaseRequest',
        entityId: id,
        requestId: req.headers['x-request-id'] as string,
        changedFields: { information: body.data.information },
      });
      return u;
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /release-requests/:id/forward — SO forwards for decision
releaseRequestsRouter.post('/:id/forward', requireRole(Role.SCRUTINY_OFFICER) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = ReleaseForwardSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (rr.status !== PrismaRRStatus.UNDER_REVIEW) {
      return next(createError(409, 'INVALID_STATE', `Cannot forward from state ${rr.status}`));
    }
    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    // Check required checklist items
    const checklist = rr.checklistSnapshot as any[];
    const incomplete = checklist.filter(item => item.isRequired && !item.completed);
    if (incomplete.length > 0) {
      return next(createError(422, 'CHECKLIST_INCOMPLETE', 'Required checklist items are incomplete', { incompleteItems: incomplete.map(i => i.label) }));
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: {
          status: PrismaRRStatus.PENDING_AUTHORITY_DECISION,
          scrutinyNotes: body.data.notes,
          version: { increment: 1 },
        },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_FORWARDED',
        entityType: 'ReleaseRequest',
        entityId: id,
        requestId: req.headers['x-request-id'] as string,
      });
      return u;
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /release-requests/:id/approve — AA approves (maker-checker)
releaseRequestsRouter.post('/:id/approve', requireRole(Role.APPROVING_AUTHORITY) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = ReleaseDecisionSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (rr.status !== PrismaRRStatus.PENDING_AUTHORITY_DECISION) {
      return next(createError(409, 'INVALID_STATE', `Cannot approve from state ${rr.status}`));
    }

    // Maker-checker: the reviewer cannot decide
    if (rr.reviewedById === authReq.user.id) {
      return next(createError(403, 'MAKER_CHECKER_VIOLATION', 'The reviewing officer cannot approve this request'));
    }

    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    // Check required checklist items
    const checklist = rr.checklistSnapshot as any[];
    const incomplete = checklist.filter(item => item.isRequired && !item.completed);
    if (incomplete.length > 0) {
      return next(createError(422, 'CHECKLIST_INCOMPLETE', 'Required checklist items are incomplete'));
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: {
          status: PrismaRRStatus.APPROVED,
          decisionById: authReq.user.id,
          decisionAt: new Date(),
          decisionReason: body.data.decisionReason,
          version: { increment: 1 },
        },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_APPROVED',
        entityType: 'ReleaseRequest',
        entityId: id,
        requestId: req.headers['x-request-id'] as string,
        reason: body.data.decisionReason,
      });
      return u;
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /release-requests/:id/reject — AA rejects
releaseRequestsRouter.post('/:id/reject', requireRole(Role.APPROVING_AUTHORITY) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = ReleaseDecisionSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (rr.status !== PrismaRRStatus.PENDING_AUTHORITY_DECISION) {
      return next(createError(409, 'INVALID_STATE', `Cannot reject from state ${rr.status}`));
    }
    if (rr.reviewedById === authReq.user.id) {
      return next(createError(403, 'MAKER_CHECKER_VIOLATION', 'The reviewing officer cannot reject this request'));
    }
    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: {
          status: PrismaRRStatus.REJECTED,
          decisionById: authReq.user.id,
          decisionAt: new Date(),
          decisionReason: body.data.decisionReason,
          version: { increment: 1 },
        },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_REJECTED',
        entityType: 'ReleaseRequest',
        entityId: id,
        requestId: req.headers['x-request-id'] as string,
        reason: body.data.decisionReason,
      });
      return u;
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /release-requests/:id/complete — SO or AA records completion evidence
releaseRequestsRouter.post('/:id/complete', requireRole(Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY) as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = ReleaseCompletionSchema.safeParse(req.body);
    if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    if (rr.status !== PrismaRRStatus.APPROVED) {
      return next(createError(409, 'INVALID_STATE', `Cannot complete from state ${rr.status}`));
    }
    if (body.data.version !== rr.version) return next(createError(409, 'VERSION_CONFLICT', 'Record version mismatch'));

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.releaseRequest.update({
        where: { id, version: rr.version },
        data: {
          status: PrismaRRStatus.COMPLETED,
          completedById: authReq.user.id,
          completedAt: new Date(body.data.completionDate),
          completionReference: body.data.completionReference,
          version: { increment: 1 },
        },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'RELEASE_REQUEST_COMPLETED',
        entityType: 'ReleaseRequest',
        entityId: id,
        requestId: req.headers['x-request-id'] as string,
        changedFields: { completionReference: body.data.completionReference, completionDate: body.data.completionDate },
      });
      return u;
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /release-requests/:id/checklist — update checklist item completion
releaseRequestsRouter.patch('/:id/checklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { itemId, completed } = req.body;

    const rr = await prisma.releaseRequest.findUnique({ where: { id } });
    if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
    await requireInstitutionAccess(rr.institutionId, req);

    // Only SO can update checklist
    if (authReq.user.role !== Role.SCRUTINY_OFFICER) {
      return next(createError(403, 'FORBIDDEN', 'Only scrutiny officers can update the checklist'));
    }

    const checklist = (rr.checklistSnapshot as any[]).map(item =>
      item.id === itemId ? { ...item, completed } : item
    );

    const updated = await prisma.releaseRequest.update({
      where: { id },
      data: { checklistSnapshot: checklist, version: { increment: 1 } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
