import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';

export async function institutionScope(
  req: AuthenticatedRequest,
): Promise<string[] | null> {
  if (req.user.role === 'SYSTEM_ADMIN') return null;
  if (req.user.role === 'INSTITUTION_USER')
    return req.user.institutionId ? [req.user.institutionId] : [];
  return (
    await prisma.staffInstitutionScope.findMany({
      where: { userId: req.user.id },
      select: { institutionId: true },
    })
  ).map((item) => item.institutionId);
}
export async function scopedAuditWhere(
  req: AuthenticatedRequest,
): Promise<any> {
  const ids = await institutionScope(req);
  if (ids === null) return {};
  const instruments = await prisma.instrument.findMany({
    where: { institutionId: { in: ids } },
    select: { id: true },
  });
  const instrumentIds = instruments.map((item) => item.id);
  const [releases, docs, verifications, discrepancies] = await Promise.all([
    prisma.releaseRequest.findMany({
      where: { institutionId: { in: ids } },
      select: { id: true },
    }),
    prisma.document.findMany({
      where: {
        OR: [
          { instrument: { institutionId: { in: ids } } },
          { releaseRequest: { institutionId: { in: ids } } },
        ],
      },
      select: { id: true },
    }),
    prisma.verification.findMany({
      where: { instrumentId: { in: instrumentIds } },
      select: { id: true },
    }),
    prisma.discrepancy.findMany({
      where: { instrumentId: { in: instrumentIds } },
      select: { id: true },
    }),
  ]);
  return {
    OR: [
      { entityType: 'Institution', entityId: { in: ids } },
      ...[
        ['Instrument', instruments],
        ['ReleaseRequest', releases],
        ['Document', docs],
        ['Verification', verifications],
        ['Discrepancy', discrepancies],
      ].map(([entityType, records]) => ({
        entityType,
        entityId: {
          in: (records as Array<{ id: string }>).map((item) => item.id),
        },
      })),
      { entityType: 'Report', actorUserId: req.user.id },
      {
        entityType: 'User',
        entityId: req.user.id,
        action: { startsWith: 'AUTH_' },
      },
    ],
  };
}
