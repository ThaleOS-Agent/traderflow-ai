import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, CircleDollarSign, RefreshCw, Zap } from 'lucide-react';
import { api, type DerivContract, type DerivProposal, type DerivSymbol } from './api';

const CONTRACT_LABELS: Record<string, string> = {
  CALL: 'Rise',
  PUT: 'Fall',
  DIGITOVER: 'Digit Over',
  DIGITUNDER: 'Digit Under',
  ASIANU: 'Asian Up',
  ASIAND: 'Asian Down'
};

function fmtMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function DTraderPanel({ paperTrading }: { paperTrading: boolean }) {
  const [symbols, setSymbols] = useState<DerivSymbol[]>([]);
  const [contracts, setContracts] = useState<DerivContract[]>([]);
  const [quote, setQuote] = useState<DerivProposal | null>(null);
  const [balance, setBalance] = useState<{ balance: number; currency: string; loginId?: string } | null>(null);
  const [symbol, setSymbol] = useState('R_100');
  const [contractType, setContractType] = useState('CALL');
  const [amount, setAmount] = useState('10');
  const [duration, setDuration] = useState('5');
  const [durationUnit, setDurationUnit] = useState('m');
  const [basis, setBasis] = useState<'stake' | 'payout'>('stake');
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSymbols = useCallback(async () => {
    const response = await api.getDerivSymbols();
    setSymbols(response.symbols);
    if (!response.symbols.some(item => item.symbol === symbol) && response.symbols[0]) {
      setSymbol(response.symbols[0].symbol);
    }
  }, [symbol]);

  const loadContracts = useCallback(async (nextSymbol: string) => {
    const response = await api.getDerivContracts(nextSymbol);
    const available = response.contracts.filter(contract => ['CALL', 'PUT', 'DIGITOVER', 'DIGITUNDER'].includes(contract.contractType));
    setContracts(available);
    if (!available.some(contract => contract.contractType === contractType) && available[0]) {
      setContractType(available[0].contractType);
    }
  }, [contractType]);

  const refreshQuote = useCallback(async () => {
    if (!symbol || !contractType || !amount || !duration) return;
    setQuoteLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.getDerivProposal({
        symbol,
        contractType,
        amount: Number(amount),
        duration: Number(duration),
        durationUnit,
        basis
      });
      setQuote(response.proposal);
    } catch (err) {
      setError((err as Error).message || 'Failed to load Deriv quote');
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [amount, basis, contractType, duration, durationUnit, symbol]);

  const refreshBalance = useCallback(async () => {
    try {
      const response = await api.getDerivBalance();
      setBalance(response.account);
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([loadSymbols(), loadContracts(symbol), refreshBalance()])
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadContracts, loadSymbols, refreshBalance, symbol]);

  useEffect(() => {
    void loadContracts(symbol);
  }, [loadContracts, symbol]);

  const contractOptions = useMemo(() => {
    const unique = new Map<string, DerivContract>();
    contracts.forEach(contract => {
      if (!unique.has(contract.contractType)) unique.set(contract.contractType, contract);
    });
    return Array.from(unique.values());
  }, [contracts]);

  const buyContract = async () => {
    if (!quote) return;
    setBuying(true);
    setError('');
    setMessage('');
    try {
      const response = await api.buyDerivContract({
        proposalId: quote.id,
        price: quote.displayValue || quote.askPrice,
        symbol,
        contractType
      });
      setMessage(`Deriv contract purchased. Contract ID ${response.buy.contract_id ?? response.buy.transaction_id ?? 'received'}.`);
      await refreshBalance();
      await refreshQuote();
    } catch (err) {
      setError((err as Error).message || 'Failed to buy Deriv contract');
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(12,18,30,0.98),rgba(5,10,18,0.98))] p-5">
        <p className="text-sm text-gray-400">Loading Deriv contract workspace…</p>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,rgba(9,14,24,0.99),rgba(4,8,14,0.98))] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">DTrader Integration</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Deriv contract ticket inside TradeFlow</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Quote and buy Deriv contracts without leaving the TraderFlow dashboard. Configure the Deriv API token in Exchange / Broker settings to enable live buys.
          </p>
        </div>
        <div className="grid min-w-[240px] grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-gray-500">Mode</p>
            <p className="mt-1 font-semibold text-white">{paperTrading ? 'Quote only' : 'Live buy enabled'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-gray-500">Balance</p>
            <p className="mt-1 font-semibold text-white">{balance ? fmtMoney(balance.balance, balance.currency) : 'Connect Deriv'}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-400">
            Market
            <select
              value={symbol}
              onChange={event => setSymbol(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            >
              {symbols.map(item => (
                <option key={item.symbol} value={item.symbol}>
                  {item.displayName} · {item.marketDisplayName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-400">
            Contract
            <select
              value={contractType}
              onChange={event => setContractType(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            >
              {contractOptions.map(contract => (
                <option key={contract.contractType} value={contract.contractType}>
                  {CONTRACT_LABELS[contract.contractType] ?? contract.contractType}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-400">
            Amount
            <input
              type="number"
              min="0.35"
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="text-xs text-gray-400">
            Basis
            <select
              value={basis}
              onChange={event => setBasis(event.target.value as 'stake' | 'payout')}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            >
              <option value="stake">Stake</option>
              <option value="payout">Payout</option>
            </select>
          </label>

          <label className="text-xs text-gray-400">
            Duration
            <input
              type="number"
              min="1"
              step="1"
              value={duration}
              onChange={event => setDuration(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="text-xs text-gray-400">
            Unit
            <select
              value={durationUnit}
              onChange={event => setDurationUnit(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            >
              <option value="t">Ticks</option>
              <option value="m">Minutes</option>
              <option value="h">Hours</option>
              <option value="d">Days</option>
            </select>
          </label>

          <div className="col-span-2 flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void refreshQuote()}
              disabled={quoteLoading}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-4 py-2 text-xs font-medium text-cyan-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${quoteLoading ? 'animate-spin' : ''}`} />
              Refresh Quote
            </button>
            <button
              type="button"
              onClick={() => void refreshBalance()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-gray-200"
            >
              <CircleDollarSign className="h-3.5 w-3.5" />
              Refresh Balance
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Contract Preview</p>
              <p className="mt-1 text-xs text-gray-500">{CONTRACT_LABELS[contractType] ?? contractType} on {symbol}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${paperTrading ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200' : 'border-green-500/25 bg-green-500/10 text-green-200'}`}>
              {paperTrading ? 'Paper mode' : 'Live mode'}
            </span>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-200">
              {message}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Cost</p>
              <p className="mt-1 text-lg font-semibold text-white">{quote ? fmtMoney(quote.displayValue || quote.askPrice, quote.currency) : '—'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Payout</p>
              <p className="mt-1 text-lg font-semibold text-white">{quote ? fmtMoney(quote.payout, quote.currency) : '—'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Potential Return</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                {quote ? fmtMoney(Math.max(quote.payout - (quote.displayValue || quote.askPrice), 0), quote.currency) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Spot</p>
              <p className="mt-1 text-lg font-semibold text-white">{quote?.spot ? quote.spot.toLocaleString('en-US') : '—'}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-3">
            <div className="flex items-start gap-2">
              <Activity className="mt-0.5 h-4 w-4 text-cyan-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Longcode</p>
                <p className="mt-2 text-sm text-cyan-50/90">{quote?.longcode ?? 'Refresh a quote to load the Deriv contract narrative.'}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={buyContract}
            disabled={paperTrading || !quote || buying}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/15 px-4 py-3 text-sm font-semibold text-green-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            {paperTrading ? 'Switch to live mode to buy' : 'Buy on Deriv'}
          </button>

          <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Zap className="h-3.5 w-3.5 text-cyan-300" />
            TraderFlow keeps the main multi-exchange execution path unchanged. This panel handles Deriv’s proposal and contract flow separately because the venue is contract-based rather than order-book based.
          </p>
        </div>
      </div>
    </div>
  );
}
