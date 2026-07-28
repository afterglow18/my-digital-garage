/**
 * CleanUpPhotoSheet
 *
 * Full-screen overlay that runs @imgly/background-removal on an already-stored
 * image data URL, lets the user pick Original vs Cleaned, then immediately
 * calls onSave with the chosen data URL so the parent can optimistically update
 * the UI before the DB write finishes.
 *
 * Phases:
 *   processing ──(success)──► compare ──(user confirms)──► onSave() + onClose()
 *              └─(failure)──► error
 */
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import { removeBackground } from "@/lib/backgroundRemoval";

type Phase = "processing" | "compare" | "error";

interface Props {
  open:         boolean;
  imageDataUrl: string;                      // existing stored data URL
  onClose:      () => void;
  onSave:       (chosenDataUrl: string) => void;  // called immediately (optimistic)
}

export function CleanUpPhotoSheet({ open, imageDataUrl, onClose, onSave }: Props) {
  const [phase,      setPhase]      = useState<Phase>("processing");
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [selected,   setSelected]   = useState<"original" | "cleaned">("cleaned");

  // Bumped each time the sheet opens so stale async chains abort on unmount/close
  const genRef = useRef(0);

  useEffect(() => {
    if (!open || !imageDataUrl) return;

    const myGen = ++genRef.current;
    setPhase("processing");
    setCleanedUrl(null);
    setErrorMsg(null);
    setSelected("cleaned");

    removeBackground(imageDataUrl)
      .then((resultUrl) => {
        if (genRef.current !== myGen) return;
        setCleanedUrl(resultUrl);
        setPhase("compare");
      })
      .catch((err) => {
        if (genRef.current !== myGen) return;
        console.warn("Background removal failed:", err);
        setErrorMsg(
          err instanceof Error ? err.message : "Background removal failed. Please try again.",
        );
        setPhase("error");
      });

    return () => { genRef.current += 1; };  // abort on unmount
  }, [open, imageDataUrl]);

  if (!open) return null;

  const handleConfirm = () => {
    const chosen = selected === "cleaned" && cleanedUrl ? cleanedUrl : imageDataUrl;
    onSave(chosen);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto bg-[#F2F2F2]"
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Clean Up Photo
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* PROCESSING */}
        {phase === "processing" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Removing background…</p>
              <p className="text-sm text-black/50 mt-1">This runs fully on-device and may take a moment.</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {phase === "error" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div style={{ textAlign: "center" }}>
              <p className="font-display font-bold text-2xl uppercase tracking-tight text-red-600">
                Could not remove background
              </p>
              <p className="text-sm text-black/50 mt-2 max-w-xs mx-auto">{errorMsg}</p>
            </div>
            <button
              onClick={onClose}
              className="px-8 py-3 border-2 border-black rounded-xl font-display font-bold
                         text-sm uppercase tracking-tight bg-white
                         shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              ← Back
            </button>
          </div>
        )}

        {/* COMPARE */}
        {phase === "compare" && cleanedUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>

            <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                        textTransform: "uppercase", letterSpacing: 2, opacity: 0.4, margin: 0 }}>
              Tap to choose
            </p>

            {/* Side-by-side cards */}
            <div style={{ display: "flex", gap: 12 }}>

              {/* Original */}
              <button
                onClick={() => setSelected("original")}
                style={{
                  flex: 1,
                  opacity: selected === "original" ? 1 : 0.5,
                  border: selected === "original" ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0, cursor: "pointer",
                }}
              >
                <div style={{ background: "black", minHeight: 200, position: "relative" }}>
                  <img
                    src={imageDataUrl}
                    alt="Original"
                    style={{ width: "100%", objectFit: "contain", maxHeight: 200, display: "block" }}
                  />
                  {selected === "original" && (
                    <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22,
                                  borderRadius: "50%", background: "black",
                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={13} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>
                  Original
                </p>
              </button>

              {/* Cleaned */}
              <button
                onClick={() => setSelected("cleaned")}
                style={{
                  flex: 1,
                  opacity: selected === "cleaned" ? 1 : 0.5,
                  border: selected === "cleaned" ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0, cursor: "pointer",
                }}
              >
                {/* Checkerboard shows transparency */}
                <div style={{
                  background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                  minHeight: 200, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <img
                    src={cleanedUrl}
                    alt="Cleaned"
                    style={{ width: "100%", objectFit: "contain", maxHeight: 200, display: "block" }}
                  />
                  {selected === "cleaned" && (
                    <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22,
                                  borderRadius: "50%", background: "black",
                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={13} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>
                  Cleaned ✨
                </p>
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={onClose}
                className="flex-1 py-3 border-2 border-black rounded-xl font-display font-bold
                           text-sm uppercase tracking-tight bg-white
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                ← Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected === "cleaned" && !cleanedUrl}
                className="flex-2 py-3 px-5 border-2 border-black rounded-xl font-display font-bold
                           text-sm uppercase tracking-tight bg-primary
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ flex: 2 }}
              >
                {selected === "cleaned" ? "✓ Save Cleaned Version" : "✓ Save Original"}
              </button>
            </div>

          </div>
        )}

      </div>
    </motion.div>
  );
}
