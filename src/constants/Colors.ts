/**
 * Soft & Warm Palette for NousDeux
 * Pastel peach, warm cream, soft pinks.
 * Tokens sémantiques pour l'adaptation light/dark automatique.
 */
export const Colors = {
  light: {
    text: '#4A3B39',
    background: '#FFF5F2',           // Warm cream
    tint: '#FF9A8B',                 // Soft peach
    icon: '#4A3B39',
    tabIconDefault: '#C6B2B0',
    tabIconSelected: '#FF9A8B',
    card: '#FFFFFF',
    cardBorder: 'rgba(255, 154, 139, 0.2)',
    gradientStart: '#FF9A8B',
    gradientEnd: '#FF6A88',
    // Fonds de blocs translucides (sur fond d'écran)
    glassBackground: 'rgba(255, 255, 255, 0.75)',
    // Fonds de cartes principales (mainCard, smallCard, categoryCard)
    cardGlass: 'rgba(255, 255, 255, 0.82)',
    // Fonds de cartes colorées (ex: Question du Jour, Illimitées…)
    cardGlassColored: (r: number, g: number, b: number) => `rgba(${r},${g},${b},0.08)`,
    // Overlay de page (par-dessus le fond d'écran, sous le contenu)
    pageOverlay: 'rgba(255,255,255,0.18)',
    // Carte verrouillée
    cardLocked: '#F3F4F6',
    cardLockedBorder: '#E5E7EB',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A99693',
    background: '#1F1715', // slightly lighter than 1A1514
    tint: '#FFB8AD',
    icon: '#F8F4F3',
    tabIconDefault: '#ccc',
    tabIconSelected: '#FFB8AD',
    card: '#362927', // lighter than 2D2423
    cardBorder: 'rgba(255, 184, 173, 0.18)',
    gradientStart: '#A94D62',
    gradientEnd: '#813B4D',
    // Fonds de blocs translucides (sur fond d'écran)
    glassBackground: 'rgba(35, 26, 25, 0.75)', // less opaque, slightly lighter
    // Fonds de cartes principales (mainCard, smallCard, categoryCard) — sombre avec transparence
    cardGlass: 'rgba(54, 41, 39, 0.82)', // lighter glass
    // Fonds de cartes colorées en dark (teinte sombre légèrement colorée)
    cardGlassColored: (r: number, g: number, b: number) => `rgba(${r},${g},${b},0.12)`,
    // Overlay de page sombre (réduit l'éblouissement sur les fonds clairs)
    pageOverlay: 'rgba(0,0,0,0.30)',
    border: 'rgba(255,255,255,0.1)',
    // Carte verrouillée en dark
    cardLocked: 'rgba(38, 28, 27, 0.90)',
    cardLockedBorder: 'rgba(80, 60, 58, 0.6)',
  },
};
