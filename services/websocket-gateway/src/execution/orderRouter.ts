import { PreTradeChecks, type PreTradeInput } from './preTradeChecks.js';
import { SmartRouter, type SmartRouteCandidate } from './smartRouter.js';

export class OrderRouter {
  private readonly preTradeChecks = new PreTradeChecks();
  private readonly smartRouter = new SmartRouter();

  route(
    safetyInput: PreTradeInput,
    liveCandidates: SmartRouteCandidate[],
    paperCandidate: SmartRouteCandidate
  ) {
    const safety = this.preTradeChecks.evaluate(safetyInput);
    if (!safety.approved) {
      return {
        mode: 'paper',
        selectedRoute: paperCandidate,
        blocked: true,
        reasons: safety.reasons
      };
    }

    const ranked = this.smartRouter.rank(liveCandidates);
    return {
      mode: 'live',
      selectedRoute: ranked[0] ?? paperCandidate,
      blocked: false,
      reasons: [],
      ranked
    };
  }
}
