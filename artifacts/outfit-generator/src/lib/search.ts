/**
 * search.ts — Scored full-text search across wardrobe items and lookbook groups.
 *
 * Field weights (higher = more important):
 *   name / brand        → 10
 *   color / category    → 7
 *   size / notes        → 5
 *   season/occasion/price/date → 3
 *   visionLabels/text   → 2
 */

import type { ClothingItem, SavedOutfit } from "@/lib/db";

export type IndexedItem = ClothingItem & {
  visionLabels?: string[];
  visionText?:   string[];
};

const WEIGHTS: { field: keyof IndexedItem; weight: number }[] = [
  { field: "name",          weight: 10 },
  { field: "brand",         weight: 10 },
  { field: "color",         weight:  7 },
  { field: "category",      weight:  7 },
  { field: "size",          weight:  5 },
  { field: "notes",         weight:  5 },
  { field: "season",        weight:  3 },
  { field: "occasion",      weight:  3 },
  { field: "purchasePrice", weight:  3 },
  { field: "purchaseDate",  weight:  3 },
  { field: "visionLabels",  weight:  2 },
  { field: "visionText",    weight:  2 },
];

function scoreItem(item: IndexedItem, q: string): number {
  let score = 0;
  for (const { field, weight } of WEIGHTS) {
    const raw = item[field];
    if (!raw) continue;
    const haystack = (Array.isArray(raw) ? raw.join(" ") : String(raw)).toLowerCase();
    if (haystack === q)            score += weight * 3;
    else if (haystack.startsWith(q)) score += weight * 2;
    else if (haystack.includes(q)) score += weight;
  }
  return score;
}

export interface SearchResults {
  items:  IndexedItem[];
  groups: SavedOutfit[];
}

export function searchAll(
  allItems: IndexedItem[],
  outfits:  SavedOutfit[],
  rawQuery: string,
): SearchResults {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { items: [], groups: [] };

  const scoredItems = allItems
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const matchedIds = new Set(scoredItems.map(({ item }) => item.id));

  const matchedGroups = outfits.filter((outfit) => {
    const nameMatch  = outfit.name.toLowerCase().includes(q);
    const notesMatch = (outfit.notes ?? "").toLowerCase().includes(q);
    const itemMatch  = (outfit.items ?? []).some((i) => matchedIds.has(i.id));
    return nameMatch || notesMatch || itemMatch;
  });

  return {
    items:  scoredItems.map(({ item }) => item),
    groups: matchedGroups,
  };
}
