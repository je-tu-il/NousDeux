/**
 * Base de données des questions Bloomy
 *
 * Comment ajouter une question :
 *   1. Copie une ligne existante
 *   2. Incrémente l'id (q001, q002, q003...)
 *   3. Rédige le texte dans `text`
 *   4. Choisis une catégorie dans `category`
 *   5. C'est tout !
 *
 * Comment retirer une question :
 *   - Supprime simplement sa ligne
 *   - (Conseil : garde-la commentée plutôt que de la supprimer définitivement)
 *
 * Catégories disponibles :
 *   souvenir   — moments passés ensemble
 *   reve       — projets et envies futures
 *   profond    — connaissance de soi et de l'autre
 *   fun        — légères et amusantes
 *   amour      — sentiments et émotions
 *   quotidien  — habitudes et préférences du quotidien
 *   defi       — petits défis à faire ensemble
 */

export type QuestionCategory =
  | 'souvenir'
  | 'reve'
  | 'profond'
  | 'fun'
  | 'amour'
  | 'quotidien'
  | 'defi';

export interface Question {
  id: string;
  text: string;
  category: QuestionCategory;
}

export const QUESTIONS: Question[] = [
  // ────────── SOUVENIR ──────────
  { id: "q001", text: "Quel est le souvenir le plus doux que tu gardes de notre première rencontre ?", category: "souvenir" },
  { id: "q002", text: "Quel moment ensemble t'a fait réaliser que tu tenais vraiment à l'autre ?", category: "souvenir" },
  { id: "q003", text: "C'était quoi notre meilleure sortie ensemble jusqu'ici ?", category: "souvenir" },
  { id: "q004", text: "Tu te souviens de quoi que tu portais le jour où on s'est rencontré(e)s ?", category: "souvenir" },
  { id: "q005", text: "Quel voyage ou escapade ensemble t'a marqué(e) le plus ?", category: "souvenir" },
  { id: "q006", text: "Quelle photo de nous deux tu garderais si tu ne devais en garder qu'une ?", category: "souvenir" },
  { id: "q007", text: "C'est quoi le moment le plus drôle qu'on ait vécu ensemble ?", category: "souvenir" },
  { id: "q008", text: "Quelle chanson te rappelle une scène précise vécue avec moi ?", category: "souvenir" },

  // ────────── REVE ──────────
  { id: "q009", text: "Si on pouvait voyager n'importe où ensemble, où est-ce qu'on irait en premier ?", category: "reve" },
  { id: "q010", text: "Comment tu imagines notre maison idéale dans 10 ans ?", category: "reve" },
  { id: "q011", text: "C'est quoi le projet commun qui te tient le plus à cœur pour notre avenir ?", category: "reve" },
  { id: "q012", text: "Si on avait 6 mois sabbatiques et l'argent pour en profiter, qu'est-ce qu'on ferait ?", category: "reve" },
  { id: "q013", text: "Comment tu imagines notre retraite ensemble ?", category: "reve" },
  { id: "q014", text: "Il y a un endroit dans le monde où tu veux absolument m'emmener un jour. C'est où ?", category: "reve" },
  { id: "q015", text: "Si on créait quelque chose ensemble (une boîte, un projet, une œuvre...), ce serait quoi ?", category: "reve" },

  // ────────── PROFOND ──────────
  { id: "q016", text: "Qu'est-ce que tu as appris sur toi-même depuis qu'on est ensemble ?", category: "profond" },
  { id: "q017", text: "C'est quoi ta plus grande peur dans notre relation ?", category: "profond" },
  { id: "q018", text: "Qu'est-ce que je fais qui te rend vraiment heureux/heureuse, même si c'est un petit truc ?", category: "profond" },
  { id: "q019", text: "Si tu devais me décrire en 3 mots à quelqu'un qui ne me connaît pas, tu dirais quoi ?", category: "profond" },
  { id: "q020", text: "C'est quoi la chose la plus courageuse que tu aies faite pour notre relation ?", category: "profond" },
  { id: "q021", text: "Qu'est-ce que tu n'as jamais osé me dire mais que tu penses vraiment ?", category: "profond" },
  { id: "q022", text: "Quel est le moment où tu as eu le plus besoin de moi et comment je me suis comporté(e) ?", category: "profond" },
  { id: "q023", text: "Selon toi, quelle est la chose sur laquelle on devrait travailler ensemble ?", category: "profond" },
  { id: "q024", text: "C'est quoi pour toi la définition d'un couple épanoui ?", category: "profond" },

  // ────────── FUN ──────────
  { id: "q025", text: "Si on était un duo de super-héros, on aurait quels pouvoirs ?", category: "fun" },
  { id: "q026", text: "On est dans une émission de télé-réalité ensemble. C'est laquelle et comment on se comporte ?", category: "fun" },
  { id: "q027", text: "Si notre histoire d'amour était un film, quel genre ça serait et qui jouerait nos rôles ?", category: "fun" },
  { id: "q028", text: "C'est quoi le truc le plus random qu'on pourrait faire ce weekend ?", category: "fun" },
  { id: "q029", text: "Si on faisait un top 3 des arguments les plus absurdes qu'on a eus, c'est quoi ?", category: "fun" },
  { id: "q030", text: "On a une machine à remonter le temps. On va voir quelle époque en premier ?", category: "fun" },
  { id: "q031", text: "C'est quoi notre running joke / blague interne qu'on est les seuls à comprendre ?", category: "fun" },

  // ────────── AMOUR ──────────
  { id: "q032", text: "Qu'est-ce que j'ai fait récemment qui t'a fait sentir vraiment aimé(e) ?", category: "amour" },
  { id: "q033", text: "C'est quoi ton langage de l'amour préféré (mots, actes, cadeaux, temps de qualité, toucher) ?", category: "amour" },
  { id: "q034", text: "Quel est le plus beau message ou mot que tu m'aies jamais dit ?", category: "amour" },
  { id: "q035", text: "Si tu devais écrire une chanson d'amour pour moi, le titre serait quoi ?", category: "amour" },
  { id: "q036", text: "Comment tu sais, au quotidien, que tu m'aimes encore ?", category: "amour" },
  { id: "q037", text: "C'est quoi ta façon préférée de passer du temps avec moi ?", category: "amour" },
  { id: "q038", text: "Qu'est-ce qui te manquerait le plus si je n'étais plus là ?", category: "amour" },

  // ────────── QUOTIDIEN ──────────
  { id: "q039", text: "C'est quoi ta routine du matin idéale avec moi ?", category: "quotidien" },
  { id: "q040", text: "Si on cuisinait un plat ensemble ce soir, ce serait quoi ?", category: "quotidien" },
  { id: "q041", text: "C'est quoi la petite habitude de l'autre que tu trouves adorable même si c'est bizarre ?", category: "quotidien" },
  { id: "q042", text: "Série, film ou documentaire : qu'est-ce qu'on regarde ce soir si on choisissait ensemble ?", category: "quotidien" },
  { id: "q043", text: "Tu préfères qu'on passe une soirée calme à la maison ou une sortie improvisée ?", category: "quotidien" },
  { id: "q044", text: "C'est quoi la petite chose du quotidien que tu fais et qui me facilite la vie sans que je le dise assez ?", category: "quotidien" },

  // ────────── DEFI ──────────
  { id: "q045", text: "Défi : écris 5 choses que tu adores chez moi sans réfléchir, je fais pareil.", category: "defi" },
  { id: "q046", text: "Défi : on se fixe un objectif commun pour ce mois-ci. C'est quoi le nôtre ?", category: "defi" },
  { id: "q047", text: "Défi : on planifie une surprise l'un pour l'autre cette semaine — chacun garde le secret !", category: "defi" },
  { id: "q048", text: "Défi : dis-moi un compliment que tu m'as jamais fait et que tu penses vraiment.", category: "defi" },
  { id: "q049", text: "Défi : on s'échange nos playlists et on écoute celle de l'autre pendant 30 minutes.", category: "defi" },
  { id: "q050", text: "Défi : on prend une photo de nous deux ce soir pour se souvenir de ce moment.", category: "defi" },
];

// ─── Utilitaires ───────────────────────────────────────────────────────────────

/**
 * Retourne toutes les questions d'une catégorie donnée.
 */
export function getByCategory(category: QuestionCategory): Question[] {
  return QUESTIONS.filter((q) => q.category === category);
}

/**
 * Retourne une question par son ID.
 */
export function getById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

/**
 * Retourne les questions que le couple n'a PAS encore vues.
 * @param seenIds - tableau des IDs déjà vus par ce couple
 */
export function getUnseen(seenIds: string[]): Question[] {
  return QUESTIONS.filter((q) => !seenIds.includes(q.id));
}

/**
 * Retourne le nombre total de questions disponibles.
 */
export function getTotalCount(): number {
  return QUESTIONS.length;
}
