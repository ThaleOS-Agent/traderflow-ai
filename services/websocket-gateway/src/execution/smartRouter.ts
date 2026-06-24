export type SmartRouteCandidate = {
  exchange: string;
  healthScore: number;
  estimatedFeeBps: number;
  estimatedSpreadBps: number;
  estimatedSlippageBps: number;
  latencyMs: number;
};

export class SmartRouter {
  rank(candidates: SmartRouteCandidate[]) {
    return [...candidates]
      .map(candidate => ({
        ...candidate,
        routeConfidenceScore: Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (candidate.healthScore * 0.45)
              + (Math.max(0, 30 - candidate.estimatedFeeBps) * 0.2)
              + (Math.max(0, 20 - candidate.estimatedSpreadBps) * 0.15)
              + (Math.max(0, 20 - candidate.estimatedSlippageBps) * 0.1)
              + (Math.max(0, 100 - candidate.latencyMs) * 0.1)
            )
          )
        )
      }))
      .sort((left, right) => right.routeConfidenceScore - left.routeConfidenceScore);
  }
}
