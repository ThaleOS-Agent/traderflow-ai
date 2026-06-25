import { useCallback, useEffect, useState } from 'react';
import { Link2, Plus, Trash2, AlertCircle, Waves, ShieldCheck, Eye } from 'lucide-react';
import { api, type ExchangeCapabilitiesResponse, type ExchangeConnection, type ExchangeConnectionPayload, type ExchangeVenue, type StreamingStatus } from './api';

interface VenueCapabilityFallback extends ExchangeVenue {
  configured?: boolean;
  connection?: ExchangeConnection | null;
}

const defaultForm: ExchangeConnectionPayload = {
  name: 'binance',
  apiKey: '',
  apiSecret: '',
  passphrase: '',
  isTestnet: true,
};

const SUPPORTED_VENUES = [
  { value: 'deriv', label: 'Deriv', type: 'Broker', hint: 'API token + optional app ID in passphrase' },
  { value: 'binance', label: 'Binance', type: 'Exchange', hint: 'API key + secret' },
  { value: 'coinbase', label: 'Coinbase Advanced Trade', type: 'Exchange', hint: 'API key + secret + passphrase' },
  { value: 'kraken', label: 'Kraken', type: 'Exchange', hint: 'API key + secret' },
  { value: 'kucoin', label: 'KuCoin', type: 'Exchange', hint: 'API key + secret + passphrase' },
  { value: 'bybit', label: 'Bybit', type: 'Exchange', hint: 'API key + secret' },
  { value: 'gemini', label: 'Gemini', type: 'Exchange', hint: 'API key + secret' },
  { value: 'bitfinex', label: 'Bitfinex', type: 'Exchange', hint: 'API key + secret' },
  { value: 'interactive_brokers', label: 'Interactive Brokers', type: 'Broker', hint: 'OAuth bearer token' },
  { value: 'oanda', label: 'OANDA', type: 'Broker', hint: 'Token + account ID' },
];

function venueMeta(name: string) {
  return SUPPORTED_VENUES.find(venue => venue.value === name) ?? {
    value: name,
    label: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    type: 'Connection',
    hint: 'API credentials',
  };
}

function fieldPlaceholders(name: string) {
  if (name === 'deriv') {
    return {
      apiKey: 'Deriv API token',
      apiSecret: 'Optional secret (leave blank)',
      passphrase: 'Deriv app ID (optional, defaults to configured app ID)'
    };
  }

  if (name === 'oanda') {
    return {
      apiKey: 'API key / token',
      apiSecret: 'API secret',
      passphrase: 'Passphrase or OANDA account ID'
    };
  }

  return {
    apiKey: 'API key / token',
    apiSecret: 'API secret',
    passphrase: 'Passphrase or OANDA account ID'
  };
}

export function ExchangeConnections() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [supportedVenues, setSupportedVenues] = useState<ExchangeCapabilitiesResponse['venues']>([]);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus | null>(null);
  const [platformSocket, setPlatformSocket] = useState<{
    path: string;
    authEvent: string;
    subscribeEvent: string;
    channels: string[];
    notes: string;
  } | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<ExchangeCapabilitiesResponse['venues'][number] | null>(null);
  const [form, setForm] = useState<ExchangeConnectionPayload>(defaultForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState('');
  const [balanceMessage, setBalanceMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [connectionsResult, capabilitiesResult, streamingResult] = await Promise.allSettled([
      api.getExchangeConnections(),
      api.getExchangeCapabilities(),
      api.getExchangeStreamingStatus(),
    ]);

    if (connectionsResult.status === 'fulfilled') {
      setConnections(connectionsResult.value.connections);
    } else {
      setConnections([]);
    }

    if (capabilitiesResult.status === 'fulfilled') {
      const fallbackSupported = connectionsResult.status === 'fulfilled' ? connectionsResult.value.supported ?? [] : [];
      setSupportedVenues(capabilitiesResult.value.venues?.length ? capabilitiesResult.value.venues : fallbackSupported);
      setPlatformSocket(capabilitiesResult.value.platformWebSocket ?? null);
    } else {
      setSupportedVenues([]);
      setPlatformSocket(null);
    }

    if (streamingResult.status === 'fulfilled') {
      setStreamingStatus(streamingResult.value.streaming);
    } else {
      setStreamingStatus(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(() => { void load(); }, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    setBalanceMessage('');
    try {
      await api.saveExchangeConnection({ ...form, isActive: true, testConnection: false });
      setForm(defaultForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message || 'Failed to save exchange');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id: string) => {
    setBalanceMessage('');
    await api.activateExchangeConnection(id);
    await load();
  };

  const deactivate = async (id: string) => {
    setBalanceMessage('');
    await api.deactivateExchangeConnection(id);
    await load();
  };

  const remove = async (id: string) => {
    setBalanceMessage('');
    await api.deleteExchangeConnection(id);
    await load();
  };

  const loadBalance = async (exchange: string) => {
    setBalanceLoading(exchange);
    setError('');
    setBalanceMessage('');
    try {
      const res = await api.getExchangeBalance(exchange);
      const entries = Object.entries(res.balances || {});
      setBalanceMessage(
        entries.length
          ? `${venueMeta(exchange).label} balance loaded. ${entries.length} asset balances returned.`
          : `${venueMeta(exchange).label} balance loaded, but no assets were returned.`
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to load exchange balance');
    } finally {
      setBalanceLoading('');
    }
  };

  const openVenueForm = (name: string) => {
    setForm(f => ({ ...f, name }));
    setShowForm(true);
  };

  const venues: VenueCapabilityFallback[] = supportedVenues.length
    ? supportedVenues
    : SUPPORTED_VENUES.map(venue => ({
      name: venue.value,
      label: venue.label,
      type: venue.type.toLowerCase(),
      credentialHint: venue.hint,
      configured: connections.some(connection => connection.name === venue.value),
      connection: connections.find(connection => connection.name === venue.value) ?? null,
    }));

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Link2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">Exchange / Broker</p>
          <p className="text-gray-500 text-xs">Live and paper venue coverage, credentials, and platform websocket transport</p>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <a
          href="/connections/accounts"
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100 hover:bg-cyan-500/15"
        >
          Open THAELIA Account Monitor
        </a>
      </div>

      {platformSocket && (
        <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-cyan-500/15 p-2">
              <Waves className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cyan-100">Platform WebSocket</p>
              <p className="mt-1 text-xs text-cyan-100/80">
                `{platformSocket.path}` with `{platformSocket.authEvent}` then `{platformSocket.subscribeEvent}`. Channels:
                {' '}{platformSocket.channels.join(', ')}.
              </p>
              <p className="mt-2 text-xs text-cyan-200/70">{platformSocket.notes}</p>
            </div>
          </div>
        </div>
      )}

      {streamingStatus && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-100">THAELIA Gateway Monitor</p>
              <p className="mt-1 text-xs text-emerald-100/80">
                Live transport health, reconnect pressure, queue depth, and recovery recommendations.
              </p>
            </div>
            <div className="text-right text-[11px] text-emerald-200/80">
              {Object.values(streamingStatus.queues ?? {}).map(queue => (
                <p key={queue.name}>
                  {queue.name}: {queue.depth} queued / {queue.dropped} dropped
                </p>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {streamingStatus.connections.length ? streamingStatus.connections.map(connection => (
              <div key={`${connection.venue}-${connection.isTestnet ? 'test' : 'live'}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {venueMeta(connection.venue).label} · {connection.status}
                      <span className={`ml-2 ${connection.healthBand === 'green' ? 'text-green-300' : connection.healthBand === 'amber' ? 'text-yellow-300' : 'text-red-300'}`}>
                        {connection.healthScore ?? 0}/100
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {connection.transport ?? 'websocket'} · {connection.isTestnet ? 'testnet/practice' : 'live'} · {connection.symbols.join(', ')}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-gray-300">
                    <p>Latency {connection.latencyMs ?? 'n/a'} ms</p>
                    <p>Reconnects {connection.reconnectCount ?? 0} · Msg/min {connection.messageRate ?? 0}</p>
                    <p>Missed pings {connection.missedPings ?? 0} · Sequence gaps {connection.sequenceGaps ?? 0}</p>
                  </div>
                </div>
                {(connection.warnings?.length || connection.recommendations?.length || connection.recoveryActions?.length) ? (
                  <div className="mt-2 grid gap-2 lg:grid-cols-3 text-[11px]">
                    <p className="rounded-md bg-red-500/10 px-2 py-1 text-red-200">
                      Warnings: {(connection.warnings ?? []).join(' · ') || 'none'}
                    </p>
                    <p className="rounded-md bg-yellow-500/10 px-2 py-1 text-yellow-100">
                      Recommendations: {(connection.recommendations ?? []).join(' · ') || 'none'}
                    </p>
                    <p className="rounded-md bg-cyan-500/10 px-2 py-1 text-cyan-100">
                      Recovery: {(connection.recoveryActions ?? []).join(' · ') || 'none'}
                    </p>
                  </div>
                ) : null}
              </div>
            )) : (
              <p className="text-xs text-emerald-100/75">No gateway transports are active yet.</p>
            )}
          </div>

          {(streamingStatus.warnings?.length || streamingStatus.recommendations?.length || streamingStatus.recoveryActions?.length) ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-3 text-[11px]">
              <p className="rounded-md bg-red-500/10 px-2 py-2 text-red-100">
                Global warnings: {(streamingStatus.warnings ?? []).join(' · ') || 'none'}
              </p>
              <p className="rounded-md bg-yellow-500/10 px-2 py-2 text-yellow-100">
                Recommendations: {(streamingStatus.recommendations ?? []).join(' · ') || 'none'}
              </p>
              <p className="rounded-md bg-cyan-500/10 px-2 py-2 text-cyan-100">
                Recovery actions: {(streamingStatus.recoveryActions ?? []).join(' · ') || 'none'}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
        </p>
      )}

      {balanceMessage && (
        <p className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2 mb-3">
          {balanceMessage}
        </p>
      )}

      <div className="space-y-2 mb-3">
        {venues.map(venue => {
          const connection = venue.connection ?? connections.find(item => item.name === venue.name) ?? null;
          const meta = venueMeta(venue.name);
          const type = venue.type ?? meta.type;
          const label = venue.label ?? meta.label;
          const hint = venue.credentialHint ?? meta.hint;

          return (
            <div key={venue.name} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <div>
                <p className="text-white text-xs font-semibold">
                  {label}{' '}
                  {connection?.isActive && <span className="text-green-400">Active</span>}
                  {!connection && <span className="text-gray-500">Not configured</span>}
                </p>
                <p className="text-gray-500 text-xs">
                  {type.replace(/\b\w/g, c => c.toUpperCase())} ·{' '}
                  {connection ? (connection.isTestnet ? 'Testnet / practice' : 'Live') : hint}
                  {connection && ` · ${connection.hasApiKey ? 'API key saved' : 'No key'}`}
                </p>
                {venue.capabilities && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 ${venue.capabilities.paper ? 'bg-yellow-500/15 text-yellow-200' : 'bg-white/5 text-gray-500'}`}>
                      {venue.capabilities.paper ? 'Paper' : 'No paper'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${venue.capabilities.live ? 'bg-green-500/15 text-green-200' : 'bg-white/5 text-gray-500'}`}>
                      {venue.capabilities.live ? 'Live' : 'No live'}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-gray-400">
                      {venue.capabilities.transport.marketData} market data
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-gray-400">
                      {venue.capabilities.transport.nativeExchangeWebSocket ? 'Native WS' : 'No native WS'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedVenue(venue)}
                  className="text-xs text-gray-300 hover:text-white"
                >
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Details
                  </span>
                </button>
                {!connection && (
                  <button onClick={() => openVenueForm(venue.name)} className="text-xs text-cyan-300 hover:text-cyan-200">
                    Configure
                  </button>
                )}
                {connection && !connection.isActive && (
                  <button onClick={() => activate(connection.id)} className="text-xs text-cyan-300 hover:text-cyan-200">
                    Enable
                  </button>
                )}
                {connection?.isActive && (
                  <button onClick={() => deactivate(connection.id)} className="text-xs text-yellow-300 hover:text-yellow-200">
                    Disable
                  </button>
                )}
                {connection && (
                  <button
                    onClick={() => loadBalance(connection.name)}
                    disabled={balanceLoading === connection.name}
                    className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                  >
                    {balanceLoading === connection.name ? 'Loading…' : 'Balance'}
                  </button>
                )}
                {connection && (
                  <button onClick={() => remove(connection.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowForm(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300"
      >
        <Plus className="w-3.5 h-3.5" /> {showForm ? 'Hide exchange form' : 'Add exchange connection'}
      </button>

      {showForm && (
        <div className="grid grid-cols-2 gap-2 mt-3 bg-black/20 border border-white/10 rounded-lg p-3">
          {(() => {
            const placeholders = fieldPlaceholders(String(form.name));
            return (
              <>
          <select
            value={String(form.name)}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
          >
            {SUPPORTED_VENUES.map(venue => (
              <option key={venue.value} value={venue.value}>
                {venue.type}: {venue.label}
              </option>
            ))}
          </select>
          <p className="col-span-2 text-xs text-gray-500">
            {venueMeta(String(form.name)).hint}
          </p>
          <input
            value={String(form.apiKey)}
            onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
            placeholder={placeholders.apiKey}
            className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
          />
          <input
            type="password"
            value={String(form.apiSecret)}
            onChange={e => setForm(f => ({ ...f, apiSecret: e.target.value }))}
            placeholder={placeholders.apiSecret}
            className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
          />
          <input
            type="password"
            value={String(form.passphrase)}
            onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}
            placeholder={placeholders.passphrase}
            className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
          />
          <label className="col-span-2 flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={Boolean(form.isTestnet)}
              onChange={e => setForm(f => ({ ...f, isTestnet: e.target.checked }))}
            />
            Use testnet / practice environment
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="col-span-2 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-xs text-cyan-200 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save connection'}
          </button>
              </>
            );
          })()}
        </div>
      )}

      {selectedVenue && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{selectedVenue.label ?? venueMeta(selectedVenue.name).label}</p>
              <p className="mt-1 text-xs text-gray-500">
                {(selectedVenue.type ?? venueMeta(selectedVenue.name).type).replace(/\b\w/g, c => c.toUpperCase())}
                {' · '}
                {selectedVenue.credentialHint ?? venueMeta(selectedVenue.name).hint}
              </p>
            </div>
            <button onClick={() => setSelectedVenue(null)} className="text-xs text-gray-500 hover:text-white">
              Close
            </button>
          </div>

          {selectedVenue.capabilities ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wider text-gray-500">Support</p>
                <div className="mt-3 space-y-2 text-xs text-gray-300">
                  <p className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-green-300" /> Live trading: {selectedVenue.capabilities.live ? 'supported' : 'not supported'}</p>
                  <p className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-yellow-300" /> Paper mode: {selectedVenue.capabilities.paper ? 'supported' : 'not supported'}</p>
                  <p>Asset classes: {selectedVenue.capabilities.assetClasses.join(', ')}</p>
                  <p>Credentials: {selectedVenue.capabilities.credentials.join(', ')}</p>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wider text-gray-500">Transport</p>
                <div className="mt-3 space-y-2 text-xs text-gray-300">
                  <p>Market data: {selectedVenue.capabilities.transport.marketData}</p>
                  <p>Account: {selectedVenue.capabilities.transport.account}</p>
                  <p>Orders: {selectedVenue.capabilities.transport.orders}</p>
                  <p>Platform WebSocket: {selectedVenue.capabilities.transport.platformWebSocket ? 'yes' : 'no'}</p>
                  <p>Native exchange WebSocket: {selectedVenue.capabilities.transport.nativeExchangeWebSocket ? 'yes' : 'no'}</p>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 lg:col-span-2">
                <p className="text-xs uppercase tracking-wider text-gray-500">Connector coverage</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {selectedVenue.capabilities.supports.map(item => (
                    <span key={item} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-gray-300">
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs text-gray-400">{selectedVenue.capabilities.notes}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-500">No connector capability metadata available.</p>
          )}
        </div>
      )}
    </div>
  );
}
