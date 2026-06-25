import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Circle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api, type Mt5AccountSummary, type Mt5ConnectionPayload, type Mt5Position, type MtConnection } from './api';

const emptyForm: Mt5ConnectionPayload = {
  platform: 'mt5',
  provider: 'bridge',
  label: '',
  login: '',
  server: '',
  accountId: '',
  apiUrl: '',
  apiKey: '',
  token: '',
  isDemo: true,
};

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function MT5Panel() {
  const [account, setAccount] = useState<Mt5AccountSummary | null>(null);
  const [positions, setPositions] = useState<Mt5Position[]>([]);
  const [mode, setMode] = useState<string>('');
  const [connections, setConnections] = useState<MtConnection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Mt5ConnectionPayload>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, posRes, connectionRes] = await Promise.allSettled([
        api.getMt5Status(),
        api.getMt5Positions(),
        api.getMt5Connections(),
      ]);

      if (statusRes.status === 'fulfilled') {
        setAccount(statusRes.value.account);
        setMode(statusRes.value.mode);
      }
      if (posRes.status === 'fulfilled') {
        setPositions(posRes.value.positions);
      }
      if (connectionRes.status === 'fulfilled') {
        setConnections(connectionRes.value.connections);
      }
    } catch {
      setError('Failed to load MT5 data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalProfit = positions.reduce((sum, p) => sum + (p.profit ?? 0), 0);

  const saveConnection = async () => {
    setSaving(true);
    setError('');
    try {
      await api.saveMt5Connection({ ...form, isActive: true, testConnection: true });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message || 'Failed to save MT connection');
    } finally {
      setSaving(false);
    }
  };

  const activateConnection = async (id: string) => {
    await api.activateMt5Connection(id);
    await load();
  };

  const deleteConnection = async (id: string) => {
    await api.deleteMt5Connection(id);
    await load();
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">MT4 / MT5</p>
            <div className="flex items-center gap-1.5">
              <Circle className={`w-2 h-2 fill-current ${
                account?.connected ? 'text-green-400' : account?._mock ? 'text-yellow-400' : 'text-gray-600'
              }`} />
              <span className="text-xs text-gray-500 capitalize">
                {mode === 'mock' ? 'Demo (not configured)' : mode === 'bridge' ? 'Bridge connected' : mode === 'metaapi' ? 'MetaAPI cloud' : '…'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
        </p>
      )}

      <div className="mb-4 space-y-2">
        {connections.map(connection => (
          <div key={connection.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <div>
              <p className="text-white text-xs font-semibold">
                {connection.label || connection.platform.toUpperCase()} {connection.isActive && <span className="text-green-400">Active</span>}
              </p>
              <p className="text-gray-500 text-xs">
                {connection.platform.toUpperCase()} · {connection.provider} · {connection.connectionStatus}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!connection.isActive && (
                <button onClick={() => activateConnection(connection.id)} className="text-xs text-blue-300 hover:text-blue-200">
                  Use
                </button>
              )}
              <button onClick={() => deleteConnection(connection.id)} className="text-gray-500 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => setShowForm(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300"
        >
          <Plus className="w-3.5 h-3.5" /> {showForm ? 'Hide MT4/MT5 connection form' : 'Add MT4/MT5 connection'}
        </button>

        {showForm && (
          <div className="grid grid-cols-2 gap-2 bg-black/20 border border-white/10 rounded-lg p-3">
            <select
              value={String(form.platform)}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value as Mt5ConnectionPayload['platform'] }))}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
            >
              <option value="mt5">MT5</option>
              <option value="mt4">MT4</option>
            </select>
            <select
              value={String(form.provider)}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value as Mt5ConnectionPayload['provider'] }))}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
            >
              <option value="bridge">REST bridge</option>
              <option value="metaapi">MetaAPI</option>
            </select>
            <input
              value={String(form.label)}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Label"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
            />
            <input
              value={String(form.login)}
              onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              placeholder="Login"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
            />
            <input
              value={String(form.server)}
              onChange={e => setForm(f => ({ ...f, server: e.target.value }))}
              placeholder="Server"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
            />
            {form.provider === 'metaapi' ? (
              <input
                value={String(form.accountId)}
                onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                placeholder="MetaAPI account ID"
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
              />
            ) : (
              <input
                value={String(form.apiUrl)}
                onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))}
                placeholder="Bridge API URL"
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
              />
            )}
            {form.provider === 'metaapi' ? (
              <input
                type="password"
                value={String(form.token)}
                onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                placeholder="MetaAPI token"
                className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
              />
            ) : (
              <input
                type="password"
                value={String(form.apiKey)}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="Bridge API key"
                className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder-gray-600"
              />
            )}
            <button
              onClick={saveConnection}
              disabled={saving}
              className="col-span-2 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-xs text-blue-200 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save and test connection'}
            </button>
          </div>
        )}
      </div>

      {account && (
        <>
          {/* Account summary */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Balance</p>
              <p className="text-white font-semibold text-sm">${fmt(account.balance ?? 0)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Equity</p>
              <p className="text-white font-semibold text-sm">${fmt(account.equity ?? 0)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Free Margin</p>
              <p className="text-white font-semibold text-sm">${fmt(account.freeMargin ?? 0)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <p className="text-gray-500 text-xs">Open P&L</p>
              <p className={`font-semibold text-sm ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalProfit >= 0 ? '+' : ''}${fmt(totalProfit)}
              </p>
            </div>
          </div>

          <p className="text-gray-600 text-xs mb-2">{account.broker} · {account.platform} · {account.currency}</p>

          {/* Open positions */}
          {positions.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Open Positions</p>
              <div className="space-y-2">
                {positions.map(pos => (
                  <div key={pos.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      {pos.type === 'BUY'
                        ? <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      }
                      <div>
                        <p className="text-white text-xs font-semibold">{pos.symbol}</p>
                        <p className="text-gray-600 text-xs">{pos.volume} lots @ {pos.openPrice}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold font-mono ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.profit >= 0 ? '+' : ''}${fmt(pos.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {positions.length === 0 && !loading && (
            <p className="text-gray-600 text-xs text-center py-3">No open positions</p>
          )}

          {account._mock && (
            <p className="mt-3 text-yellow-600 text-xs text-center">
              Showing demo data. Set MT5_API_URL or MT5_METAAPI_TOKEN in .env to connect.
            </p>
          )}
        </>
      )}

      {loading && !account && (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
