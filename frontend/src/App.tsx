import { useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppShell } from './app/AppShell';
import { HomePage } from './app/HomePage';
import { GeneratorShell } from './app/GeneratorShell';
import type { ReportKey } from './app/reports';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './auth/LoginPage';
import { BIZ_INPUT_CHANNELS, bizBadgeLabel, emptyBizChannel, type BizChannelMetrics, type BizMetricKey, type BizPeriod, type BizRow } from './lib/business';
import { PLATFORM_CONFIG, emptyPlatformState, emptyPlatformStateMap, type PlatformKey, type PlatformResultData } from './lib/summary';

function defaultChannelData(): Record<string, BizChannelMetrics> {
  return Object.fromEntries(BIZ_INPUT_CHANNELS.map((c) => [c.key, emptyBizChannel()]));
}

function Splash() {
  return (
    <div className="app-splash">
      <img src="/mil-logo.png" alt="" width={44} height={44} />
      <span className="app-splash-bar" aria-hidden />
    </div>
  );
}

// Guards the generator routes: an unauthenticated visitor is bounced to
// /login (remembering where they were headed); the landing page stays public.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return <>{children}</>;
}

// Holds the cross-tab shared state and stays mounted across every route so
// upload progress / generated reports survive navigating to the home page
// and back.
function AppRoutes() {
  const [clientId, setClientId] = useState<number | null>(null);
  const [platformState, setPlatformState] = useState(emptyPlatformStateMap());
  const [omzetOld, setOmzetOld] = useState<number | null>(null);
  const [omzetCur, setOmzetCur] = useState<number | null>(null);
  const [channelData, setChannelData] = useState<Record<string, BizChannelMetrics>>(defaultChannelData);
  const [offlineStores, setOfflineStores] = useState<BizRow[]>([{ id: 1, name: 'Store 1', ...emptyBizChannel() }]);
  const [otherChannels, setOtherChannels] = useState<BizRow[]>([{ id: 2, name: 'Channel 1', ...emptyBizChannel() }]);
  const bizRowSeq = useRef(3);

  function setPlatformResult(key: PlatformKey, data: PlatformResultData) {
    setPlatformState((prev) => ({ ...prev, [key]: { done: true, error: null, data } }));
  }
  function invalidatePlatform(key: PlatformKey) {
    setPlatformState((prev) => (prev[key].done || prev[key].error ? { ...prev, [key]: emptyPlatformState() } : prev));
  }
  function handleChannelDataChange(chKey: string, metric: BizMetricKey, period: BizPeriod, v: number | null) {
    setChannelData((prev) => ({ ...prev, [chKey]: { ...prev[chKey], [metric]: { ...prev[chKey][metric], [period]: v } } }));
  }

  const bizState = { channelData, offlineStores, otherChannels, shopeeOmzet: { old: omzetOld, cur: omzetCur } };
  const doneCount = PLATFORM_CONFIG.filter((p) => platformState[p.key].done).length;
  const badges: Record<ReportKey, string> = {
    meta: platformState.meta.done ? '✓' : '—',
    shopee: platformState.shopee.done ? '✓' : '—',
    tiktok: platformState.tiktok.done ? '✓' : '—',
    business: bizBadgeLabel(bizState),
    summary: doneCount === PLATFORM_CONFIG.length ? '✓' : `${doneCount}/${PLATFORM_CONFIG.length}`,
    reports: '—',
    brands: '—',
  };

  const location = useLocation();
  const reduce = useReducedMotion();
  // Coarse key: all /generate/* share one key so switching report modules
  // doesn't remount the shell (upload state must survive).
  const groupKey = location.pathname.startsWith('/generate') ? 'gen' : location.pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={groupKey}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -8 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
    <Routes location={location}>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/generate" element={<Navigate to="/generate/meta" replace />} />
      <Route
        path="/generate/:platform"
        element={
          <RequireAuth>
            <GeneratorShell
              clientId={clientId}
              setClientId={setClientId}
              badges={badges}
              platformState={platformState}
              bizState={bizState}
              setPlatformResult={setPlatformResult}
              invalidatePlatform={invalidatePlatform}
              omzetOld={omzetOld}
              omzetCur={omzetCur}
              setOmzetOld={setOmzetOld}
              setOmzetCur={setOmzetCur}
              channelData={channelData}
              offlineStores={offlineStores}
              otherChannels={otherChannels}
              onChannelDataChange={handleChannelDataChange}
              setOfflineStores={setOfflineStores}
              setOtherChannels={setOtherChannels}
              nextRowId={() => bizRowSeq.current++}
            />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
}
