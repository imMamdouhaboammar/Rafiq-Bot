/**
 * MEDIA OPTIMIZER & SCENE EXTRACTION ENGINE
 *
 * Provides client-side and fallback media preprocessing:
 * 1. Image Quality & Dimension Optimization: Compresses high-res (20MB+) images to lightweight frames for AI payload.
 * 2. Video Scene Extractor: Extracts sequential timestamped keyframe scenes across any video size (up to 2GB+)
 *    and converts them to compact visual scene frames for multimodal LLM storytelling.
 */

export interface OptimizedImageResult {
  mimeType: string;
  data: string; // Pure Base64 without data URI prefix
  rawBytes: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

export interface ExtractedVideoScene {
  sceneIndex: number;
  totalScenes: number;
  timestampSeconds: number;
  formattedTime: string; // e.g. "00:15"
  label: string;
  mimeType: string;
  data: string; // Pure Base64
  rawBytes: number;
  width: number;
  height: number;
}

export interface VideoSceneExtractResult {
  durationSeconds: number;
  totalScenes: number;
  scenes: ExtractedVideoScene[];
  summaryContext: string;
}

const DEFAULT_MAX_IMAGE_DIMENSION = 1280;
const DEFAULT_IMAGE_QUALITY = 0.85;
const DEFAULT_MAX_VIDEO_SCENES = 5;
const DEFAULT_SCENE_MAX_DIMENSION = 854; // 480p/720p scale
const DEFAULT_SCENE_QUALITY = 0.80;

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const minutes = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${mm}:${ss}`;
};

/**
 * Optimizes an image blob for AI payload by downscaling if larger than maxDimension
 * and re-compressing to WebP or JPEG.
 */
export const optimizeImageForAi = async (
  blob: Blob,
  options: {
    maxDimension?: number;
    quality?: number;
    preferredMimeType?: string;
  } = {},
): Promise<OptimizedImageResult> => {
  const maxDim = options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION;
  const quality = options.quality ?? DEFAULT_IMAGE_QUALITY;
  const targetMime = options.preferredMimeType || 'image/jpeg';

  // Check if running in browser with DOM & Canvas
  const hasBrowserCanvas = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.createElement === 'function';

  if (!hasBrowserCanvas) {
    // Node / non-browser fallback: convert blob to base64 directly
    const buffer = Buffer.from(await blob.arrayBuffer());
    return {
      mimeType: blob.type || 'image/jpeg',
      data: buffer.toString('base64'),
      rawBytes: buffer.length,
      width: 0,
      height: 0,
      wasCompressed: false,
    };
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let { width, height } = img;
        let scale = 1;

        if (width > maxDim || height > maxDim) {
          scale = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Canvas 2D context unavailable.');
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(targetMime, quality);
        const base64Data = dataUrl.split(',')[1] || '';
        const rawBytes = Math.floor((base64Data.length * 6) / 8);

        resolve({
          mimeType: targetMime,
          data: base64Data,
          rawBytes,
          width,
          height,
          wasCompressed: scale < 1 || rawBytes < blob.size,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for optimization.'));
    };

    img.src = objectUrl;
  });
};

/**
 * Calculates evenly distributed timestamps across video duration.
 */
export const calculateSceneTimestamps = (
  durationSeconds: number,
  maxScenes = DEFAULT_MAX_VIDEO_SCENES,
): number[] => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const count = Math.min(maxScenes, Math.max(1, Math.ceil(durationSeconds / 25)));

  if (count === 1) {
    return [Math.min(durationSeconds, Math.max(0.5, durationSeconds * 0.3))];
  }

  const timestamps: number[] = [];
  for (let index = 0; index < count; index += 1) {
    // Distribute from 5% to 95% of duration
    const fraction = (index + 0.5) / count;
    const time = Number((durationSeconds * fraction).toFixed(2));
    timestamps.push(Math.min(durationSeconds, Math.max(0, time)));
  }

  return timestamps;
};

/**
 * Extracts sequential keyframe scenes from a video Blob using HTMLVideoElement and Canvas.
 */
export const extractVideoScenes = async (
  videoBlob: Blob,
  options: {
    maxScenes?: number;
    maxDimension?: number;
    quality?: number;
    signal?: AbortSignal;
    onProgress?: (progressRatio: number) => void;
  } = {},
): Promise<VideoSceneExtractResult> => {
  const maxScenes = options.maxScenes ?? DEFAULT_MAX_VIDEO_SCENES;
  const maxDim = options.maxDimension ?? DEFAULT_SCENE_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_SCENE_QUALITY;

  const hasBrowserVideo = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.createElement === 'function';

  if (!hasBrowserVideo) {
    // Non-browser fallback
    return {
      durationSeconds: 0,
      totalScenes: 0,
      scenes: [],
      summaryContext: '[VIDEO_SCENES_UNAVAILABLE: Non-browser environment]',
    };
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoBlob);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Video scene extraction cancelled.', 'AbortError'));
    };

    if (options.signal?.aborted) {
      handleAbort();
      return;
    }
    options.signal?.addEventListener('abort', handleAbort, { once: true });

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video for scene extraction.'));
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 0;
        const timestamps = calculateSceneTimestamps(duration, maxScenes);
        const scenes: ExtractedVideoScene[] = [];
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Canvas 2D context unavailable.');
        }

        // Calculate aspect-preserving dimensions
        let vWidth = video.videoWidth || 640;
        let vHeight = video.videoHeight || 360;
        if (vWidth > maxDim || vHeight > maxDim) {
          const scale = Math.min(maxDim / vWidth, maxDim / vHeight);
          vWidth = Math.max(1, Math.round(vWidth * scale));
          vHeight = Math.max(1, Math.round(vHeight * scale));
        }

        canvas.width = vWidth;
        canvas.height = vHeight;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        for (let i = 0; i < timestamps.length; i += 1) {
          if (options.signal?.aborted) {
            handleAbort();
            return;
          }

          const targetTime = timestamps[i];
          await seekVideoToTime(video, targetTime);

          context.drawImage(video, 0, 0, vWidth, vHeight);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64Data = dataUrl.split(',')[1] || '';
          const rawBytes = Math.floor((base64Data.length * 6) / 8);
          const formatted = formatDuration(targetTime);

          scenes.push({
            sceneIndex: i + 1,
            totalScenes: timestamps.length,
            timestampSeconds: targetTime,
            formattedTime: formatted,
            label: `Scene ${i + 1} (@ ${formatted})`,
            mimeType: 'image/jpeg',
            data: base64Data,
            rawBytes,
            width: vWidth,
            height: vHeight,
          });

          options.onProgress?.((i + 1) / timestamps.length);
        }

        cleanup();

        const summaryLines = [
          `[EXTRACTED_VIDEO_SCENES: ${scenes.length} keyframes extracted across ${formatDuration(duration)} duration]`,
          ...scenes.map(s => `- ${s.label}: Visual scene frame at timestamp ${s.formattedTime}`),
        ];

        resolve({
          durationSeconds: duration,
          totalScenes: scenes.length,
          scenes,
          summaryContext: summaryLines.join('\n'),
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.src = objectUrl;
  });
};

const seekVideoToTime = (video: HTMLVideoElement, time: number): Promise<void> => (
  new Promise((resolve, reject) => {
    let timeoutId: number;
    const handleSeeked = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      resolve();
    };
    const handleError = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      reject(new Error(`Failed to seek video to ${time}s`));
    };

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });

    // Safety timeout in case seek never fires
    timeoutId = window.setTimeout(() => {
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      resolve(); // Proceed with current frame rather than hanging forever
    }, 1500);

    video.currentTime = Math.min(video.duration || time, Math.max(0, time));
  })
);
