import { useState } from 'react';
import {
  Crown, Zap, Shield, Star, Diamond, Gem, Check,
  Lock, ArrowRight, Sparkles,
} from 'lucide-react';

// ── Tier definitions ────────────────────────────────────────────────────────

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    icon: Star,
    color: 'from-gray-500/20 to-gray-600/20',
    border: 'border-gray-600/30',
    badge: 'text-gray-400',
    accent: '#9ca3af',
    features: [
      'Basic trading signals',
      'Paper trading (simulated)',
      '2 strategies',
      '3 open positions',
      '100 API calls / day',
    ],
    locked: [],
  },
  {
    id: 'bronze',
    name: 'Bronze',
    price: 29,
    icon: Shield,
    color: 'from-orange-800/20 to-yellow-700/20',
    border: 'border-orange-600/30',
    badge: 'text-orange-400',
    accent: '#f97316',
    features: [
      'All Free features',
      'Live trading',
      'Advanced charts',
      'Email alerts',
      '5 strategies',
      '10 open positions',
      '1,000 API calls / day',
    ],
    locked: [],
  },
  {
    id: 'silver',
    name: 'Silver',
    price: 79,
    icon: Zap,
    color: 'from-slate-400/20 to-gray-300/20',
    border: 'border-slate-400/30',
    badge: 'text-slate-300',
    accent: '#cbd5e1',
    features: [
      'All Bronze features',
      'Arbitrage bot',
      'Harmonic patterns',
      'ML predictions',
      'Multi-exchange support',
      '10 strategies',
      '25 open positions',
      '5,000 API calls / day',
    ],
    locked: [],
  },
  {
    id: 'gold',
    name: 'Gold',
    price: 199,
    popular: true,
    icon: Star,
    color: 'from-yellow-500/20 to-amber-500/20',
    border: 'border-yellow-500/40',
    badge: 'text-yellow-400',
    accent: '#eab308',
    features: [
      'All Silver features',
      'Ensemble Master strategy',
      'Social & copy trading',
      'Options calculator',
      '20 strategies',
      '50 open positions',
      '20,000 API calls / day',
    ],
    locked: [],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    price: 499,
    icon: Gem,
    color: 'from-cyan-400/20 to-blue-500/20',
    border: 'border-cyan-400/40',
    badge: 'text-cyan-300',
    accent: '#22d3ee',
    features: [
      'All Gold features',
      'DEX integration',
      'Yield farming signals',
      'Priority support',
      'Forex & commodities',
      '50 strategies',
      '100 open positions',
      '100,000 API calls / day',
    ],
    locked: [],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    price: 999,
    icon: Diamond,
    color: 'from-blue-400/20 to-violet-500/20',
    border: 'border-blue-400/40',
    badge: 'text-blue-300',
    accent: '#60a5fa',
    features: [
      'All Platinum features',
      'Custom strategy builder',
      'API access',
      'White-glove service',
      'Unlimited positions',
      '100 strategies',
      '500,000 API calls / day',
    ],
    locked: [],
  },
  {
    id: 'founder',
    name: 'Founder',
    price: null,
    lifetime: true,
    icon: Crown,
    color: 'from-amber-400/30 to-orange-500/30',
    border: 'border-amber-400/60',
    badge: 'text-amber-400',
    accent: '#f59e0b',
    features: [
      'Every feature — now & future',
      'Unlimited everything',
      'White-glove priority support',
      'Platform governance rights',
      'Revenue share eligibility',
      'Early access to all betas',
      'Direct founder communication',
      'Lifetime access — no renewals',
    ],
    locked: [],
  },
] as const;

type TierId = typeof TIERS[number]['id'];

interface SubscriptionPageProps {
  currentTier?: string;
  isFounder?: boolean;
  onUpgrade?: (tier: string) => void;
}

const TIER_ORDER: TierId[] = ['free', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'founder'];

function tierIndex(t: string): number {
  return TIER_ORDER.indexOf(t as TierId);
}

export function SubscriptionPage({ currentTier = 'free', isFounder = false, onUpgrade }: SubscriptionPageProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const effectiveTier = isFounder ? 'founder' : currentTier;

  return (
    <div className="min-h-screen bg-[#050508] text-white px-6 py-10">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">Subscription Plans</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">
          Choose your edge.
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto text-sm">
          Every tier unlocks more power. Founder access gives you everything — permanently.
        </p>
        {effectiveTier !== 'free' && (
          <div className="mt-4 inline-flex items-center gap-2 text-sm">
            <span className="text-gray-500">Current plan:</span>
            <span className="capitalize font-semibold text-white">{effectiveTier}</span>
            {isFounder && <Crown className="w-4 h-4 text-amber-400" />}
          </div>
        )}
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto mb-6">
        {TIERS.filter(t => t.id !== 'founder').map(tier => {
          const Icon = tier.icon;
          const isCurrent = effectiveTier === tier.id;
          const isLocked = tierIndex(effectiveTier) > tierIndex(tier.id);
          const isUpgrade = !isCurrent && !isLocked && effectiveTier !== 'founder';
          const isPopular = 'popular' in tier && tier.popular;

          return (
            <div
              key={tier.id}
              className={`relative bg-gradient-to-br ${tier.color} border ${tier.border} rounded-2xl p-5 flex flex-col transition-all duration-200 ${
                isCurrent ? 'ring-2 ring-offset-1 ring-offset-[#050508]' : ''
              } ${selected === tier.id ? 'scale-[1.02]' : ''}`}
              style={isCurrent ? { ['--tw-ring-color' as string]: tier.accent } : {}}
              onClick={() => setSelected(tier.id)}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-3 py-0.5 rounded-full">
                  POPULAR
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 bg-green-500 text-black text-xs font-bold px-3 py-0.5 rounded-full">
                  CURRENT
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Icon className="w-4 h-4" style={{ color: tier.accent }} />
                </div>
                <div>
                  <p className={`font-bold text-white`}>{tier.name}</p>
                  <p className={`text-xs ${tier.badge}`}>
                    {tier.price === 0 ? 'Free forever' : `$${tier.price} / month`}
                  </p>
                </div>
              </div>

              <ul className="space-y-1.5 mb-5 flex-1">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: tier.accent }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={e => { e.stopPropagation(); if (isUpgrade) onUpgrade?.(tier.id); }}
                disabled={isCurrent || isLocked || effectiveTier === 'founder'}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-green-500/20 text-green-400 cursor-default'
                    : isLocked || effectiveTier === 'founder'
                    ? 'bg-white/5 text-gray-600 cursor-default'
                    : 'text-black hover:opacity-90 active:scale-95'
                }`}
                style={isUpgrade ? { backgroundColor: tier.accent } : {}}
              >
                {isCurrent && <><Check className="w-3.5 h-3.5" /> Active</>}
                {isLocked && <><Lock className="w-3.5 h-3.5" /> Included</>}
                {effectiveTier === 'founder' && <><Crown className="w-3.5 h-3.5" /> Included</>}
                {isUpgrade && <><ArrowRight className="w-3.5 h-3.5" /> Upgrade</>}
                {effectiveTier === 'free' && tier.id === 'free' && <><Check className="w-3.5 h-3.5" /> Active</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Founder tier — full-width spotlight */}
      {(() => {
        const tier = TIERS.find(t => t.id === 'founder')!;
        const Icon = tier.icon;
        const isCurrent = effectiveTier === 'founder';
        return (
          <div className={`relative max-w-7xl mx-auto bg-gradient-to-r ${tier.color} border-2 ${tier.border} rounded-2xl p-8 overflow-hidden`}>
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />

            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/20 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-white">Founder</h2>
                    <span className="bg-amber-400/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                      LIFETIME
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">By invitation only. Full access, forever.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                {tier.features.map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-gray-300">{f}</span>
                  </div>
                ))}
              </div>

              <div className="flex-shrink-0">
                {isCurrent ? (
                  <div className="flex items-center gap-2 bg-amber-400/20 border border-amber-400/40 rounded-xl px-5 py-3 text-amber-400 font-bold">
                    <Crown className="w-4 h-4" /> Founder Access Active
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-2">Contact us to become a Founder</p>
                    <a
                      href="mailto:founder@tradeflow.ai"
                      className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                    >
                      <Icon className="w-4 h-4" /> Apply for Founder Access
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
