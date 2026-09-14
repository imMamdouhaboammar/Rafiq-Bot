import {
  buildLocalAttachmentMetadata,
  createAttachmentDerivativePlan,
  sanitizeDerivedText,
} from '../services/attachmentDerivatives.js';
import type { AttachmentCategory } from '../types.js';

interface DerivativeWorkerRequest {
  requestId: string;
  file: File;
  category: AttachmentCategory;
  durationSeconds?: number;
}

interface DerivativeWorkerResponse {
  requestId: string;
  ok: boolean;
  metadata?: ReturnType<typeof buildLocalAttachmentMetadata>;
  plan?: ReturnType<typeof createAttachmentDerivativePlan>;
  derivedText?: string;
  error?: string;
}

const textMimePattern = /^(text\/|application\/(json|xml|javascript|csv))/i;

self.addEventListener('message', event => {
  const request = event.data as DerivativeWorkerRequest;
  void processRequest(request).then(response => {
    self.postMessage(response);
  });
});

const processRequest = async (
  request: DerivativeWorkerRequest,
): Promise<DerivativeWorkerResponse> => {
  try {
    if (!request.requestId?.trim()) throw new Error('Derivative request ID is required.');
    if (!(request.file instanceof File)) throw new Error('Derivative request requires a File.');

    const plan = createAttachmentDerivativePlan({
      category: request.category,
      durationSeconds: request.durationSeconds,
    });
    const metadata = buildLocalAttachmentMetadata({
      name: request.file.name,
      type: request.file.type,
      size: request.file.size,
      lastModified: request.file.lastModified,
      category: request.category,
    });

    let derivedText: string | undefined;
    if (plan.extractText && textMimePattern.test(request.file.type || 'text/plain')) {
      const textSlice = request.file.slice(0, Math.min(request.file.size, 2 * 1024 * 1024));
      derivedText = sanitizeDerivedText(await textSlice.text(), plan.maxTextCharacters);
    }

    return {
      requestId: request.requestId,
      ok: true,
      metadata,
      plan,
      derivedText,
    };
  } catch (error) {
    return {
      requestId: request.requestId || 'unknown',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
