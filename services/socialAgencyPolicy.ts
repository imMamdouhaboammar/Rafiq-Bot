import { SocialAgencySchema, type SocialAgency } from '../contracts/rafiqV6.js';

export type ProactivityDecisionReason =
  | 'allowed'
  | 'disabled'
  | 'quiet_hours'
  | 'daily_limit'
  | 'cooldown'
  | 'duplicate_topic';

export interface ProactivityDecision {
  allowed: boolean;
  reason: ProactivityDecisionReason;
}

const getHourInTimezone = (date: Date, timezone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  if (!Number.isInteger(hour)) throw new Error(`Unable to resolve local hour for ${timezone}.`);
  return hour;
};

export const isQuietHour = (hour: number, startHour: number, endHour: number): boolean => {
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
};

export const canSendUnsolicitedMessage = ({
  agency: rawAgency,
  now,
  sentToday,
  lastSentAt,
  topicKey,
  recentTopicKeys,
}: {
  agency: SocialAgency;
  now: Date;
  sentToday: number;
  lastSentAt?: Date;
  topicKey: string;
  recentTopicKeys: string[];
}): ProactivityDecision => {
  const agency = SocialAgencySchema.parse(rawAgency);
  if (agency.proactivity <= 0 || agency.unsolicitedDailyLimit === 0) {
    return { allowed: false, reason: 'disabled' };
  }

  if (agency.quietHours.enabled) {
    const hour = getHourInTimezone(now, agency.quietHours.timezone);
    if (isQuietHour(hour, agency.quietHours.startHour, agency.quietHours.endHour)) {
      return { allowed: false, reason: 'quiet_hours' };
    }
  }

  if (sentToday >= agency.unsolicitedDailyLimit) {
    return { allowed: false, reason: 'daily_limit' };
  }

  if (lastSentAt) {
    const cooldownMs = agency.cooldownHours * 60 * 60 * 1000;
    if (now.getTime() - lastSentAt.getTime() < cooldownMs) {
      return { allowed: false, reason: 'cooldown' };
    }
  }

  const normalizedTopic = topicKey.trim().toLocaleLowerCase('ar');
  if (!normalizedTopic || recentTopicKeys.some(key => key.trim().toLocaleLowerCase('ar') === normalizedTopic)) {
    return { allowed: false, reason: 'duplicate_topic' };
  }

  return { allowed: true, reason: 'allowed' };
};

export const buildSocialAgencyPrompt = (agencyInput: SocialAgency): string => {
  const agency = SocialAgencySchema.parse(agencyInput);
  const boldness = agency.boldness < 34 ? 'منخفضة' : agency.boldness > 66 ? 'مرتفعة' : 'متوازنة';
  const proactivity = agency.proactivity < 34 ? 'منخفضة' : agency.proactivity > 66 ? 'مرتفعة' : 'متوازنة';

  return [
    `وضوح الرأي والاختلاف المهذب: ${boldness}.`,
    `المبادرة والمتابعة: ${proactivity}.`,
    'الجرأة لا تعني إطالة الرد. حافظ على نفس طول الرد المناسب للسياق.',
    'ممنوع التملك أو الإلحاح أو صناعة استعجال وهمي أو دفع المستخدم للاعتماد العاطفي.',
    'لا تبدأ متابعة غير مطلوبة إلا بعد اجتياز حدود اليوم والـcooldown والـquiet hours ومنع تكرار الموضوع.',
  ].join('\n');
};
