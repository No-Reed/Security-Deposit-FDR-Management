import { prisma } from '../config/prisma';
import { config, MATURITY_ALERT_DAYS } from '../config/env';
import { createError } from '../middleware/errorHandler';

export async function operationalSettings() {
  const rows = await prisma.systemSetting.findMany();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const thresholds = (values.maturityAlertDays || MATURITY_ALERT_DAYS.join(','))
    .split(',')
    .map(Number);
  return {
    thresholds: [...new Set(thresholds)].sort((a, b) => b - a),
    alertDays: Math.max(...thresholds),
    timezone: config.APP_TIMEZONE,
    escalationDays: Number(values.escalationDays || config.ESCALATION_DAYS),
    escalationRepeatDays: Number(
      values.escalationRepeatDays || config.ESCALATION_REPEAT_DAYS,
    ),
  };
}
export function validateSetting(key: string, value: string) {
  if (key === 'maturityAlertDays') {
    const numbers = value.split(',').map((item) => Number(item.trim()));
    if (
      !numbers.length ||
      numbers.length > 12 ||
      numbers.some(
        (number) => !Number.isInteger(number) || number < 1 || number > 3650,
      )
    ) {
      throw createError(
        422,
        'INVALID_SETTING',
        'Use up to 12 positive reminder thresholds, separated by commas.',
      );
    }
    return [...new Set(numbers)].sort((a, b) => b - a).join(',');
  }
  if (
    ['escalationDays', 'escalationRepeatDays'].includes(key) &&
    /^\d+$/.test(value) &&
    Number(value) >= 1 &&
    Number(value) <= 3650
  )
    return String(Number(value));
  throw createError(
    422,
    'READ_ONLY_SETTING',
    'Only reminder thresholds and escalation intervals may be changed here.',
  );
}
