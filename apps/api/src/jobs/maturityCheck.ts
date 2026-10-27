import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { deriveDateStatus, daysUntil } from '../lib/dates';
import { operationalSettings } from '../lib/settings';
import { writeAuditEvent } from '../lib/audit';

export interface EmailAdapter {
  send(
    to: string,
    subject: string,
    message: string,
  ): Promise<{ delivered: boolean }>;
}
// Only in-app delivery is configured. No email-delivery claim is made.
export const emailAdapter: EmailAdapter = {
  async send() {
    return { delivered: false };
  },
};

export async function runMaturityCheck() {
  const settings = await operationalSettings();
  let notificationsCreated = 0,
    escalations = 0;
  const records = await prisma.instrument.findMany({
    where: { lifecycleStatus: { notIn: ['DRAFT', 'REJECTED', 'CLOSED'] } },
    include: {
      institution: {
        include: {
          users: { where: { isActive: true, role: 'INSTITUTION_USER' } },
          staffScopes: { include: { user: true } },
        },
      },
      successor: true,
      releaseRequests: true,
    },
  });
  for (const record of records) {
    if (
      record.releaseRequests.some((item) => item.status === 'COMPLETED') ||
      (record.successor &&
        ['VERIFIED', 'CLOSED'].includes(record.successor.lifecycleStatus))
    )
      continue;
    const derived = deriveDateStatus(
      record.maturityDate,
      record.validityEndDate,
      settings.alertDays,
      settings.timezone,
    );
    const end = derived.effectiveEnd.toISOString().slice(0, 10);
    const staff = record.institution.staffScopes
      .map((item) => item.user)
      .filter((user) => user.isActive);
    const reminderRecipients = [
      ...record.institution.users,
      ...staff.filter((user) => user.role === 'SCRUTINY_OFFICER'),
    ];
    const threshold = settings.thresholds.find(
      (value) => derived.daysRemaining === value,
    );
    const matured = ['MATURED', 'EXPIRED'].includes(derived.dateStatus);
    const age = -daysUntil(
      derived.dateStatus === 'EXPIRED'
        ? record.validityEndDate!
        : record.maturityDate,
      settings.timezone,
    );
    const action =
      (record.successor && record.successor.lifecycleStatus !== 'REJECTED') ||
      record.releaseRequests.some(
        (item) => !['REJECTED'].includes(item.status),
      );
    const level =
      matured && !action && age >= settings.escalationDays
        ? Math.floor(
            (age - settings.escalationDays) / settings.escalationRepeatDays,
          ) + 1
        : 0;
    const deliveries: Array<{
      userId: string;
      key: string;
      type: string;
      title: string;
      message: string;
    }> = [];
    if (threshold !== undefined && !matured)
      for (const user of reminderRecipients)
        deliveries.push({
          userId: user.id,
          key: `${record.id}:${threshold}:${end}:${user.id}`,
          type: 'MATURITY_REMINDER',
          title: `Instrument deadline in ${threshold} days`,
          message: `${record.referenceCode} reaches its maturity/validity deadline on ${end}. Review renewal or other required action.`,
        });
    if (level)
      for (const user of staff.filter((user) =>
        ['SCRUTINY_OFFICER', 'APPROVING_AUTHORITY'].includes(user.role),
      ))
        deliveries.push({
          userId: user.id,
          key: `${record.id}:escalation:${level}:${end}:${user.id}`,
          type: 'MATURITY_ESCALATION',
          title: 'Overdue instrument requires follow-up',
          message: `${record.referenceCode} is ${age} days past maturity/expiry with no current replacement or release action. Escalation ${level}.`,
        });
    for (const delivery of deliveries) {
      try {
        await prisma.$transaction(async (tx) => {
          const notification = await tx.notification.create({
            data: {
              recipientUserId: delivery.userId,
              institutionId: record.institutionId,
              type: delivery.type,
              title: delivery.title,
              message: delivery.message,
              relatedEntityType: 'Instrument',
              relatedEntityId: record.id,
              dueAt: derived.effectiveEnd,
              dedupeKey: delivery.key,
              deliveryChannel: 'IN_APP',
              deliveryStatus: 'DELIVERED',
              sentAt: new Date(),
            },
          });
          await writeAuditEvent(tx, {
            action: 'NOTIFICATION_CREATED',
            entityType: 'Instrument',
            entityId: record.id,
            metadata: {
              notificationId: notification.id,
              channel: 'IN_APP',
              type: delivery.type,
            },
          });
        });
        if (delivery.type === 'MATURITY_REMINDER') notificationsCreated++;
        else escalations++;
      } catch (error: any) {
        if (error.code !== 'P2002') throw error;
      }
    }
  }
  return { checked: records.length, notificationsCreated, escalations };
}
let scheduled: cron.ScheduledTask | undefined;
export function startMaturityJob() {
  if (scheduled) return;
  scheduled = cron.schedule(
    '0 6 * * *',
    () => {
      runMaturityCheck().catch((error) =>
        logger.error({ error }, 'Maturity check failed'),
      );
    },
    { timezone: 'Asia/Kolkata' },
  );
}
