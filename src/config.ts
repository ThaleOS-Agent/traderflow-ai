export const siteConfig = {
  title: 'TradeFlow AI',
};

type NavIcon = 'disc' | 'play' | 'calendar' | 'chart';

interface NavItem {
  label: string;
  icon: NavIcon;
  sectionId: string;
}

interface HeroConfig {
  brandName: string;
  decodeText: string;
  decodeChars: string;
  subtitle: string;
  backgroundImage: string;
  cornerLabel: string;
  cornerDetail: string;
  ctaPrimary: string;
  ctaPrimaryTarget: string;
  ctaSecondary: string;
  ctaSecondaryTarget: string;
  navItems: NavItem[];
}

export const heroConfig: HeroConfig = {
  brandName: 'TradeFlow AI',
  decodeText: 'TRADEFLOW',
  decodeChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()',
  subtitle: 'AI-Powered Trading Intelligence',
  backgroundImage: '',
  cornerLabel: 'LIVE PLATFORM',
  cornerDetail: 'Paper Trading Mode',
  ctaPrimary: 'Start Trading',
  ctaPrimaryTarget: 'strategy',
  ctaSecondary: 'View Markets',
  ctaSecondaryTarget: 'markets',
  navItems: [
    { label: 'Strategy', icon: 'disc', sectionId: 'strategy' },
    { label: 'Markets', icon: 'chart', sectionId: 'markets' },
    { label: 'Schedule', icon: 'calendar', sectionId: 'schedule' },
  ],
};

interface GalleryImage {
  id: string;
  src: string;
  alt?: string;
  title?: string;
  date?: string;
}

export const parallaxGalleryConfig = {
  sectionLabel: 'MARKETS',
  sectionTitle: 'Live Market Intelligence',
  galleryLabel: 'STRATEGIES',
  galleryTitle: 'Trading Strategies',
  marqueeTexts: ['AI TRADING', 'QUANTUM SIGNALS', 'MULTI-ASSET', 'PAPER MODE'],
  endCtaText: 'Explore Strategies',
  parallaxImagesTop: [] as GalleryImage[],
  parallaxImagesBottom: [] as GalleryImage[],
  galleryImages: [] as GalleryImage[],
};
