/**
 * ReplacePhotoSheet
 *
 * Full-screen overlay that lets the user pick a new photo (camera or gallery)
 * for an existing item. Runs the same encode → Original | Cleaned ✨ comparison
 * flow as QuickAddSheet, then immediately calls onSave(chosenDataUrl) so the
 * parent can optimistically update the UI before the DB write finishes.
 *
 * Phases:
 *   pick ──(file chosen)──► encoding ──► preview ──(user confirms)──► onSave() + onClose()
 */
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check, Camera, ImageIcon } from "lucide-react";
import {
  removeBackground,
  blobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Encode any image File/Blob to a JPEG ≤ 2048px — ready for bg removal. */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX   = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w     = Math.round(img.naturalWidth  * scale);
      const h     = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

/** Compress a blob to a JPEG data-URL at ≤ 800px for DB storage. */
async function compressForStorage(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 800 / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.naturalWidth  * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

type Phase = "pick" | "encoding" | "preview";

interface Props {
  open:     boolean;
  onClose:  () => void;
  /** Called immediately when the user confirms their choice (optimistic) */
  onSave:   (chosenDataUrl: string) => void;
}

export function ReplacePhotoSheet({ open, onClose, onSave }: Props) {
  const [phase,        setPhase]        = useState<Phase>("pick");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");

  // Each file pick bumps this to abort stale async chains
  const bgGenRef = useRef(0);

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ── Reset + close ────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    bgGenRef.current += 1;
    setBgProcessing(false);
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    onClose();
  }, [onClose]);

  // ── Single-file: encode → show original → bg removal in background ───────────
  const handleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    const myGen = ++bgGenRef.current;
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");
    setPhase("encoding");

    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    setBgProcessing(true);
    try {
      const dataUrl   = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, []);

  // ── Confirm chosen version → call parent's onSave ───────────────────────────
  const handleConfirm = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;

    try {
      // Cleaned PNG preserves transparency via FileReader; original re-compresses to JPEG
      const path = selected === "cleaned" && cleanedBlob
        ? await blobToDataUrl(blob)
        : await compressForStorage(blob);

      onSave(path);
      handleClose();
    } catch (err) {
      setErrorMsg(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [selected, cleanedBlob, originalBlob, onSave, handleClose]);

  // ── Input handler ────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    handleFile(files[0]);
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto bg-[#F2F2F2]"
    >
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={false}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Replace Photo
        </h2>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* PICK */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-primary
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Take<br />Photo
                </span>
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photo
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ENCODING */}
        {phase === "encoding" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
              <p className="text-sm text-black/50 mt-1">Getting your photo ready.</p>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {phase === "preview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
            {errorMsg && <p style={{ color: "red", fontSize: 13 }}>{errorMsg}</p>}

            <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                        textTransform: "uppercase", letterSpacing: 2, opacity: 0.4, margin: 0 }}>
              {bgProcessing ? "This will take a moment…" : bgFailed ? "Original only" : "Tap to choose"}
            </p>

            {/* Side-by-side cards */}
            <div style={{ display: "flex", gap: 12 }}>

              {/* Original card */}
              <button
                onClick={() => setSelected("original")}
                style={{ flex: 1,
                         opacity: selected === "original" ? 1 : 0.5,
                         border: selected === "original" ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                         borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                         cursor: "pointer" }}
              >
                <div style={{ background: "black", minHeight: 176, position: "relative" }}>
                  {originalUrl && (
                    <img src={originalUrl} alt="Original"
                         style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }} />
                  )}
                  {selected === "original" && (
                    <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                  borderRadius: "50%", background: "black",
                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={12} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>Original</p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && setSelected("cleaned")}
                disabled={!cleanedUrl}
                style={{ flex: 1,
                         opacity: selected === "cleaned" && cleanedUrl ? 1 : 0.5,
                         border: selected === "cleaned" && cleanedUrl ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                         borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                         cursor: cleanedUrl ? "pointer" : "default" }}
              >
                <div style={{ background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                              minHeight: 176, position: "relative",
                              display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cleanedUrl ? (
                    <>
                      <img src={cleanedUrl} alt="Cleaned"
                           style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }} />
                      {selected === "cleaned" && (
                        <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                      borderRadius: "50%", background: "black",
                                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p style={{ fontSize: 12, fontWeight: "bold", textTransform: "uppercase",
                                opacity: 0.4, textAlign: "center", padding: "0 12px", margin: 0 }}>
                      Could not remove background
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Loader2 size={32} style={{ opacity: 0.5 }} className="animate-spin" />
                      <p style={{ fontSize: 13, fontWeight: "bold", textTransform: "uppercase",
                                  opacity: 0.5, margin: 0 }}>Processing</p>
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>Cleaned ✨</p>
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setPhase("pick")}
                className="flex-1 py-3 border-2 border-black rounded-xl font-display font-bold
                           text-sm uppercase tracking-tight bg-white
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                ↩ Retake
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected === "cleaned" && bgProcessing}
                className="flex-2 py-3 px-5 border-2 border-black rounded-xl font-display font-bold
                           text-sm uppercase tracking-tight bg-primary
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ flex: 2 }}
              >
                {selected === "cleaned" && bgProcessing ? "Processing…" : "✓ Use This Photo"}
              </button>
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
}
