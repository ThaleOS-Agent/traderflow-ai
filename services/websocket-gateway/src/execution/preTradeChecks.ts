import type { ConnectionState } from '../config/accountConfig.js';

export type PreTradeInput = {
  emergencyStop: boolean;
  liveTradingEnabled: boolean;
  dailyDrawdownLimitBreached: boolean;
  maxPositionSizeBreached: boolean;
  maxOpenPositionsBreached: boolean;
  accountStreamState: ConnectionState;
  exchangeHealthScore: number;
  botApproved: boolean;
};

export class PreTradeChecks {
  evaluate(input: PreTradeInput) {
    const reasons: string[] = [];
    if (input.emergencyStop) reasons.push('emergency stop check failed');
    if (!input.liveTradingEnabled) reasons.push('live trading enabled check failed');
    if (input.dailyDrawdownLimitBreached) reasons.push('daily drawdown check failed');
    if (input.maxPositionSizeBreached) reasons.push('max position size check failed');
    if (input.maxOpenPositionsBreached) reasons.push('max open positions check failed');
    if (input.accountStreamState !== 'HEALTHY') reasons.push('account stream health check failed');
    if (input.exchangeHealthScore < 70) reasons.push('exchange health check failed');
    if (!input.botApproved) reasons.push('bot approval check failed');

    return {
      approved: reasons.length === 0,
      reasons
    };
  }
}
