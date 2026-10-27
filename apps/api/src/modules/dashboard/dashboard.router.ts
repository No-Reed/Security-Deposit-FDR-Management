import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { instrumentRecords } from '../../lib/queries';
import { scopedAuditWhere } from '../../lib/scope';
import { operationalSettings } from '../../lib/settings';
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth as any);
dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const actor = req as AuthenticatedRequest;
    const [records, where, settings] = await Promise.all([
      instrumentRecords(actor),
      scopedAuditWhere(actor),
      operationalSettings(),
    ]);
    const current = records.filter(
      (record) =>
        !['REJECTED', 'CLOSED'].includes(record.lifecycleStatus) &&
        record.releaseStatus !== 'COMPLETED' &&
        record.renewalStatus !== 'COMPLETED',
    );
    const count = (status: string) =>
      current.filter((record) => record.dateStatus === status).length;
    const distribution: Record<string, number> = {};
    for (const record of records)
      distribution[record.lifecycleStatus] =
        (distribution[record.lifecycleStatus] || 0) + 1;
    const recentActivity = await prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 8,
      include: { actor: { select: { name: true } } },
    });
    res.json({
      totalInstruments: records.length,
      totalValue: records
        .reduce((sum, record) => sum.plus(record.amount), new Prisma.Decimal(0))
        .toFixed(2),
      activeCount: count('ACTIVE'),
      expiringSoonCount: count('EXPIRING_SOON'),
      maturedCount: count('MATURED'),
      expiredCount: count('EXPIRED'),
      pendingVerificationCount: records.filter((record) =>
        ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(
          record.lifecycleStatus,
        ),
      ).length,
      discrepancyCount: records.reduce(
        (sum, record) => sum + record.openDiscrepanciesCount,
        0,
      ),
      renewalPendingCount: current.filter((record) =>
        ['REQUIRED', 'IN_PROGRESS'].includes(record.renewalStatus),
      ).length,
      openReleaseRequestsCount: records.filter((record) =>
        ['OPEN', 'APPROVED'].includes(record.releaseStatus),
      ).length,
      quality: {
        recordsWithEvidence: records.filter((item) => item.documentsCount > 0)
          .length,
        missingEvidence: records.filter(
          (item) =>
            item.lifecycleStatus !== 'DRAFT' && item.documentsCount === 0,
        ).length,
        unresolvedCases: current.filter(
          (item) =>
            item.openDiscrepanciesCount > 0 ||
            ['REQUIRED', 'IN_PROGRESS'].includes(item.renewalStatus) ||
            ['OPEN', 'APPROVED'].includes(item.releaseStatus),
        ).length,
        reviewIntervalsHours: records
          .filter(
            (item) =>
              item.lifecycleStatus === 'VERIFIED' &&
              item.verificationRecords?.[0]?.verifiedAt &&
              item.submittedAt,
          )
          .map((item) =>
            Math.max(
              0,
              (new Date(item.verificationRecords[0].verifiedAt).getTime() -
                new Date(item.submittedAt).getTime()) /
                3600000,
            ),
          ),
      },
      distribution,
      recentActivity,
      thresholds: settings.thresholds,
    });
  } catch (error) {
    next(error);
  }
});
dashboardRouter.get('/upcoming-maturities', async (req, res, next) => {
  try {
    const records = await instrumentRecords(req as AuthenticatedRequest, {
      sortBy: 'maturityDate',
      sortOrder: 'asc',
    });
    const settings = await operationalSettings();
    const thresholds = [...settings.thresholds].sort((a, b) => a - b);
    const buckets: Record<string, any[]> = {};
    let start = 0;
    for (const end of thresholds) {
      buckets[`${start}-${end}`] = [];
      start = end + 1;
    }
    buckets.matured = [];
    buckets.expired = [];
    for (const record of records.filter(
      (item) =>
        !['DRAFT', 'REJECTED', 'CLOSED'].includes(item.lifecycleStatus) &&
        item.releaseStatus !== 'COMPLETED' &&
        item.renewalStatus !== 'COMPLETED',
    )) {
      if (record.dateStatus === 'MATURED') buckets.matured.push(record);
      else if (record.dateStatus === 'EXPIRED') buckets.expired.push(record);
      else {
        let from = 0;
        for (const end of thresholds) {
          if (record.daysRemaining <= end) {
            buckets[`${from}-${end}`].push(record);
            break;
          }
          from = end + 1;
        }
      }
    }
    res.json({
      buckets,
      totals: Object.fromEntries(
        Object.entries(buckets).map(([key, rows]) => [key, rows.length]),
      ),
    });
  } catch (error) {
    next(error);
  }
});
