import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@depositdesk/shared';
import { RecordVerificationSchema } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import {
  requireAuth,
  requireRole,
  AuthenticatedRequest,
  requireInstitutionAccess,
} from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { config } from '../../config/env';
import { paginate } from '../../lib/domain';

export const verificationRouter = Router();
verificationRouter.use(requireAuth as any);

// POST /verification/instruments/:id — record verification outcome
verificationRouter.post(
  '/instruments/:id',
  requireRole(Role.SCRUTINY_OFFICER) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;

      const instrument = await prisma.instrument.findUnique({ where: { id } });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      const body = RecordVerificationSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );
      if (instrument.lifecycleStatus !== 'UNDER_REVIEW')
        return next(
          createError(
            409,
            'INVALID_STATE',
            'Pick up the submission for review first.',
          ),
        );
      if (body.data.version !== instrument.version)
        return next(
          createError(
            409,
            'VERSION_CONFLICT',
            'Refresh the record before recording a review.',
          ),
        );
      if (
        config.DEMO_MODE &&
        body.data.independentVerificationStatus ===
          'CONFIRMED_BY_AUTHORIZED_SOURCE'
      ) {
        return next(
          createError(
            422,
            'DEMO_EVIDENCE_ONLY',
            'Use Demo simulated for synthetic evidence. No live bank verification is integrated.',
          ),
        );
      }
      if (
        !config.DEMO_MODE &&
        body.data.independentVerificationStatus === 'DEMO_SIMULATED'
      ) {
        return next(
          createError(
            422,
            'DEMO_DISABLED',
            'Simulated evidence is disabled outside demo mode.',
          ),
        );
      }

      const verification = await prisma.$transaction(async (tx) => {
        await tx.instrument.update({
          where: {
            id,
            version: body.data.version,
            lifecycleStatus: 'UNDER_REVIEW',
          },
          data: { version: { increment: 1 } },
        });
        const v = await tx.verification.create({
          data: {
            instrumentId: id,
            documentReviewStatus: body.data.documentReviewStatus as any,
            independentVerificationStatus: body.data
              .independentVerificationStatus as any,
            sourceType: body.data.sourceType,
            sourceName: body.data.sourceName,
            referenceNumber: body.data.referenceNumber,
            result: body.data.result,
            notes: body.data.notes,
            verifiedById: authReq.user.id,
            verifiedAt: new Date(),
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'VERIFICATION_RECORDED',
          entityType: 'Verification',
          entityId: v.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            instrumentId: id,
            documentReviewStatus: body.data.documentReviewStatus,
            independentVerificationStatus:
              body.data.independentVerificationStatus,
            sourceName: body.data.sourceName,
            referenceNumber: body.data.referenceNumber,
          },
        });
        return v;
      });

      res.status(201).json(verification);
    } catch (err) {
      next(err);
    }
  },
);

// GET /verification/queue — SO/AA see verification queue
verificationRouter.get(
  '/queue',
  requireRole(Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(
        parseInt(req.query.pageSize as string) || 20,
        100,
      );
      const skip = (page - 1) * pageSize;

      const scopes = await prisma.staffInstitutionScope.findMany({
        where: { userId: authReq.user.id },
        select: { institutionId: true },
      });

      const where = {
        institutionId: { in: scopes.map((s) => s.institutionId) },
        lifecycleStatus: {
          in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] as any[],
        },
      };

      const [total, instruments] = await Promise.all([
        prisma.instrument.count({ where }),
        prisma.instrument.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { submittedAt: 'asc' },
          include: {
            institution: { select: { id: true, name: true } },
            submittedBy: { select: { id: true, name: true } },
            _count: { select: { documents: true, discrepancies: true } },
          },
        }),
      ]);

      res.json(paginate(instruments, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  },
);

// GET /verification/instruments/:id — get all verifications for an instrument
verificationRouter.get(
  '/instruments/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const instrument = await prisma.instrument.findUnique({
        where: { id },
        select: { institutionId: true },
      });
      if (!instrument)
        return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      const verifications = await prisma.verification.findMany({
        where: { instrumentId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          verifiedBy: { select: { id: true, name: true, role: true } },
        },
      });

      res.json(verifications);
    } catch (err) {
      next(err);
    }
  },
);
