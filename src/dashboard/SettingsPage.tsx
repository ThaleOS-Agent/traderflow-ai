import { useState, useEffect } from 'react';
import {
  Settings, Bell, Lock, Zap, AlertCircle, CheckCircle,
  Loader2, Save, ChevronLeft, Database, Key, Eye, EyeOff
} from 'lucide-react';
import { api } from './api';

interface SettingsPageProps {
  onBack: () => void;
}

const EXCHANGE_OPTIONS = [
  { value: 'binance', label: 'Binance' },
  { value: 'coinbase', label: 'Coinbase Exchange', passphraseLabel: 'API Passphrase' },
  { value: 'kraken', label: 'Kraken' },
  { value: 'kucoin', label: 'KuCoin', passphraseLabel: 'API Passphrase' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'ftx', label: 'FTX' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'bitfinex', label: 'Bitfinex' },
  { value: 'interactive_brokers', label: 'Interactive Brokers' },
  { value: 'oanda', label: 'OANDA', passphraseLabel: 'Account ID' },
];

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApiSecret, setShowApiSecret] = useState(false);

  const [settings, setSettings] = useState({
    paperTrading: true,
    autoTrading: false,
    maxDailyLoss: 100,
    maxPositionSize: 1000,
    stopLossPercent: 2,
    takeProfitPercent: 4,
    leverage: 1,
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    notificationsEnabled: true,
    pushNotifications: true,
  });

  const [mt5Config, setMt5Config] = useState({
    connected: false,
    mode: 'mock' as 'mock' | 'bridge' | 'metaapi',
    accountNumber: '',
  });

  const [exchangeKey, setExchangeKey] = useState({
    exchange: 'binance',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    isTestnet: true,
  });

  const selectedExchange = EXCHANGE_OPTIONS.find((option) => option.value === exchangeKey.exchange);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, mt5Res] = await Promise.allSettled([
        api.getTradingSettings(),
        api.getMt5Status(),
      ]);

      if (settingsRes.status === 'fulfilled') {
        setSettings(prev => ({ ...prev, ...settingsRes.value }));
      }
      if (mt5Res.status === 'fulfilled') {
        const res = mt5Res.value as { mode?: string; account?: { accountNumber?: string } };
        setMt5Config({
          connected: true,
          mode: (res.mode as 'mock' | 'bridge' | 'metaapi') || 'mock',
          accountNumber: res.account?.accountNumber || '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key]
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await api.updateTradingSettings(settings);
      
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExchangeKey = async () => {
    try {
      setSaving(true);
      setError('');
      
      if (!exchangeKey.apiKey || !exchangeKey.apiSecret) {
        setError('API Key and Secret are required');
        setSaving(false);
        return;
      }

      if (selectedExchange?.passphraseLabel && !exchangeKey.passphrase) {
        setError(`${selectedExchange.passphraseLabel} is required`);
        setSaving(false);
        return;
      }

      await api.addExchangeKeys(exchangeKey);
      
      setSuccess('Exchange connected successfully');
      setExchangeKey({ exchange: 'binance', apiKey: '', apiSecret: '', passphrase: '', isTestnet: true });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exchange key');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-6 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 mb-6 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Trading Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trading Mode */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold">Trading Mode</h2>
            </div>

            <div className="space-y-4">
              {/* Paper Trading Toggle */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="text-white font-medium">Paper Trading</p>
                  <p className="text-gray-500 text-xs">Simulate trades with virtual funds</p>
                </div>
                <button
                  onClick={() => handleToggle('paperTrading')}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.paperTrading ? 'bg-green-500/20' : 'bg-gray-600/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.paperTrading ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Auto Trading Toggle */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="text-white font-medium">Auto Trading</p>
                  <p className="text-gray-500 text-xs">Automatically execute signals</p>
                </div>
                <button
                  onClick={() => handleToggle('autoTrading')}
                  disabled={!settings.paperTrading}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.autoTrading ? 'bg-green-500/20' : 'bg-gray-600/20'
                  } ${!settings.paperTrading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.autoTrading ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold">Risk Management</h2>
            </div>

            <div className="space-y-4">
              {/* Risk Level */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Risk Level</label>
                <select
                  value={settings.riskLevel}
                  onChange={(e) => setSettings(prev => ({ ...prev, riskLevel: e.target.value as 'low' | 'medium' | 'high' }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="low">Low (Conservative)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Aggressive)</option>
                </select>
              </div>

              {/* Max Daily Loss */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Daily Loss ($)</label>
                <input
                  type="number"
                  value={settings.maxDailyLoss}
                  onChange={(e) => setSettings(prev => ({ ...prev, maxDailyLoss: parseFloat(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Max Position Size */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Position Size ($)</label>
                <input
                  type="number"
                  value={settings.maxPositionSize}
                  onChange={(e) => setSettings(prev => ({ ...prev, maxPositionSize: parseFloat(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Stop Loss % */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Stop Loss (%)</label>
                <input
                  type="number"
                  value={settings.stopLossPercent}
                  onChange={(e) => setSettings(prev => ({ ...prev, stopLossPercent: parseFloat(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Take Profit % */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Take Profit (%)</label>
                <input
                  type="number"
                  value={settings.takeProfitPercent}
                  onChange={(e) => setSettings(prev => ({ ...prev, takeProfitPercent: parseFloat(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Leverage */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Leverage</label>
                <input
                  type="number"
                  value={settings.leverage}
                  onChange={(e) => setSettings(prev => ({ ...prev, leverage: parseFloat(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>

          {/* Notifications */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">Notifications</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="text-white font-medium">Email Notifications</p>
                  <p className="text-gray-500 text-xs">Get trade alerts via email</p>
                </div>
                <button
                  onClick={() => handleToggle('notificationsEnabled')}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.notificationsEnabled ? 'bg-green-500/20' : 'bg-gray-600/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="text-white font-medium">Push Notifications</p>
                  <p className="text-gray-500 text-xs">Browser push notifications</p>
                </div>
                <button
                  onClick={() => handleToggle('pushNotifications')}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.pushNotifications ? 'bg-green-500/20' : 'bg-gray-600/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.pushNotifications ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Advanced Settings */}
        <div className="space-y-6">
          {/* MT5 Connection */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">MT5 Connection</h2>
            </div>

            <div className="space-y-3">
              <div className={`flex items-center gap-2 text-xs ${mt5Config.connected ? 'text-green-400' : 'text-gray-500'}`}>
                <div className={`w-2 h-2 rounded-full ${mt5Config.connected ? 'bg-green-400' : 'bg-gray-600'}`} />
                {mt5Config.connected ? 'Connected' : 'Not Connected'}
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-gray-400">Mode:</span> {mt5Config.mode}
              </div>
              {mt5Config.accountNumber && (
                <div className="text-xs text-gray-500">
                  <span className="text-gray-400">Account:</span> {mt5Config.accountNumber}
                </div>
              )}
              <button className="w-full text-xs mt-2 py-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors">
                Configure MT5
              </button>
            </div>
          </div>

          {/* Exchange API */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold">Exchange API</h2>
            </div>

            <div className="space-y-3">
              <select
                value={exchangeKey.exchange}
                onChange={(e) => setExchangeKey(prev => ({ ...prev, exchange: e.target.value, passphrase: '' }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500/50"
              >
                {EXCHANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="API Key"
                value={exchangeKey.apiKey}
                onChange={(e) => setExchangeKey(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />

              <div className="relative">
                <input
                  type={showApiSecret ? 'text' : 'password'}
                  placeholder="API Secret"
                  value={exchangeKey.apiSecret}
                  onChange={(e) => setExchangeKey(prev => ({ ...prev, apiSecret: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 pr-8 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => setShowApiSecret(!showApiSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showApiSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {selectedExchange?.passphraseLabel && (
                <input
                  type="text"
                  placeholder={selectedExchange.passphraseLabel}
                  value={exchangeKey.passphrase}
                  onChange={(e) => setExchangeKey(prev => ({ ...prev, passphrase: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
              )}

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={exchangeKey.isTestnet}
                  onChange={(e) => setExchangeKey(prev => ({ ...prev, isTestnet: e.target.checked }))}
                  className="w-3 h-3"
                />
                <span className="text-gray-400">Use Testnet</span>
              </label>

              <button
                onClick={handleAddExchangeKey}
                disabled={saving}
                className="w-full text-xs mt-2 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded transition-colors disabled:opacity-50"
              >
                {saving ? 'Connecting…' : 'Connect Exchange'}
              </button>
            </div>
          </div>

          {/* Account & Security */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold">Security</h2>
            </div>

            <div className="space-y-2 text-xs">
              <button className="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors">
                Change Password
              </button>
              <button className="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors">
                Enable 2FA
              </button>
              <button className="w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
