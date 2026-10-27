import { Router, Request } from 'express';
import { z } from 'zod';
import {
  Role,
  PaginationSchema,
  CreateReleaseRequestSchema,
  SubmitTransitionSchema,
  ReleaseReviewSchema,
  ReleaseReturnSchema,
  ReleaseForwardSchema,
  ReleaseResubmitSchema,
  ReleaseDecisionSchema,
  ReleaseCompletionSchema,
} from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import {
  requireAuth,
  requireRole,
  requireInstitutionAccess,
  AuthenticatedRequest,
} from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';
import { institutionScope } from '../../lib/scope';
import { documentView } from '../../lib/instruments';
import { writeAuditEvent } from '../../lib/audit';
import { generateReferenceCode, paginate } from '../../lib/domain';

export const releaseRequestsRouter = Router();
releaseRequestsRouter.use(requireAuth as any);
const include = {
  institution: { select: { id: true, name: true } },
  instrument: {
    select: {
      id: true,
      referenceCode: true,
      instrumentNumber: true,
      bankName: true,
      amount: true,
      lifecycleStatus: true,
    },
  },
  submittedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  documents: { include: { uploadedBy: { select: { id: true, name: true } } } },
} as const;
const view = (record: any) => ({
  ...record,
  instrument: {
    ...record.instrument,
    amount: record.instrument.amount.toString(),
  },
  documents: record.documents.map(documentView),
  scrutinyOfficer: record.reviewedBy,
  approvingAuthority: record.decidedBy,
  decidedAt: record.decisionAt,
  completionDate: record.completionDate?.toISOString().slice(0, 10),
});
function parse(schema: any, input: any): any {
  const result = schema.safeParse(input);
  if (!result.success)
    throw createError(
      422,
      'VALIDATION_ERROR',
      'Invalid request details.',
      result.error.issues,
    );
  return result.data;
}
async function record(id: string, req: Request) {
  const result = await prisma.releaseRequest.findUnique({
    where: { id },
    include,
  });
  if (!result)
    throw createError(404, 'NOT_FOUND', 'Release request not found.');
  await requireInstitutionAccess(result.institutionId, req);
  return result;
}
const incomplete = (rr: any) =>
  (rr.checklistSnapshot as any[]).filter(
    (item) => item.isRequired && !item.completed,
  );
const reviewer = (rr: any, req: AuthenticatedRequest) => {
  if (rr.reviewedById !== req.user.id)
    throw createError(
      403,
      'REVIEWER_MISMATCH',
      'Only the assigned reviewing officer can perform this action.',
    );
};

releaseRequestsRouter.get('/', async (req, res, next) => {
  try {
    const { page, pageSize } = PaginationSchema.parse(req.query);
    const ids = await institutionScope(req as unknown as AuthenticatedRequest);
    const where: any = ids === null ? {} : { institutionId: { in: ids } };
    if (req.query.open === 'true')
      where.status = { notIn: ['REJECTED', 'COMPLETED'] };
    if (req.query.status)
      where.status = parse(
        z.enum([
          'DRAFT',
          'SUBMITTED',
          'UNDER_REVIEW',
          'RETURNED_FOR_INFORMATION',
          'RESUBMITTED',
          'PENDING_AUTHORITY_DECISION',
          'APPROVED',
          'REJECTED',
          'COMPLETED',
        ]),
        req.query.status,
      );
    if (req.query.search)
      where.OR = [
        {
          referenceCode: {
            contains: String(req.query.search),
            mode: 'insensitive',
          },
        },
        {
          instrument: {
            instrumentNumber: {
              contains: String(req.query.search),
              mode: 'insensitive',
            },
          },
        },
        {
          institution: {
            name: { contains: String(req.query.search), mode: 'insensitive' },
          },
        },
      ];
    const [total, rows] = await Promise.all([
      prisma.releaseRequest.count({ where }),
      prisma.releaseRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include,
      }),
    ]);
    res.json(paginate(rows.map(view), total, page, pageSize));
  } catch (error) {
    next(error);
  }
});
releaseRequestsRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(view(await record(req.params.id, req)));
  } catch (error) {
    next(error);
  }
});
releaseRequestsRouter.post(
  '/',
  requireRole(Role.INSTITUTION_USER) as any,
  async (req, res, next) => {
    try {
      const actor = req as unknown as AuthenticatedRequest;
      const body = parse(CreateReleaseRequestSchema, req.body);
      const instrument = await prisma.instrument.findUnique({
        where: { id: body.instrumentId },
        include: { releaseRequests: true },
      });
      if (!instrument)
        throw createError(404, 'NOT_FOUND', 'Instrument not found.');
      await requireInstitutionAccess(instrument.institutionId, req);
      if (
        instrument.lifecycleStatus !== 'VERIFIED' ||
        instrument.releaseRequests.some((item) => item.status === 'COMPLETED')
      )
        throw createError(
          422,
          'INVALID_INSTRUMENT',
          'Only verified instruments without a completed release can start a request.',
        );
      const checklist = await prisma.releaseChecklistItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      if (!checklist.some((item) => item.isRequired))
        throw createError(
          422,
          'CHECKLIST_NOT_CONFIGURED',
          'An administrator must configure the required demo-policy checklist first.',
        );
      const rr = await prisma.$transaction(async (tx) => {
        // Serialize against closure and concurrent release requests for this instrument.
        await tx.$queryRaw`SELECT id FROM "Instrument" WHERE id = ${instrument.id} FOR UPDATE`;
        const fresh = await tx.instrument.findUniqueOrThrow({
          where: { id: instrument.id },
        });
        if (fresh.lifecycleStatus !== 'VERIFIED')
          throw createError(
            409,
            'INVALID_STATE',
            'The instrument changed. Refresh it.',
          );
        const existing = await tx.releaseRequest.findFirst({
          where: { instrumentId: instrument.id, status: { not: 'REJECTED' } },
        });
        if (existing)
          throw createError(
            409,
            'OPEN_REQUEST_EXISTS',
            'A current or completed release request already exists.',
          );
        await tx.instrument.update({
          where: { id: instrument.id },
          data: { version: { increment: 1 } },
        });
        const created = await tx.releaseRequest.create({
          data: {
            referenceCode: generateReferenceCode('RR'),
            instrumentId: instrument.id,
            institutionId: instrument.institutionId,
            requestType: body.requestType,
            reason: body.reason,
            submittedById: actor.user.id,
            checklistSnapshot: checklist.map((item) => ({
              id: item.id,
              label: item.label,
              isRequired: item.isRequired,
              completed: false,
              sortOrder: item.sortOrder,
            })),
          },
          include,
        });
        await writeAuditEvent(tx, {
          actorUserId: actor.user.id,
          actorRole: actor.user.role,
          action: 'RELEASE_REQUEST_CREATED',
          entityType: 'ReleaseRequest',
          entityId: created.id,
          requestId: req.headers['x-request-id'] as string,
        });
        return created;
      });
      res.status(201).json(view(rr));
    } catch (error) {
      next(error);
    }
  },
);
releaseRequestsRouter.patch(
  '/:id',
  requireRole(Role.INSTITUTION_USER) as any,
  async (req, res, next) => {
    try {
      const rr = await record(req.params.id, req);
      const body = parse(
        z
          .object({
            reason: z.string().trim().min(1).max(2000),
            version: z.number().int().positive(),
          })
          .strict(),
        req.body,
      );
      if (!['DRAFT', 'RETURNED_FOR_INFORMATION'].includes(rr.status))
        throw createError(
          409,
          'INVALID_STATE',
          'This request cannot be edited at this stage.',
        );
      const actor = req as unknown as AuthenticatedRequest;
      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.releaseRequest.update({
          where: { id: rr.id, version: body.version, status: rr.status },
          data: { reason: body.reason, version: { increment: 1 } },
          include,
        });
        await writeAuditEvent(tx, {
          actorUserId: actor.user.id,
          actorRole: actor.user.role,
          action: 'RELEASE_REQUEST_UPDATED',
          entityType: 'ReleaseRequest',
          entityId: rr.id,
          reason: body.reason,
        });
        return item;
      });
      res.json(view(updated));
    } catch (error) {
      next(error);
    }
  },
);

type Transition = {
  roles: Role[];
  schema: any;
  from: string[];
  to: string;
  prepare?: (rr: any, body: any, req: AuthenticatedRequest) => any;
  retry?: boolean;
};
const transitions: Record<string, Transition> = {
  submit: {
    roles: [Role.INSTITUTION_USER],
    schema: SubmitTransitionSchema,
    from: ['DRAFT'],
    to: 'SUBMITTED',
    retry: true,
    prepare(rr) {
      if (rr.instrument.lifecycleStatus !== 'VERIFIED')
        throw createError(
          422,
          'INVALID_INSTRUMENT',
          'Instrument is no longer verified.',
        );
      if (!rr.documents.some((doc: any) => !doc.isSuperseded))
        throw createError(
          422,
          'MISSING_DOCUMENT',
          'Attach supporting evidence before submission.',
        );
      return { submittedAt: new Date() };
    },
  },
  review: {
    roles: [Role.SCRUTINY_OFFICER],
    schema: ReleaseReviewSchema,
    from: ['SUBMITTED', 'RESUBMITTED'],
    to: 'UNDER_REVIEW',
    prepare(_rr, body, req) {
      return {
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        scrutinyNotes: body.notes,
      };
    },
  },
  return: {
    roles: [Role.SCRUTINY_OFFICER],
    schema: ReleaseReturnSchema,
    from: ['UNDER_REVIEW'],
    to: 'RETURNED_FOR_INFORMATION',
    prepare(rr, body, req) {
      reviewer(rr, req);
      return { returnReason: body.reason, scrutinyNotes: body.observations };
    },
  },
  resubmit: {
    roles: [Role.INSTITUTION_USER],
    schema: ReleaseResubmitSchema,
    from: ['RETURNED_FOR_INFORMATION'],
    to: 'RESUBMITTED',
    prepare(rr, body) {
      if (!rr.documents.some((doc: any) => !doc.isSuperseded))
        throw createError(
          422,
          'MISSING_DOCUMENT',
          'Attach supporting evidence.',
        );
      return {
        checklistSnapshot: (rr.checklistSnapshot as any[]).map((item) => ({
          ...item,
          completed: false,
        })),
        history: [
          ...(rr.history as any[]),
          {
            action: 'INFORMATION_SUPPLIED',
            notes: body.information,
            at: new Date().toISOString(),
          },
        ],
      };
    },
  },
  forward: {
    roles: [Role.SCRUTINY_OFFICER],
    schema: ReleaseForwardSchema,
    from: ['UNDER_REVIEW'],
    to: 'PENDING_AUTHORITY_DECISION',
    prepare(rr, body, req) {
      reviewer(rr, req);
      if (incomplete(rr).length)
        throw createError(
          422,
          'CHECKLIST_INCOMPLETE',
          'Complete the required checklist before forwarding.',
        );
      if (!body.notes?.trim())
        throw createError(422, 'NOTES_REQUIRED', 'Enter scrutiny notes.');
      return { scrutinyNotes: body.notes };
    },
  },
  approve: {
    roles: [Role.APPROVING_AUTHORITY],
    schema: ReleaseDecisionSchema,
    from: ['PENDING_AUTHORITY_DECISION'],
    to: 'APPROVED',
    retry: true,
    prepare(rr, body, req) {
      if (rr.reviewedById === req.user.id || rr.submittedById === req.user.id)
        throw createError(
          403,
          'MAKER_CHECKER_VIOLATION',
          'The maker or reviewing officer cannot decide this request.',
        );
      if (incomplete(rr).length)
        throw createError(
          422,
          'CHECKLIST_INCOMPLETE',
          'Required checklist items are incomplete.',
        );
      return {
        decisionById: req.user.id,
        decisionAt: new Date(),
        decisionReason: body.decisionReason,
        decisionNotes: body.notes,
      };
    },
  },
  reject: {
    roles: [Role.APPROVING_AUTHORITY],
    schema: ReleaseDecisionSchema,
    from: ['PENDING_AUTHORITY_DECISION'],
    to: 'REJECTED',
    prepare(rr, body, req) {
      if (rr.reviewedById === req.user.id || rr.submittedById === req.user.id)
        throw createError(
          403,
          'MAKER_CHECKER_VIOLATION',
          'The maker or reviewer cannot decide this request.',
        );
      return {
        decisionById: req.user.id,
        decisionAt: new Date(),
        decisionReason: body.decisionReason,
        decisionNotes: body.notes,
      };
    },
  },
  complete: {
    roles: [Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY],
    schema: ReleaseCompletionSchema,
    from: ['APPROVED'],
    to: 'COMPLETED',
    prepare(_rr, body, req) {
      return {
        completedById: req.user.id,
        completedAt: new Date(),
        completionDate: new Date(body.completionDate),
        completionReference: body.completionReference,
        completionNotes: body.notes,
      };
    },
  },
};
for (const [action, rule] of Object.entries(transitions))
  releaseRequestsRouter.post(
    `/:id/${action}`,
    requireRole(...rule.roles) as any,
    async (req, res, next) => {
      try {
        const actor = req as unknown as AuthenticatedRequest;
        const body = parse(rule.schema, req.body);
        const rr = await record(req.params.id, req);
        if (
          rule.retry &&
          rr.status === rule.to &&
          rr.version === body.version + 1 &&
          (action !== 'approve' || rr.decisionById === actor.user.id)
        ) {
          res.json(view(rr));
          return;
        }
        if (!rule.from.includes(rr.status))
          throw createError(
            409,
            'INVALID_STATE',
            `Cannot ${action} from ${rr.status}.`,
          );
        if (rr.version !== body.version)
          throw createError(
            409,
            'VERSION_CONFLICT',
            'Refresh the changed request.',
          );
        const data = rule.prepare?.(rr, body, actor) || {};
        const updated = await prisma.$transaction(async (tx) => {
          const fresh = await tx.releaseRequest.update({
            where: { id: rr.id, version: body.version, status: rr.status },
            data: {
              ...data,
              status: rule.to as any,
              version: { increment: 1 },
              history: [
                ...(data.history || (rr.history as any[])),
                {
                  action: rule.to,
                  at: new Date().toISOString(),
                  byUserId: actor.user.id,
                  notes:
                    body.decisionReason ||
                    body.reason ||
                    body.notes ||
                    body.information ||
                    body.completionReference ||
                    null,
                },
              ],
            },
            include,
          });
          await writeAuditEvent(tx, {
            actorUserId: actor.user.id,
            actorRole: actor.user.role,
            action: `RELEASE_REQUEST_${rule.to}`,
            entityType: 'ReleaseRequest',
            entityId: rr.id,
            requestId: req.headers['x-request-id'] as string,
            reason: body.decisionReason || body.reason || body.notes,
            changedFields: {
              from: rr.status,
              to: rule.to,
              completionReference: body.completionReference,
            },
          });
          return fresh;
        });
        res.json(view(updated));
      } catch (error) {
        next(error);
      }
    },
  );
releaseRequestsRouter.patch(
  '/:id/checklist',
  requireRole(Role.SCRUTINY_OFFICER) as any,
  async (req, res, next) => {
    try {
      const body = parse(
        z
          .object({
            itemId: z.string().min(1),
            completed: z.boolean(),
            version: z.number().int().positive(),
          })
          .strict(),
        req.body,
      );
      const rr = await record(req.params.id, req);
      const actor = req as unknown as AuthenticatedRequest;
      if (rr.status !== 'UNDER_REVIEW')
        throw createError(
          409,
          'INVALID_STATE',
          'Checklist changes require active review.',
        );
      reviewer(rr, actor);
      const items = rr.checklistSnapshot as any[];
      if (!items.some((item) => item.id === body.itemId))
        throw createError(
          422,
          'INVALID_ITEM',
          'Checklist item is not part of this request.',
        );
      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.releaseRequest.update({
          where: { id: rr.id, version: body.version, status: 'UNDER_REVIEW' },
          data: {
            checklistSnapshot: items.map((item) =>
              item.id === body.itemId
                ? { ...item, completed: body.completed }
                : item,
            ),
            version: { increment: 1 },
          },
          include,
        });
        await writeAuditEvent(tx, {
          actorUserId: actor.user.id,
          actorRole: actor.user.role,
          action: 'RELEASE_CHECKLIST_UPDATED',
          entityType: 'ReleaseRequest',
          entityId: rr.id,
          changedFields: { itemId: body.itemId, completed: body.completed },
        });
        return item;
      });
      res.json(view(updated));
    } catch (error) {
      next(error);
    }
  },
);
