import { useState, useEffect, useCallback } from 'react';
import { Wallet, ExternalLink, Copy, CheckCircle, AlertCircle, Loader2, Unplug } from 'lucide-react';
import { api, type WalletConnectSession, type WalletSessionStatus } from './api';

interface WalletState {
  address: string;
  balance: string;   // in ETH / native token
  chainId: number;
  chainName: string;
  symbol: string;
  sessionId?: string;
  verified: boolean;
}

interface WalletSessionState extends WalletConnectSession {
  status?: string;
  walletAddress?: string;
  chainId?: number;
}

const CHAIN_META: Record<number, { name: string; symbol: string }> = {
  1:     { name: 'Ethereum',  symbol: 'ETH'  },
  56:    { name: 'BSC',       symbol: 'BNB'  },
  137:   { name: 'Polygon',   symbol: 'MATIC' },
  42161: { name: 'Arbitrum',  symbol: 'ETH'  },
  10:    { name: 'Optimism',  symbol: 'ETH'  },
  43114: { name: 'Avalanche', symbol: 'AVAX' },
  11155111: { name: 'Sepolia Testnet', symbol: 'ETH' },
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function weiToEth(wei: string): string {
  const n = BigInt(wei);
  const eth = Number(n) / 1e18;
  return eth.toFixed(4);
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

export function WalletConnect() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);
  const [walletSession, setWalletSession] = useState<WalletSessionState | null>(null);

  const fetchBalance = useCallback(async (address: string) => {
    if (!window.ethereum) return;
    const balanceHex = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }) as string;
    return weiToEth(BigInt(balanceHex).toString(10));
  }, []);

  const connect = async () => {
    setError('');
    if (!window.ethereum) {
      setError('MetaMask not detected. Install MetaMask to connect a wallet.');
      return;
    }
    setLoading(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const address = accounts[0];
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const chainId = parseInt(chainIdHex, 16);
      const meta = CHAIN_META[chainId] ?? { name: `Chain ${chainId}`, symbol: 'ETH' };
      const balance = (await fetchBalance(address)) ?? '0.0000';
      const sessionRes = await api.createWalletSession();
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [sessionRes.session.message, address],
      }) as string;
      const payload = {
        sessionId: sessionRes.session.id,
        address,
        chainId,
        signature,
        message: sessionRes.session.message,
      };
      const wasAuthenticated = api.isAuthenticated();
      const verifyRes = wasAuthenticated
        ? await api.linkWallet(payload)
        : await api.verifyWallet(payload);

      if (!wasAuthenticated && 'token' in verifyRes && verifyRes.token) {
        api.setAuthToken(verifyRes.token);
      }

      setWallet({
        address,
        balance,
        chainId,
        chainName: meta.name,
        symbol: meta.symbol,
        sessionId: sessionRes.session.id,
        verified: verifyRes.success,
      });
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 4001) setError('Connection rejected.');
      else setError(e.message ?? 'Failed to connect wallet.');
    } finally {
      setLoading(false);
    }
  };

  const createWalletConnectSession = async () => {
    setError('');
    setSessionLoading(true);
    try {
      const res = await api.createWalletSession();
      setWalletSession({ ...res.session, status: 'pending' });
    } catch (err) {
      setError((err as Error).message || 'Failed to create WalletConnect session.');
    } finally {
      setSessionLoading(false);
    }
  };

  const disconnect = async () => {
    const sessionId = wallet?.sessionId;
    setWallet(null);
    if (sessionId && api.isAuthenticated()) {
      await api.disconnectWallet(sessionId).catch(() => undefined);
    }
  };

  const copyAddress = () => {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySessionUri = () => {
    if (!walletSession) return;
    navigator.clipboard.writeText(walletSession.uri);
    setSessionCopied(true);
    setTimeout(() => setSessionCopied(false), 2000);
  };

  const refreshBalance = useCallback(async () => {
    if (!wallet) return;
    const balance = await fetchBalance(wallet.address);
    if (balance) setWallet(w => w ? { ...w, balance } : null);
  }, [wallet, fetchBalance]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts: unknown) => {
      const list = accounts as string[];
      if (!list.length) { setWallet(null); return; }
      if (wallet && list[0] !== wallet.address) {
        setWallet(null); // force reconnect for new account
      }
    };
    const onChain = () => { if (wallet) { setWallet(null); } };
    window.ethereum.on('accountsChanged', onAccounts as (...args: unknown[]) => void);
    window.ethereum.on('chainChanged', onChain);
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccounts as (...args: unknown[]) => void);
      window.ethereum?.removeListener('chainChanged', onChain);
    };
  }, [wallet]);

  const walletSessionId = walletSession?.id;
  const walletSessionStatus = walletSession?.status;

  useEffect(() => {
    if (!walletSessionId || walletSessionStatus === 'connected') return;
    const timer = window.setInterval(async () => {
      try {
        const res = await api.getWalletSession(walletSessionId);
        setWalletSession(current => current ? { ...current, ...(res.status as WalletSessionStatus) } : current);
      } catch {
        // Session polling is informational only.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [walletSessionId, walletSessionStatus]);

  if (!wallet) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Wallet</p>
            <p className="text-gray-500 text-xs">Connect or link to this account</p>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
          </p>
        )}

        <button
          onClick={connect}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          {loading ? 'Verifying…' : 'Connect MetaMask'}
        </button>

        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <p className="text-white text-xs font-semibold">WalletConnect Session</p>
              <p className="text-gray-500 text-xs">Use the URI with a WalletConnect-compatible wallet</p>
            </div>
            <button
              type="button"
              onClick={createWalletConnectSession}
              disabled={sessionLoading}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 disabled:opacity-50"
            >
              {sessionLoading ? 'Creating…' : walletSession ? 'New URI' : 'Create URI'}
            </button>
          </div>

          {walletSession && (
            <div className="bg-black/20 border border-white/10 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">Status</span>
                <span className="text-xs text-cyan-300 capitalize">{walletSession.status ?? 'pending'}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">URI</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate text-[11px] text-gray-300 bg-white/5 rounded px-2 py-1">
                    {walletSession.uri}
                  </code>
                  <button
                    type="button"
                    onClick={copySessionUri}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                    title="Copy WalletConnect URI"
                  >
                    {sessionCopied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Expires {new Date(walletSession.expiresAt).toLocaleString()}
              </p>
              {walletSession.walletAddress && (
                <p className="text-xs text-green-400">
                  Connected: {truncate(walletSession.walletAddress)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-purple-500/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-green-400 font-medium">{wallet.chainName}</span>
        </div>
        <button
          onClick={disconnect}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          <Unplug className="w-3 h-3" /> Disconnect
        </button>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-gray-500 text-xs mb-1">On-chain Balance</p>
        <p className="text-2xl font-bold text-white">
          {wallet.balance} <span className="text-lg text-gray-400">{wallet.symbol}</span>
        </p>
        {wallet.verified && (
          <p className="mt-1 flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="w-3 h-3" /> Wallet linked and verified
          </p>
        )}
      </div>

      {/* Address */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
        <span className="font-mono text-xs text-gray-300">{truncate(wallet.address)}</span>
        <div className="flex items-center gap-2">
          <button onClick={copyAddress} className="text-gray-500 hover:text-gray-300 transition-colors">
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a
            href={`https://etherscan.io/address/${wallet.address}`}
            target="_blank"
            rel="noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <button
        onClick={refreshBalance}
        className="mt-3 w-full py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        Refresh balance
      </button>
    </div>
  );
}
