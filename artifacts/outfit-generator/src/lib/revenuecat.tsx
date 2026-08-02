/**
 * RevenueCat integration — using @revenuecat/purchases-capacitor.
 *
 * • On iOS (Capacitor native): full purchase flow via StoreKit.
 * • In browser (Replit preview / web): purchases show "unavailable" gracefully.
 *
 * Premium access is ALWAYS derived from a live RC CustomerInfo fetch.
 * It is never stored in or read from localStorage.
 *
 * CustomerInfo is refreshed:
 *   1. On app launch (initial query mount)
 *   2. On app foreground (appStateChange listener)
 *   3. Immediately after a successful purchase (cache seeded + invalidated)
 *   4. Immediately after Restore Purchases (cache seeded + invalidated)
 *   5. Whenever RC pushes a server-side update (addCustomerInfoUpdateListener)
 *      — this catches refunds, expirations, and subscription lapses in real-time.
 */

// Static import — Vite must NOT code-split this into a lazy chunk.
// A dynamic import() in Capacitor's WKWebView hangs silently: the chunk
// never loads, configure() is never reached, and RC's servers never see the key.
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import React, { createContext, useContext, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ── Constants ─────────────────────────────────────────────────────────────────

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "My Digital Garage Pro";

// Hardcoded — RC public iOS keys are client-side only and safe to commit.
// Using import.meta.env risks a stale/wrong key from a different env group.
const RC_IOS_KEY = "appl_LqSZShMSaHakuPbuPObKqDUFfEq";

function getApiKey(): string {
  return RC_IOS_KEY;
}

// ── Timeout helper — prevents RC calls from hanging indefinitely ──────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[RevenueCat] ${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ── Initialization ────────────────────────────────────────────────────────────

export async function initializeRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const apiKey = getApiKey();

  // Fire-and-forget: do NOT await either of these.
  // On Capacitor + SPM the Swift→JS bridge response may never arrive for
  // setLogLevel/configure, but the native SDK initialises synchronously on
  // message receipt — awaiting just blocks the JS side forever.
  void Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
    .then(() => console.log("[RC] setLogLevel ✓"))
    .catch((e: unknown) => console.warn("[RC] setLogLevel failed:", e));

  void Purchases.configure({ apiKey })
    .then(() => console.log("[RC] configure() response ✓"))
    .catch((e: unknown) => console.error("[RC] configure() error:", e));

  // One microtask so the bridge messages are dispatched before we return.
  await Promise.resolve();
  console.log("[RevenueCat] configure() dispatched");
}

// ── Query key ─────────────────────────────────────────────────────────────────

const CUSTOMER_INFO_KEY = ["revenuecat", "customer-info"] as const;

// ── Subscription context ──────────────────────────────────────────────────────

function useSubscriptionContext() {
  const qc = useQueryClient();

  // staleTime: 0 — always considered stale so every mount/focus triggers a
  // fresh fetch. The foreground listener below handles mid-session refreshes.
  const customerInfoQuery = useQuery({
    queryKey: CUSTOMER_INFO_KEY,
    queryFn: async () => {
      if (!Capacitor.isNativePlatform()) return null;
      const { customerInfo } = await withTimeout(
        Purchases.getCustomerInfo(),
        8000,
        "getCustomerInfo",
      );
      return customerInfo;
    },
    staleTime: 0,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      if (!Capacitor.isNativePlatform()) return null;

      // Brief pause so configure()'s native message is processed before we ask
      // for offerings — Capacitor's bridge dispatches messages asynchronously.
      await new Promise(r => setTimeout(r, 500));

      const result = await withTimeout(
        Purchases.getOfferings(),
        10000,
        "getOfferings",
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const offerings = (result as any).offerings ?? result ?? null;
      console.log(
        "[RC] getOfferings result — current:",
        offerings?.current?.identifier ?? "null",
        "| packages:",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        JSON.stringify((offerings?.current?.availablePackages ?? []).map((p: any) =>
          ({ id: p.identifier, type: p.packageType, price: p.product?.priceString })
        )),
      );
      return offerings;
    },
    staleTime: 300 * 1000,
    retry: 3,
    retryDelay: 2000,
  });

  // ── Foreground + server-push listeners ─────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appListenerHandle: Awaited<ReturnType<typeof import("@capacitor/app").App.addListener>> | null = null;
    let rcCallbackId: string | null = null;

    (async () => {
      // 1. Recheck CustomerInfo every time the app comes back to the foreground.
      try {
        const { App } = await import("@capacitor/app");
        appListenerHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            console.log("[RevenueCat] App foregrounded — rechecking CustomerInfo");
            qc.invalidateQueries({ queryKey: CUSTOMER_INFO_KEY });
          }
        });
      } catch (err) {
        console.warn("[RevenueCat] Could not add appStateChange listener:", err);
      }

      // 2. RC server-push: fires when RC detects a refund, expiry, or any
      //    server-side entitlement change — revokes access in real-time.
      try {
        rcCallbackId = await Purchases.addCustomerInfoUpdateListener(
          (customerInfo) => {
            console.log("[RevenueCat] CustomerInfo pushed from server — updating cache");
            qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
          }
        );
      } catch (err) {
        console.warn("[RevenueCat] Could not add CustomerInfo listener:", err);
      }
    })();

    return () => {
      appListenerHandle?.remove();
      if (rcCallbackId !== null) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: rcCallbackId })
          .catch(() => {/* non-fatal */});
      }
    };
  }, [qc]);

  // ── Purchase ───────────────────────────────────────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: async (pkg: unknown) => {
      if (!Capacitor.isNativePlatform()) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg as never });
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      // Seed the cache immediately with the fresh CustomerInfo RC just returned,
      // then invalidate to schedule a background re-fetch for confirmation.
      qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
      qc.invalidateQueries({ queryKey: ["revenuecat"] });
    },
  });

  // ── Restore ────────────────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!Capacitor.isNativePlatform()) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.restorePurchases();
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      // Same pattern: seed immediately, then confirm in background.
      qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
      qc.invalidateQueries({ queryKey: ["revenuecat"] });
    },
  });

  // ── Entitlement check — derived purely from live RC data ───────────────────
  // Never reads localStorage. If customerInfo is null (not yet loaded or
  // browser), isSubscribed is false — safe default to free tier.
  const isSubscribed =
    customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  return {
    customerInfo:  customerInfoQuery.data ?? null,
    offerings:     offeringsQuery.data ?? null,
    isSubscribed,
    isLoading:     customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase:      purchaseMutation.mutateAsync,
    restore:       restoreMutation.mutateAsync,
    isPurchasing:  purchaseMutation.isPending,
    isRestoring:   restoreMutation.isPending,
    purchaseError: purchaseMutation.error as Error | null,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be inside <SubscriptionProvider>");
  return ctx;
}
