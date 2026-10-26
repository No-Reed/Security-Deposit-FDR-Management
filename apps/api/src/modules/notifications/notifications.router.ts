import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth as any);

// GET /notifications
notificationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const skip = (page - 1) * pageSize;
    const unreadOnly = req.query.unread === 'true';

    const where: any = {
      recipientUserId: authReq.user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const unreadCount = await prisma.notification.count({
      where: { recipientUserId: authReq.user.id, readAt: null },
    });

    res.json({ data: notifications, total, page, pageSize, totalPages: Math.ceil(total / pageSize), unreadCount });
  } catch (err) {
    next(err);
  }
});

// POST /notifications/:id/read
notificationsRouter.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Notification not found' });
    if (notification.recipientUserId !== authReq.user.id) {
      return next({ statusCode: 403, code: 'FORBIDDEN', message: 'Cannot mark another user\'s notification as read' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /notifications/read-all
notificationsRouter.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await prisma.notification.updateMany({
      where: { recipientUserId: authReq.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
