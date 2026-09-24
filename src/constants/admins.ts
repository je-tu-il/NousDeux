/**
 * UIDs administrateurs de l'application NousDeux.
 * Source de vérité unique partagée entre settings.tsx, admin.tsx et les tests.
 * Synchronisé avec les règles Firestore (firestore.rules).
 */
export const ADMIN_UIDS_LIST = [
  '0SDwLPRnKRaq0SMn0RkjEfWTugl1',
  'rfI3GYRmLPcMCCwejgnF22yy1ni2',
  'uXNK1h8u01VjUwBENVIu8naJCa42',
  'tvR7bgEnaFROAtsxIOqm1oDx4ME3',
  'neLeDx68mcVXDyrVgW7RDKRFHUE2',
] as const;

export const ADMIN_UIDS = new Set<string>(ADMIN_UIDS_LIST);

export function isUserAdmin(uid: string | null | undefined): boolean {
  if (!uid) return false;
  return ADMIN_UIDS.has(uid);
}
