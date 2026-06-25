import WebSocket from 'ws';

const DEFAULT_DERIV_APP_ID = '1089';
const DERIV_WS_ORIGIN = 'wss://ws.derivws.com/websockets/v3';

function granularityFor(interval) {
  switch (String(interval || '1h').toLowerCase()) {
    case '1m': return 60;
    case '5m': return 300;
    case '15m': return 900;
    case '30m': return 1800;
    case '1h': return 3600;
    case '4h': return 14400;
    case '1d': return 86400;
    default: return 3600;
  }
}

class DerivService {
  constructor() {
    this.defaultAppId = process.env.DERIV_APP_ID || DEFAULT_DERIV_APP_ID;
  }

  getAppId(appId) {
    return String(appId || this.defaultAppId);
  }

  perform(messages, { appId } = {}) {
    const resolvedAppId = this.getAppId(appId);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${DERIV_WS_ORIGIN}?app_id=${encodeURIComponent(resolvedAppId)}`);
      let settled = false;
      let stepIndex = 0;
      let currentReqId = 0;
      let previousResponse = null;

      const timeout = setTimeout(() => {
        fail(new Error('Timed out waiting for Deriv response'));
      }, 15000);

      const cleanup = () => {
        clearTimeout(timeout);
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch {
          // Ignore close cleanup issues.
        }
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const sendNext = () => {
        if (stepIndex >= messages.length) {
          finish(previousResponse);
          return;
        }

        const next = messages[stepIndex];
        const payload = typeof next === 'function' ? next(previousResponse) : next;
        currentReqId = stepIndex + 1;
        ws.send(JSON.stringify({ ...payload, req_id: currentReqId }));
      };

      ws.on('open', sendNext);

      ws.on('message', raw => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.req_id !== currentReqId) return;

          if (data.error) {
            fail(new Error(data.error.message || data.error.code || 'Deriv request failed'));
            return;
          }

          previousResponse = data;
          stepIndex += 1;

          if (stepIndex >= messages.length) {
            finish(data);
            return;
          }

          sendNext();
        } catch (error) {
          fail(error);
        }
      });

      ws.on('error', fail);
      ws.on('close', () => {
        if (!settled && stepIndex < messages.length) {
          fail(new Error('Deriv websocket closed before the request completed'));
        }
      });
    });
  }

  async getActiveSymbols({ market, limit = 24 } = {}) {
    const response = await this.perform([
      {
        active_symbols: 'brief',
        landing_company: 'svg',
        product_type: 'basic'
      }
    ]);

    const symbols = (response.active_symbols || [])
      .filter(symbol => !market || String(symbol.market).toLowerCase() === String(market).toLowerCase())
      .map(symbol => ({
        symbol: symbol.symbol,
        displayName: symbol.display_name,
        market: symbol.market,
        marketDisplayName: symbol.market_display_name,
        subgroup: symbol.submarket_display_name,
        symbolType: symbol.symbol_type,
        pip: symbol.pip
      }))
      .sort((a, b) => `${a.marketDisplayName} ${a.displayName}`.localeCompare(`${b.marketDisplayName} ${b.displayName}`));

    return symbols.slice(0, Number(limit) || 24);
  }

  async getCandles(symbol, interval = '1h', count = 200) {
    const response = await this.perform([
      {
        ticks_history: symbol,
        style: 'candles',
        adjust_start_time: 1,
        count: Math.min(Number(count) || 200, 500),
        granularity: granularityFor(interval)
      }
    ]);

    return (response.candles || []).map(candle => ({
      epoch: candle.epoch,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close)
    }));
  }

  async getContractsFor(symbol, currency = 'USD') {
    const response = await this.perform([
      {
        contracts_for: symbol,
        currency
      }
    ]);

    return (response.contracts_for?.available || []).map(contract => ({
      contractType: contract.contract_type,
      contractCategory: contract.contract_category,
      exchangeName: contract.exchange_name,
      market: contract.market,
      sentiment: contract.sentiment,
      startType: contract.start_type,
      minContractDuration: contract.min_contract_duration,
      maxContractDuration: contract.max_contract_duration,
      barrierCategory: contract.barrier_category,
      expiryType: contract.expiry_type
    }));
  }

  async getProposal({
    symbol,
    contractType,
    amount,
    basis = 'stake',
    currency = 'USD',
    duration = 5,
    durationUnit = 'm',
    barrier
  }) {
    const response = await this.perform([
      {
        proposal: 1,
        symbol,
        contract_type: contractType,
        amount: Number(amount),
        basis,
        currency,
        duration: Number(duration),
        duration_unit: durationUnit,
        ...(barrier ? { barrier } : {})
      }
    ]);

    const proposal = response.proposal || {};
    return {
      id: proposal.id,
      longcode: proposal.longcode,
      spot: Number(proposal.spot ?? 0),
      displayValue: Number(proposal.display_value ?? proposal.ask_price ?? 0),
      payout: Number(proposal.payout ?? 0),
      askPrice: Number(proposal.ask_price ?? 0),
      commission: Number(proposal.commission ?? 0),
      dateStart: proposal.date_start,
      dateExpiry: proposal.date_expiry,
      contractType,
      currency
    };
  }

  async getBalance({ token, appId } = {}) {
    const response = await this.perform([
      {
        authorize: token
      }
    ], { appId });

    return {
      loginId: response.authorize?.loginid,
      balance: Number(response.authorize?.balance ?? 0),
      currency: response.authorize?.currency,
      isVirtual: Boolean(response.authorize?.is_virtual),
      email: response.authorize?.email
    };
  }

  async buyContract({ token, appId, proposalId, price }) {
    const response = await this.perform([
      { authorize: token },
      () => ({
        buy: proposalId,
        price: Number(price)
      })
    ], { appId });

    return response.buy;
  }
}

export const derivService = new DerivService();
