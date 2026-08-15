/**
 * Canvas work behind the composer: cropping to an aspect ratio, baking filters
 * into a file, and pulling cover frames out of a video.
 *
 * Kept out of the component so the pixel maths is testable and readable on its
 * own, and so the component stays about the interaction.
 */

// The ratio vocabulary is an API contract, so it is defined once in lib/api.
import { ASPECT_RATIOS, type AspectRatio } from '@/lib/api';

export { ASPECT_RATIOS };
export type { AspectRatio };

/** Ratios offered per media type — video gets the three the design calls for. */
export const IMAGE_RATIOS: AspectRatio[] = ['ORIGINAL', '1:1', '4:5', '16:9'];
export const VIDEO_RATIOS: AspectRatio[] = ['ORIGINAL', '1:1', '16:9', '9:16'];

/** width / height, or null for "leave it as it is". */
export function ratioValue(ratio: AspectRatio): number | null {
  switch (ratio) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    default:
      return null;
  }
}

export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  fade: number;
  temperature: number;
  vignette: number;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  fade: 0,
  temperature: 0,
  vignette: 0,
};

/** Named looks, expressed as adjustment presets rather than bespoke shaders. */
export const FILTER_PRESETS: { name: string; adjustments: Partial<Adjustments> }[] = [
  { name: 'Original', adjustments: {} },
  { name: 'Clarendon', adjustments: { contrast: 20, saturation: 25, brightness: 8 } },
  { name: 'Gingham', adjustments: { fade: 30, brightness: 5, saturation: -15 } },
  { name: 'Moon', adjustments: { saturation: -100, contrast: 10, brightness: 6 } },
  { name: 'Lark', adjustments: { brightness: 12, saturation: 12, temperature: -10 } },
  { name: 'Reyes', adjustments: { fade: 40, brightness: 10, saturation: -20, contrast: -10 } },
  { name: 'Juno', adjustments: { saturation: 35, temperature: 15, contrast: 8 } },
  { name: 'Slumber', adjustments: { brightness: -6, saturation: -25, temperature: 12 } },
  { name: 'Crema', adjustments: { fade: 20, temperature: 8, contrast: -6 } },
  { name: 'Vintage', adjustments: { fade: 25, temperature: 20, saturation: -10, vignette: 40 } },
];

/**
 * The adjustments as a CSS `filter` string — the same value drives the live
 * preview and the canvas export, so what you see is what gets uploaded.
 *
 * `fade` and `temperature` have no CSS primitive, so they're approximated:
 * fade as reduced contrast plus a lift in brightness, temperature as a
 * sepia/hue pairing. Vignette is a gradient overlay, not a filter, so it is
 * applied separately.
 */
export function toCssFilter(a: Adjustments): string {
  const parts: string[] = [];

  // Percentages: 0 is neutral, so map -100..100 onto 0..2 multipliers.
  if (a.brightness) parts.push(`brightness(${1 + a.brightness / 100})`);
  if (a.contrast || a.fade) {
    // Fade flattens the image, which reads as lower contrast.
    parts.push(`contrast(${1 + a.contrast / 100 - a.fade / 200})`);
  }
  if (a.saturation) parts.push(`saturate(${Math.max(0, 1 + a.saturation / 100)})`);
  if (a.fade) parts.push(`brightness(${1 + a.fade / 400})`);
  if (a.temperature > 0) parts.push(`sepia(${a.temperature / 200})`);
  if (a.temperature < 0) parts.push(`hue-rotate(${a.temperature / 8}deg)`);

  return parts.length ? parts.join(' ') : 'none';
}

/** Loads a File into an HTMLImageElement, revoking the blob URL afterwards. */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}

/** The largest centred box of `ratio` that fits inside `width` x `height`. */
export function centredCrop(width: number, height: number, ratio: number | null) {
  if (!ratio) return { x: 0, y: 0, width, height };

  const current = width / height;
  if (current > ratio) {
    // Too wide: trim the sides.
    const cropWidth = height * ratio;
    return { x: (width - cropWidth) / 2, y: 0, width: cropWidth, height };
  }
  // Too tall: trim top and bottom.
  const cropHeight = width / ratio;
  return { x: 0, y: (height - cropHeight) / 2, width, height: cropHeight };
}

/**
 * Applies the chosen crop and adjustments to an image and returns a new File.
 *
 * Destructive on purpose: the upload carries the edited pixels, so every client
 * — including ones that know nothing about filters — shows what the author saw.
 */
export async function renderImage(
  file: File,
  ratio: AspectRatio,
  adjustments: Adjustments,
): Promise<File> {
  const img = await loadImage(file);
  const crop = centredCrop(img.naturalWidth, img.naturalHeight, ratioValue(ratio));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');

  const filter = toCssFilter(adjustments);
  // Canvas2D filter support is broad, but not universal — an unsupported value
  // is simply ignored, which degrades to an uncropped-looking colour rather
  // than failing the post.
  if (filter !== 'none') ctx.filter = filter;

  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  if (adjustments.vignette > 0) {
    ctx.filter = 'none';
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.35,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.75,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${adjustments.vignette / 100})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    // 0.92 keeps the artefacts invisible without doubling the byte count.
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  );
  if (!blob) throw new Error('Your browser could not process this image.');

  const name = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
}

export interface VideoFrame {
  time: number;
  dataUrl: string;
}

/**
 * Grabs evenly spaced stills from a video for the cover picker.
 *
 * Seeking is inherently sequential here: each frame has to wait for its own
 * `seeked` event before the canvas holds the right pixels.
 */
export async function extractFrames(file: File, count = 8): Promise<VideoFrame[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('That video could not be read.'));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) return [];

    const canvas = document.createElement('canvas');
    // Thumbnail-sized: these are 60px tall on screen, so full resolution would
    // cost memory for nothing.
    const scale = Math.min(1, 320 / (video.videoWidth || 320));
    canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || 240) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const frames: VideoFrame[] = [];
    for (let i = 0; i < count; i++) {
      // Nudged off 0 and off the very end, where many encodings have no frame.
      const time = (duration * (i + 0.5)) / count;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = time;
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ time, dataUrl: canvas.toDataURL('image/jpeg', 0.7) });
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Re-grabs one frame at full resolution to upload as the post's cover, cropped
 * to the same ratio as the video so the thumbnail matches the player.
 */
export async function renderCover(
  file: File,
  time: number,
  ratio: AspectRatio,
): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('That video could not be read.'));
    });

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = time;
    });

    const crop = centredCrop(video.videoWidth, video.videoHeight, ratioValue(ratio));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(crop.width);
    canvas.height = Math.round(crop.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process this video.');

    ctx.drawImage(
      video,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) throw new Error('Your browser could not process this video.');

    return new File([blob], 'cover.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
