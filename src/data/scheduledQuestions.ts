/**
 * Questions du Jour planifiées à l'avance
 *
 * Format : "YYYY-MM-DD" → ID de question (de questions.ts)
 *
 * Comment planifier une question :
 *   Ajoute une ligne : "2026-09-01": "q012",
 *   L'ID doit exister dans questions.ts
 *
 * Si aucune question n'est planifiée pour une date,
 * une question aléatoire non encore vue sera choisie.
 *
 * Les questions planifiées ici sont les mêmes
 * pour TOUS les couples ce jour-là.
 */

export const SCHEDULED_QUESTIONS: Record<string, string> = {
  // ── Août 2026 ────────────────────────────────────────────
  "2026-08-01": "q032", // amour      — Qu'est-ce que j'ai fait récemment qui t'a fait sentir vraiment aimé(e) ?
  "2026-08-02": "q001", // souvenir   — Le souvenir le plus doux de notre première rencontre ?
  "2026-08-03": "q016", // profond    — Qu'as-tu appris sur toi-même depuis qu'on est ensemble ?
  "2026-08-04": "q025", // fun        — Si on était un duo de super-héros ?
  "2026-08-05": "q009", // reve       — Si on pouvait voyager n'importe où ensemble ?
  "2026-08-06": "q039", // quotidien  — Ta routine du matin idéale avec moi ?
  "2026-08-07": "q045", // defi       — Écris 5 choses que tu adores chez moi

  "2026-08-08": "q033", // amour      — C'est quoi ton langage de l'amour préféré ?
  "2026-08-09": "q002", // souvenir   — Quel moment t'a fait réaliser que tu tenais vraiment à l'autre ?
  "2026-08-10": "q017", // profond    — C'est quoi ta plus grande peur dans notre relation ?
  "2026-08-11": "q026", // fun        — On est dans une émission de télé-réalité ?
  "2026-08-12": "q010", // reve       — Comment tu imagines notre maison idéale dans 10 ans ?
  "2026-08-13": "q040", // quotidien  — Si on cuisinait un plat ensemble ce soir ?
  "2026-08-14": "q046", // defi       — On se fixe un objectif commun pour ce mois-ci

  "2026-08-15": "q034", // amour      — Quel est le plus beau message que tu m'aies jamais dit ?
  "2026-08-16": "q003", // souvenir   — C'était quoi notre meilleure sortie ensemble ?
  "2026-08-17": "q018", // profond    — Qu'est-ce que je fais qui te rend vraiment heureux/heureuse ?
  "2026-08-18": "q027", // fun        — Si notre histoire d'amour était un film ?
  "2026-08-19": "q011", // reve       — C'est quoi le projet commun qui te tient le plus à cœur ?
  "2026-08-20": "q041", // quotidien  — La petite habitude de l'autre que tu trouves adorable ?
  "2026-08-21": "q047", // defi       — On planifie une surprise l'un pour l'autre cette semaine

  "2026-08-22": "q035", // amour      — Si tu devais écrire une chanson d'amour pour moi ?
  "2026-08-23": "q004", // souvenir   — Tu te souviens de quoi que tu portais le jour où on s'est rencontré(e)s ?
  "2026-08-24": "q019", // profond    — Si tu devais me décrire en 3 mots ?
  "2026-08-25": "q028", // fun        — C'est quoi le truc le plus random qu'on pourrait faire ce weekend ?
  "2026-08-26": "q012", // reve       — Si on avait 6 mois sabbatiques ?
  "2026-08-27": "q042", // quotidien  — Série, film ou docu : qu'est-ce qu'on regarde ce soir ?
  "2026-08-28": "q048", // defi       — Dis-moi un compliment que tu m'as jamais fait

  "2026-08-29": "q036", // amour      — Comment tu sais, au quotidien, que tu m'aimes encore ?
  "2026-08-30": "q020", // profond    — C'est quoi la chose la plus courageuse que tu aies faite pour notre relation ?
  "2026-08-31": "q005", // souvenir   — Quel voyage ensemble t'a marqué(e) le plus ?

  // ── Septembre 2026 (ajoute tes questions ici) ────────────
  // "2026-09-01": "q021",
};

/**
 * Retourne l'ID de question planifié pour une date donnée,
 * ou null si aucune question n'est prévue ce jour-là.
 */
export function getScheduledQuestionId(dateKey: string): string | null {
  return SCHEDULED_QUESTIONS[dateKey] ?? null;
}
