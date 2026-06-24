export type StateRecoveryResult = {
  pausedTrading: boolean;
  consistent: boolean;
  diffs: string[];
  balancesFetched: boolean;
  ordersFetched: boolean;
  positionsFetched: boolean;
  fillsFetched: boolean;
};

export type RecoverySnapshot = {
  balances: unknown;
  openOrders: unknown;
  positions: unknown;
  recentFills: unknown;
  streamState: unknown;
};

export class StateRecoveryCoordinator {
  async recover(snapshot: RecoverySnapshot): Promise<StateRecoveryResult> {
    const diffs: string[] = [];

    if (!snapshot.balances) diffs.push('Balances snapshot missing');
    if (!snapshot.openOrders) diffs.push('Open orders snapshot missing');
    if (!snapshot.positions) diffs.push('Positions snapshot missing');
    if (!snapshot.recentFills) diffs.push('Recent fills snapshot missing');
    if (!snapshot.streamState) diffs.push('Stream state missing');

    return {
      pausedTrading: true,
      consistent: diffs.length === 0,
      diffs,
      balancesFetched: Boolean(snapshot.balances),
      ordersFetched: Boolean(snapshot.openOrders),
      positionsFetched: Boolean(snapshot.positions),
      fillsFetched: Boolean(snapshot.recentFills)
    };
  }
}
