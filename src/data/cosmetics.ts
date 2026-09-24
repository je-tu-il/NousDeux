import { InventoryData, QuestProgressMap } from '../lib/economy';

export type CosmeticType = 'background' | 'border' | 'tag';

export type UnlockCondition = 
  | { type: 'free' }
  | { type: 'streak'; days: number }
  | { type: 'quest'; questId: string; tier: string }
  | { type: 'purchase'; price: number };

export type Cosmetic = {
  id: string;
  name: string;
  description: string;
  type: CosmeticType;
  unlock: UnlockCondition;
  preview: string; // gradient CSS string or color for backgrounds, border style description for borders
  emoji?: string;
  image?: any; // require() image for local assets
  darkImage?: any; // optional dark-mode version of a background
  imagePosition?: 'top center' | 'center' | 'bottom center'; // How to align when cropping
  tags?: string[]; // categories for filtering
};

export const COSMETICS: Cosmetic[] = [
  // BACKGROUNDS
  { id: 'bg_free_1', name: 'Par défaut', description: 'Le fond classique', type: 'background', unlock: { type: 'free' }, preview: 'linear-gradient(135deg, #FF9A8B 0%, #FF6A88 100%)', image: require('../../assets/images/romantic_calendar_bg.png'), darkImage: require('../../Fonts/DashboardOriginalS.jpg'), tags: ['clair', 'simple'] },

  { id: 'bg_free_3b', name: 'Lavande douce', description: 'Apaisant et floral', type: 'background', unlock: { type: 'purchase', price: 50 }, preview: 'linear-gradient(135deg, #E2B0FF 0%, #9F44D3 100%)', image: require('../../assets/images/cosmetics/backgrounds/Lavande.png'), darkImage: require('../../Fonts/LavandeS.jpg'), imagePosition: 'bottom center', tags: ['clair', 'violet'] },
  { id: 'bg_free_4', name: 'Menthe fraîche', description: 'Rafraîchissant', type: 'background', unlock: { type: 'purchase', price: 50 }, preview: 'linear-gradient(135deg, #84FAB0 0%, #8FD3F4 100%)', image: require('../../assets/images/cosmetics/backgrounds/Mente.png'), darkImage: require('../../Fonts/MentheS.jpg'), tags: ['clair', 'vert'] },
  { id: 'bg_free_5', name: 'Bleu ciel', description: 'Léger comme l\'air', type: 'background', unlock: { type: 'purchase', price: 50 }, preview: 'linear-gradient(135deg, #89F7FE 0%, #66A6FF 100%)', image: require('../../Fonts/BleuCielC.jpg'), darkImage: require('../../Fonts/BleuCielS.jpg'), tags: ['clair', 'bleu'] },
  { id: 'bg_free_6', name: 'Crème', description: 'Douceur lumineuse', type: 'background', unlock: { type: 'purchase', price: 50 }, preview: 'linear-gradient(135deg, #FFF8E7 0%, #F5D9A6 100%)', image: require('../../assets/images/cosmetics/backgrounds/Creme.png'), darkImage: require('../../Fonts/CremeS.jpg'), tags: ['clair', 'chaud'] },
  { id: 'bg_free_7', name: 'Rose poudré', description: 'Une teinte délicate', type: 'background', unlock: { type: 'purchase', price: 50 }, preview: 'linear-gradient(135deg, #FFF1F3 0%, #E8B4B8 100%)', image: require('../../assets/images/cosmetics/backgrounds/Rose.png'), darkImage: require('../../Fonts/RoseS.jpg'), tags: ['clair', 'rose'] },
  
  { id: 'bg_streak_3', name: 'Aurore boréale', description: 'Illuminez vos nuits', type: 'background', unlock: { type: 'streak', days: 3 }, preview: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)', image: require('../../Fonts/AuroreC.jpg'), darkImage: require('../../assets/images/cosmetics/backgrounds/Aurore.png'), imagePosition: 'top center', tags: ['nuit', 'vert'] },
  { id: 'bg_streak_7', name: 'Coucher de soleil', description: 'Fin de journée romantique', type: 'background', unlock: { type: 'streak', days: 7 }, preview: 'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)', image: require('../../assets/images/cosmetics/backgrounds/CoucherSoleil.png'), darkImage: require('../../Fonts/CoucherSoleilS.jpg'), tags: ['chaud', 'orange'] },
  { id: 'bg_streak_14', name: 'Nuit étoilée', description: 'Rêves infinis', type: 'background', unlock: { type: 'streak', days: 14 }, preview: 'linear-gradient(135deg, #09203F 0%, #537895 100%)', image: require('../../Fonts/NuitC.jpg'), darkImage: require('../../assets/images/cosmetics/backgrounds/Nuit.png'), imagePosition: 'top center', tags: ['sombre', 'nuit'] },
  { id: 'bg_streak_30', name: 'Forêt enchantée', description: 'Mystère sylvestre', type: 'background', unlock: { type: 'streak', days: 30 }, preview: 'linear-gradient(135deg, #16A085 0%, #F4D03F 100%)', image: require('../../Fonts/ForetC.jpg'), darkImage: require('../../assets/images/cosmetics/backgrounds/Foret.png'), imagePosition: 'bottom center', tags: ['nature', 'vert'] },
  { id: 'bg_streak_60', name: 'Cerisiers en fleur', description: 'Éveil printanier', type: 'background', unlock: { type: 'streak', days: 60 }, preview: 'linear-gradient(135deg, #FF9A8B 0%, #FF6A88 100%)', image: require('../../assets/images/cosmetics/backgrounds/Cerisier.png'), darkImage: require('../../Fonts/CerisierS.jpg'), imagePosition: 'bottom center', tags: ['floral', 'rose'] },

  { id: 'bg_shop_1', name: 'Galaxy rose', description: 'Un univers de douceur', type: 'background', unlock: { type: 'purchase', price: 80 }, preview: 'linear-gradient(135deg, #FCCB90 0%, #D57EEB 100%)', image: require('../../assets/images/cosmetics/backgrounds/Galaxy.png'), darkImage: require('../../Fonts/GalaxyS.jpg'), imagePosition: 'top center', tags: ['espace', 'rose'] },
  { id: 'bg_shop_2', name: 'Corail tropical', description: 'Ambiance vacances', type: 'background', unlock: { type: 'purchase', price: 100 }, preview: 'linear-gradient(135deg, #FAD961 0%, #F76B1C 100%)', image: require('../../assets/images/cosmetics/backgrounds/Corail.png'), darkImage: require('../../Fonts/CorailS.jpg'), imagePosition: 'bottom center', tags: ['chaud', 'orange'] },
  { id: 'bg_shop_3', name: 'Prairie fleurie', description: 'Nature verdoyante', type: 'background', unlock: { type: 'purchase', price: 120 }, preview: 'linear-gradient(135deg, #D4FC79 0%, #96E6A1 100%)', image: require('../../assets/images/cosmetics/backgrounds/Prairie.png'), darkImage: require('../../Fonts/PrairieS.jpg'), imagePosition: 'bottom center', tags: ['nature', 'vert'] },
  { id: 'bg_shop_4', name: 'Vague océan', description: 'Plongez dans le grand bleu', type: 'background', unlock: { type: 'purchase', price: 150 }, preview: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)', image: require('../../assets/images/cosmetics/backgrounds/Vague.png'), darkImage: require('../../Fonts/VagueS.jpg'), imagePosition: 'bottom center', tags: ['eau', 'bleu'] },
  { id: 'bg_shop_5', name: 'Automne doré', description: 'Feuilles rousses et dorées', type: 'background', unlock: { type: 'purchase', price: 180 }, preview: 'linear-gradient(135deg, #F6D365 0%, #FDA085 100%)', image: require('../../assets/images/cosmetics/backgrounds/Automne.png'), darkImage: require('../../Fonts/AutomneS.jpg'), imagePosition: 'bottom center', tags: ['saison', 'orange'] },
  { id: 'bg_shop_6', name: 'Néon violet', description: 'Ambiance cyberpunk', type: 'background', unlock: { type: 'purchase', price: 200 }, preview: 'linear-gradient(135deg, #B12A5B 0%, #CF556C 100%)', image: require('../../Fonts/NeonC.jpg'), darkImage: require('../../assets/images/cosmetics/backgrounds/Neont.png'), tags: ['neon', 'violet'] },
  { id: 'bg_shop_7', name: 'Arc-en-ciel pastel', description: 'Toutes les couleurs en douceur', type: 'background', unlock: { type: 'purchase', price: 250 }, preview: 'linear-gradient(135deg, #FDFBFB 0%, #EBEDEE 100%)', image: require('../../assets/images/cosmetics/backgrounds/Arcenciel.png'), darkImage: require('../../Fonts/ArcEncielS.jpg'), tags: ['colore', 'clair'] },
  { id: 'bg_shop_8', name: 'Tempête de neige', description: 'Frais et revigorant', type: 'background', unlock: { type: 'purchase', price: 300 }, preview: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)', image: require('../../assets/images/cosmetics/backgrounds/Neige.png'), darkImage: require('../../Fonts/NeigeS.jpg'), tags: ['froid', 'bleu'] },
  { id: 'bg_shop_9', name: 'Volcan tropical', description: 'Éruption de chaleur', type: 'background', unlock: { type: 'purchase', price: 350 }, preview: 'linear-gradient(135deg, #FF0844 0%, #FFB199 100%)', image: require('../../assets/images/cosmetics/backgrounds/Volcan.png'), darkImage: require('../../Fonts/VolcanS.jpg'), imagePosition: 'bottom center', tags: ['feu', 'rouge'] },
  { id: 'bg_shop_10', name: 'Cascade arc-en-ciel', description: 'Magie pure', type: 'background', unlock: { type: 'purchase', price: 400 }, preview: 'linear-gradient(135deg, #96FBC4 0%, #F9F586 100%)', image: require('../../assets/images/cosmetics/backgrounds/Cascade.png'), darkImage: require('../../Fonts/CascadeS.jpg'), imagePosition: 'bottom center', tags: ['magie', 'jaune'] },

  // BORDERS
  { id: 'bd_free_1', name: 'Par défaut', description: 'Simple et épuré', type: 'border', unlock: { type: 'free' }, preview: 'solid 2px #FF9A8B', tags: ['clair', 'simple'] },
  { id: 'bd_free_2', name: 'Simple fin', description: 'Une ligne délicate', type: 'border', unlock: { type: 'purchase', price: 50 }, preview: 'solid 1px #E2E8F0', image: require('../../assets/images/cosmetics/borders/Argent.png'), tags: ['clair', 'simple'] },
  { id: 'bd_free_3', name: 'Pointillé', description: 'Léger et fun', type: 'border', unlock: { type: 'purchase', price: 50 }, preview: 'dashed 2px #CBD5E1', image: require('../../assets/images/cosmetics/borders/Pointille.png'), tags: ['clair', 'simple'] },
  
  { id: 'bd_streak_7', name: 'Fleurs roses', description: 'Printanier', type: 'border', unlock: { type: 'streak', days: 7 }, preview: 'solid 3px #F472B6', image: require('../../assets/images/cosmetics/borders/Fleurs.png'), tags: ['floral', 'rose'] },
  { id: 'bd_streak_14', name: 'Cœurs', description: 'Plein d\'amour', type: 'border', unlock: { type: 'streak', days: 14 }, preview: 'solid 3px #EF4444', image: require('../../assets/images/cosmetics/borders/Coeur.png'), tags: ['amour', 'rouge'] },
  { id: 'bd_streak_30', name: 'Étoiles dorées', description: 'Brillant', type: 'border', unlock: { type: 'streak', days: 30 }, preview: 'solid 3px #FBBF24', image: require('../../assets/images/cosmetics/borders/Etoiles.png'), tags: ['brillant', 'jaune'] },
  { id: 'bd_streak_60', name: 'Diamants', description: 'Précieux', type: 'border', unlock: { type: 'streak', days: 60 }, preview: 'solid 3px #38BDF8', image: require('../../assets/images/cosmetics/borders/CrystauxBleu.png'), tags: ['precieux', 'bleu'] },

  { id: 'bd_shop_1', name: 'Néon rose', description: 'Flashy', type: 'border', unlock: { type: 'purchase', price: 100 }, preview: 'solid 2px #FF00FF', image: require('../../assets/images/cosmetics/borders/RoseBorder.png'), tags: ['neon', 'rose'] },
  { id: 'bd_shop_2', name: 'Pixel art', description: 'Rétro', type: 'border', unlock: { type: 'purchase', price: 120 }, preview: 'dotted 4px #000000', image: require('../../assets/images/cosmetics/borders/NoirForteresse.png'), tags: ['retro', 'sombre'] },
  { id: 'bd_shop_3', name: 'Arc-en-ciel animé', description: 'Vivant', type: 'border', unlock: { type: 'purchase', price: 150 }, preview: 'solid 3px #FFA500', image: require('../../assets/images/cosmetics/borders/Arcenciel.png'), tags: ['colore', 'vif'] },
  { id: 'bd_shop_4', name: 'Or royal', description: 'Luxueux', type: 'border', unlock: { type: 'purchase', price: 200 }, preview: 'solid 4px #FFD700', image: require('../../assets/images/cosmetics/borders/BordOr.png'), tags: ['luxe', 'jaune'] },
  { id: 'bd_shop_5', name: 'Galaxie tournante', description: 'Spatial', type: 'border', unlock: { type: 'purchase', price: 250 }, preview: 'solid 3px #4B0082', image: require('../../assets/images/cosmetics/borders/Galaxy.png'), tags: ['espace', 'violet'] },
  { id: 'bd_shop_6', name: 'Fleurs de cerisier', description: 'Japonais', type: 'border', unlock: { type: 'purchase', price: 300 }, preview: 'solid 4px #FFB7C5', image: require('../../assets/images/cosmetics/borders/Cerisier.png'), tags: ['floral', 'rose'] },
  { id: 'bd_shop_7', name: 'Vague de mer', description: 'Océanique', type: 'border', unlock: { type: 'purchase', price: 400 }, preview: 'solid 3px #00CED1', image: require('../../assets/images/cosmetics/borders/Vague.png'), tags: ['eau', 'bleu'] },
  { id: 'bd_shop_8', name: 'Couronne royale', description: 'Le summum', type: 'border', unlock: { type: 'purchase', price: 500 }, preview: 'double 6px #DAA520', image: require('../../assets/images/cosmetics/borders/Couronne.png'), tags: ['royal', 'or'] },

  // TAGS
  { id: 'tag_free_0', name: 'Aucun', description: 'Sans tag', type: 'tag', unlock: { type: 'free' }, preview: '', emoji: '' },
  { id: 'tag_free_1', name: 'Bavard(e)', description: 'Parle beaucoup', type: 'tag', unlock: { type: 'purchase', price: 50 }, preview: '', emoji: '💬' },
  { id: 'tag_free_2', name: 'Romantique', description: 'Fleur bleue', type: 'tag', unlock: { type: 'purchase', price: 50 }, preview: '', emoji: '🌸' },
  { id: 'tag_free_3', name: 'Gamer', description: 'Joue souvent', type: 'tag', unlock: { type: 'purchase', price: 50 }, preview: '', emoji: '🎮' },
  { id: 'tag_free_4', name: 'Créatif(ve)', description: 'Plein d\'idées', type: 'tag', unlock: { type: 'purchase', price: 50 }, preview: '', emoji: '🎨' },
  { id: 'tag_free_5', name: 'Noctambule', description: 'Vit la nuit', type: 'tag', unlock: { type: 'purchase', price: 50 }, preview: '', emoji: '🌙' },

  { id: 'tag_quest_1', name: 'Champion(ne)', description: 'Complétionniste', type: 'tag', unlock: { type: 'quest', questId: 'streak_connect', tier: 'gold' }, preview: '', emoji: '🏆' },
  { id: 'tag_quest_2', name: 'Fidèle', description: 'Toujours là', type: 'tag', unlock: { type: 'quest', questId: 'daily_claims', tier: 'silver' }, preview: '', emoji: '⭐' },
  { id: 'tag_quest_3', name: 'Déterminé(e)', description: 'Va jusqu\'au bout', type: 'tag', unlock: { type: 'quest', questId: 'questions_answered', tier: 'gold' }, preview: '', emoji: '🎯' },
  { id: 'tag_quest_4', name: 'Collectionneur/se', description: 'Aime tout avoir', type: 'tag', unlock: { type: 'quest', questId: 'items_owned', tier: 'silver' }, preview: '', emoji: '💎' },
  { id: 'tag_quest_5', name: 'En feu', description: 'Inarrêtable', type: 'tag', unlock: { type: 'quest', questId: 'both_active', tier: 'gold' }, preview: '', emoji: '🔥' },
  { id: 'tag_quest_6', name: 'Expert(e)', description: 'Sait tout', type: 'tag', unlock: { type: 'quest', questId: 'bonus_questions', tier: 'platinum' }, preview: '', emoji: '🌺' },

  { id: 'tag_shop_1', name: 'Libre', description: 'Esprit libre', type: 'tag', unlock: { type: 'purchase', price: 50 }, preview: '', emoji: '🦋' },
  { id: 'tag_shop_2', name: 'Surfeur/se', description: 'Prend la vague', type: 'tag', unlock: { type: 'purchase', price: 50 }, preview: '', emoji: '🌊' },
  { id: 'tag_shop_3', name: 'Chanceux/se', description: 'A de la chance', type: 'tag', unlock: { type: 'purchase', price: 80 }, preview: '', emoji: '🍀' },
  { id: 'tag_shop_4', name: 'Star', description: 'Brille de mille feux', type: 'tag', unlock: { type: 'purchase', price: 100 }, preview: '', emoji: '🌟' },
  { id: 'tag_shop_5', name: 'Mystérieux/se', description: 'Garde ses secrets', type: 'tag', unlock: { type: 'purchase', price: 120 }, preview: '', emoji: '🎭' },
  { id: 'tag_shop_6', name: 'Unique', description: 'Pas comme les autres', type: 'tag', unlock: { type: 'purchase', price: 150 }, preview: '', emoji: '🦄' },
  { id: 'tag_shop_7', name: 'Festif(ve)', description: 'Fait la fête', type: 'tag', unlock: { type: 'purchase', price: 150 }, preview: '', emoji: '🎪' },
  { id: 'tag_shop_8', name: 'Stratège', description: 'Pense à tout', type: 'tag', unlock: { type: 'purchase', price: 180 }, preview: '', emoji: '🧩' },
  { id: 'tag_shop_9', name: 'Coloré(e)', description: 'Met de la vie', type: 'tag', unlock: { type: 'purchase', price: 200 }, preview: '', emoji: '🌈' },
  { id: 'tag_shop_10', name: 'Mélomane', description: 'Aime la musique', type: 'tag', unlock: { type: 'purchase', price: 200 }, preview: '', emoji: '🎵' },
  { id: 'tag_shop_11', name: 'Gourmand(e)', description: 'Aime manger', type: 'tag', unlock: { type: 'purchase', price: 220 }, preview: '', emoji: '🍕' },
  { id: 'tag_shop_12', name: 'Ambitieux/se', description: 'Vise loin', type: 'tag', unlock: { type: 'purchase', price: 250 }, preview: '', emoji: '🚀' },
  { id: 'tag_shop_13', name: 'Malin(e)', description: 'Très intelligent', type: 'tag', unlock: { type: 'purchase', price: 280 }, preview: '', emoji: '🦊' },
  { id: 'tag_shop_14', name: 'Magique', description: 'Fait des merveilles', type: 'tag', unlock: { type: 'purchase', price: 300 }, preview: '', emoji: '💫' }
];

export const BACKGROUNDS = COSMETICS.filter(c => c.type === 'background');
export const BORDERS = COSMETICS.filter(c => c.type === 'border');
export const TAGS = COSMETICS.filter(c => c.type === 'tag');

export function getCosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find(c => c.id === id);
}

export function getCosmeticImage(cosmetic: Cosmetic | null | undefined, isDarkMode: boolean): any {
  return isDarkMode ? cosmetic?.darkImage : cosmetic?.image;
}

export function isOwned(inventory: InventoryData, cosmetic: Cosmetic, streak: number = 0, questProgress: QuestProgressMap = {}): boolean {
  if (cosmetic.unlock.type === 'free') return true;
  if (cosmetic.unlock.type === 'streak' && streak >= (cosmetic.unlock.days ?? 0)) return true;
  if (cosmetic.unlock.type === 'quest') {
    const progress = questProgress[cosmetic.unlock.questId];
    if (progress && progress.tier) {
      const tiers = ['bronze', 'silver', 'gold', 'platinum'];
      const currentTierIdx = tiers.indexOf(progress.tier);
      const reqTierIdx = tiers.indexOf(cosmetic.unlock.tier);
      if (currentTierIdx >= reqTierIdx) return true;
    }
  }
  if (cosmetic.type === 'background' && inventory?.backgrounds?.includes(cosmetic.id)) return true;
  if (cosmetic.type === 'border' && inventory?.borders?.includes(cosmetic.id)) return true;
  if (cosmetic.type === 'tag' && inventory?.tags?.includes(cosmetic.id)) return true;
  return false;
}

export function canUnlock(cosmetic: Cosmetic, streak: number, questProgress: QuestProgressMap): boolean {
  if (cosmetic.unlock.type === 'free') return true;
  if (cosmetic.unlock.type === 'purchase') return true;
  if (cosmetic.unlock.type === 'streak') return streak >= cosmetic.unlock.days;
  
  if (cosmetic.unlock.type === 'quest') {
    const progress = questProgress[cosmetic.unlock.questId];
    if (!progress || !progress.tier) return false;
    
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const requiredIndex = tiers.indexOf(cosmetic.unlock.tier);
    const currentIndex = tiers.indexOf(progress.tier);
    
    return currentIndex >= requiredIndex;
  }
  
  return false;
}

export function parseGradientColors(cssString: string): string[] {
  if (cssString === 'none' || cssString === 'transparent') return ['transparent', 'transparent'];
  const matches = cssString.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgba?\([^)]+\)|transparent/g);
  if (!matches) return ['transparent', 'transparent'];
  if (matches.length === 1) return [matches[0], matches[0]];
  return [matches[0], matches[1]];
}

