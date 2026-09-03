import { useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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

function GeneratorApp() {
  const [clientId, setClientId] = useState<number | null>(null);

  // ── Cross-tab shared state ──
  // platformState feeds the Summary Overview tab (Meta/Shopee/TikTok each
  // report their last-generated result here); the Business Overview state
  // (channelData/offlineStores/otherChannels) is shared between the Business
  // Overview tab's own cards and Summary Overview's Cost per Revenue card,
  // same as the original's module-level globals. It lives here, above the
  // router, so it survives navigating between /generate/:platform pages.
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

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/generate" element={<Navigate to="/generate/meta" replace />} />
      <Route
        path="/generate/:platform"
        element={
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
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-splash">
        <img src="/mil-logo.png" alt="" width={44} height={44} />
        <span className="app-splash-bar" aria-hidden />
      </div>
    );
  }
  if (!user) return <LoginPage />;

  return (
    <AppShell>
      <GeneratorApp />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
