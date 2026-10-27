import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { institutionScope } from './scope';
import { instrumentView } from './instruments';
import { operationalSettings } from './settings';

export async function instrumentRecords(
  req: AuthenticatedRequest,
  filters: any = {},
) {
  const ids = await institutionScope(req);
  const where: any = ids === null ? {} : { institutionId: { in: ids } };
  const and: any[] = [];
  if (filters.institutionId) and.push({ institutionId: filters.institutionId });
  if (filters.queue === 'true')
    and.push({
      lifecycleStatus: {
        in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED'],
      },
    });
  if (filters.lifecycleStatus)
    and.push({ lifecycleStatus: filters.lifecycleStatus });
  if (filters.instrumentType) where.instrumentType = filters.instrumentType;
  if (filters.bankName)
    where.bankName = { contains: filters.bankName, mode: 'insensitive' };
  if (filters.search)
    and.push({
      OR: ['referenceCode', 'instrumentNumber', 'bankName']
        .map((key) => ({
          [key]: { contains: filters.search, mode: 'insensitive' },
        }))
        .concat([
          {
            institution: {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { aicteId: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
          },
        ] as any),
    });
  for (const field of ['issueDate', 'maturityDate']) {
    if (filters[field + 'From'])
      where[field] = {
        ...(where[field] || {}),
        gte: new Date(filters[field + 'From']),
      };
    if (filters[field + 'To'])
      where[field] = {
        ...(where[field] || {}),
        lte: new Date(filters[field + 'To']),
      };
  }
  if (filters.discrepancyStatus)
    where.discrepancies = { some: { status: filters.discrepancyStatus } };
  if (and.length) where.AND = and;
  const [records, settings] = await Promise.all([
    prisma.instrument.findMany({
      where,
      orderBy: [
        { [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' },
        { id: 'asc' },
      ],
      include: {
        institution: { select: { id: true, name: true, aicteId: true } },
        predecessor: {
          select: {
            id: true,
            instrumentNumber: true,
            maturityDate: true,
            amount: true,
          },
        },
        successor: {
          select: {
            id: true,
            instrumentNumber: true,
            maturityDate: true,
            amount: true,
            lifecycleStatus: true,
          },
        },
        releaseRequests: { select: { status: true } },
        verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: {
            documents: true,
            discrepancies: { where: { status: { in: ['OPEN', 'RESPONDED'] } } },
          },
        },
      },
    }),
    operationalSettings(),
  ]);
  return records
    .map((record) => instrumentView(record, settings))
    .filter(
      (record) =>
        (filters.monitoring !== 'true' ||
          (!['REJECTED', 'CLOSED'].includes(record.lifecycleStatus) &&
            record.releaseStatus !== 'COMPLETED' &&
            record.renewalStatus !== 'COMPLETED')) &&
        (filters.overdue !== 'true' ||
          ['MATURED', 'EXPIRED'].includes(record.dateStatus)) &&
        (filters.awaitingVerification !== 'true' ||
          ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(
            record.lifecycleStatus,
          )) &&
        (!filters.renewals ||
          (record.renewalStatus !== 'NONE' &&
            record.releaseStatus !== 'COMPLETED' &&
            (filters.renewals !== 'pending' ||
              ['REQUIRED', 'IN_PROGRESS'].includes(record.renewalStatus)))) &&
        (!filters.dateStatus || record.dateStatus === filters.dateStatus) &&
        (!filters.renewalStatus ||
          record.renewalStatus === filters.renewalStatus) &&
        (!filters.verificationStatus ||
          record.independentVerificationStatus ===
            filters.verificationStatus) &&
        (!filters.releaseStatus ||
          record.releaseStatus === filters.releaseStatus) &&
        (filters.daysFrom === undefined ||
          record.daysRemaining >= Number(filters.daysFrom)) &&
        (filters.daysTo === undefined ||
          record.daysRemaining <= Number(filters.daysTo)),
    );
}
