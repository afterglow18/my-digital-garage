/**
 * vision.ts — Photo analysis for search indexing.
 *
 * On web: canvas-based dominant-colour extraction (48×48 sample).
 * On iOS: delegates to the native VisionPlugin (Vision framework).
 *
 * visionVersion scheme:
 *   0 = unanalyzed
 *   1 = iOS Vision (correct, don't re-run on web)
 *   4 = web canvas (current threshold, correct)
 *   5 = web analyzed but no labels found (don't retry)
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

// ── Native iOS Vision plugin (web impl = no-op) ───────────────────────────────

interface VisionPluginInterface {
  analyze(options: { imageDataUrl: string }): Promise<{
    labels: string[];
    text:   string[];
  }>;
}

const VisionPlugin = registerPlugin<VisionPluginInterface>("VisionPlugin", {
  web: {
    async analyze() {
      return { labels: [], text: [] };
    },
  },
});

// ── Color name mapping ────────────────────────────────────────────────────────

function rgbToColorName(r: number, g: number, b: number): string | null {
  const brightness = (r + g + b) / 3;

  if (brightness < 80)  return "black";
  if (brightness < 110) return "dark grey";
  if (brightness < 175) return "grey";
  if (brightness < 225) return "light grey";
  if (r > 220 && g > 220 && b > 220) return "white";

  // Warm neutrals
  if (r > g && r > b) {
    if (r > 200 && g > 170 && b > 140) return "beige";
    if (r > 180 && g > 140 && b > 90)  return "tan";
    if (r > 120 && g > 70  && b > 30)  return "brown";
  }

  // Chromatic hues
  const max  = Math.max(r, g, b);
  const min  = Math.min(r, g, b);
  const diff = max - min;
  if (diff < 30) return null; // achromatic, already handled above

  let hue = 0;
  if      (max === r) hue = ((g - b) / diff) % 6;
  else if (max === g) hue = (b - r) / diff + 2;
  else                hue = (r - g) / diff + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 15 || hue >= 345) return "red";
  if (hue < 40)  return "orange";
  if (hue < 70)  return "yellow";
  if (hue < 165) return "green";
  if (hue < 195) return "teal";
  if (hue < 255) return "blue";
  if (hue < 285) return "purple";
  if (hue < 345) return "pink";
  return "red";
}

// ── Canvas extraction (web) ───────────────────────────────────────────────────

export async function extractColorsFromImage(imageDataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const SIZE  = 48;
      const PATCH = 4;

      const canvas = document.createElement("canvas");
      canvas.width  = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve([]); return; }

      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      // Detect background by sampling 4×4 patches from each corner
      const bgSamples: [number, number, number][] = [];
      for (const [cx, cy] of [
        [0, 0], [SIZE - PATCH, 0], [0, SIZE - PATCH], [SIZE - PATCH, SIZE - PATCH],
      ] as [number, number][]) {
        for (let y = cy; y < cy + PATCH; y++) {
          for (let x = cx; x < cx + PATCH; x++) {
            const i = (y * SIZE + x) * 4;
            bgSamples.push([data[i], data[i + 1], data[i + 2]]);
          }
        }
      }
      const bgR = bgSamples.reduce((s, [r]) => s + r, 0) / bgSamples.length;
      const bgG = bgSamples.reduce((s, [, g]) => s + g, 0) / bgSamples.length;
      const bgB = bgSamples.reduce((s, [,, b]) => s + b, 0) / bgSamples.length;

      const colorCounts = new Map<string, number>();
      let fgTotal = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;
        if (Math.abs(r - bgR) < 30 && Math.abs(g - bgG) < 30 && Math.abs(b - bgB) < 30) continue;

        fgTotal++;
        const name = rgbToColorName(r, g, b);
        if (name) colorCounts.set(name, (colorCounts.get(name) ?? 0) + 1);
      }

      const threshold = fgTotal * 0.10;
      const result = [...colorCounts.entries()]
        .filter(([, count]) => count >= threshold)
        .sort(([, a], [, b]) => b - a)
        .map(([name]) => name);

      resolve(result);
    };
    img.onerror = () => resolve([]);
    img.src = imageDataUrl;
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export interface VisionResult {
  labels:  string[];
  text:    string[];
  version: number; // 1 = iOS, 4 = web OK, 5 = web no-results
}

export async function analyzeItemPhoto(imageDataUrl: string): Promise<VisionResult> {
  if (Capacitor.isNativePlatform()) {
    // Run native Vision (object labels + text) AND canvas color extraction in parallel.
    // Apple Vision gives object types ("shoe", "high heel") but never color names,
    // so canvas extraction is the only source of colors on iOS.
    const [nativeResult, canvasColors] = await Promise.allSettled([
      VisionPlugin.analyze({ imageDataUrl }),
      extractColorsFromImage(imageDataUrl),
    ]);

    const nativeLabels = nativeResult.status === "fulfilled" ? nativeResult.value.labels : [];
    const nativeText   = nativeResult.status === "fulfilled" ? nativeResult.value.text   : [];
    const colors       = canvasColors.status  === "fulfilled" ? canvasColors.value        : [];

    // Merge: canvas colors first (most useful for search), then Vision object labels
    const mergedLabels = [...colors, ...nativeLabels];

    // v2 = iOS Vision + canvas colors merged
    return { labels: mergedLabels, text: nativeText, version: 2 };
  }

  // Web path
  try {
    const colors = await extractColorsFromImage(imageDataUrl);
    return { labels: colors, text: [], version: colors.length > 0 ? 4 : 5 };
  } catch {
    return { labels: [], text: [], version: 5 };
  }
}
