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

interface MarketingLandingProps {
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onPricingAction: () => void;
}

const marketTape = [
  ['S&P 500', '5,347.21', '+0.62%'],
  ['NASDAQ 100', '18,743.65', '+0.81%'],
  ['EUR/USD', '1.08245', '+0.23%'],
  ['GOLD', '2,354.18', '-0.12%'],
  ['BTC/USD', '66,251.35', '+1.34%'],
];

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

const proofCards = [
  {
    label: 'Global asset coverage',
    value: 'Crypto, FX, metals, indices, and oil',
    detail: 'One automation layer across fragmented venues.',
  },
  {
    label: 'Operational model',
    value: 'Research -> Decide -> Execute',
    detail: 'A product workflow users can understand, audit, and trust.',
  },
  {
    label: 'Risk discipline',
    value: 'Policy-driven before every dispatch',
    detail: 'Exposure, drawdown, and strategy eligibility are checked centrally.',
  },
];

function ProductPreview() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,27,40,0.96),rgba(8,12,20,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.42)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <p className="text-white font-semibold">Automation Dashboard</p>
            <p className="text-xs text-slate-500">Institutional execution. Intelligent automation.</p>
          </div>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          System healthy
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Portfolio value', '$2.84M', '+0.87% today'],
              ['Signals today', '24', '12 approved'],
              ['Execution latency', '35ms', 'Median dispatch'],
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
                <p className="text-white font-semibold">Market coverage</p>
                <p className="text-sm text-slate-500">Cross-asset opportunity grid</p>
              </div>
              <button className="text-sm text-cyan-300">View all</button>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ['BTC/USD', '+1.12%', 'Buy', '72%'],
                ['EUR/USD', '+0.23%', 'Buy', '68%'],
                ['XAU/USD', '-0.12%', 'Sell', '61%'],
                ['US30', '+0.35%', 'Buy', '64%'],
              ].map(([symbol, change, action, confidence]) => (
                <div key={symbol} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-3 text-sm">
                  <div>
                    <p className="text-white font-medium">{symbol}</p>
                    <p className="text-xs text-slate-500">Live market stream</p>
                  </div>
                  <span className={`${change.startsWith('-') ? 'text-rose-300' : 'text-emerald-300'}`}>{change}</span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${action === 'Buy' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
                    {action}
                  </span>
                  <span className="text-slate-400">{confidence}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">Risk overview</p>
                <p className="text-sm text-slate-500">Automated before every trade</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-amber-300" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['Overall risk', 'Moderate'],
                ['Exposure', '28.7%'],
                ['VaR', '$78.4k'],
                ['Drawdown', '4.32%'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">Execution feed</p>
                <p className="text-sm text-slate-500">Recent routed orders</p>
              </div>
              <Radar className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-4 space-y-2">
              {[
                ['10:24:31', 'EURUSD', 'Buy', '1.4M'],
                ['10:24:19', 'XAUUSD', 'Sell', '250K'],
                ['10:24:07', 'NAS100', 'Buy', '2 contracts'],
                ['10:23:58', 'GBPUSD', 'Buy', '750K'],
              ].map(([time, symbol, side, size]) => (
                <div key={`${time}-${symbol}`} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-3 text-sm">
                  <span className="text-slate-500">{time}</span>
                  <span className="text-white font-medium">{symbol}</span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${side === 'Buy' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
                    {side}
                  </span>
                  <span className="text-slate-400">{size}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
            <div className="flex items-center gap-3">
              <TimerReset className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-white font-semibold">Automation status</p>
                <p className="text-sm text-slate-500">12 active strategies, 99.99% monitored uptime</p>
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
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.08),transparent_28%),radial-gradient(circle_at_75%_12%,rgba(34,211,238,0.10),transparent_22%)]" />

      <section className="relative mx-auto max-w-[1440px] px-6 pb-12 pt-12 lg:px-10 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-[620px]">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              AI-powered. Globally connected. Always executing.
            </div>

            <h1 className="mt-8 text-5xl font-semibold tracking-[-0.05em] text-white md:text-6xl lg:text-7xl">
              AI-powered market research, decisioning, and{' '}
              <span className="text-cyan-300">automated execution.</span>
            </h1>

            <p className="mt-8 max-w-[560px] text-lg leading-8 text-slate-300 md:text-xl">
              TradeFlow AI analyzes global markets 24/7, identifies high-probability opportunities,
              and executes with speed and precision so users can focus on growth, not screens.
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
                Explore the platform
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-8 text-base text-slate-400">
              Trusted by <span className="text-cyan-300">15,000+</span> traders and institutions worldwide.
            </p>
          </div>

          <ProductPreview />
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
            View all markets
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
              Start with paper trading, upgrade when ready.
            </h3>
            <p className="mt-5 text-base leading-7 text-slate-400">
              The product defaults users into a safer paper-trading mode while exposing the same workflow used for live execution.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Paper trading enabled by default',
                'Auto-trading gated by strategy and risk settings',
                'Multi-venue execution surface for exchanges and brokers',
                'Live feeds, signals, and order telemetry in one dashboard',
              ].map(item => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={onPricingAction}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-3 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Review plans
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
