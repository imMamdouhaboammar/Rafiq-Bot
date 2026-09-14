export type SelfieSubIntent =
  | 'request_avatar_selfie'
  | 'request_avatar_fullbody'
  | 'request_avatar_current_scene'
  | 'request_avatar_outfit_based'
  | 'request_avatar_romantic_style'
  | 'request_avatar_funny_style';

export type DirectImageRequest = {
  kind: 'selfie' | 'studio';
  intent: 'request_avatar_image' | 'request_studio';
  subIntent?: SelfieSubIntent;
  prompt: string;
  idempotencyKey?: string;
};

export interface ConfirmedSelfieAction {
  confirmed: true;
  prompt: string;
  idempotencyKey: string;
  subIntent?: SelfieSubIntent;
}

/**
 * Natural-language text is never an execution authority for image generation.
 * The chat UI must show an explicit selfie action and pass a confirmed,
 * structured request through createConfirmedSelfieRequest.
 */
export const detectDirectImageRequest = (_rawText: string): DirectImageRequest | null => null;

const MODEL_IMAGE_DIRECTIVE = /\[\[\s*GENERATE_(?:SELFIE|IMAGE)(?:\s*:\s*[\s\S]*?)?\s*\]\]/gi;

/**
 * Model text is display content, never an execution channel. Remove legacy
 * image-control tokens so they cannot leak into the conversation UI.
 */
export const stripUntrustedImageDirectives = (rawText: string): string => (
  rawText
    .replace(MODEL_IMAGE_DIRECTIVE, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
);

export const createConfirmedSelfieRequest = (
  action: ConfirmedSelfieAction,
): DirectImageRequest => {
  const prompt = action.prompt.trim();
  const idempotencyKey = action.idempotencyKey.trim();

  if (action.confirmed !== true) {
    throw new Error('Selfie generation requires explicit confirmation.');
  }
  if (!prompt) {
    throw new Error('A confirmed selfie request requires a prompt.');
  }
  if (!idempotencyKey || idempotencyKey.length > 160) {
    throw new Error('A valid selfie idempotency key is required.');
  }

  return {
    kind: 'selfie',
    intent: 'request_avatar_image',
    subIntent: action.subIntent ?? 'request_avatar_selfie',
    prompt,
    idempotencyKey,
  };
};
