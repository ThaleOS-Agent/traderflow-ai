import { useCallback, useEffect, useState } from 'react';
import { Link2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { api } from './api';

interface ExchangeConnection {
  id: string;
  name: string;
  isTestnet: boolean;
  isActive: boolean;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasPassphrase: boolean;
}

interface SupportedVenue {
  name: string;
  label?: string;
  type?: string;
  credentialHint?: string;
  configured?: boolean;
  connection?: ExchangeConnection | null;
}

const defaultForm = {
  name: 'binance',
  apiKey: '',
  apiSecret: '',
  passphrase: '',
  isTestnet: true,
};

const SUPPORTED_VENUES = [
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

export function ExchangeConnections() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [supportedVenues, setSupportedVenues] = useState<SupportedVenue[]>([]);
  const [form, setForm] = useState<Record<string, string | boolean>>(defaultForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState('');
  const [balanceMessage, setBalanceMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.getExchangeConnections();
      setConnections(res.connections as unknown as ExchangeConnection[]);
      setSupportedVenues((res.supported ?? []) as unknown as SupportedVenue[]);
    } catch {
      setConnections([]);
      setSupportedVenues([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const venues = supportedVenues.length
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
          <p className="text-gray-500 text-xs">Save keys for live execution</p>
        </div>
      </div>

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
              </div>
              <div className="flex items-center gap-2">
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
            placeholder="API key / token"
            className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
          />
          <input
            type="password"
            value={String(form.apiSecret)}
            onChange={e => setForm(f => ({ ...f, apiSecret: e.target.value }))}
            placeholder="API secret"
            className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
          />
          <input
            type="password"
            value={String(form.passphrase)}
            onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}
            placeholder="Passphrase or OANDA account ID"
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
        </div>
      )}
    </div>
  );
}
