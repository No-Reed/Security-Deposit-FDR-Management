import { PrismaClient } from '@prisma/client';
import { Role } from '@depositdesk/shared';

interface AuditEventData {
  actorUserId?: string | null;
  actorRole?: Role | string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  changedFields?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Write audit event within the same Prisma transaction (tx)
export async function writeAuditEvent(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  data: AuditEventData
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      actorUserId: data.actorUserId ?? null,
      actorRole: data.actorRole ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      requestId: data.requestId ?? null,
      changedFields: (data.changedFields as any) ?? undefined,
      reason: data.reason ?? null,
      metadata: (data.metadata as any) ?? undefined,
    },
  });
}
