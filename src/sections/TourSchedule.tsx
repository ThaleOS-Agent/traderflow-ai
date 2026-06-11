import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Zap, Shield, BarChart3, Globe, Cpu, ArrowUpRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Cpu,
    number: '01',
    title: 'Quantum AI Strategy',
    description: 'Proprietary ML ensemble combining reinforcement learning with harmonic pattern detection across 50+ indicators.',
    stats: ['94% signal accuracy', '< 50ms execution', 'Multi-timeframe'],
    color: 'from-cyan-500/20 to-blue-500/20',
    border: 'border-cyan-500/20',
  },
  {
    icon: BarChart3,
    number: '02',
    title: 'Multi-Exchange Trading',
    description: 'Seamlessly connect Binance, Coinbase, Kraken, KuCoin, Bybit, and 4 more exchanges simultaneously.',
    stats: ['9 exchanges', 'DEX support', 'Real-time sync'],
    color: 'from-blue-500/20 to-purple-500/20',
    border: 'border-blue-500/20',
  },
  {
    icon: Zap,
    number: '03',
    title: 'Auto-Execution Engine',
    description: 'Set your risk tolerance once. The engine monitors markets 24/7 and executes verified signals automatically.',
    stats: ['24/7 uptime', 'Auto stop-loss', 'Take-profit logic'],
    color: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/20',
  },
  {
    icon: Shield,
    number: '04',
    title: 'Advanced Risk Manager',
    description: 'Multi-layered risk controls with position sizing, daily loss limits, drawdown protection, and leverage caps.',
    stats: ['Daily loss limits', 'Position sizing', 'Drawdown guard'],
    color: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/20',
  },
  {
    icon: Globe,
    number: '05',
    title: 'Social & Copy Trading',
    description: 'Follow top-performing traders, mirror their portfolio in real time, or publish your own strategy for followers.',
    stats: ['Copy trading', 'Leaderboard', 'PnL sharing'],
    color: 'from-orange-500/20 to-yellow-500/20',
    border: 'border-orange-500/20',
  },
  {
    icon: BarChart3,
    number: '06',
    title: 'Enhanced Backtesting',
    description: 'Test any strategy against years of historical data with slippage modelling, fees, and walk-forward analysis.',
    stats: ['5yr history', 'Slippage model', 'Walk-forward'],
    color: 'from-red-500/20 to-orange-500/20',
    border: 'border-red-500/20',
  },
];

const TourSchedule = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
            delay: (i % 3) * 0.1,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="tour" ref={sectionRef} className="relative bg-[#050508] py-24 px-8">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <p className="font-mono-custom text-xs text-cyan-400/60 uppercase tracking-widest mb-3">
            PLATFORM FEATURES
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Everything you need to<br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              trade at the edge.
            </span>
          </h2>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.number}
                ref={el => { cardsRef.current[i] = el; }}
                className={`group relative bg-gradient-to-br ${feature.color} backdrop-blur-sm border ${feature.border} rounded-2xl p-6 hover:scale-[1.02] transition-transform duration-300 cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-mono-custom text-4xl font-bold text-white/10">
                    {feature.number}
                  </span>
                </div>

                <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">{feature.description}</p>

                <div className="flex flex-wrap gap-2">
                  {feature.stats.map(stat => (
                    <span
                      key={stat}
                      className="text-xs font-mono-custom text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full"
                    >
                      {stat}
                    </span>
                  ))}
                </div>

                <ArrowUpRight className="absolute bottom-6 right-6 w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TourSchedule;
