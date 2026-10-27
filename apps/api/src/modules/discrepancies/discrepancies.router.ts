import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@depositdesk/shared';
import {
  PaginationSchema,
  CreateDiscrepancySchema,
  ResolveDiscrepancySchema,
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
import { paginate } from '../../lib/domain';

export const discrepanciesRouter = Router();
discrepanciesRouter.use(requireAuth as any);

// POST /discrepancies — SO creates discrepancy
discrepanciesRouter.post(
  '/',
  requireRole(Role.SCRUTINY_OFFICER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = CreateDiscrepancySchema.safeParse(req.body);
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
        where: { id: body.data.instrumentId },
      });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      if (
        !['UNDER_REVIEW', 'ACTION_REQUIRED'].includes(
          instrument.lifecycleStatus,
        )
      )
        return next(
          createError(
            409,
            'INVALID_STATE',
            'Pick up the submission before flagging a discrepancy.',
          ),
        );
      if (body.data.releaseRequestId) {
        const parent = await prisma.releaseRequest.findUnique({
          where: { id: body.data.releaseRequestId },
        });
        if (!parent || parent.instrumentId !== instrument.id)
          return next(
            createError(
              422,
              'INVALID_PARENT',
              'Release request does not belong to this instrument.',
            ),
          );
      }
      const discrepancy = await prisma.$transaction(async (tx) => {
        await tx.instrument.update({
          where: {
            id: instrument.id,
            version: body.data.version,
            lifecycleStatus: instrument.lifecycleStatus,
          },
          data: {
            lifecycleStatus: 'ACTION_REQUIRED',
            version: { increment: 1 },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTRUMENT_ACTION_REQUIRED',
          entityType: 'Instrument',
          entityId: instrument.id,
          reason: body.data.reason,
        });
        const d = await tx.discrepancy.create({
          data: {
            instrumentId: body.data.instrumentId,
            releaseRequestId: body.data.releaseRequestId,
            code: body.data.code,
            severity: body.data.severity as any,
            description: body.data.description,
            reason: body.data.reason,
            assignedToId: authReq.user.id,
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'DISCREPANCY_CREATED',
          entityType: 'Discrepancy',
          entityId: d.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            code: body.data.code,
            severity: body.data.severity,
            instrumentId: body.data.instrumentId,
          },
        });
        return d;
      });

      res.status(201).json(discrepancy);
    } catch (err) {
      next(err);
    }
  },
);

// GET /discrepancies — filtered list
discrepanciesRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const {page,pageSize}=PaginationSchema.parse(req.query);
    const skip = (page - 1) * pageSize;
      const { role, institutionId } = authReq.user;

      let where: any = {};
      if (role === Role.INSTITUTION_USER) {
        if (!institutionId) return res.json(paginate([], 0, page, pageSize));
        where = { instrument: { institutionId } };
      } else if (
        role === Role.SCRUTINY_OFFICER ||
        role === Role.APPROVING_AUTHORITY
      ) {
        const scopes = await prisma.staffInstitutionScope.findMany({
          where: { userId: authReq.user.id },
          select: { institutionId: true },
        });
        where = {
          instrument: {
            institutionId: { in: scopes.map((s) => s.institutionId) },
          },
        };
      }

      if (req.query.status) {
      if(!['OPEN','RESPONDED','RESOLVED','DISMISSED','UNRESOLVED'].includes(String(req.query.status))) throw createError(422,'INVALID_STATUS','Invalid discrepancy filter.');
      where.status=req.query.status==='UNRESOLVED'?{in:['OPEN','RESPONDED']}:req.query.status;
    }
      if (req.query.instrumentId) where.instrumentId = req.query.instrumentId;

      const [total, discrepancies] = await Promise.all([
        prisma.discrepancy.count({ where }),
        prisma.discrepancy.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { detectedAt: 'desc' },
          include: {
            instrument: {
              select: {
                id: true,
                referenceCode: true,
                institutionId: true,
                institution: { select: { name: true } },
              },
            },
            assignedTo: { select: { id: true, name: true } },
            resolvedBy: { select: { id: true, name: true } },
          },
        }),
      ]);

      res.json(paginate(discrepancies, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /discrepancies/:id/resolve — SO resolves, IU responds
discrepanciesRouter.patch(
  '/:id/resolve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = ResolveDiscrepancySchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const discrepancy = await prisma.discrepancy.findUnique({
        where: { id },
        include: {
          instrument: {
            select: {
              id: true,
              institutionId: true,
              version: true,
              lifecycleStatus: true,
            },
          },
        },
      });
      if (!discrepancy)
        return next(createError(404, 'NOT_FOUND', 'Discrepancy not found'));
      await requireInstitutionAccess(discrepancy.instrument.institutionId, req);

      const { role } = authReq.user;
      let newStatus: any;
      let action: string;

      if (role === Role.INSTITUTION_USER) {
        // IU can only respond (move to RESPONDED)
        if (
          body.data.status !== 'RESPONDED' ||
          discrepancy.instrument.lifecycleStatus !== 'ACTION_REQUIRED'
        )
          return next(
            createError(
              403,
              'FORBIDDEN',
              'Institutions can respond only while corrections are requested.',
            ),
          );
        newStatus = 'RESPONDED';
        action = 'DISCREPANCY_RESPONDED';
      } else if (role === Role.SCRUTINY_OFFICER) {
        if (body.data.status === 'RESPONDED')
          return next(
            createError(
              422,
              'INVALID_STATUS',
              'Officers must resolve or dismiss a discrepancy.',
            ),
          );
        newStatus = body.data.status;
        action =
          body.data.status === 'RESOLVED'
            ? 'DISCREPANCY_RESOLVED'
            : 'DISCREPANCY_DISMISSED';
      } else {
        return next(createError(403, 'FORBIDDEN', 'Insufficient permissions'));
      }

      if (!['OPEN', 'RESPONDED'].includes(discrepancy.status))
        return next(
          createError(
            409,
            'INVALID_STATE',
            'This discrepancy is already closed.',
          ),
        );
      const updated = await prisma.$transaction(async (tx) => {
        await tx.instrument.update({
          where: { id: discrepancy.instrument.id, version: body.data.version },
          data: { version: { increment: 1 } },
        });
        const d = await tx.discrepancy.update({
          where: { id },
          data: {
            status: newStatus,
            resolutionNotes: body.data.resolutionNotes,
            resolvedById:
              role !== Role.INSTITUTION_USER
                ? authReq.user.id
                : discrepancy.resolvedById,
            resolvedAt:
              role !== Role.INSTITUTION_USER
                ? new Date()
                : discrepancy.resolvedAt,
            history: [
              ...(discrepancy.history as any[]),
              {
                timestamp: new Date().toISOString(),
                status: newStatus,
                byUserId: authReq.user.id,
                notes: body.data.resolutionNotes,
              },
            ],
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action,
          entityType: 'Discrepancy',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            status: newStatus,
            notes: body.data.resolutionNotes,
          },
        });
        return d;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);
