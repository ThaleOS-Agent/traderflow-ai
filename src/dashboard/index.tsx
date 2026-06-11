import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Settings,
  Activity,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';
import { api } from './api';
import type { DashboardOverview, MarketDataItem } from './api';

type NavItem = 'overview' | 'trades' | 'markets' | 'settings';

const NAV_ITEMS: { id: NavItem; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trades', label: 'Trades', icon: TrendingUp },
  { id: 'markets', label: 'Markets', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 backdrop-blur-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {sub}
        </p>
      )}
    </div>
  );
}

function OverviewPanel({ data }: { data: DashboardOverview }) {
  const { portfolio, todayPnL, openPositionsCount, todayTradesCount } = data;
  const pnlPositive = todayPnL >= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Balance"
          value={`$${portfolio.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        />
        <StatCard
          label="Today's P&L"
          value={`${pnlPositive ? '+' : ''}$${todayPnL.toFixed(2)}`}
          positive={pnlPositive}
          sub={pnlPositive ? 'Profitable day' : 'Loss today'}
        />
        <StatCard label="Open Positions" value={String(openPositionsCount)} />
        <StatCard
          label="Win Rate"
          value={`${portfolio.winRate.toFixed(1)}%`}
          sub={`${todayTradesCount} trades today`}
          positive={portfolio.winRate >= 50}
        />
      </div>

      {/* Open positions */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Open Positions</h2>
          <span className="text-xs text-gray-500">{openPositionsCount} active</span>
        </div>
        {data.openPositions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-600">No open positions</div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {data.openPositions.map((t) => (
              <div key={t._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{t.symbol}</p>
                  <p className="text-xs text-gray-500 uppercase">{t.side} · {t.assetType}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">${t.entryPrice.toLocaleString()}</p>
                  <p className={`text-xs ${(t.profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(t.profit ?? 0) >= 0 ? '+' : ''}{(t.profit ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MarketsPanel({ data }: { data: MarketDataItem[] }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Live Market Data</h2>
      </div>
      <div className="divide-y divide-gray-800/60">
        {data.map((item) => {
          const positive = item.change24h >= 0;
          return (
            <div key={item.symbol} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-white">{item.symbol}</p>
                <p className="text-xs text-gray-500 uppercase">{item.assetType}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">${item.price.toLocaleString()}</p>
                <p className={`text-xs flex items-center justify-end gap-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
                  {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {positive ? '+' : ''}{item.change24h.toFixed(2)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [activeNav, setActiveNav] = useState<NavItem>('overview');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [markets, setMarkets] = useState<MarketDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getDashboardOverview(), api.getMarketData()])
      .then(([ov, mkt]) => {
        setOverview(ov);
        setMarkets(mkt);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900/40 border-r border-gray-800 py-6 px-3 hidden md:flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveNav(id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-left ${
              activeNav === id
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
            {activeNav === id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
          </button>
        ))}

        <div className="mt-auto">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-400">Engine live</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Mobile nav */}
        <div className="flex gap-2 mb-6 md:hidden overflow-x-auto pb-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                activeNav === id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 border border-gray-800 hover:border-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading dashboard…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-400 text-sm">{error}</div>
        ) : (
          <>
            {activeNav === 'overview' && overview && <OverviewPanel data={overview} />}
            {activeNav === 'markets' && <MarketsPanel data={markets} />}
            {activeNav === 'trades' && (
              <div className="text-center py-16 text-gray-600 text-sm">
                Trades panel — coming soon
              </div>
            )}
            {activeNav === 'settings' && (
              <div className="text-center py-16 text-gray-600 text-sm">
                Settings panel — coming soon
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
