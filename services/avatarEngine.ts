
import type { BotSettings } from "../types.js";
import { generateVisualSeed, getVisualPromptModifiers } from "./visualEngine.js";
import { createGoogleGenAIClient } from "./googleClient.server.js";
import { GEMINI_SAFETY_OFF_SETTINGS } from './geminiSafety.server.js';

export const PROFILE_AVATAR_MODEL_CHAIN = [
  'gemini-3.1-flash-image'
];

/**
 * Infers age from bio text using regex patterns if not explicitly provided.
 */
function inferAgeFromBio(bio: string): number {
  const patterns = [
    { regex: /(مدرس|دكتور|مهندس|مدير|شغال|موظف)/, age: 30 },
    { regex: /(طالب|جامعة|مدرسة|دراسة|بذاكر)/, age: 19 },
    { regex: /(اب|أب|أم|زوج|زوجة|عيال|أطفال)/, age: 35 },
    { regex: /(جد|جدة|متقاعد|معاش)/, age: 65 },
    { regex: /(طفل|صغير|لعب)/, age: 10 },
  ];
  
  for (const p of patterns) {
    if (p.regex.test(bio)) return p.age;
  }
  return 24; // Default fallback age
}

const normalizeProfileVisualSeed = (seed: ReturnType<typeof generateVisualSeed>) => ({
  palette: /black\s*&\s*white|muted vintage|cinematic/i.test(seed.palette)
    ? "warm natural phone colors"
    : seed.palette,
  lighting: /dramatic|studio|neon|rembrandt/i.test(seed.lighting)
    ? "soft daylight from a window"
    : seed.lighting,
  tone: /cinematic|moody|gritty|ethereal/i.test(seed.tone)
    ? "natural relaxed selfie"
    : seed.tone,
  seed: seed.seed,
});

export const buildProfileAvatarPrompt = (settings: BotSettings): string => {
  const age = settings.botAge || inferAgeFromBio(settings.botBio || "");
  const gender = settings.botGender === 'male' ? 'man' : 'woman';
  const genderArabic = settings.botGender === 'male' ? 'رجل' : 'امرأة';
  const visualSeed = normalizeProfileVisualSeed(settings.visualSeed || generateVisualSeed());

  return `
    Create one square, photorealistic social profile lifestyle portrait for a fictional Arab ${gender}.
    It should feel like a beautiful candid Instagram story photo that also works perfectly as a WhatsApp profile picture.

    PERSONA:
    - Name: ${settings.botName}
    - Gender: ${genderArabic}
    - Approximate age: ${age}
    - Personality and life context:
      ${settings.botBio || "A natural everyday Arab person with a believable private life."}

    CORE FACE REQUIREMENTS:
    - The person must look clearly Arab / Middle Eastern / North African with authentic Arab facial features.
    - Natural skin texture, believable eyes, nose, jaw, hair, eyebrows, and expression.
    - Avoid generic Western, East Asian, anime, doll-like, celebrity, influencer, or stock-photo face.
    - Do not copy any real public figure.

    SOCIAL PROFILE / STORY STYLE:
    - Looks like a real photo someone would actually post as an Instagram story, then crop as their WhatsApp avatar.
    - Three-quarter or full-body lifestyle portrait, not just a tight face crop. Keep the face readable when cropped into a circular avatar.
    - Casual phone-camera or friend-taken phone photo, eye-level, 24-35mm phone lens feel, natural perspective.
    - Modern modest fashion / stylish everyday outfit inferred from the persona and gender: coordinated colors, layered textures, clean shoes, simple accessories, smartwatch or subtle jewelry when appropriate.
    - Include one natural lifestyle micro-action inferred from the persona: holding coffee, walking on a sidewalk, leaning on a balcony, standing near a campus/cafe, adjusting scarf/hair, laughing mid-moment, or looking back at the camera.
    - Attractive but believable; natural grooming, expressive eyes, relaxed body language, confident posture.
    - Real Egyptian / Arab everyday setting: sunny residential sidewalk, campus courtyard, cafe exterior, apartment building entrance, green hedge, blooming tree, parked car, or warm urban street.
    - Bright natural daylight, vibrant realistic colors, strong sunlight when appropriate, sharp real shadows on the ground, gentle skin texture, shallow depth of field, slight phone-camera grain.
    - Square 1:1 composition with enough body/outfit/context to feel like a lifestyle photo, while still working as a profile avatar; no passport-photo stiffness.

    VISUAL CONSISTENCY:
    ${getVisualPromptModifiers(visualSeed)}

    NEGATIVE CONSTRAINTS:
    - No text, no watermark, no logo, no frame, no UI, no extra people.
    - No cartoon, illustration, 3D render, painting, plastic skin, beauty filter, or heavy retouching.
    - No dark moody portrait, no black-and-white photo, no studio fashion lighting.
    - No passport photo, no stiff centered ID portrait, no stock-photo smile, no lifeless blank background.
    - No extreme close-up unless the persona explicitly requires it.
    - No exaggerated stereotypes, costumes, flags, or religious/political symbols unless explicitly described in the persona.
    - No sunglasses covering the eyes.

    Output only the image.
  `;
};

/**
 * Generates an avatar based purely on the persona's details with creative freedom.
 */
export const generateRealisticAvatar = async (settings: BotSettings): Promise<string> => {
  const ai = createGoogleGenAIClient();
  const prompt = buildProfileAvatarPrompt(settings);

  for (const modelId of PROFILE_AVATAR_MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.9,
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: modelId.includes('gemini-3') ? "1K" : undefined
          },
          safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }

      console.warn(`Avatar generation returned no image for ${modelId}`);
    } catch (error) {
      console.warn(`Avatar generation failed with ${modelId}:`, error);
    }
  }

  return "";
};
