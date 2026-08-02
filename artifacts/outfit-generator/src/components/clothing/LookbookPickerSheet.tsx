/**
 * LookbookPickerSheet — lets the user add or remove an item from any saved group.
 *
 * Shows all saved groups with 3-thumbnail previews.
 * Groups that already contain the item show a filled checkmark.
 * Tapping a group toggles membership.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, BookOpen } from "lucide-react";
import {
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListOutfitsQueryKey,
  type ClothingItem,
  type SavedOutfit,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";

interface Props {
  item:    ClothingItem;
  onClose: () => void;
}

function ThreeThumbs({ outfit, highlightId }: { outfit: SavedOutfit; highlightId: number }) {
  const thumbs = outfit.items.slice(0, 3);
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => {
        const it = thumbs[i];
        return (
          <div
            key={i}
            className={`w-12 h-12 border-2 border-black rounded-lg overflow-hidden flex-shrink-0
                        ${it?.id === highlightId ? "ring-2 ring-offset-1 ring-black" : ""}`}
            style={{ background: "#F2F2F2" }}
          >
            {it?.imageObjectPath ? (
              <img
                src={getImageUrl(it.imageObjectPath)!}
                alt={it.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-black/20">—</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LookbookPickerSheet({ item, onClose }: Props) {
  const { data: outfits = [], isLoading } = useListOutfits();
  const addItem    = useAddItemToOutfit();
  const removeItem = useRemoveItemFromOutfit();
  const queryClient = useQueryClient();

  const toggle = (outfit: SavedOutfit) => {
    const contains = outfit.items.some((i) => i.id === item.id);
    if (contains) {
      removeItem.mutate(
        { id: outfit.id, itemId: item.id },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) },
      );
    } else {
      addItem.mutate(
        { id: outfit.id, data: { itemId: item.id } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) },
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[75] flex flex-col max-w-md mx-auto bg-[#F2F2F2]"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4
                   bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add to Lookbook
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

      {/* Item pill */}
      <div className="px-4 py-3 border-b border-black/10 bg-white/60 flex items-center gap-3">
        <div className="w-10 h-10 border-2 border-black rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#F2F2F2" }}>
          {item.imageObjectPath ? (
            <img src={getImageUrl(item.imageObjectPath)!} alt={item.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[9px] text-black/30">—</span>
            </div>
          )}
        </div>
        <span className="text-sm font-bold truncate">{item.name}</span>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse border-2 border-black rounded-xl" />
          ))
        ) : outfits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-10 h-10 text-black/20 mb-3" />
            <p className="font-bold text-sm">No groups yet.</p>
            <p className="text-xs text-black/50 mt-1">Save an outfit from your Garage first.</p>
          </div>
        ) : (
          outfits.map((outfit) => {
            const contains = outfit.items.some((i) => i.id === item.id);
            return (
              <button
                key={outfit.id}
                onClick={() => toggle(outfit)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                            ${contains
                              ? "border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                              : "border-black/20 bg-white/60 hover:border-black/50"
                            }`}
              >
                <ThreeThumbs outfit={outfit} highlightId={item.id} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{outfit.name}</p>
                  <p className="text-[10px] text-black/40 uppercase tracking-wide mt-0.5">
                    {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                              ${contains
                                ? "bg-black border-black"
                                : "bg-white border-black/25"
                              }`}
                >
                  <AnimatePresence>
                    {contains && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Check className="w-3.5 h-3.5 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
