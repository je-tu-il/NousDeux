/**
 * Soft & Warm Palette for NousDeux
 * Pastel peach, warm cream, soft pinks.
 * Tokens sémantiques pour l'adaptation light/dark automatique.
 */
export const Colors = {
  light: {
    text: '#212723',
    background: '#EFEADD',           // Warm cream
    tint: '#315E79',                 // Soft peach
    icon: '#212723',
    tabIconDefault: '#514E45',
    tabIconSelected: '#315E79',
    card: '#FFFAF0',
    cardBorder: 'rgba(164, 157, 142, 0.2)',
    gradientStart: '#4E7185',
    gradientEnd: '#315E79',
    // Fonds de blocs translucides (sur fond d'écran)
    glassBackground: 'rgba(255, 250, 240, 0.96)',
    // Fonds de cartes principales (mainCard, smallCard, categoryCard)
    cardGlass: 'rgba(255, 250, 240, 0.96)',
    // Fonds de cartes colorées (ex: Question du Jour, Illimitées…)
    cardGlassColored: (r: number, g: number, b: number) => `rgba(${r},${g},${b},0.08)`,
    // Overlay de page (par-dessus le fond d'écran, sous le contenu)
    pageOverlay: 'rgba(255,255,255,0.18)',
    // Carte verrouillée
    cardLocked: '#F3F4F6',
    cardLockedBorder: '#E5E7EB',
  },
  dark: {
    text: '#FFFAF0',
    textSecondary: '#DBD4C4',
    background: '#212723', // slightly lighter than 1A1514
    tint: '#ADC8D8',
    icon: '#F8F4F3',
    tabIconDefault: '#ccc',
    tabIconSelected: '#ADC8D8',
    card: '#303932', // lighter than 2D2423
    cardBorder: 'rgba(173, 200, 216, 0.18)',
    gradientStart: '#42667D',
    gradientEnd: '#315E79',
    // Fonds de blocs translucides (sur fond d'écran)
    glassBackground: 'rgba(33, 39, 35, 0.96)', // less opaque, slightly lighter
    // Fonds de cartes principales (mainCard, smallCard, categoryCard) — sombre avec transparence
    cardGlass: 'rgba(48, 57, 50, 0.96)', // lighter glass
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
