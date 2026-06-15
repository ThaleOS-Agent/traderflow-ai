import { TrendingUp, Github, Twitter, MessageCircle } from 'lucide-react';

const PLATFORM_LINKS: { label: string; href: string }[] = [
  { label: 'Strategies',     href: '#strategies' },
  { label: 'Signals',        href: '#gallery' },
  { label: 'Backtesting',    href: '#tour' },
  { label: 'Risk Manager',   href: '#tour' },
  { label: 'Social Trading', href: '#tour' },
];

const COMPANY_LINKS: { label: string; href: string }[] = [
  { label: 'About',            href: '#strategies' },
  { label: 'Pricing',          href: 'mailto:billing@tradeflow.ai?subject=Pricing' },
  { label: 'Documentation',    href: 'mailto:support@tradeflow.ai?subject=Documentation' },
  { label: 'Support',          href: 'mailto:support@tradeflow.ai' },
  { label: 'Terms of Service', href: 'mailto:legal@tradeflow.ai?subject=Terms+of+Service' },
];

const SOCIAL_LINKS = [
  { Icon: Twitter,       href: 'https://twitter.com/tradeflowai' },
  { Icon: Github,        href: 'https://github.com/thaleos-agent/traderflow-ai' },
  { Icon: MessageCircle, href: 'https://discord.gg/tradeflowai' },
];

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer id="footer" className="bg-[#050508] border-t border-white/5 py-16 px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-cyan-400/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                TRADEFLOW AI
              </span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              AI-powered automated trading across crypto, forex, and commodities.
              Built for serious traders who demand edge.
            </p>
            <div className="flex gap-3 mt-6">
              {SOCIAL_LINKS.map(({ Icon, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2.5">
              {PLATFORM_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target={href.startsWith('mailto') ? undefined : '_self'}
                    className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-xs">
            © {year} TradeFlow AI. All rights reserved.
          </p>
          <p className="text-gray-700 text-xs">
            Trading involves risk. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
