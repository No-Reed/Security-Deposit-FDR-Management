import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { InstrumentFiltersSchema } from '@depositdesk/shared';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { instrumentRecords } from '../../lib/queries';
import { institutionScope, scopedAuditWhere } from '../../lib/scope';
import { sanitizeCsvCell } from '../../lib/domain';
import { createError } from '../../middleware/errorHandler';

export const reportsRouter = Router();
reportsRouter.use(requireAuth as any);
const kinds = [
  'instruments',
  'active',
  'maturities',
  'matured',
  'pending-verification',
  'discrepancies',
  'renewals',
  'pending-actions',
  'release-requests',
  'completed-releases',
  'institutions',
  'audit-events',
];
reportsRouter.get('/:kind.csv', async (req, res, next) => {
  try {
    const actor = req as unknown as AuthenticatedRequest;
    const kind = req.params.kind;
    if (!kinds.includes(kind))
      throw createError(404, 'NOT_FOUND', 'Report not found.');
    let headers: string[], rows: unknown[][];
    if (kind === 'audit-events') {
      if (actor.user.role === 'INSTITUTION_USER')
        throw createError(
          403,
          'FORBIDDEN',
          'Audit reports are available to authorized staff.',
        );
      const events = await prisma.auditEvent.findMany({
        where: await scopedAuditWhere(actor),
        orderBy: { timestamp: 'desc' },
        include: { actor: { select: { name: true } } },
      });
      headers = [
        'Timestamp UTC',
        'Actor',
        'Action',
        'Entity type',
        'Entity reference',
        'Reason',
      ];
      rows = events.map((item) => [
        item.timestamp.toISOString(),
        item.actor?.name || 'System',
        item.action,
        item.entityType,
        item.entityId || '',
        item.reason || '',
      ]);
    } else if (['release-requests', 'completed-releases'].includes(kind)) {
      const ids = await institutionScope(actor);
      const records = await prisma.releaseRequest.findMany({
        where: {
          ...(ids === null ? {} : { institutionId: { in: ids } }),
          ...(kind === 'completed-releases' ? { status: 'COMPLETED' } : {}),
        },
        include: {
          institution: { select: { name: true } },
          instrument: { select: { instrumentNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      headers = [
        'Request',
        'Instrument',
        'Institution',
        'Type',
        'Status',
        'Reason',
        'Completion reference',
        'Completion date',
      ];
      rows = records.map((item) => [
        item.referenceCode,
        item.instrument.instrumentNumber,
        item.institution.name,
        item.requestType,
        item.status,
        item.reason,
        item.completionReference || '',
        item.completionDate?.toISOString().slice(0, 10) || '',
      ]);
    } else {
      const filters = InstrumentFiltersSchema.parse(req.query);
      let records = await instrumentRecords(actor, filters);
      if (kind === 'active')
        records = records.filter((item) => item.dateStatus === 'ACTIVE');
      if (kind === 'maturities')
        records = records.filter((item) => item.dateStatus === 'EXPIRING_SOON');
      if (kind === 'matured')
        records = records.filter((item) =>
          ['MATURED', 'EXPIRED'].includes(item.dateStatus),
        );
      if (kind === 'pending-verification')
        records = records.filter((item) =>
          ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(
            item.lifecycleStatus,
          ),
        );
      if (kind === 'discrepancies')
        records = records.filter((item) => item.openDiscrepanciesCount > 0);
      if (kind === 'renewals')
        records = records.filter(
          (item) =>
            ['REQUIRED', 'IN_PROGRESS'].includes(item.renewalStatus) &&
            item.releaseStatus !== 'COMPLETED',
        );
      if (kind === 'pending-actions')
        records = records.filter(
          (item) =>
            item.openDiscrepanciesCount ||
            [
              'SUBMITTED',
              'RESUBMITTED',
              'UNDER_REVIEW',
              'ACTION_REQUIRED',
            ].includes(item.lifecycleStatus) ||
            ['REQUIRED', 'IN_PROGRESS'].includes(item.renewalStatus) ||
            ['OPEN', 'APPROVED'].includes(item.releaseStatus),
        );
      if (kind === 'institutions') {
        const groups = new Map<
          string,
          { name: string; count: number; value: Prisma.Decimal }
        >();
        for (const item of records) {
          const group = groups.get(item.institutionId) || {
            name: item.institutionName,
            count: 0,
            value: new Prisma.Decimal(0),
          };
          group.count++;
          group.value = group.value.plus(item.amount);
          groups.set(item.institutionId, group);
        }
        headers = [
          'Institution',
          'Instrument count',
          'Registered value INR (includes history)',
        ];
        rows = [...groups.values()].map((item) => [
          item.name,
          item.count,
          item.value.toFixed(2),
        ]);
      } else {
        headers = [
          'Reference',
          'Institution',
          'Instrument number',
          'Bank',
          'Branch',
          'Amount INR',
          'Issue date',
          'Maturity date',
          'Validity end',
          'Lifecycle',
          'Date status',
          'Independent verification',
          'Renewal',
          'Release',
          'Open discrepancies',
        ];
        rows = records.map((item) => [
          item.referenceCode,
          item.institutionName,
          item.instrumentNumber,
          item.bankName,
          item.bankBranch,
          item.amount,
          item.issueDate,
          item.maturityDate,
          item.validityEndDate || '',
          item.lifecycleStatus,
          item.dateStatus,
          item.independentVerificationStatus,
          item.renewalStatus,
          item.releaseStatus,
          item.openDiscrepanciesCount,
        ]);
      }
    }
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${sanitizeCsvCell(cell == null ? '' : String(cell)).replace(/"/g, '""')}"`,
          )
          .join(','),
      )
      .join('\r\n');
    await prisma.auditEvent.create({
      data: {
        actorUserId: actor.user.id,
        actorRole: actor.user.role,
        action: 'REPORT_EXPORTED',
        entityType: 'Report',
        metadata: { kind, rowCount: rows.length },
        requestId: req.headers['x-request-id'] as string,
      },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="depositdesk-${kind}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
});
