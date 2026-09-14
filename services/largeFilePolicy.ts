export const MAX_LOCAL_ATTACHMENT_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const STORAGE_SOFT_LIMIT_RATIO = 0.7;
export const MAX_DERIVED_TEXT_CHARS = 200_000;
export const MAX_VIDEO_KEYFRAMES = 12;
export const MAX_AUDIO_CHUNKS = 24;

export class LargeFilePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LargeFilePolicyError';
  }
}

export interface LocalFileLike {
  name: string;
  size: number;
  type: string;
}

export const validateLocalAttachmentFile = (file: LocalFileLike): void => {
  if (!file.name.trim()) throw new LargeFilePolicyError('اسم الملف مطلوب');
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new LargeFilePolicyError('حجم الملف غير صالح');
  }
  if (file.size === 0) throw new LargeFilePolicyError('الملف فارغ');
  if (file.size > MAX_LOCAL_ATTACHMENT_BYTES) {
    throw new LargeFilePolicyError('الحد الأقصى للملف المحلي هو 2GB');
  }
};

export const validateLocalAttachmentCount = (
  currentCount: number,
  incomingCount = 1,
): void => {
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    throw new LargeFilePolicyError('عدد المرفقات الحالي غير صالح');
  }
  if (!Number.isInteger(incomingCount) || incomingCount < 1) {
    throw new LargeFilePolicyError('عدد المرفقات الجديدة غير صالح');
  }
  if (currentCount + incomingCount > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new LargeFilePolicyError(`يمكن إرفاق ${MAX_ATTACHMENTS_PER_MESSAGE} ملفات كحد أقصى في الرسالة`);
  }
};

export const calculateStorageHeadroom = ({
  usage = 0,
  quota = 0,
}: {
  usage?: number;
  quota?: number;
}) => {
  if (!Number.isFinite(quota) || quota <= 0) {
    return {
      known: false,
      softLimitBytes: undefined,
      availableBeforeSoftLimit: undefined,
    };
  }
  const safeUsage = Number.isFinite(usage) ? Math.max(0, usage) : 0;
  const softLimitBytes = quota * STORAGE_SOFT_LIMIT_RATIO;
  return {
    known: true,
    softLimitBytes,
    availableBeforeSoftLimit: Math.max(0, softLimitBytes - safeUsage),
  };
};

export const assertFileFitsStorageHeadroom = (
  fileSize: number,
  estimate: { usage?: number; quota?: number },
): void => {
  const headroom = calculateStorageHeadroom(estimate);
  if (!headroom.known || headroom.availableBeforeSoftLimit === undefined) return;
  if (fileSize > headroom.availableBeforeSoftLimit) {
    throw new LargeFilePolicyError('المساحة المحلية المتاحة قبل حد الأمان 70% لا تكفي لهذا الملف');
  }
};
