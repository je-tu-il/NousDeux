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
  "2026-08-01": "q_gen_amour_001", 
  "2026-08-02": "q_gen_souvenir_001",
  "2026-08-03": "q_gen_profond_001",
  "2026-08-04": "q_gen_fun_001",
  "2026-08-05": "q_gen_reve_001",
  "2026-08-06": "q_gen_quotidien_001",
  "2026-08-07": "q_gen_defi_001",

  "2026-08-08": "q_gen_amour_002",
  "2026-08-09": "q_gen_souvenir_002",
  "2026-08-10": "q_gen_profond_002",
  "2026-08-11": "q_gen_fun_002",
  "2026-08-12": "q_gen_reve_002",
  "2026-08-13": "q_gen_quotidien_002",
  "2026-08-14": "q_gen_defi_002",

  "2026-08-15": "q_gen_amour_003",
  "2026-08-16": "q_gen_souvenir_003",
  "2026-08-17": "q_gen_profond_003",
  "2026-08-18": "q_gen_fun_003",
  "2026-08-19": "q_gen_reve_003",
  "2026-08-20": "q_gen_quotidien_003",
  "2026-08-21": "q_gen_defi_003",

  "2026-08-22": "q_gen_amour_004",
  "2026-08-23": "q_gen_souvenir_004",
  "2026-08-24": "q_gen_profond_004",
  "2026-08-25": "q_gen_fun_004",
  "2026-08-26": "q_gen_reve_004",
  "2026-08-27": "q_gen_quotidien_004",
  "2026-08-28": "q_gen_defi_004",

  "2026-08-29": "q_gen_amour_005",
  "2026-08-30": "q_gen_profond_005",
  "2026-08-31": "q_gen_fun_005",

  // ── Septembre 2026 (Exemples) ────────────────────────────
  "2026-09-01": "q_gen_amour_006",
  "2026-09-02": "q_gen_souvenir_005",
  "2026-09-03": "q_gen_profond_006",
  "2026-09-04": "q_gen_fun_006",
  "2026-09-05": "q_gen_reve_005",
  "2026-09-06": "q_gen_quotidien_005",
  "2026-09-07": "q_gen_defi_005",

  // ... Ajouter la suite selon vos besoins
};

/**
 * Retourne l'ID de question planifié pour une date donnée,
 * ou null si aucune question n'est prévue ce jour-là.
 */
export function getScheduledQuestionId(dateKey: string): string | null {
  return SCHEDULED_QUESTIONS[dateKey] ?? null;
}
