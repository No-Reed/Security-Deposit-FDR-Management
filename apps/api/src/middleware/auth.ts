import { Request, Response, NextFunction } from 'express';
import { Role } from '@depositdesk/shared';
import { createError } from './errorHandler';
import { prisma } from '../config/prisma';

// Extend Express Request to include session data
declare module 'express-session' {
  interface SessionData {
    userId: string;
    role: Role;
    institutionId: string | null;
    csrfToken: string;
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: Role;
    institutionId: string | null;
    name: string;
    email: string;
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    next(createError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sessionRole = req.session?.userId ? (req as AuthenticatedRequest).user?.role : undefined;
    if (!sessionRole || !roles.includes(sessionRole)) {
      next(createError(403, 'FORBIDDEN', 'Insufficient permissions'));
      return;
    }
    next();
  };
}

// Middleware to load the full user and attach to req.user
export async function loadUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session?.userId) {
    next();
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, role: true, institutionId: true, name: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      next(createError(401, 'UNAUTHORIZED', 'Session invalid'));
      return;
    }

    (req as AuthenticatedRequest).user = {
      id: user.id,
      role: user.role as Role,
      institutionId: user.institutionId,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Verify institution-level access for IU
export async function requireInstitutionAccess(institutionId: string, req: Request): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { role, institutionId: userInstitutionId } = authReq.user;

  if (role === Role.INSTITUTION_USER) {
    if (userInstitutionId !== institutionId) {
      throw createError(403, 'FORBIDDEN', 'Access to this institution is denied');
    }
    return;
  }

  if (role === Role.SCRUTINY_OFFICER || role === Role.APPROVING_AUTHORITY) {
    // Check if officer has scope for this institution
    const scope = await prisma.staffInstitutionScope.findUnique({
      where: { userId_institutionId: { userId: authReq.user.id, institutionId } },
    });
    if (!scope) {
      throw createError(403, 'FORBIDDEN', 'This institution is not in your scope');
    }
    return;
  }

  // SA can see everything (read-only on business records enforced per endpoint)
}

// CSRF protection
export function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }

  // Exempt auth login because session & CSRF token do not exist yet before authentication
  if (req.path === '/login' || req.originalUrl?.includes('/auth/login')) {
    next();
    return;
  }

  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromSession = req.session?.csrfToken;

  if (!tokenFromHeader || !tokenFromSession || tokenFromHeader !== tokenFromSession) {
    next(createError(403, 'CSRF_INVALID', 'CSRF token validation failed'));
    return;
  }
  next();
}

// Add request ID
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}
