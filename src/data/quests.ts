export type QuestEvent = 
  | 'daily_claim' 
  | 'question_answered' 
  | 'bonus_question' 
  | 'petals_earned' 
  | 'both_active' 
  | 'petals_spent' 
  | 'items_owned'
  | 'couple_duration';

export type QuestTierLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export type QuestTier = { 
  tier: QuestTierLevel; 
  threshold: number; 
  reward: number; 
  badge?: string 
};

export type Quest = { 
  id: string; 
  name: string; 
  description: string; 
  icon: string; 
  trigger: QuestEvent; 
  tiers: QuestTier[] 
};

export const QUESTS: Quest[] = [
  {
    id: 'streak_connect',
    name: 'Connexion fidèle',
    description: 'Se connecter plusieurs jours d\'affilée',
    icon: '🔥',
    trigger: 'daily_claim',
    tiers: [
      { tier: 'bronze', threshold: 3, reward: 20 },
      { tier: 'silver', threshold: 7, reward: 50 },
      { tier: 'gold', threshold: 30, reward: 150 },
      { tier: 'platinum', threshold: 100, reward: 500 }
    ]
  },
  {
    id: 'questions_answered',
    name: 'Curiosité',
    description: 'Répondre aux questions',
    icon: '💬',
    trigger: 'question_answered',
    tiers: [
      { tier: 'bronze', threshold: 10, reward: 30 },
      { tier: 'silver', threshold: 50, reward: 100 },
      { tier: 'gold', threshold: 200, reward: 300 },
      { tier: 'platinum', threshold: 500, reward: 800 }
    ]
  },
  {
    id: 'petals_earned',
    name: 'Récolte',
    description: 'Gagner des pétales au total',
    icon: '🌸',
    trigger: 'petals_earned',
    tiers: [
      { tier: 'bronze', threshold: 100, reward: 25 },
      { tier: 'silver', threshold: 500, reward: 80 },
      { tier: 'gold', threshold: 2000, reward: 200 },
      { tier: 'platinum', threshold: 5000, reward: 500 }
    ]
  },
  {
    id: 'bonus_questions',
    name: 'Extra effort',
    description: 'Compléter des questions bonus',
    icon: '✨',
    trigger: 'bonus_question',
    tiers: [
      { tier: 'bronze', threshold: 5, reward: 15 },
      { tier: 'silver', threshold: 20, reward: 60 },
      { tier: 'gold', threshold: 75, reward: 180 },
      { tier: 'platinum', threshold: 200, reward: 450 }
    ]
  },
  {
    id: 'both_active',
    name: 'Duo dynamique',
    description: 'Jours où vous êtes tous les deux actifs',
    icon: '💞',
    trigger: 'both_active',
    tiers: [
      { tier: 'bronze', threshold: 5, reward: 20 },
      { tier: 'silver', threshold: 15, reward: 60 },
      { tier: 'gold', threshold: 60, reward: 200 },
      { tier: 'platinum', threshold: 200, reward: 600 }
    ]
  },
  {
    id: 'daily_claims',
    name: 'Récupérateur',
    description: 'Réclamer les pétales journaliers',
    icon: '📅',
    trigger: 'daily_claim',
    tiers: [
      { tier: 'bronze', threshold: 5, reward: 25 },
      { tier: 'silver', threshold: 20, reward: 75 },
      { tier: 'gold', threshold: 60, reward: 220 },
      { tier: 'platinum', threshold: 180, reward: 600 }
    ]
  },
  {
    id: 'petals_spent',
    name: 'Dépensier',
    description: 'Dépenser des pétales dans le shop',
    icon: '🛍️',
    trigger: 'petals_spent',
    tiers: [
      { tier: 'bronze', threshold: 50, reward: 30 },
      { tier: 'silver', threshold: 200, reward: 100 },
      { tier: 'gold', threshold: 1000, reward: 280 },
      { tier: 'platinum', threshold: 3000, reward: 700 }
    ]
  },
  {
    id: 'items_owned',
    name: 'Collectionneur',
    description: 'Posséder des cosmétiques',
    icon: '💎',
    trigger: 'items_owned',
    tiers: [
      { tier: 'bronze', threshold: 3, reward: 35 },
      { tier: 'silver', threshold: 10, reward: 100 },
      { tier: 'gold', threshold: 25, reward: 260 },
      { tier: 'platinum', threshold: 50, reward: 650 }
    ]
  },
  {
    id: 'couple_duration',
    name: 'Amour durable',
    description: 'Jours passés en couple sur NousDeux',
    icon: '⏳',
    trigger: 'couple_duration',
    tiers: [
      { tier: 'bronze', threshold: 10, reward: 50 },
      { tier: 'silver', threshold: 50, reward: 200 },
      { tier: 'gold', threshold: 180, reward: 800 },
      { tier: 'platinum', threshold: 365, reward: 2000 }
    ]
  }
];
