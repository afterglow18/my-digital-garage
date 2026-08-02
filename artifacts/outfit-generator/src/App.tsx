import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import AccountPage from './pages/account';
import WelcomePage from './pages/welcome';
import { SubscriptionProvider } from '@/lib/revenuecat';
import { queryClient } from '@/lib/queryClient';
import { BiometricLockProvider } from '@/context/BiometricLockContext';
import { useVisionIndexer } from '@/hooks/useVisionIndexer';

// initializeRevenueCat() is called once in main.tsx before React mounts.

// ── Vision indexer toast ──────────────────────────────────────────────────────
function VisionIndexerToast() {
  useVisionIndexer();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    const hide = () => setTimeout(() => setVisible(false), 1500);
    window.addEventListener("vision:indexing-start", show);
    window.addEventListener("vision:indexing-done",  hide as EventListener);
    return () => {
      window.removeEventListener("vision:indexing-start", show);
      window.removeEventListener("vision:indexing-done",  hide as EventListener);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200]
                    bg-black/80 text-white text-xs font-medium px-4 py-2 rounded-full
                    shadow-lg pointer-events-none whitespace-nowrap">
      🔍 Preparing photo search…
    </div>
  );
}

// ── First-launch welcome ──────────────────────────────────────────────────────
const ENTERED_KEY = "garage-entered";

function hasEntered(): boolean {
  try {
    return (
      sessionStorage.getItem(ENTERED_KEY) === "1" ||
      new URLSearchParams(window.location.search).get("preview") === "1"
    );
  } catch {
    return false;
  }
}

function markEntered() {
  try { sessionStorage.setItem(ENTERED_KEY, "1"); } catch {}
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"         component={WardrobePage}  />
        <Route path="/generate" component={GeneratePage}  />
        <Route path="/saved"    component={SavedPage}     />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/account"  component={AccountPage}   />
        <Redirect to="/" />
      </Switch>
    </AppLayout>
  );
}

// ── App shell — shows welcome on first session, then the app ─────────────────
function AppShell() {
  const [entered, setEntered] = useState<boolean>(hasEntered);

  const handleEnter = useCallback(() => {
    markEntered();
    setEntered(true);
  }, []);

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <VisionIndexerToast />
      {entered ? (
        <Router />
      ) : (
        <WelcomePage onEnter={handleEnter} />
      )}
    </WouterRouter>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <BiometricLockProvider>
          <AppShell />
        </BiometricLockProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}

export default App;
