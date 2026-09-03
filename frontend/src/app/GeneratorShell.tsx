import { Navigate, useParams } from 'react-router-dom';
import { MetaTab } from '../features/meta/MetaTab';
import { ShopeeTab } from '../features/shopee/ShopeeTab';
import { TiktokTab } from '../features/tiktok/TiktokTab';
import { BusinessTab } from '../features/business/BusinessTab';
import { SummaryTab } from '../features/summary/SummaryTab';
import { ClientPicker } from '../features/reports/ClientPicker';
import { ReportsTab } from '../features/reports/ReportsTab';
import { BrandSettingsPage } from '../features/brands/BrandSettingsPage';
import { Reveal } from '../components/Reveal';
import { HeaderIllustration } from '../components/HeaderIllustration';
import { GenSidebar } from './GenSidebar';
import { isReportKey, reportByKey, type ReportKey } from './reports';
import type { BizChannelMetrics, BizMetricKey, BizPeriod, BizRow, BizState } from '../lib/business';
import type { PlatformKey, PlatformResultData, PlatformStateMap } from '../lib/summary';

export interface GeneratorShellProps {
  clientId: number | null;
  setClientId: (id: number | null) => void;
  badges: Record<ReportKey, string>;
  platformState: PlatformStateMap;
  bizState: BizState;
  setPlatformResult: (key: PlatformKey, data: PlatformResultData) => void;
  invalidatePlatform: (key: PlatformKey) => void;
  omzetOld: number | null;
  omzetCur: number | null;
  setOmzetOld: (v: number | null) => void;
  setOmzetCur: (v: number | null) => void;
  channelData: Record<string, BizChannelMetrics>;
  offlineStores: BizRow[];
  otherChannels: BizRow[];
  onChannelDataChange: (chKey: string, metric: BizMetricKey, period: BizPeriod, v: number | null) => void;
  setOfflineStores: (rows: BizRow[]) => void;
  setOtherChannels: (rows: BizRow[]) => void;
  nextRowId: () => number;
}

// Everything that used to live directly in App's render: the client picker
// and all six always-mounted report panels (kept mounted so upload progress
// survives switching between them). The active panel is driven by the
// /generate/:platform URL param instead of local state. A desktop sidebar
// lists every report type for one-click switching; on mobile that job falls
// to the global drawer.
export function GeneratorShell(props: GeneratorShellProps) {
  const { platform } = useParams();
  if (!isReportKey(platform)) return <Navigate to="/generate/meta" replace />;
  const activeTab: ReportKey = platform;
  const active = reportByKey(activeTab);

  return (
    <div className="gen-wrap bleed">
      <GenSidebar badges={props.badges} />

      <div className="gen-main" id="app">
        <Reveal className="gen-head" key={activeTab}>
          <div className="gen-head-text">
            <span className="gen-head-eyebrow" style={{ color: active.accent }}>
              {active.tagline}
            </span>
            <h1 className="gen-head-title">{active.label}</h1>
            <p className="gen-head-desc">{active.desc}</p>
          </div>
          <HeaderIllustration report={activeTab} accent={active.accent} />
        </Reveal>

        {activeTab === 'brands' ? (
          <BrandSettingsPage />
        ) : (
          <>
        <ClientPicker clientId={props.clientId} onChange={props.setClientId} />

        <MetaTab
          isActive={activeTab === 'meta'}
          clientId={props.clientId}
          onGenerated={(data) => props.setPlatformResult('meta', data)}
          onInvalidate={() => props.invalidatePlatform('meta')}
        />
        <ShopeeTab
          isActive={activeTab === 'shopee'}
          clientId={props.clientId}
          omzetOld={props.omzetOld}
          omzetCur={props.omzetCur}
          onOmzetOldChange={props.setOmzetOld}
          onOmzetCurChange={props.setOmzetCur}
          onGenerated={(data) => props.setPlatformResult('shopee', data)}
          onInvalidate={() => props.invalidatePlatform('shopee')}
        />
        <TiktokTab
          isActive={activeTab === 'tiktok'}
          clientId={props.clientId}
          onGenerated={(data) => props.setPlatformResult('tiktok', data)}
          onInvalidate={() => props.invalidatePlatform('tiktok')}
        />
        <ReportsTab isActive={activeTab === 'reports'} clientId={props.clientId} />
        <BusinessTab
          isActive={activeTab === 'business'}
          channelData={props.channelData}
          offlineStores={props.offlineStores}
          otherChannels={props.otherChannels}
          shopeeOmzet={{ old: props.omzetOld, cur: props.omzetCur }}
          onChannelDataChange={props.onChannelDataChange}
          onOfflineStoresChange={props.setOfflineStores}
          onOtherChannelsChange={props.setOtherChannels}
          nextRowId={props.nextRowId}
        />
        <SummaryTab isActive={activeTab === 'summary'} platformState={props.platformState} bizState={props.bizState} />
          </>
        )}
      </div>
    </div>
  );
}
