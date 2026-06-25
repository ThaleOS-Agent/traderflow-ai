import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Globe2,
  Radar,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Zap
} from 'lucide-react';
import { api } from '../dashboard/api';

interface MarketingLandingProps {
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onPricingAction: () => void;
}

type HealthPayload = Awaited<ReturnType<typeof api.getHealth>>;
type LiveFeedPayload = Awaited<ReturnType<typeof api.getLiveFeed>>;
type StreamingPayload = Awaited<ReturnType<typeof api.getExchangeStreamingStatus>>;

const fallbackTape = [
  ['BTC/USD', '66,251.35', '+1.34%'],
  ['ETH/USD', '3,184.22', '+0.81%'],
  ['EUR/USD', '1.08245', '+0.23%'],
  ['XAU/USD', '2,354.18', '-0.12%'],
  ['USOIL', '78.42', '+0.48%'],
] as const;

const workflowCards = [
  {
    step: '01',
    title: 'AI Research',
    description: 'Models scan global markets, macro catalysts, and venue-specific liquidity in real time.',
    Icon: Globe2,
  },
  {
    step: '02',
    title: 'Smart Decisioning',
    description: 'Signals are ranked, risk-checked, and fused into one institutional-quality decision layer.',
    Icon: BrainCircuit,
  },
  {
    step: '03',
    title: 'Automated Execution',
    description: 'Approved trades route through paper or live execution with continuous monitoring and controls.',
    Icon: Zap,
  },
];

function compactNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  if (value >= 1000) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  if (value >= 1) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
  return value.toFixed(6);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function relativeTime(value: number | string | null | undefined) {
  if (!value) return 'No recent update';
  const timestamp = typeof value === 'string' ? Date.parse(value) : value;
  if (!Number.isFinite(timestamp)) return 'No recent update';

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 15) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function streamStatusTone(status: string) {
  if (status === 'connected') return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20';
  if (status === 'connecting') return 'bg-amber-500/15 text-amber-200 border-amber-400/20';
  return 'bg-rose-500/15 text-rose-200 border-rose-400/20';
}

function ProductPreview({
  health,
  marketData,
  streamStatus,
}: {
  health: HealthPayload | null;
  marketData: LiveFeedPayload['marketData'];
  streamStatus: StreamingPayload['streaming'] | null;
}) {
  const connections = streamStatus?.connections ?? [];
  const connectedCount = connections.filter(connection => connection.status === 'connected').length;
  const latestMarkets = marketData.slice(0, 4);
  const streamCards = connections.slice(0, 4);

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,27,40,0.96),rgba(8,12,20,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
            <Sparkles className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <p className="font-semibold text-white">Automation Dashboard</p>
            <p className="text-xs text-slate-500">Live backend state. Real market telemetry.</p>
          </div>
        </div>
        <div className={`rounded-full border px-3 py-1 text-[11px] font-medium ${health?.status === 'ok' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-200'}`}>
          {health?.status === 'ok' ? 'System healthy' : 'Syncing status'}
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Tracked assets', compactNumber(health?.trackedAssets), 'Cross-asset coverage'],
              ['Live opportunities', compactNumber(health?.activeOpportunities), 'AI-ranked now'],
              ['Connected streams', `${connectedCount}/${connections.length || 0}`, 'Native market feeds'],
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-sm text-emerald-300">{detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Market coverage</p>
                <p className="text-sm text-slate-500">Public live feed routed through the landing experience</p>
              </div>
              <button className="text-sm text-cyan-300">Live feed</button>
            </div>
            <div className="mt-4 space-y-3">
              {latestMarkets.map((item) => (
                <div key={item.symbol} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.provider} • {relativeTime(item.updatedAt)}</p>
                  </div>
                  <span className={`${item.change24h < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatPercent(item.change24h)}</span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${item.status === 'live' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
                    {item.status}
                  </span>
                  <span className="text-slate-300">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Stream topology</p>
                <p className="text-sm text-slate-500">Native venue socket status</p>
              </div>
              <Radar className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-4 space-y-2">
              {streamCards.length > 0 ? streamCards.map((connection) => (
                <div key={`${connection.venue}-${String(connection.isTestnet)}`} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize text-white">{connection.venue.replace('_', ' ')}</p>
                    <p className="text-xs text-slate-500">
                      {connection.symbols.length} symbols • {connection.isTestnet ? 'paper' : 'live'} • {relativeTime(connection.lastMessageAt)}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${streamStatusTone(connection.status)}`}>
                    {connection.status}
                  </span>
                </div>
              )) : (
                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-3 text-sm text-slate-400">
                  Waiting for stream health data.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Core services</p>
                <p className="text-sm text-slate-500">Execution and research readiness</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-amber-300" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['Trading engine', health?.tradingEngine || 'unknown'],
                ['Pattern scanner', health?.patternScanner || 'unknown'],
                ['Arbitrage', health?.arbitrageDetector || 'unknown'],
                ['Auto execution', health?.autoExecution || 'unknown'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-2 text-lg font-semibold capitalize text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
            <div className="flex items-center gap-3">
              <TimerReset className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="font-semibold text-white">Runtime verification</p>
                <p className="text-sm text-slate-500">
                  Health endpoint verified {relativeTime(health?.timestamp)} with native stream visibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingLanding({
  onPrimaryAction,
  onSecondaryAction,
  onPricingAction,
}: MarketingLandingProps) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [streaming, setStreaming] = useState<StreamingPayload['streaming'] | null>(null);
  const [marketData, setMarketData] = useState<LiveFeedPayload['marketData']>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      const [healthRes, feedRes, streamRes] = await Promise.allSettled([
        api.getHealth(),
        api.getLiveFeed('all'),
        api.getExchangeStreamingStatus(),
      ]);

      if (!active) return;
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (feedRes.status === 'fulfilled') setMarketData(feedRes.value.marketData);
      if (streamRes.status === 'fulfilled') setStreaming(streamRes.value.streaming);
    }

    load();
    const interval = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const marketTape = marketData.length > 0
    ? marketData.slice(0, 5).map(item => [
        item.label,
        formatPrice(item.price),
        formatPercent(item.change24h),
      ] as const)
    : fallbackTape;

  const proofCards = [
    {
      label: 'Global asset coverage',
      value: `${compactNumber(health?.trackedAssets)} tracked instruments`,
      detail: 'Crypto, FX, metals, indices, and oil running through one operational layer.',
    },
    {
      label: 'Native venue streaming',
      value: `${streaming?.connections.filter(connection => connection.status === 'connected').length ?? 0} live adapters connected`,
      detail: 'Landing now surfaces actual exchange websocket state, not placeholder transport claims.',
    },
    {
      label: 'Operational model',
      value: health?.agentOrchestrator === 'initialized' ? 'Research -> Decide -> Execute' : 'Initializing orchestration',
      detail: 'A product workflow users can understand, audit, and trust.',
    },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.08),transparent_28%),radial-gradient(circle_at_75%_12%,rgba(34,211,238,0.10),transparent_22%)]" />

      <section className="relative mx-auto max-w-[1440px] px-6 pb-12 pt-12 lg:px-10 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-[620px]">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
              <span className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-cyan-300' : 'bg-amber-300'}`} />
              Live market research, decisioning, and execution telemetry
            </div>

            <h1 className="mt-8 text-5xl font-semibold tracking-[-0.05em] text-white md:text-6xl lg:text-7xl">
              AI-powered market research, decisioning, and{' '}
              <span className="text-cyan-300">automated execution.</span>
            </h1>

            <p className="mt-8 max-w-[560px] text-lg leading-8 text-slate-300 md:text-xl">
              TradeFlow AI analyzes global markets 24/7, identifies high-probability opportunities,
              and executes with speed and precision through a user-facing product surface backed by live backend state.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                onClick={onPrimaryAction}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 text-base font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
              >
                Start automated trading
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onSecondaryAction}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.03] px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                Explore the live platform
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-8 text-base text-slate-400">
              Production heartbeat: <span className="text-cyan-300">{health?.status === 'ok' ? 'healthy' : 'syncing'}</span> •
              {' '}Last verified {relativeTime(health?.timestamp)}
            </p>
          </div>

          <ProductPreview health={health} marketData={marketData} streamStatus={streaming} />
        </div>
      </section>

      <section className="border-y border-white/8 bg-black/20">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5 text-sm lg:px-10">
          {marketTape.map(([label, value, change]) => (
            <div key={label} className="flex items-center gap-3 text-slate-300">
              <span className="font-medium text-white">{label}</span>
              <span>{value}</span>
              <span className={change.startsWith('-') ? 'text-rose-300' : 'text-emerald-300'}>{change}</span>
            </div>
          ))}
          <button
            onClick={onSecondaryAction}
            className="ml-auto inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
          >
            View live platform
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10">
        <div className="text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
            How TradeFlow AI works
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-400">
            The product is designed as one operational loop: research, validate, route, and monitor.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {workflowCards.map(({ step, title, description, Icon }) => (
            <div key={title} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-7">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/18 bg-cyan-400/10">
                  <Icon className="h-7 w-7 text-cyan-300" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-sm font-semibold text-slate-950">
                  {step}
                </div>
              </div>
              <h3 className="mt-7 text-2xl font-semibold text-white">{title}</h3>
              <p className="mt-4 text-base leading-7 text-slate-400">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="automation" className="mx-auto max-w-[1440px] px-6 pb-20 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,36,0.92),rgba(8,12,20,0.96))] p-8">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Automation-ready architecture</p>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
              Professional controls for users. Full automation under the hood.
            </h3>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
              Users get a clear operating surface with market context, execution visibility, and risk controls.
              The system handles the heavy lifting continuously in the background.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {proofCards.map(({ label, value, detail }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-3 text-lg font-semibold text-white">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-cyan-400/10 bg-cyan-400/[0.04] p-8">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Plans and onboarding</p>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Launch with paper mode. Scale into live routing when ready.
            </h3>
            <p className="mt-5 text-base leading-7 text-slate-300">
              The landing now reflects live backend state, while the app routes users into sign-in, plans, and the
              operational dashboard without splitting the experience into disconnected marketing and product worlds.
            </p>

            <div className="mt-8 space-y-3">
              {[
                `Native stream venues supported: ${streaming?.supportedVenues?.length ?? 0}`,
                `Agent orchestrator: ${health?.agentOrchestrator ?? 'loading'}`,
                `Auto execution engine: ${health?.autoExecution ?? 'loading'}`,
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={onPricingAction}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
              >
                Review plans
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onPrimaryAction}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                Open the app
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
