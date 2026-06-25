import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, KeyRound, RefreshCw, ShieldCheck, Waves, Wifi } from 'lucide-react';
import { api, type AccountMonitorResponse } from './api';

const EXCHANGE_OPTIONS = [
  { value: 'binance_futures', label: 'Binance Futures' },
  { value: 'bybit_v5', label: 'Bybit V5' },
  { value: 'kraken_v2', label: 'Kraken' },
  { value: 'coinbase_advanced_trade', label: 'Coinbase' },
  { value: 'okx_v5', label: 'OKX' },
  { value: 'oanda_practice', label: 'OANDA Practice' },
  { value: 'paper', label: 'Paper Account' }
];

function formatDate(value: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('healthy') || normalized.includes('consistent') || normalized.includes('authenticated')) {
    return 'bg-green-500/15 text-green-200 border-green-500/20';
  }
  if (normalized.includes('degraded') || normalized.includes('stale') || normalized.includes('pending') || normalized.includes('paper')) {
    return 'bg-yellow-500/15 text-yellow-100 border-yellow-500/20';
  }
  return 'bg-red-500/15 text-red-200 border-red-500/20';
}

export function AccountConnectionsPage({ onBack }: { onBack: () => void }) {
  const [monitor, setMonitor] = useState<AccountMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    exchange: 'paper',
    label: 'Paper Account',
    accountId: '',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    authenticated: false,
  });

  const load = useCallback(async () => {
    try {
      const response = await api.getAccountConnectionsMonitor();
      setMonitor(response.monitor);
    } catch (err) {
      setError((err as Error).message || 'Failed to load account monitor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConnection = async () => {
    setSaving(true);
    setError('');
    try {
      await api.saveAccountConnection({
        ...form,
        environment: form.exchange === 'paper' ? 'paper' : form.exchange === 'oanda_practice' ? 'practice' : 'testnet',
        authMethod: form.exchange === 'coinbase_advanced_trade' ? 'ED25519' : form.exchange === 'kraken_v2' ? 'RSA' : 'HMAC_SHA256',
        privateTrading: false,
        permissions: {
          readAccount: true,
          readOrders: true,
          trade: false,
          withdraw: false,
        }
      });
      await load();
    } catch (err) {
      setError((err as Error).message || 'Failed to save account connection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07111b] flex items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-cyan-300/40 border-t-cyan-300 animate-spin" />
          Loading THAELIA account monitor…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111b] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/70">THAELIA</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Private Account WebSocket Monitor</h1>
              <p className="mt-3 max-w-3xl text-sm text-cyan-100/75">
                Paper-first authenticated account connectivity with heartbeat monitoring, session rotation, reconciliation status, and live-trading safety gates.
              </p>
            </div>
            {monitor && (
              <div className="grid gap-2 text-sm text-cyan-100/80">
                <p>Paper trading: {monitor.flags.enablePaperTrading ? 'enabled' : 'disabled'}</p>
                <p>Live trading: {monitor.flags.enableLiveTrading ? 'enabled' : 'disabled'}</p>
                <p>Demo mode: {monitor.flags.demoMode ? 'enabled' : 'disabled'}</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</span>
          </div>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {(monitor?.cards ?? []).map(card => (
              <div key={card.exchange} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{card.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{card.config.environment} · {card.config.authMethod ?? 'HMAC_SHA256'}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] ${statusTone(card.authenticated ? 'authenticated' : 'unauthenticated')}`}>
                    {card.authenticated ? 'Authenticated' : 'Unauthenticated'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Private stream</p>
                    <p className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${statusTone(card.privateStreamStatus)}`}>{card.privateStreamStatus}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Heartbeat</p>
                    <p className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${statusTone(card.heartbeatStatus)}`}>{card.heartbeatStatus}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last pong</p>
                    <p className="mt-2 text-white">{formatDate(card.lastPong)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Reconnect count</p>
                    <p className="mt-2 text-white">{card.reconnectCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Session rotation</p>
                    <p className="mt-2 text-white">{formatDate(card.nextSessionRotation)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Listen key refresh</p>
                    <p className="mt-2 text-white">{formatDate(card.listenKeyRefreshTimer)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest balance event</p>
                    <p className="mt-2 text-white">{card.latestBalanceEvent ? String(card.latestBalanceEvent.eventType ?? 'BALANCE_UPDATE') : 'None yet'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest order event</p>
                    <p className="mt-2 text-white">{card.latestOrderEvent ? String(card.latestOrderEvent.eventType ?? 'ORDER_UPDATE') : 'None yet'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[11px] ${statusTone(card.stateReconciliationStatus)}`}>
                    Reconciliation: {card.stateReconciliationStatus}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] ${statusTone(card.tradingPermissionStatus)}`}>
                    Trading: {card.tradingPermissionStatus}
                  </span>
                  {card.withdrawalPermissionWarning && (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] text-red-200">
                      Withdrawal warning
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  {card.assistantMessage}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/15 p-3">
                  <KeyRound className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Register account connector</p>
                  <p className="text-xs text-slate-500">Credentials stay backend-only. Live mode remains blocked unless explicitly enabled.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <select
                  value={form.exchange}
                  onChange={(event) => {
                    const option = EXCHANGE_OPTIONS.find(item => item.value === event.target.value);
                    setForm(current => ({ ...current, exchange: event.target.value, label: option?.label || event.target.value }));
                  }}
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"
                >
                  {EXCHANGE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input value={form.label} onChange={event => setForm(current => ({ ...current, label: event.target.value }))} placeholder="Label" className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-slate-600" />
                <input value={form.accountId} onChange={event => setForm(current => ({ ...current, accountId: event.target.value }))} placeholder="Account ID" className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-slate-600" />
                <input value={form.apiKey} onChange={event => setForm(current => ({ ...current, apiKey: event.target.value }))} placeholder="API key" className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-slate-600" />
                <input type="password" value={form.apiSecret} onChange={event => setForm(current => ({ ...current, apiSecret: event.target.value }))} placeholder="API secret" className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-slate-600" />
                <input type="password" value={form.passphrase} onChange={event => setForm(current => ({ ...current, passphrase: event.target.value }))} placeholder="Passphrase / account token" className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-slate-600" />
                <button
                  onClick={saveConnection}
                  disabled={saving}
                  className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save connector'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /></div>
                <div>
                  <p className="text-base font-semibold text-white">Security checklist</p>
                  <p className="text-xs text-slate-500">Paper-first activation, least privilege, and no frontend secret exposure.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Never expose API keys, secrets, listen keys, auth tokens, or private account identifiers in the frontend.</p>
                <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Disable withdrawal permission on every exchange key before marking the connector safe.</p>
                <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Recommend IP allowlisting and keep live trading disabled until reconciliation passes.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-yellow-500/15 p-3"><Waves className="h-5 w-5 text-yellow-200" /></div>
                <div>
                  <p className="text-base font-semibold text-white">THAELIA recommendations</p>
                  <p className="text-xs text-slate-500">Current deployment guardrails.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {(monitor?.recommendations ?? []).map(item => (
                  <p key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">{item}</p>
                ))}
                {(monitor?.warnings ?? []).map(item => (
                  <p key={item} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{item}</p>
                ))}
              </div>
            </div>

            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white hover:bg-white/[0.06]"
            >
              <RefreshCw className="h-4 w-4" /> Refresh monitor
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/15 p-3"><Wifi className="h-5 w-5 text-cyan-300" /></div>
            <div>
              <p className="text-base font-semibold text-white">Paper-first activation path</p>
              <p className="text-xs text-slate-500">Recommended rollout before enabling any live venue.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm text-slate-300">
            {['Connect in read-only mode', 'Authenticate private stream', 'Run reconciliation', 'Enable live only after explicit approval'].map(step => (
              <div key={step} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">{step}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
