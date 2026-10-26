import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { config, MATURITY_ALERT_DAYS } from '../config/env';
import { deriveDateStatus } from '../lib/dates';

export async function runMaturityCheck(): Promise<{ checked: number; notificationsCreated: number; escalations: number }> {
  logger.info('Running maturity check job');

  const maxAlertDays = MATURITY_ALERT_DAYS[0] || 90;
  let notificationsCreated = 0;
  let escalations = 0;

  const instruments = await prisma.instrument.findMany({
    where: {
      lifecycleStatus: { notIn: ['REJECTED', 'CLOSED'] },
    },
    include: {
      institution: {
        include: {
          users: { where: { isActive: true }, select: { id: true } },
          staffScopes: {
            include: {
              user: { select: { id: true, isActive: true, role: true } },
            },
          },
        },
      },
      releaseRequests: { where: { status: { notIn: ['REJECTED', 'COMPLETED'] } }, select: { id: true } },
      successor: { select: { id: true, lifecycleStatus: true } },
    },
  });

  for (const instrument of instruments) {
    const derived = deriveDateStatus(
      instrument.maturityDate,
      instrument.validityEndDate,
      maxAlertDays,
      config.APP_TIMEZONE
    );

    const effectiveEnd = instrument.validityEndDate ?? instrument.maturityDate;
    const effectiveEndStr = effectiveEnd.toISOString().split('T')[0];

    // Collect recipients
    const recipientIds = new Set<string>();
    for (const u of instrument.institution.users) recipientIds.add(u.id);
    for (const scope of instrument.institution.staffScopes) {
      if (scope.user && scope.user.isActive && ['SCRUTINY_OFFICER', 'APPROVING_AUTHORITY'].includes(scope.user.role)) {
        recipientIds.add(scope.user.id);
      }
    }

    // Threshold reminders
    for (const thresholdDays of MATURITY_ALERT_DAYS) {
      if (derived.daysRemaining !== null && derived.daysRemaining === thresholdDays) {
        for (const recipientId of recipientIds) {
          const dedupeKey = `maturity:${instrument.id}:${thresholdDays}:${effectiveEndStr}:${recipientId}`;
          try {
            await prisma.notification.create({
              data: {
                recipientUserId: recipientId,
                institutionId: instrument.institutionId,
                type: 'MATURITY_REMINDER',
                title: `FDR Maturing in ${thresholdDays} days`,
                message: `Instrument ${instrument.referenceCode} (${instrument.bankName} - ${instrument.instrumentNumber}) matures on ${effectiveEndStr}. ${thresholdDays} days remaining.`,
                relatedEntityType: 'Instrument',
                relatedEntityId: instrument.id,
                dueAt: effectiveEnd,
                dedupeKey,
                deliveryStatus: 'DELIVERED',
                sentAt: new Date(),
              },
            });
            notificationsCreated++;
          } catch (err: any) {
            // Unique constraint violation = already sent (idempotent)
            if (err.code !== 'P2002') {
              logger.error({ err, instrumentId: instrument.id, threshold: thresholdDays }, 'Failed to create notification');
            }
          }
        }
      }
    }

    // Escalation: matured/expired with no renewal or release action
    if (derived.dateStatus === 'MATURED' || derived.dateStatus === 'EXPIRED') {
      const hasAction =
        instrument.successor !== null ||
        instrument.releaseRequests.length > 0;

      if (!hasAction) {
        const escalationLevel = 1; // MVP: single escalation level
        const dedupeKey = `escalation:${instrument.id}:${escalationLevel}:${effectiveEndStr}`;

        // Also notify AA
        const approvers = await prisma.user.findMany({
          where: { role: 'APPROVING_AUTHORITY', isActive: true },
          select: { id: true },
        });
        for (const approver of approvers) recipientIds.add(approver.id);

        for (const recipientId of recipientIds) {
          const recipientDedupeKey = `${dedupeKey}:${recipientId}`;
          try {
            await prisma.notification.create({
              data: {
                recipientUserId: recipientId,
                institutionId: instrument.institutionId,
                type: 'MATURITY_ESCALATION',
                title: 'ESCALATION: Matured instrument without action',
                message: `Instrument ${instrument.referenceCode} (${instrument.bankName}) matured/expired with no renewal or release request. Immediate action required.`,
                relatedEntityType: 'Instrument',
                relatedEntityId: instrument.id,
                dueAt: effectiveEnd,
                dedupeKey: recipientDedupeKey,
                deliveryStatus: 'DELIVERED',
                sentAt: new Date(),
              },
            });
            escalations++;
          } catch (err: any) {
            if (err.code !== 'P2002') {
              logger.error({ err, instrumentId: instrument.id }, 'Failed to create escalation notification');
            }
          }
        }
      }
    }
  }

  logger.info({ checked: instruments.length, notificationsCreated, escalations }, 'Maturity check complete');
  return { checked: instruments.length, notificationsCreated, escalations };
}

let cronTask: cron.ScheduledTask | null = null;

export function startMaturityJob() {
  if (cronTask) return;

  // Run daily at 6 AM IST (00:30 UTC)
  cronTask = cron.schedule('30 0 * * *', async () => {
    try {
      await runMaturityCheck();
    } catch (err) {
      logger.error(err, 'Maturity check job failed');
    }
  });

  logger.info('Maturity check cron job started (daily at 06:00 IST)');
}
