import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@depositdesk/shared';
import { CreateInstitutionSchema, UpdateInstitutionSchema, PaginationSchema } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { requireAuth, requireRole, AuthenticatedRequest, requireInstitutionAccess } from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { paginate } from '../../lib/domain';

export const institutionsRouter = Router();

// All institution routes require auth
institutionsRouter.use(requireAuth as any);

// GET /institutions
institutionsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, pageSize } = PaginationSchema.parse(req.query);
    const skip = (page - 1) * pageSize;

    const { role, institutionId } = authReq.user;

    // IU can only see their own institution
    let where: any = {};
    if (role === Role.INSTITUTION_USER) {
      if (!institutionId) return res.json(paginate([], 0, page, pageSize));
      where = { id: institutionId };
    } else if (role === Role.SCRUTINY_OFFICER || role === Role.APPROVING_AUTHORITY) {
      // Only institutions in scope
      const scopes = await prisma.staffInstitutionScope.findMany({
        where: { userId: authReq.user.id },
        select: { institutionId: true },
      });
      where = { id: { in: scopes.map(s => s.institutionId) } };
    }

    const search = req.query.search as string | undefined;
    if (search) {
      where = { ...where, OR: [{ name: { contains: search, mode: 'insensitive' } }, { aicteId: { contains: search, mode: 'insensitive' } }] };
    }

    const [total, institutions] = await Promise.all([
      prisma.institution.count({ where }),
      prisma.institution.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          aicteId: true,
          name: true,
          institutionType: true,
          address: true,
          state: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { instruments: true, users: true } },
        },
      }),
    ]);

    res.json(paginate(institutions, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// POST /institutions — SO or SA
institutionsRouter.post(
  '/',
  requireRole(Role.SCRUTINY_OFFICER, Role.SYSTEM_ADMIN) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = CreateInstitutionSchema.safeParse(req.body);
      if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

      const institution = await prisma.$transaction(async (tx) => {
        const created = await tx.institution.create({ data: body.data });
        if (authReq.user.role === Role.SCRUTINY_OFFICER) await tx.staffInstitutionScope.create({ data: { userId: authReq.user.id, institutionId: created.id } });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTITUTION_CREATED',
          entityType: 'Institution',
          entityId: created.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: body.data as any,
        });
        return created;
      });

      res.status(201).json(institution);
    } catch (err) {
      next(err);
    }
  }
);

// GET /institutions/:id
institutionsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { role, institutionId } = authReq.user;

    // IU can only see own institution
    if (role === Role.INSTITUTION_USER && institutionId !== id) {
      return next(createError(403, 'FORBIDDEN', 'Access denied'));
    }

    // Check scope for officers
    if (role === Role.SCRUTINY_OFFICER || role === Role.APPROVING_AUTHORITY) {
      const scope = await prisma.staffInstitutionScope.findUnique({
        where: { userId_institutionId: { userId: authReq.user.id, institutionId: id } },
      });
      if (!scope) return next(createError(403, 'FORBIDDEN', 'Institution not in scope'));
    }

    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        _count: { select: { instruments: true, users: true } },
      },
    });

    if (!institution) return next(createError(404, 'NOT_FOUND', 'Institution not found'));
    res.json(institution);
  } catch (err) {
    next(err);
  }
});

// PATCH /institutions/:id
institutionsRouter.patch(
  '/:id',
  requireRole(Role.SCRUTINY_OFFICER, Role.SYSTEM_ADMIN) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = UpdateInstitutionSchema.safeParse(req.body);
      if (!body.success) return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));

      const existing = await prisma.institution.findUnique({ where: { id } });
      if (!existing) return next(createError(404, 'NOT_FOUND', 'Institution not found'));

      await requireInstitutionAccess(id, req);
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.institution.update({ where: { id }, data: body.data });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'INSTITUTION_UPDATED',
          entityType: 'Institution',
          entityId: id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: body.data as any,
        });
        return u;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);
