/**
 * avatarParts.ts — Données pixel art pour le système d'avatars NousDeux
 * Grille 16×24 pixels, affichée à 3x (48×72px) ou 4x (64×96px)
 * Format: chaque pixel = [x, y] dans la grille
 * 'skin' = couleur de peau choisie, 'hair' = couleur cheveux choisie
 */

export type PixelColor = string | 'skin' | 'hair' | 'outline';

export type PixelLayer = {
  color: PixelColor;
  pixels: [number, number][];
};

export type AvatarPartData = {
  id: string;
  name: string;
  category: AvatarCategory;
  price?: number;        // undefined = free
  unlockStreak?: number; // unlock par streak
  layers: PixelLayer[];
};

export type AvatarCategory =
  | 'body'
  | 'skin'
  | 'hair'
  | 'hairColor'
  | 'eyes'
  | 'mouth'
  | 'accessory'
  | 'hat'
  | 'outfit';

export type AvatarConfig = {
  body: string;
  skin: string;
  hair: string;
  hairColor: string;
  eyes: string;
  mouth: string;
  accessory: string;
  hat: string;
  outfit: string;
};

export const DEFAULT_AVATAR: AvatarConfig = {
  body: 'body_m',
  skin: 'skin_light',
  hair: 'hair_short',
  hairColor: '#3D2B1F',
  eyes: 'eyes_normal',
  mouth: 'mouth_smile',
  accessory: 'acc_none',
  hat: 'hat_none',
  outfit: 'outfit_casual',
};

// ─── Couleurs de peau ─────────────────────────────────────────────────────────

export const SKIN_TONES: { id: string; name: string; color: string }[] = [
  { id: 'skin_light',      name: 'Porcelaine',   color: '#FFE4C4' },
  { id: 'skin_fair',       name: 'Ivoire',        color: '#F5C99B' },
  { id: 'skin_medium',     name: 'Ambre',         color: '#E8A87C' },
  { id: 'skin_tan',        name: 'Miel',          color: '#C68642' },
  { id: 'skin_brown',      name: 'Cannelle',      color: '#8D5524' },
  { id: 'skin_dark',       name: 'Ébène',         color: '#4A2912' },
  { id: 'skin_golden',     name: 'Doré',          color: '#D4A76A' },
  { id: 'skin_olive',      name: 'Olive',         color: '#B5804D' },
];

// ─── Couleurs de cheveux ──────────────────────────────────────────────────────

export const HAIR_COLORS: { id: string; name: string; color: string }[] = [
  { id: 'hc_black',        name: 'Noir',          color: '#1A0A00' },
  { id: 'hc_darkbrown',    name: 'Brun foncé',    color: '#3D2B1F' },
  { id: 'hc_brown',        name: 'Châtain',       color: '#6B3A2A' },
  { id: 'hc_auburn',       name: 'Auburn',        color: '#922724' },
  { id: 'hc_red',          name: 'Roux vif',      color: '#C0392B' },
  { id: 'hc_blonde',       name: 'Blond',         color: '#F0C040' },
  { id: 'hc_platinum',     name: 'Platine',       color: '#F5F0E8' },
  { id: 'hc_grey',         name: 'Gris',          color: '#9B9B9B' },
  { id: 'hc_pink',         name: 'Rose candy',    color: '#FF6B9D' },
  { id: 'hc_blue',         name: 'Bleu océan',    color: '#4A90D9' },
  { id: 'hc_purple',       name: 'Violet fée',    color: '#9B59B6' },
  { id: 'hc_green',        name: 'Vert forêt',    color: '#27AE60' },
  { id: 'hc_rainbow',      name: 'Arc-en-ciel 1', color: 'rainbow1' },
  { id: 'hc_pastel',       name: 'Pastel dégradé',color: 'rainbow2' },
];

// ─── Corps (silhouettes) ─────────────────────────────────────────────────────

export const BODIES: AvatarPartData[] = [
  {
    id: 'body_m',
    name: 'Standard',
    category: 'body',
    layers: [
      {
        color: 'skin',
        // Tête (6×6), cou (2×2), épaules (10×3)
        pixels: [
          [5,1],[6,1],[7,1],[8,1],[9,1],[10,1],
          [4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],
          [4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],
          [4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],
          [4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],
          [5,6],[6,6],[7,6],[8,6],[9,6],[10,6],
          [7,7],[8,7], // cou
          [7,8],[8,8],
        ],
      },
      {
        color: 'outline',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [3,2],[12,2],[3,3],[12,3],[3,4],[12,4],[3,5],[12,5],
          [4,6],[11,6],[5,7],[10,7],[6,8],[9,8],
        ],
      },
    ],
  },
  {
    id: 'body_s',
    name: 'Petit(e)',
    category: 'body',
    layers: [
      {
        color: 'skin',
        pixels: [
          [6,2],[7,2],[8,2],[9,2],
          [5,3],[6,3],[7,3],[8,3],[9,3],[10,3],
          [5,4],[6,4],[7,4],[8,4],[9,4],[10,4],
          [5,5],[6,5],[7,5],[8,5],[9,5],[10,5],
          [6,6],[7,6],[8,6],[9,6],
          [7,7],[8,7],
        ],
      },
      {
        color: 'outline',
        pixels: [
          [6,1],[7,1],[8,1],[9,1],
          [4,3],[11,3],[4,4],[11,4],[4,5],[11,5],
          [5,6],[10,6],[6,7],[9,7],[7,8],[8,8],
        ],
      },
    ],
  },
  {
    id: 'body_l',
    name: 'Grand(e)',
    category: 'body',
    layers: [
      {
        color: 'skin',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          [3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],[12,2],
          [3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],
          [3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[12,4],
          [3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],
          [4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],
          [7,7],[8,7],[7,8],[8,8],
        ],
      },
      {
        color: 'outline',
        pixels: [
          [4,0],[11,0],[3,1],[12,1],
          [2,2],[13,2],[2,3],[13,3],[2,4],[13,4],[2,5],[13,5],
          [3,6],[12,6],[4,7],[11,7],[5,8],[10,8],
        ],
      },
    ],
  },
];

// ─── Coiffures ────────────────────────────────────────────────────────────────

export const HAIRS: AvatarPartData[] = [
  {
    id: 'hair_short',
    name: 'Court & Net',
    category: 'hair',
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          [4,2],[11,2],
        ],
      },
    ],
  },
  {
    id: 'hair_long',
    name: 'Long & Fluide',
    category: 'hair',
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          [3,2],[4,2],[11,2],[12,2],
          [3,3],[4,3],[11,3],[12,3],
          [3,4],[4,4],[11,4],[12,4],
          [3,5],[4,5],[11,5],[12,5],
          [4,6],[11,6],[12,6],
          [4,7],[12,7],
        ],
      },
    ],
  },
  {
    id: 'hair_curly',
    name: 'Bouclé & Volumineux',
    category: 'hair',
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          [3,2],[4,2],[11,2],[12,2],
          [3,3],[5,3],[7,3],[9,3],[11,3],[12,3],
          [4,4],[6,4],[8,4],[10,4],
          // Boucles latérales
          [2,3],[2,4],[3,4],[2,5],[13,3],[13,4],[12,4],[13,5],
        ],
      },
    ],
  },
  {
    id: 'hair_bun',
    name: 'Chignon Élégant',
    category: 'hair',
    layers: [
      {
        color: 'hair',
        pixels: [
          // Chignon en haut
          [6,0],[7,0],[8,0],[9,0],
          [5,1],[6,1],[7,1],[8,1],[9,1],[10,1],
          [5,2],[10,2],
          // Côtés courts
          [4,2],[11,2],
          [4,3],[11,3],
        ],
      },
      {
        color: '#8B6554', // highlight du chignon
        pixels: [[7,0],[8,0],[7,1],[8,1]],
      },
    ],
  },
  {
    id: 'hair_pigtails',
    name: 'Couettes',
    category: 'hair',
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          // Couette gauche
          [2,2],[3,2],[3,3],[2,3],[2,4],[3,4],[2,5],[3,5],
          // Couette droite
          [12,2],[13,2],[12,3],[13,3],[12,4],[13,4],[12,5],[13,5],
        ],
      },
    ],
  },
  {
    id: 'hair_shaved',
    name: 'Rasé·e',
    category: 'hair',
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[11,1],
        ],
      },
    ],
  },
  {
    id: 'hair_braids',
    name: 'Tresses',
    category: 'hair',
    price: 120,
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          // Tresse gauche zigzag
          [3,2],[4,2],[3,3],[4,3],[4,4],[3,4],[4,5],[3,5],[4,6],[3,6],
          // Tresse droite zigzag
          [11,2],[12,2],[12,3],[11,3],[11,4],[12,4],[12,5],[11,5],[11,6],[12,6],
        ],
      },
    ],
  },
  {
    id: 'hair_mohawk',
    name: 'Iroquoise',
    category: 'hair',
    price: 150,
    layers: [
      {
        color: 'hair',
        pixels: [
          // Crête centrale
          [7,0],[8,0],[7,-1],[8,-1],[7,-2],[8,-2],
          [4,1],[5,1],[11,1],[10,1],
          [4,2],[11,2],
        ],
      },
    ],
  },
  {
    id: 'hair_ponytail',
    name: 'Queue-de-cheval',
    category: 'hair',
    price: 80,
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          [4,2],[11,2],[4,3],[11,3],
          // Queue à droite
          [12,2],[13,2],[14,3],[13,3],[14,4],[13,4],[13,5],[12,5],
        ],
      },
    ],
  },
  {
    id: 'hair_afro',
    name: 'Afro',
    category: 'hair',
    price: 100,
    layers: [
      {
        color: 'hair',
        pixels: [
          [6,0],[7,0],[8,0],[9,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          [3,2],[4,2],[5,2],[10,2],[11,2],[12,2],
          [3,3],[4,3],[11,3],[12,3],
          [3,4],[4,4],[11,4],[12,4],
          // Volume extra côtés
          [2,2],[2,3],[13,2],[13,3],
        ],
      },
    ],
  },
  {
    id: 'hair_twin_buns',
    name: 'Twin Buns',
    category: 'hair',
    price: 140,
    unlockStreak: 14,
    layers: [
      {
        color: 'hair',
        pixels: [
          // Chignon gauche
          [4,0],[5,0],[6,0],[4,1],[5,1],[6,1],
          // Chignon droit
          [9,0],[10,0],[11,0],[9,1],[10,1],[11,1],
          // Côtés
          [3,2],[4,2],[11,2],[12,2],
          [3,3],[12,3],
        ],
      },
    ],
  },
  {
    id: 'hair_wolf_cut',
    name: 'Wolf Cut',
    category: 'hair',
    price: 200,
    layers: [
      {
        color: 'hair',
        pixels: [
          [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],
          [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
          [3,2],[4,2],[5,2],[10,2],[11,2],[12,2],
          // Mèches longues devant
          [3,3],[4,3],[5,3],[11,3],[12,3],
          [3,4],[4,4],[12,4],[13,4],
          [3,5],[13,5],
        ],
      },
    ],
  },
];

// ─── Yeux ─────────────────────────────────────────────────────────────────────

export const EYES: AvatarPartData[] = [
  {
    id: 'eyes_normal',
    name: 'Normal',
    category: 'eyes',
    layers: [
      { color: '#1A0A00', pixels: [[5,3],[6,3],[9,3],[10,3]] },
      { color: '#FFFFFF', pixels: [[5,3],[9,3]] },
    ],
  },
  {
    id: 'eyes_happy',
    name: 'Joyeux',
    category: 'eyes',
    layers: [
      { color: '#1A0A00', pixels: [[5,3],[6,3],[7,3],[9,3],[10,3],[11,3]] },
      // Yeux en arc fermé
      { color: '#1A0A00', pixels: [[5,4],[6,4],[9,4],[10,4]] },
    ],
  },
  {
    id: 'eyes_sleepy',
    name: 'Fatigué·e',
    category: 'eyes',
    layers: [
      { color: '#1A0A00', pixels: [[5,3],[6,3],[9,3],[10,3]] },
      { color: '#4A3B39', pixels: [[5,3],[6,3],[9,3],[10,3]] }, // demi-fermé
      { color: '#1A0A00', pixels: [[5,4],[6,4],[9,4],[10,4]] },
    ],
  },
  {
    id: 'eyes_star',
    name: 'Étoilé·e',
    category: 'eyes',
    price: 80,
    layers: [
      { color: '#FFD700', pixels: [[5,3],[7,3],[9,3],[11,3]] },
      { color: '#FF9A8B', pixels: [[6,3],[10,3],[5,4],[7,4],[9,4],[11,4]] },
    ],
  },
  {
    id: 'eyes_heart',
    name: 'Cœurs',
    category: 'eyes',
    price: 120,
    unlockStreak: 7,
    layers: [
      { color: '#FF6A88', pixels: [[5,3],[6,3],[5,4],[6,4],[7,4]] },
      { color: '#FF6A88', pixels: [[9,3],[10,3],[9,4],[10,4],[11,4]] },
    ],
  },
  {
    id: 'eyes_glasses',
    name: 'Lunettes',
    category: 'eyes',
    price: 90,
    layers: [
      { color: '#4A3B39', pixels: [[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3]] },
      { color: '#1A0A00', pixels: [[5,3],[6,3],[9,3],[10,3]] },
      { color: '#AAAAAA', pixels: [[4,3],[7,3],[8,3],[11,3]] },
    ],
  },
  {
    id: 'eyes_wink',
    name: 'Clin d\'œil',
    category: 'eyes',
    price: 60,
    layers: [
      { color: '#1A0A00', pixels: [[5,3],[6,3],[9,3],[10,3],[11,3]] },
      { color: '#1A0A00', pixels: [[5,4],[10,4]] }, // œil gauche fermé
    ],
  },
  {
    id: 'eyes_pixel',
    name: 'Pixel Classic',
    category: 'eyes',
    price: 150,
    layers: [
      { color: '#00FF00', pixels: [[5,2],[6,2],[5,3],[6,3]] },
      { color: '#00FF00', pixels: [[9,2],[10,2],[9,3],[10,3]] },
      { color: '#003300', pixels: [[5,3],[9,3]] },
    ],
  },
];

// ─── Bouches ──────────────────────────────────────────────────────────────────

export const MOUTHS: AvatarPartData[] = [
  {
    id: 'mouth_smile',
    name: 'Sourire',
    category: 'mouth',
    layers: [
      { color: '#FF6A88', pixels: [[6,5],[7,5],[8,5],[9,5]] },
      { color: '#FF9A8B', pixels: [[6,6],[9,6]] },
    ],
  },
  {
    id: 'mouth_grin',
    name: 'Grand Sourire',
    category: 'mouth',
    layers: [
      { color: '#FF6A88', pixels: [[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]] },
      { color: '#FFFFFF', pixels: [[6,5],[7,5],[8,5],[9,5]] },
      { color: '#FF9A8B', pixels: [[5,6],[10,6]] },
    ],
  },
  {
    id: 'mouth_neutral',
    name: 'Neutre',
    category: 'mouth',
    layers: [
      { color: '#B07070', pixels: [[6,5],[7,5],[8,5],[9,5]] },
    ],
  },
  {
    id: 'mouth_surprised',
    name: 'Surpris·e',
    category: 'mouth',
    layers: [
      { color: '#FF6A88', pixels: [[7,5],[8,5],[7,6],[8,6]] },
      { color: '#CC4466', pixels: [[7,5],[8,5]] },
    ],
  },
  {
    id: 'mouth_kiss',
    name: 'Bisou',
    category: 'mouth',
    price: 70,
    unlockStreak: 7,
    layers: [
      { color: '#FF2D6E', pixels: [[7,5],[8,5]] },
      { color: '#FF6A88', pixels: [[6,5],[9,5],[7,6],[8,6]] },
    ],
  },
  {
    id: 'mouth_uwu',
    name: 'UwU',
    category: 'mouth',
    price: 100,
    layers: [
      { color: '#FF6A88', pixels: [[6,5],[7,5],[8,5],[9,5]] },
      { color: '#FF9A8B', pixels: [[6,6],[7,6],[8,6],[9,6]] },
      { color: '#FF2D6E', pixels: [[7,5],[8,5]] },
    ],
  },
];

// ─── Tenues ───────────────────────────────────────────────────────────────────

export const OUTFITS: AvatarPartData[] = [
  {
    id: 'outfit_astronaut',
    name: 'Astronaute',
    category: 'outfit',
    price: 350,
    unlockStreak: 10,
    layers: [
      { color: '#FFFFFF', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],
        [2,10],[3,10],[4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],[12,10],[13,10],
        [2,11],[3,11],[12,11],[13,11],
        [3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],
        [4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],
        [4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],
        [4,15],[5,15],[6,15],[9,15],[10,15],[11,15],
        [4,16],[5,16],[10,16],[11,16],
        [4,17],[5,17],[10,17],[11,17]
      ]},
      { color: '#D1D5DB', pixels: [
        [3,9],[4,9],[11,9],[12,9],[2,10],[3,10],[12,10],[13,10],
        [6,14],[9,14], [4,17],[5,17],[10,17],[11,17] // Ombre / Bottes
      ]},
      { color: '#3B82F6', pixels: [ // Détails bleus
        [7,11],[8,11],[5,13],[10,13]
      ]},
      { color: '#EF4444', pixels: [ // Détails rouges
        [7,12],[8,12]
      ]}
    ],
  },
  {
    id: 'outfit_dino',
    name: 'Grenouillère Dino',
    category: 'outfit',
    price: 250,
    layers: [
      { color: '#22C55E', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],
        [2,10],[3,10],[4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],[12,10],[13,10],
        [2,11],[3,11],[4,11],[11,11],[12,11],[13,11],
        [3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],
        [3,13],[4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],[12,13],
        [4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],
        [4,15],[5,15],[6,15],[9,15],[10,15],[11,15],
        [4,16],[5,16],[10,16],[11,16]
      ]},
      { color: '#166534', pixels: [ // Crêtes
        [7,9],[8,9],[7,11],[8,11],[7,13],[8,13]
      ]},
      { color: '#FCD34D', pixels: [ // Ventre
        [6,12],[7,12],[8,12],[9,12],
        [6,13],[7,13],[8,13],[9,13]
      ]}
    ],
  },
  {
    id: 'outfit_suit',
    name: 'Costume Classe',
    category: 'outfit',
    price: 300,
    layers: [
      { color: '#111827', pixels: [ // Veste et pantalon
        [3,9],[4,9],[5,9],[10,9],[11,9],[12,9],
        [2,10],[3,10],[4,10],[11,10],[12,10],[13,10],
        [2,11],[3,11],[12,11],[13,11],
        [3,12],[4,12],[11,12],[12,12],
        [4,13],[5,13],[10,13],[11,13],
        [4,14],[5,14],[10,14],[11,14],
        [4,15],[5,15],[10,15],[11,15],
        [4,16],[5,16],[10,16],[11,16],
        [4,17],[5,17],[10,17],[11,17]
      ]},
      { color: '#FFFFFF', pixels: [ // Chemise
        [6,9],[7,9],[8,9],[9,9],
        [5,10],[6,10],[7,10],[8,10],[9,10],[10,10],
        [5,11],[6,11],[7,11],[8,11],[9,11],[10,11],
        [5,12],[6,12],[9,12],[10,12],
        [6,13],[9,13],
        [6,14],[7,14],[8,14],[9,14]
      ]},
      { color: '#EF4444', pixels: [ // Cravate rouge
        [7,10],[8,10],
        [7,11],[8,11],
        [7,12],[8,12],
        [7,13],[8,13]
      ]}
    ],
  },

  {
    id: 'outfit_casual',
    name: 'Casual',
    category: 'outfit',
    layers: [
      { color: '#5B8DD9', pixels: [ // Pull bleu
        [2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [1,10],[2,10],[3,10],[13,10],[14,10],
        [1,11],[2,11],[13,11],[14,11],
        [2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],
        [3,13],[4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],[12,13],
        // Pantalon
        [3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],
        [3,15],[4,15],[5,15],[7,15],[8,15],[9,15],[10,15],[11,15],[12,15],
        [3,16],[4,16],[5,16],[10,16],[11,16],[12,16],
        [3,17],[4,17],[11,17],[12,17],
      ]},
      { color: '#3A6DB5', pixels: [ // Ombre pull
        [2,9],[3,9],[1,10],[2,10],
      ]},
      { color: '#2C3E50', pixels: [ // Pantalon foncé
        [3,15],[4,15],[9,15],[10,15],
        [3,16],[4,16],[10,16],[11,16],
      ]},
    ],
  },
  {
    id: 'outfit_dress',
    name: 'Robe Élégante',
    category: 'outfit',
    price: 150,
    layers: [
      { color: '#FF9A8B', pixels: [ // Corps robe
        [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],
        [3,10],[4,10],[5,10],[10,10],[11,10],[12,10],[13,10],
        [3,11],[4,11],[11,11],[12,11],[13,11],
        // Jupe évasée
        [2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],
        [1,13],[2,13],[3,13],[4,13],[13,13],[14,13],[15,13],
        [1,14],[2,14],[14,14],[15,14],
        [2,15],[3,15],[13,15],[14,15],
        [3,16],[4,16],[5,16],[6,16],[7,16],[8,16],[9,16],[10,16],[11,16],[12,16],[13,16],
      ]},
      { color: '#FF6A88', pixels: [ // Col et ceinture
        [6,9],[7,9],[8,9],
        [4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],
      ]},
    ],
  },
  {
    id: 'outfit_hoodie',
    name: 'Hoodie',
    category: 'outfit',
    price: 100,
    layers: [
      { color: '#6C5CE7', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [2,10],[3,10],[4,10],[12,10],[13,10],[14,10],
        [2,11],[3,11],[13,11],[14,11],
        [2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],
        [3,13],[4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],[12,13],[13,13],
        [3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],
        [3,15],[4,15],[5,15],[9,15],[10,15],[11,15],[12,15],
        [3,16],[4,16],[11,16],[12,16],
        [3,17],[4,17],[11,17],[12,17],
      ]},
      { color: '#5A4BD1', pixels: [ // Cordon
        [7,9],[8,9],[7,10],[8,10],
      ]},
      { color: '#A0E040', pixels: [ // Poche kangourou
        [6,12],[7,12],[8,12],[9,12],[6,13],[7,13],[8,13],[9,13],
      ]},
    ],
  },
  {
    id: 'outfit_tshirt',
    name: 'T-shirt Simple',
    category: 'outfit',
    layers: [
      { color: '#FFFFFF', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [2,10],[3,10],[13,10],[14,10],
        [2,11],[3,11],[13,11],[14,11],
        [2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],
        [3,13],[4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],[12,13],[13,13],
        // Jeans
        [3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],
        [3,15],[4,15],[5,15],[7,15],[8,15],[9,15],[11,15],[12,15],
        [3,16],[4,16],[11,16],[12,16],
        [3,17],[4,17],[11,17],[12,17],
      ]},
      { color: '#1A6EA8', pixels: [
        [3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],
        [3,15],[4,15],[5,15],[9,15],[10,15],[11,15],[12,15],[13,15],
        [3,16],[4,16],[5,16],[11,16],[12,16],[13,16],
        [3,17],[4,17],[12,17],[13,17],
      ]},
    ],
  },
  {
    id: 'outfit_suit',
    name: 'Costume',
    category: 'outfit',
    price: 250,
    unlockStreak: 30,
    layers: [
      { color: '#2C3E50', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [2,10],[3,10],[4,10],[12,10],[13,10],[14,10],
        [2,11],[3,11],[4,11],[12,11],[13,11],[14,11],
        [2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],
        [3,13],[4,13],[5,13],[10,13],[11,13],[12,13],[13,13],
        [3,14],[4,14],[5,14],[10,14],[11,14],[12,14],[13,14],
        [3,15],[4,15],[5,15],[6,15],[7,15],[8,15],[9,15],[10,15],[11,15],[12,15],[13,15],
        [3,16],[4,16],[11,16],[12,16],
        [3,17],[4,17],[11,17],[12,17],
      ]},
      { color: '#FFFFFF', pixels: [ // Chemise
        [6,9],[7,9],[8,9],[9,9],
        [6,10],[7,10],[8,10],[9,10],
        [6,11],[7,11],[8,11],[9,11],
        [6,12],[7,12],[8,12],[9,12],
      ]},
      { color: '#E74C3C', pixels: [ // Cravate
        [7,10],[8,10],[7,11],[8,11],[7,12],[8,12],[7,13],[8,13],
      ]},
    ],
  },
  {
    id: 'outfit_wizard',
    name: 'Sorcier·ère',
    category: 'outfit',
    price: 350,
    layers: [
      { color: '#4A235A', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [2,10],[3,10],[13,10],[14,10],
        [2,11],[3,11],[13,11],[14,11],
        [1,12],[2,12],[3,12],[13,12],[14,12],[15,12],
        [1,13],[2,13],[3,13],[13,13],[14,13],[15,13],
        [1,14],[2,14],[3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],[14,14],[15,14],
        [1,15],[2,15],[14,15],[15,15],
        [1,16],[2,16],[14,16],[15,16],
        [2,17],[3,17],[13,17],[14,17],
      ]},
      { color: '#9B59B6', pixels: [ // Détails magiques
        [5,10],[6,10],[10,10],[11,10],
        [7,12],[8,12],[7,13],[8,13],
      ]},
      { color: '#F1C40F', pixels: [ // Étoiles magiques
        [4,11],[12,11],[5,12],[11,12],
      ]},
    ],
  },
  {
    id: 'outfit_knight',
    name: 'Chevalier·ère',
    category: 'outfit',
    price: 400,
    unlockStreak: 60,
    layers: [
      { color: '#95A5A6', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [2,10],[3,10],[4,10],[12,10],[13,10],[14,10],
        [2,11],[3,11],[4,11],[12,11],[13,11],[14,11],
        [2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],
        [2,13],[3,13],[4,13],[12,13],[13,13],[14,13],
        [2,14],[3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],[14,14],
        [3,15],[4,15],[5,15],[6,15],[7,15],[8,15],[9,15],[10,15],[11,15],[12,15],[13,15],
        [3,16],[4,16],[11,16],[12,16],
        [3,17],[4,17],[11,17],[12,17],
      ]},
      { color: '#7F8C8D', pixels: [
        [3,9],[4,9],[12,9],[13,9],
        [2,10],[14,10],[2,12],[14,12],
      ]},
      { color: '#F1C40F', pixels: [ // Croix d'or
        [7,11],[8,11],[9,11],[7,12],[8,12],[9,12],[7,13],[8,13],[9,13],
      ]},
    ],
  },
  {
    id: 'outfit_astronaut',
    name: 'Astronaute',
    category: 'outfit',
    price: 500,
    layers: [
      { color: '#FFFFFF', pixels: [
        [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [2,10],[3,10],[4,10],[12,10],[13,10],[14,10],
        [2,11],[3,11],[4,11],[12,11],[13,11],[14,11],
        [2,12],[3,12],[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],
        [2,13],[3,13],[4,13],[12,13],[13,13],[14,13],
        [2,14],[3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],[14,14],
        [3,15],[4,15],[5,15],[6,15],[7,15],[8,15],[9,15],[10,15],[11,15],[12,15],[13,15],
        [3,16],[4,16],[5,16],[10,16],[11,16],[12,16],
        [3,17],[4,17],[11,17],[12,17],
      ]},
      { color: '#85C1E9', pixels: [ // Visière
        [5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
        [5,11],[11,11],
      ]},
      { color: '#FF9A8B', pixels: [ // Badge NASA style
        [6,13],[7,13],[8,13],[9,13],[6,14],[7,14],[8,14],[9,14],
      ]},
      { color: '#F39C12', pixels: [ // Détails combinaison
        [3,12],[14,12],[3,13],[14,13],
      ]},
    ],
  },
  {
    id: 'outfit_xmas',
    name: 'Pull de Noël',
    category: 'outfit',
    price: 180,
    layers: [
      { color: '#E74C3C', pixels: [ // Rouge principal
        [5,8],[6,8],[7,8],[8,8],[9,8],[10,8],
        [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],
        [4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
        [4,11],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11],
      ]},
      { color: '#FFFFFF', pixels: [ // Motif flocon / renne blanc
        [7,9],[8,9],
        [6,10],[7,10],[8,10],[9,10],
        [7,11],[8,11],
        [4,8],[11,8], // Manches blanches
      ]},
    ],
  },
  {
    id: 'outfit_dress',
    name: "Robe d'été",
    category: 'outfit',
    price: 150,
    layers: [
      { color: '#F1C40F', pixels: [ // Robe jaune
        [5,8],[6,8],[7,8],[8,8],[9,8],[10,8],
        [5,9],[6,9],[7,9],[8,9],[9,9],[10,9],
        [5,10],[6,10],[7,10],[8,10],[9,10],[10,10],
        [4,11],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11],
        [4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12], // Jupe bas
        [3,13],[4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],[12,13],
      ]},
      { color: '#E74C3C', pixels: [ // Motifs floraux rouges
        [6,9],[9,10],[5,12],[10,12],[7,13],
      ]},
    ],
  },
  {
    id: 'outfit_tshirt',
    name: 'T-shirt Simple',
    category: 'outfit',
    price: 40,
    layers: [
      { color: '#ECF0F1', pixels: [ // T-shirt blanc
        [5,8],[6,8],[7,8],[8,8],[9,8],[10,8],
        [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],
        [4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
      ]},
      { color: '#3498DB', pixels: [ // Pantalon bleu (jean)
        [5,11],[6,11],[7,11],[8,11],[9,11],[10,11],
        [5,12],[6,12],[7,12],[8,12],[9,12],[10,12],
      ]},
    ],
  },
];

// ─── Chapeaux & Accessoires tête ─────────────────────────────────────────────

export const HATS: AvatarPartData[] = [
  {
    id: 'hat_none',
    name: 'Aucun',
    category: 'hat',
    layers: [],
  },
  {
    id: 'hat_cap',
    name: 'Casquette',
    category: 'hat',
    price: 80,
    layers: [
      { color: '#E74C3C', pixels: [
        [4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],
        [3,1],[4,1],[11,1],[12,1],
        // Visière
        [3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],[12,2],[13,2],
      ]},
      { color: '#C0392B', pixels: [
        [4,1],[11,1],
      ]},
    ],
  },
  {
    id: 'hat_crown',
    name: 'Couronne',
    category: 'hat',
    price: 300,
    unlockStreak: 30,
    layers: [
      { color: '#F1C40F', pixels: [
        [4,0],[6,0],[8,0],[10,0],[12,0],
        [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1],
        [3,2],[4,2],[5,2],[10,2],[11,2],[12,2],[13,2],
      ]},
      { color: '#E67E22', pixels: [
        [5,1],[7,1],[9,1],[11,1],
      ]},
      { color: '#E74C3C', pixels: [ // Rubis
        [6,0],[10,0],
      ]},
      { color: '#3498DB', pixels: [ // Saphir
        [8,0],
      ]},
    ],
  },
  {
    id: 'hat_beanie',
    name: 'Bonnet',
    category: 'hat',
    price: 70,
    layers: [
      { color: '#E74C3C', pixels: [
        [6,0],[7,0],[8,0],[9,0],
        [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
        [4,2],[5,2],[10,2],[11,2],
        [3,2],[12,2],
      ]},
      { color: '#C0392B', pixels: [
        [5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
      ]},
      { color: '#FFFFFF', pixels: [ // Pompon
        [7,0],[8,0],[7,-1],[8,-1],
      ]},
    ],
  },
  {
    id: 'hat_witch',
    name: 'Chapeau Sorcière',
    category: 'hat',
    price: 200,
    layers: [
      { color: '#1A0A00', pixels: [
        [8,0],[8,-1],[7,-1],[9,-1],[7,-2],[8,-2],[9,-2],[6,-2],[10,-2],
        [5,-3],[6,-3],[7,-3],[8,-3],[9,-3],[10,-3],[11,-3],
        [3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1],[13,1],
      ]},
      { color: '#8E44AD', pixels: [ // Bande violette
        [4,1],[5,1],[10,1],[11,1],
      ]},
      { color: '#F1C40F', pixels: [ // Étoile
        [8,-1],
      ]},
    ],
  },
  {
    id: 'hat_frog',
    name: 'Bonnet Grenouille',
    category: 'hat',
    price: 150,
    layers: [
      { color: '#2ECC71', pixels: [ // Vert grenouille
        [6,0],[7,0],[8,0],[9,0],
        [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
        [4,2],[5,2],[10,2],[11,2],
        [3,2],[12,2],
        // Yeux grenouille qui dépassent
        [4,-1],[5,-1],[4,0],[5,0],
        [10,-1],[11,-1],[10,0],[11,0],
      ]},
      { color: '#FFFFFF', pixels: [ // Blanc des yeux
        [4,-1],[10,-1],
      ]},
      { color: '#000000', pixels: [ // Pupilles
        [5,-1],[11,-1],
      ]},
    ],
  },
  {
    id: 'hat_bunny',
    name: 'Oreilles de Lapin',
    category: 'hat',
    price: 120,
    unlockStreak: 14,
    layers: [
      { color: '#F8BBD9', pixels: [
        [5,-3],[5,-2],[5,-1],[5,0],
        [10,-3],[10,-2],[10,-1],[10,0],
        [6,-3],[6,-2],[7,-2],[9,-2],[9,-3],
      ]},
      { color: '#FF9A8B', pixels: [ // Intérieur oreille
        [5,-2],[5,-1],[10,-2],[10,-1],
      ]},
    ],
  },
  {
    id: 'hat_halo',
    name: 'Auréole',
    category: 'hat',
    price: 180,
    layers: [
      { color: '#F1C40F', pixels: [
        [5,-1],[6,-1],[7,-1],[8,-1],[9,-1],[10,-1],[11,-1],
        [4,-1],[12,-1],
      ]},
      { color: '#FFEB3B', pixels: [
        [6,-2],[7,-2],[8,-2],[9,-2],[10,-2],
      ]},
    ],
  },
  {
    id: 'hat_cat_ears',
    name: 'Oreilles de Chat',
    category: 'hat',
    price: 90,
    layers: [
      { color: '#1A0A00', pixels: [
        [4,0],[5,0],[4,1],[4,-1],[5,-1],
        [11,0],[10,0],[11,1],[11,-1],[10,-1],
      ]},
      { color: '#FF9A8B', pixels: [ // Intérieur rose
        [5,0],[10,0],
      ]},
    ],
  },
  {
    id: 'hat_party',
    name: 'Chapeau de Fête',
    category: 'hat',
    price: 60,
    layers: [
      { color: '#FF6A88', pixels: [
        [8,-3],[7,-2],[8,-2],[9,-2],[6,-1],[7,-1],[8,-1],[9,-1],[10,-1],
        [5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],
      ]},
      { color: '#FFD700', pixels: [
        [8,-3],[7,-1],[9,-1],
      ]},
      { color: '#9B59B6', pixels: [
        [8,-2],[6,0],[10,0],
      ]},
      { color: '#FFFFFF', pixels: [ // Pompon
        [8,-4],[7,-4],[9,-4],
      ]},
    ],
  },
  {
    id: 'hat_pixel_crown',
    name: 'Couronne Pixel',
    category: 'hat',
    price: 250,
    unlockStreak: 50,
    layers: [
      { color: '#00FF00', pixels: [
        [5,0],[6,0],[8,0],[10,0],[11,0],
        [4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1],
        [4,2],[12,2],
      ]},
      { color: '#00CC00', pixels: [
        [6,1],[8,1],[10,1],
      ]},
      { color: '#FFFF00', pixels: [
        [7,0],[9,0],
      ]},
    ],
  },
];

// ─── Accessoires (main) ───────────────────────────────────────────────────────

export const ACCESSORIES: AvatarPartData[] = [
  {
    id: 'acc_none',
    name: 'Aucun',
    category: 'accessory',
    layers: [],
  },
  {
    id: 'acc_rose',
    name: 'Rose 🌹',
    category: 'accessory',
    price: 60,
    layers: [
      { color: '#E74C3C', pixels: [[14,11],[15,11],[14,12],[15,12],[13,11]] },
      { color: '#27AE60', pixels: [[14,13],[14,14],[15,14],[13,14]] },
    ],
  },
  {
    id: 'acc_coffee',
    name: 'Café ☕',
    category: 'accessory',
    price: 50,
    layers: [
      { color: '#8B6554', pixels: [[13,11],[14,11],[15,11],[13,12],[15,12],[13,13],[14,13],[15,13]] },
      { color: '#5D4037', pixels: [[14,12]] },
      { color: '#FFFFFF', pixels: [[14,11]] },
      // Vapeur
      { color: '#CCCCCC', pixels: [[14,10],[15,10]] },
    ],
  },
  {
    id: 'acc_book',
    name: 'Livre 📚',
    category: 'accessory',
    price: 70,
    layers: [
      { color: '#E74C3C', pixels: [[12,11],[13,11],[14,11],[15,11],[12,12],[15,12],[12,13],[13,13],[14,13],[15,13]] },
      { color: '#FFFFFF', pixels: [[13,12],[14,12]] },
      { color: '#333333', pixels: [[13,11],[14,11]] },
    ],
  },
  {
    id: 'acc_controller',
    name: 'Manette 🎮',
    category: 'accessory',
    price: 80,
    layers: [
      { color: '#2C3E50', pixels: [
        [12,11],[13,11],[14,11],[15,11],[16,11],
        [12,12],[13,12],[16,12],
        [12,13],[13,13],[14,13],[15,13],[16,13],
      ]},
      { color: '#E74C3C', pixels: [[15,12]] },
      { color: '#3498DB', pixels: [[14,12]] },
    ],
  },
  {
    id: 'acc_camera',
    name: 'Appareil Photo 📷',
    category: 'accessory',
    price: 100,
    layers: [
      { color: '#1A0A00', pixels: [
        [12,11],[13,11],[14,11],[15,11],[16,11],
        [12,12],[16,12],
        [12,13],[13,13],[14,13],[15,13],[16,13],
      ]},
      { color: '#3498DB', pixels: [[14,12]] },
      { color: '#AAAAAA', pixels: [[15,11]] },
    ],
  },
  {
    id: 'acc_wand',
    name: 'Baguette Magique ✨',
    category: 'accessory',
    price: 150,
    unlockStreak: 21,
    layers: [
      { color: '#8B6554', pixels: [[14,13],[13,12],[12,11],[11,10]] },
      { color: '#FFD700', pixels: [[11,9],[12,9],[11,10]] },
      { color: '#FFFFFF', pixels: [[10,9],[12,8]] },
    ],
  },
  {
    id: 'acc_guitar',
    name: 'Guitare 🎸',
    category: 'accessory',
    price: 200,
    layers: [
      { color: '#E67E22', pixels: [
        [12,9],[13,9],[12,10],[13,10],[11,11],[12,11],[13,11],[14,11],
        [11,12],[14,12],[11,13],[12,13],[13,13],[14,13],
        [12,14],[13,14],
      ]},
      { color: '#5D4037', pixels: [[12,9],[13,9],[12,10],[13,10]] },
      { color: '#FFFFFF', pixels: [[12,11],[12,12]] },
    ],
  },
  {
    id: 'acc_icecream',
    name: 'Glace 🍦',
    category: 'accessory',
    price: 45,
    layers: [
      { color: '#F9A8D4', pixels: [[13,10],[14,10],[13,11],[14,11]] },
      { color: '#FDE68A', pixels: [[13,12],[14,12],[13,11]] },
      { color: '#D4A017', pixels: [[13,12],[13,13],[14,13]] },
    ],
  },
  {
    id: 'acc_umbrella',
    name: 'Parapluie ☂️',
    category: 'accessory',
    price: 90,
    layers: [
      { color: '#9B59B6', pixels: [
        [10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[16,9],
        [10,10],[16,10],
        [10,11],[11,11],
        [11,12],[11,13],
      ]},
      { color: '#8E44AD', pixels: [[10,9],[16,9],[10,10],[16,10]] },
    ],
  },
  {
    id: 'acc_glasses_harry',
    name: 'Lunettes Rondes',
    category: 'accessory',
    price: 120,
    layers: [
      { color: '#111111', pixels: [
        // Cercle gauche
        [4,3],[5,3],[6,3], [4,4],[6,4], [4,5],[5,5],[6,5],
        // Cercle droit
        [9,3],[10,3],[11,3], [9,4],[11,4], [9,5],[10,5],[11,5],
        // Pont
        [7,4],[8,4],
      ]},
    ],
  },
  {
    id: 'acc_sunglasses',
    name: 'Lunettes de Soleil',
    category: 'accessory',
    price: 150,
    layers: [
      { color: '#111111', pixels: [
        [4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],
        [4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],
      ]},
      { color: '#34495E', pixels: [ // Reflet
        [5,4],[10,4],[4,5],[9,5],
      ]},
    ],
  },
];

// ─── Index global des pièces ──────────────────────────────────────────────────

export const ALL_AVATAR_PARTS: AvatarPartData[] = [
  ...BODIES,
  ...HAIRS,
  ...EYES,
  ...MOUTHS,
  ...OUTFITS,
  ...HATS,
  ...ACCESSORIES,
];

export function getAvatarPartById(id: string): AvatarPartData | undefined {
  return ALL_AVATAR_PARTS.find(p => p.id === id);
}

export function getPartsByCategory(category: AvatarCategory): AvatarPartData[] {
  return ALL_AVATAR_PARTS.filter(p => p.category === category);
}

export function getSkinColor(skinId: string): string {
  return SKIN_TONES.find(s => s.id === skinId)?.color ?? '#FFE4C4';
}

export function getHairColorValue(hairColorId: string): string {
  return HAIR_COLORS.find(h => h.id === hairColorId)?.color ?? '#3D2B1F';
}
