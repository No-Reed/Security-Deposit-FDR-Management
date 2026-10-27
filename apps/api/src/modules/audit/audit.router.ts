import { Router, Request, Response, NextFunction } from 'express';
import { Role, PaginationSchema } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { scopedAuditWhere } from '../../lib/scope';
import { paginate } from '../../lib/domain';

export const auditRouter = Router();
auditRouter.use(requireAuth as any);
auditRouter.use(requireRole(Role.SCRUTINY_OFFICER, Role.APPROVING_AUTHORITY, Role.SYSTEM_ADMIN) as any);

// GET /audit-events
auditRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, pageSize } = PaginationSchema.parse(req.query);
    const skip = (page-1)*pageSize;
    const scope = await scopedAuditWhere(authReq);
    const where: any = { AND: [scope] };
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.entityId) where.entityId = req.query.entityId;
    if (req.query.actorUserId) where.actorUserId = req.query.actorUserId;
    if (req.query.action) where.action = { contains: req.query.action as string, mode: 'insensitive' };

    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { timestamp: 'desc' },
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
    ]);

    res.json(paginate(events, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});
