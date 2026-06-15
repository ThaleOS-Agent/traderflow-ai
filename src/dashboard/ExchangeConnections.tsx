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
  { value: 'ftx', label: 'FTX / Legacy', type: 'Exchange', hint: 'Legacy connector' },
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
  const [form, setForm] = useState<Record<string, string | boolean>>(defaultForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.getExchangeConnections();
      setConnections(res.connections as unknown as ExchangeConnection[]);
    } catch {
      setConnections([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
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
    await api.activateExchangeConnection(id);
    await load();
  };

  const remove = async (id: string) => {
    await api.deleteExchangeConnection(id);
    await load();
  };

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

      <div className="space-y-2 mb-3">
        {connections.map(connection => (
          <div key={connection.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <div>
              <p className="text-white text-xs font-semibold">
                {venueMeta(connection.name).label} {connection.isActive && <span className="text-green-400">Active</span>}
              </p>
              <p className="text-gray-500 text-xs">
                {venueMeta(connection.name).type} · {connection.isTestnet ? 'Testnet / practice' : 'Live'} · {connection.hasApiKey ? 'API key saved' : 'No key'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!connection.isActive && (
                <button onClick={() => activate(connection.id)} className="text-xs text-cyan-300 hover:text-cyan-200">
                  Use
                </button>
              )}
              <button onClick={() => remove(connection.id)} className="text-gray-500 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
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
