import { Router, Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';
import { LoginSchema, ChangePasswordSchema } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { createError } from '../../middleware/errorHandler';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
});

// A real Argon2 hash keeps unknown-user checks on the normal verification path.
const dummyHash = argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// POST /auth/login
authRouter.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));
    }

    const { email, password } = body.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always hash to prevent timing attacks

    if (!user || !user.isActive) {
      await argon2.verify(await dummyHash, password);
      await prisma.auditEvent.create({ data: {
        action: 'AUTH_LOGIN_FAILURE', entityType: 'User',
        requestId: req.headers['x-request-id'] as string,
        metadata: { reason: 'invalid_credentials' },
      } });
      return next(createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logger.warn({ userId: user.id }, 'Login attempt on locked account');
      return next(createError(429, 'ACCOUNT_LOCKED', 'Account is temporarily locked. Try again later.'));
    }

    const valid = await argon2.verify(user.passwordHash, password);

    if (!valid) {
      await prisma.$transaction(async (tx) => {
        const failed = await tx.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
        });
        if (failed.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
          await tx.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } });
        }
        await writeAuditEvent(tx, {
          actorUserId: user.id, actorRole: user.role, action: 'AUTH_LOGIN_FAILURE',
          entityType: 'User', entityId: user.id,
          requestId: req.headers['x-request-id'] as string,
          metadata: { reason: 'invalid_password', failedCount: failed.failedLoginCount },
        });
      });

      return next(createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    const csrfToken = randomBytes(32).toString('hex');
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      await writeAuditEvent(tx, {
        actorUserId: user.id, actorRole: user.role, action: 'AUTH_LOGIN_SUCCESS',
        entityType: 'User', entityId: user.id,
        requestId: req.headers['x-request-id'] as string,
      });
    });
    req.session.userId = user.id;
    req.session.role = user.role as any;
    req.session.institutionId = user.institutionId;
    req.session.csrfToken = csrfToken;
    // Respond only once the Postgres store has persisted the session.
    await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, institutionId: user.institutionId },
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
authRouter.post('/logout', requireAuth as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId;
    const role = req.session.role;
    await new Promise<void>((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie('dd.sid', { httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production', path: '/' });
    await prisma.auditEvent.create({
      data: { actorUserId: userId, actorRole: role, action: 'AUTH_LOGOUT', entityType: 'User', entityId: userId,
        requestId: req.headers['x-request-id'] as string },
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// GET /auth/me
authRouter.get('/me', requireAuth as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        institutionId: true,
        isActive: true,
        lastLoginAt: true,
        institution: {
          select: { id: true, name: true, aicteId: true },
        },
      },
    });

    if (!user) return next(createError(401, 'UNAUTHORIZED', 'User not found'));

    const csrfToken = req.session.csrfToken;
    if (!csrfToken) {
      // Re-generate CSRF if missing
      req.session.csrfToken = randomBytes(32).toString('hex');
    }

    res.json({ user, csrfToken: req.session.csrfToken });
  } catch (err) {
    next(err);
  }
});

// POST /auth/change-password
authRouter.post('/change-password', requireAuth as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = ChangePasswordSchema.safeParse(req.body);
    if (!body.success) {
      return next(createError(422, 'VALIDATION_ERROR', 'Invalid input', body.error.errors));
    }

    const { currentPassword, newPassword } = body.data;
    const user = await prisma.user.findUnique({ where: { id: authReq.user.id } });
    if (!user) return next(createError(401, 'UNAUTHORIZED', 'User not found'));

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) return next(createError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect'));

    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
      await writeAuditEvent(tx, {
        actorUserId: user.id,
        actorRole: user.role,
        action: 'AUTH_PASSWORD_CHANGED',
        entityType: 'User',
        entityId: user.id,
        requestId: req.headers['x-request-id'] as string,
      });
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
