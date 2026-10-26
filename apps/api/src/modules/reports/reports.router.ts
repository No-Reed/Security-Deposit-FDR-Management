import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { sanitizeCsvCell } from '../../lib/domain';
import { deriveDateStatus } from '../../lib/dates';
import { config, MATURITY_ALERT_DAYS } from '../../config/env';

export const reportsRouter = Router();
reportsRouter.use(requireAuth as any);

async function getScopedWhere(authReq: AuthenticatedRequest) {
  const { role, institutionId } = authReq.user;
  if (role === Role.INSTITUTION_USER) {
    return institutionId ? { institutionId } : null;
  }
  if (role === Role.SCRUTINY_OFFICER || role === Role.APPROVING_AUTHORITY) {
    const scopes = await prisma.staffInstitutionScope.findMany({
      where: { userId: authReq.user.id },
      select: { institutionId: true },
    });
    return { institutionId: { in: scopes.map((s: any) => s.institutionId) } };
  }
  return {}; // SA sees all
}

// GET /reports/instruments.csv
reportsRouter.get('/instruments.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const where = await getScopedWhere(authReq);
    if (where === null) {
      return res.status(200).send('');
    }

    const instruments = await prisma.instrument.findMany({
      where,
      include: { institution: { select: { name: true, aicteId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const maxAlertDays = MATURITY_ALERT_DAYS[0] || 90;
    const headers = [
      'Reference Code', 'Institution', 'AICTE ID', 'Instrument Type',
      'Instrument Number', 'Bank Name', 'Bank Branch', 'Amount (INR)',
      'Issue Date', 'Maturity Date', 'Validity End Date',
      'Lifecycle Status', 'Date Status', 'Days Remaining', 'Submitted At',
    ];

    const rows = instruments.map(inst => {
      const derived = deriveDateStatus(inst.maturityDate, inst.validityEndDate, maxAlertDays, config.APP_TIMEZONE);
      return [
        inst.referenceCode,
        inst.institution.name,
        inst.institution.aicteId || '',
        inst.instrumentType,
        inst.instrumentNumber,
        inst.bankName,
        inst.bankBranch,
        inst.amount.toString(),
        inst.issueDate.toISOString().split('T')[0],
        inst.maturityDate.toISOString().split('T')[0],
        inst.validityEndDate ? inst.validityEndDate.toISOString().split('T')[0] : '',
        inst.lifecycleStatus,
        derived.dateStatus,
        derived.daysRemaining?.toString() || '',
        inst.submittedAt ? inst.submittedAt.toISOString() : '',
      ].map(sanitizeCsvCell);
    });

    // Write audit event
    await prisma.$transaction(async (tx) => {
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'REPORT_EXPORTED',
        entityType: 'Report',
        requestId: req.headers['x-request-id'] as string,
        metadata: { report: 'instruments', count: instruments.length },
      });
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="instruments-export.csv"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /reports/pending-actions.csv
reportsRouter.get('/pending-actions.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const where = await getScopedWhere(authReq);
    if (where === null) return res.status(200).send('');

    const instruments = await prisma.instrument.findMany({
      where: { ...where, lifecycleStatus: { in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED'] as any[] } },
      include: { institution: { select: { name: true } } },
    });

    const headers = ['Reference Code', 'Institution', 'Lifecycle Status', 'Submitted At', 'Instrument Number', 'Bank Name', 'Amount (INR)'];
    const rows = instruments.map(inst => [
      inst.referenceCode,
      inst.institution.name,
      inst.lifecycleStatus,
      inst.submittedAt?.toISOString() || '',
      inst.instrumentNumber,
      inst.bankName,
      inst.amount.toString(),
    ].map(sanitizeCsvCell));

    await prisma.$transaction(async (tx) => {
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'REPORT_EXPORTED',
        entityType: 'Report',
        requestId: req.headers['x-request-id'] as string,
        metadata: { report: 'pending-actions', count: instruments.length },
      });
    });

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pending-actions.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
