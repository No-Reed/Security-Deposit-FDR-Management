import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestId, csrfProtect, loadUser } from './middleware/auth';

// Routes
import { authRouter } from './modules/auth/auth.router';
import { institutionsRouter } from './modules/institutions/institutions.router';
import { instrumentsRouter } from './modules/instruments/instruments.router';
import { documentsRouter } from './modules/documents/documents.router';
import { verificationRouter } from './modules/verification/verification.router';
import { discrepanciesRouter } from './modules/discrepancies/discrepancies.router';
import { releaseRequestsRouter } from './modules/release-requests/release-requests.router';
import { dashboardRouter } from './modules/dashboard/dashboard.router';
import { reportsRouter } from './modules/reports/reports.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { auditRouter } from './modules/audit/audit.router';
import { adminRouter } from './modules/admin/admin.router';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  // Trust proxy in production
  if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS
  app.use(
    cors({
      origin: config.APP_BASE_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-csrf-token', 'x-request-id'],
    })
  );

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request ID
  app.use(requestId);

  // Session
  app.use(
    session({
      store: new PgSession({
        conString: config.DATABASE_URL,
        tableName: 'Session',
        createTableIfMissing: false, // We manage this via Prisma
      }),
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: 'dd.sid',
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      },
    })
  );

  // Global rate limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } },
  });
  app.use(globalLimiter);

  // Load user from session on every request
  app.use(loadUser as express.RequestHandler);

  // CSRF protection on all state-changing routes
  app.use('/api/v1', csrfProtect as express.RequestHandler);

  // Request logging
  app.use((req, _res, next) => {
    logger.info(
      { method: req.method, url: req.url, requestId: req.headers['x-request-id'] },
      'Incoming request'
    );
    next();
  });

  // API routes
  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/institutions', institutionsRouter);
  api.use('/instruments', instrumentsRouter);
  api.use('/documents', documentsRouter);
  api.use('/verification', verificationRouter);
  api.use('/discrepancies', discrepanciesRouter);
  api.use('/release-requests', releaseRequestsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/reports', reportsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/audit-events', auditRouter);
  api.use('/admin', adminRouter);

  // Health check (no auth)
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', demo: config.DEMO_MODE, timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', api);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Centralized error handler
  app.use(errorHandler as express.ErrorRequestHandler);

  return app;
}
