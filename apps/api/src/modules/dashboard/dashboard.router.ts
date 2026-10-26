import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { deriveDateStatus } from '../../lib/dates';
import { config, MATURITY_ALERT_DAYS } from '../../config/env';
import { LifecycleStatus } from '@prisma/client';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth as any);

async function getScopedInstitutionIds(authReq: AuthenticatedRequest): Promise<string[] | null> {
  const { role, institutionId } = authReq.user;
  if (role === Role.INSTITUTION_USER) {
    return institutionId ? [institutionId] : [];
  }
  if (role === Role.SCRUTINY_OFFICER || role === Role.APPROVING_AUTHORITY) {
    const scopes = await prisma.staffInstitutionScope.findMany({
      where: { userId: authReq.user.id },
      select: { institutionId: true },
    });
    return scopes.map(s => s.institutionId);
  }
  return null; // SA sees all
}

// GET /dashboard/summary
dashboardRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const institutionIds = await getScopedInstitutionIds(authReq);

    const where = institutionIds ? { institutionId: { in: institutionIds } } : {};

    const [
      totalInstruments,
      activeInstruments,
      awaitingVerification,
      openDiscrepancies,
      renewalPending,
      pendingRelease,
    ] = await Promise.all([
      prisma.instrument.count({ where }),
      prisma.instrument.count({ where: { ...where, lifecycleStatus: LifecycleStatus.VERIFIED } }),
      prisma.instrument.count({ where: { ...where, lifecycleStatus: { in: [LifecycleStatus.SUBMITTED, LifecycleStatus.RESUBMITTED, LifecycleStatus.UNDER_REVIEW] } } }),
      prisma.discrepancy.count({ where: { status: { in: ['OPEN', 'RESPONDED'] }, instrument: where } }),
      prisma.releaseRequest.count({ where: { status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_INFORMATION', 'RESUBMITTED'] }, ...(institutionIds ? { institutionId: { in: institutionIds } } : {}) } }),
      prisma.releaseRequest.count({ where: { status: 'PENDING_AUTHORITY_DECISION', ...(institutionIds ? { institutionId: { in: institutionIds } } : {}) } }),
    ]);

    // Compute date-based counts
    const instruments = await prisma.instrument.findMany({
      where: { ...where, lifecycleStatus: { notIn: [LifecycleStatus.REJECTED, LifecycleStatus.CLOSED] } },
      select: { maturityDate: true, validityEndDate: true },
    });

    const maxAlertDays = MATURITY_ALERT_DAYS[0] || 90;
    let dueWithinWindow = 0;
    let expiredOrMatured = 0;

    for (const inst of instruments) {
      const derived = deriveDateStatus(inst.maturityDate, inst.validityEndDate, maxAlertDays, config.APP_TIMEZONE);
      if (derived.dateStatus === 'EXPIRED' || derived.dateStatus === 'MATURED') expiredOrMatured++;
      if (derived.dateStatus === 'EXPIRING_SOON') dueWithinWindow++;
    }

    // Lifecycle distribution
    const lifecycleGroups = await prisma.instrument.groupBy({
      by: ['lifecycleStatus'],
      where,
      _count: { id: true },
    });

    // Recent activity
    const recentActivity = await prisma.auditEvent.findMany({
      where: institutionIds
        ? {
            OR: [
              { entityType: 'Instrument' },
              { entityType: 'ReleaseRequest' },
              { entityType: 'Document' },
            ],
          }
        : undefined,
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: { actor: { select: { id: true, name: true, role: true } } },
    });

    res.json({
      summary: {
        totalInstruments,
        activeInstruments,
        dueWithinWindow,
        expiredOrMatured,
        awaitingVerification,
        openDiscrepancies,
        renewalPending,
        pendingRelease,
      },
      lifecycleDistribution: lifecycleGroups.map(g => ({
        status: g.lifecycleStatus,
        count: g._count.id,
      })),
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

// GET /dashboard/upcoming-maturities
dashboardRouter.get('/upcoming-maturities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const institutionIds = await getScopedInstitutionIds(authReq);
    const where = institutionIds ? { institutionId: { in: institutionIds } } : {};

    const instruments = await prisma.instrument.findMany({
      where: { ...where, lifecycleStatus: { notIn: [LifecycleStatus.REJECTED, LifecycleStatus.CLOSED] } },
      include: { institution: { select: { id: true, name: true } } },
      orderBy: { maturityDate: 'asc' },
    });

    const maxAlertDays = MATURITY_ALERT_DAYS[0] || 90;
    const buckets: Record<string, any[]> = {
      '0-7': [],
      '8-30': [],
      '31-60': [],
      '61-90': [],
      'beyond': [],
      'matured': [],
      'expired': [],
    };

    for (const inst of instruments) {
      const derived = deriveDateStatus(inst.maturityDate, inst.validityEndDate, maxAlertDays, config.APP_TIMEZONE);
      const item = {
        id: inst.id,
        referenceCode: inst.referenceCode,
        institution: inst.institution,
        bankName: inst.bankName,
        instrumentNumber: inst.instrumentNumber,
        amount: inst.amount.toString(),
        maturityDate: inst.maturityDate,
        validityEndDate: inst.validityEndDate,
        dateStatus: derived.dateStatus,
        daysRemaining: derived.daysRemaining,
        lifecycleStatus: inst.lifecycleStatus,
      };

      if (derived.dateStatus === 'EXPIRED') buckets.expired.push(item);
      else if (derived.dateStatus === 'MATURED') buckets.matured.push(item);
      else if (derived.daysRemaining !== null) {
        if (derived.daysRemaining <= 7) buckets['0-7'].push(item);
        else if (derived.daysRemaining <= 30) buckets['8-30'].push(item);
        else if (derived.daysRemaining <= 60) buckets['31-60'].push(item);
        else if (derived.daysRemaining <= 90) buckets['61-90'].push(item);
        else buckets.beyond.push(item);
      }
    }

    res.json({ buckets, totals: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])) });
  } catch (err) {
    next(err);
  }
});
