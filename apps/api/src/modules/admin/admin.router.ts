import { Router, Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { validateSetting } from '../../lib/settings';
import { Role } from '@depositdesk/shared';
import {
  PaginationSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UpdateSystemSettingSchema,
  ChecklistItemSchema,
} from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import {
  requireAuth,
  requireRole,
  AuthenticatedRequest,
} from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { paginate } from '../../lib/domain';
import { runMaturityCheck } from '../../jobs/maturityCheck';

export const adminRouter = Router();
adminRouter.use(requireAuth as any);

// ─── User management (SA only) ────────────────────────────────────────────────
async function validateUserMapping(
  role: string,
  institutionId?: string | null,
) {
  if (role === 'INSTITUTION_USER') {
    if (
      !institutionId ||
      !(await prisma.institution.findUnique({ where: { id: institutionId } }))
        ?.isActive
    )
      throw createError(
        422,
        'INSTITUTION_REQUIRED',
        'An institution user needs an active institution.',
      );
  } else if (institutionId)
    throw createError(
      422,
      'INVALID_MAPPING',
      'Staff accounts use scope mappings instead of an institution-user mapping.',
    );
}
const saOnly = requireRole(Role.SYSTEM_ADMIN) as any;

// GET /admin/users
adminRouter.get(
  '/users',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = PaginationSchema.parse(req.query);
      const skip = (page - 1) * pageSize;

      const [total, users] = await Promise.all([
        prisma.user.count(),
        prisma.user.findMany({
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            institutionId: true,
            institution: { select: { name: true } },
            createdAt: true,
            lastLoginAt: true,
          },
        }),
      ]);

      res.json(paginate(users, total, page, pageSize));
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/users
adminRouter.post(
  '/users',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = CreateUserSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      // Generate temp password
      await validateUserMapping(body.data.role, body.data.institutionId);
      const tempPassword = randomBytes(18).toString('base64url') + 'A1!';
      const passwordHash = await argon2.hash(tempPassword, {
        type: argon2.argon2id,
      });

      const user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            name: body.data.name,
            email: body.data.email,
            passwordHash,
            role: body.data.role as any,
            institutionId: body.data.institutionId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            institutionId: true,
            createdAt: true,
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: u.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            name: body.data.name,
            email: body.data.email,
            role: body.data.role,
          },
        });
        return u;
      });

      // Return temp password ONCE (never stored in plaintext)
      res.status(201).json({ ...user, temporaryPassword: tempPassword });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/users/:id
adminRouter.patch(
  '/users/:id',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const body = UpdateUserSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const current = await prisma.user.findUnique({ where: { id } });
      if (!current)
        return next(createError(404, 'NOT_FOUND', 'User not found.'));
      if (
        id === authReq.user.id &&
        (body.data.isActive === false ||
          (body.data.role && body.data.role !== 'SYSTEM_ADMIN'))
      )
        return next(
          createError(
            422,
            'SELF_LOCKOUT',
            'You cannot disable or demote your own administrator account.',
          ),
        );
      await validateUserMapping(
        body.data.role || current.role,
        body.data.institutionId === undefined
          ? current.institutionId
          : body.data.institutionId,
      );
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id },
          data: {
            name: body.data.name,
            email: body.data.email,
            role: body.data.role as any,
            institutionId: body.data.institutionId,
            isActive: body.data.isActive,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            institutionId: true,
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'USER_UPDATED',
          entityType: 'User',
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
  },
);

// GET/PATCH /admin/institution-scope — manage staff scopes
adminRouter.get(
  '/institution-scope/:userId',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scopes = await prisma.staffInstitutionScope.findMany({
        where: { userId: req.params.userId },
        include: { institution: { select: { id: true, name: true } } },
      });
      res.json(scopes);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  '/institution-scope',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { userId, institutionId } = req.body;
      if (!userId || !institutionId)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'userId and institutionId required',
          ),
        );

      const staff = await prisma.user.findUnique({ where: { id: userId } });
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
      });
      if (
        !staff ||
        !['SCRUTINY_OFFICER', 'APPROVING_AUTHORITY'].includes(staff.role) ||
        !institution
      )
        return next(
          createError(
            422,
            'INVALID_SCOPE',
            'Choose an officer/authority and an existing institution.',
          ),
        );
      const scope = await prisma.$transaction(async (tx) => {
        const s = await tx.staffInstitutionScope.upsert({
          where: { userId_institutionId: { userId, institutionId } },
          create: { userId, institutionId },
          update: {},
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'SCOPE_ASSIGNED',
          entityType: 'StaffInstitutionScope',
          requestId: req.headers['x-request-id'] as string,
          changedFields: { userId, institutionId },
        });
        return s;
      });
      res.status(201).json(scope);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.delete(
  '/institution-scope/:userId/:institutionId',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      await prisma.$transaction(async (tx) => {
        await tx.staffInstitutionScope.delete({
          where: {
            userId_institutionId: {
              userId: req.params.userId,
              institutionId: req.params.institutionId,
            },
          },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'SCOPE_REMOVED',
          entityType: 'StaffInstitutionScope',
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            userId: req.params.userId,
            institutionId: req.params.institutionId,
          },
        });
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// GET/PATCH settings
adminRouter.get(
  '/settings',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.systemSetting.findMany({
        orderBy: { key: 'asc' },
      });
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  '/settings',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = UpdateSystemSettingSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      body.data.value = validateSetting(body.data.key, body.data.value);
      const setting = await prisma.$transaction(async (tx) => {
        const s = await tx.systemSetting.upsert({
          where: { key: body.data.key },
          create: { key: body.data.key, value: body.data.value },
          update: { value: body.data.value },
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'SETTING_UPDATED',
          entityType: 'SystemSetting',
          requestId: req.headers['x-request-id'] as string,
          changedFields: { key: body.data.key, value: body.data.value },
        });
        return s;
      });
      res.json(setting);
    } catch (err) {
      next(err);
    }
  },
);

// GET/POST/PATCH release checklist config
adminRouter.get(
  '/release-checklist',
  requireRole(
    Role.SYSTEM_ADMIN,
    Role.SCRUTINY_OFFICER,
    Role.APPROVING_AUTHORITY,
  ) as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await prisma.releaseChecklistItem.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  '/release-checklist',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = ChecklistItemSchema.safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const item = await prisma.$transaction(async (tx) => {
        const i = await tx.releaseChecklistItem.create({ data: body.data });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'CHECKLIST_ITEM_CREATED',
          entityType: 'ReleaseChecklistItem',
          entityId: i.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: body.data as any,
        });
        return i;
      });
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  '/release-checklist/:id',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = ChecklistItemSchema.partial().safeParse(req.body);
      if (!body.success)
        return next(
          createError(
            422,
            'VALIDATION_ERROR',
            'Invalid input',
            body.error.errors,
          ),
        );

      const updated = await prisma.$transaction(async (tx) => {
        const i = await tx.releaseChecklistItem.update({
          where: { id: req.params.id },
          data: body.data,
        });
        await writeAuditEvent(tx, {
          actorUserId: authReq.user.id,
          actorRole: authReq.user.role,
          action: 'CHECKLIST_ITEM_UPDATED',
          entityType: 'ReleaseChecklistItem',
          entityId: req.params.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: body.data as any,
        });
        return i;
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/maturity-check — run on demand
adminRouter.post(
  '/maturity-check',
  saOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await runMaturityCheck();
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);
