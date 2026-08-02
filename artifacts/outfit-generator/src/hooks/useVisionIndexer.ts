/**
 * useVisionIndexer — background photo-analysis hook.
 *
 * On mount, finds all items that need vision indexing (visionVersion below the
 * current threshold), then processes them one-at-a-time with a 350 ms gap so
 * the UI stays responsive. Newly added/updated photos are queued by calling
 * queueItemForIndexing(id) directly from the mutation that adds/changes a photo.
 *
 * Version thresholds:
 *   0   = unanalyzed
 *   1   = iOS Vision (don't redo on web)
 *   4   = web canvas (current)
 *   5   = web analyzed, no labels found — skip retry
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { listClothing, updateClothingItem } from "@/lib/localDB";
import { analyzeItemPhoto } from "@/lib/vision";
import { getListClothingQueryKey } from "@/hooks/useLocalDB";
import { getImageUrl } from "@/lib/utils";
import type { ClothingItem } from "@/lib/db";

type IndexedItem = ClothingItem & { visionLabels?: string[]; visionText?: string[]; visionVersion?: number };

const WEB_VERSION = 4;
const IOS_VERSION = 2; // v1 = object labels only (no colors); v2 = merged with canvas colors

function needsIndexing(item: IndexedItem, isNative: boolean): boolean {
  const v = item.visionVersion ?? 0;
  if (v === 5) return false; // explicitly marked as no-labels, skip
  return v < (isNative ? IOS_VERSION : WEB_VERSION);
}

// Singleton queue for items added/updated after initial scan
const immediateQueue = new Set<number>();

/** Call from any mutation that attaches or replaces an item's photo. */
export function queueItemForIndexing(itemId: number) {
  immediateQueue.add(itemId);
}

export function useVisionIndexer() {
  const queryClient = useQueryClient();
  const runningRef  = useRef(false);

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    const run = async () => {
      const isNative = Capacitor.isNativePlatform();
      const allItems = (await listClothing()) as IndexedItem[];
      const queue    = allItems.filter((i) => i.imageObjectPath && needsIndexing(i, isNative));

      if (queue.length === 0) return;

      window.dispatchEvent(
        new CustomEvent("vision:indexing-start", { detail: { count: queue.length } }),
      );

      for (const item of queue) {
        // Also drain the immediate queue each iteration
        if (immediateQueue.has(item.id)) immediateQueue.delete(item.id);

        const url = getImageUrl(item.imageObjectPath!);
        if (!url) continue;

        try {
          const result = await analyzeItemPhoto(url);
          await updateClothingItem(item.id, {
            visionLabels:  result.labels,
            visionText:    result.text,
            visionVersion: result.version,
          } as Parameters<typeof updateClothingItem>[1]);
        } catch {
          // silent — one failure should not block the rest
        }

        await new Promise<void>((r) => setTimeout(r, 350));
      }

      // Process any items added during the scan
      const extra = [...immediateQueue];
      immediateQueue.clear();
      for (const id of extra) {
        const item = allItems.find((i) => i.id === id);
        if (!item?.imageObjectPath) continue;
        const url = getImageUrl(item.imageObjectPath);
        if (!url) continue;
        try {
          const result = await analyzeItemPhoto(url);
          await updateClothingItem(id, {
            visionLabels:  result.labels,
            visionText:    result.text,
            visionVersion: result.version,
          } as Parameters<typeof updateClothingItem>[1]);
        } catch { /* silent */ }
        await new Promise<void>((r) => setTimeout(r, 350));
      }

      queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
      window.dispatchEvent(new CustomEvent("vision:indexing-done"));
    };

    run().finally(() => { runningRef.current = false; });
  }, []);
}
