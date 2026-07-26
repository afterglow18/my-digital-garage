import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

/**
 * Lock ONNX Runtime Web into Web Worker (proxy) mode before imgly can disable it.
 *
 * Three-part fix for the main-thread freeze on iOS Safari / WKWebView:
 *
 * 1. Dynamic import — importing onnxruntime-web at module parse time triggers
 *    Vite's dep pre-bundling mid-session, causing a full page reload that
 *    corrupts React's internal dispatcher. Importing it dynamically inside this
 *    function means it only loads the moment inference is first requested.
 *
 * 2. Object.defineProperty with a no-op setter — imgly internally does
 *    `ort.env.wasm.proxy = false` just before it creates the inference session
 *    (because it only enables the proxy when WebGPU is available, which is never
 *    true on iOS Safari). A plain assignment would let imgly win.
 *    Object.defineProperty with `set: () => {}` makes the write a silent no-op
 *    so the value stays true and ONNX Runtime runs inference in a sub-worker.
 *
 * 3. numThreads = 1 — iOS Safari has no SharedArrayBuffer, which WASM
 *    multithreading requires. Leaving threads > 1 causes a silent crash.
 */
let ortConfigured = false;

async function configureOrt(): Promise<void> {
  if (ortConfigured) return;
  ortConfigured = true;

  // @ts-ignore — types exist at onnxruntime-web/types.d.ts but aren't exposed
  //              through the package's "exports" map so tsc can't resolve them.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  const ort = (await import("onnxruntime-web")) as any;

  Object.defineProperty(ort.env.wasm, "proxy", {
    get: () => true,
    set: () => {},       // blocks imgly from resetting this to false
    configurable: true,
  });

  ort.env.wasm.numThreads = 1;  // required — no SharedArrayBuffer on iOS Safari
}

/**
 * Remove the background from a JPEG/PNG base64 data-URL.
 * Returns a PNG data-URL with transparent background.
 *
 * Inference runs in a Web Worker (not the main thread) so the UI stays
 * responsive while the model thinks.
 *
 * First ever call downloads ~15 MB ONNX model from the imgly CDN (cached
 * in the browser cache after that).
 *
 * Throws on network error or unreadable image — callers should catch and
 * fall back to the original.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();

  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16",  // valid: "isnet" | "isnet_fp16" | "isnet_quint8" — NOT "small"/"medium"
    output: { format: "image/png", quality: 0.9 },
    // publicPath omitted → uses static imgly CDN automatically
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
