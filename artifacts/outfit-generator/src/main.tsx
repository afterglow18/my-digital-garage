import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeRevenueCat } from './lib/revenuecat';

// Kick off RC configuration immediately, before React mounts, so the SDK
// is ready by the time any component tries to fetch offerings or customer info.
initializeRevenueCat().catch(console.warn);

// IndexedDB initialises lazily on first query — no explicit init needed here.
// All data is local; no API base URL or token setup required.

createRoot(document.getElementById('root')!).render(<App />);
