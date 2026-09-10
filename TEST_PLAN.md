# Plan de tests NousDeux

Ce document est la checklist de non-régression de la V2.1. Chaque nouvelle
fonctionnalité doit ajouter ses cas automatisés dans `tests/unit` ou
`tests/e2e`, puis ses vérifications manuelles ici.

## Lancer les tests

```bash
npm run test:unit
npm run test:e2e
```

Pour les tests authentifiés, créer un état Playwright avec un compte Firebase
de test et lancer :

```powershell
$env:E2E_STORAGE_STATE="tests/.auth/test-user.json"
npm run test:e2e
```

Ne jamais utiliser un compte personnel, un vrai couple ou des données de
production pour l’automatisation.

Les tests authentifiés sont volontairement ignorés tant que
`E2E_STORAGE_STATE` n'est pas défini : Playwright ne peut pas se connecter
automatiquement à Firebase sans session de test, et les tests ne doivent pas
contourner Google OAuth ni utiliser un compte personnel. Une fois le fichier
d'état créé, les trois tests authentifiés sont exécutés automatiquement.

Les fichiers TXT de `QUESTIONS/` sont la source canonique. Après une
modification de ces fichiers, le catalogue TypeScript doit être régénéré puis
`npm run test:unit` doit confirmer que tous les identifiants sont présents.

## 1. Authentification et session

- [ ] Créer un compte neuf avec Google.
- [ ] Vérifier que le retour OAuth revient dans l’application, sans rester sur
      `__/auth/handler`.
- [ ] Se déconnecter puis se reconnecter.
- [ ] Vérifier que l’avatar, le pseudo, l’âge et les cosmétiques sont conservés.
- [ ] Couper le réseau pendant le chargement puis le rétablir.
- [ ] Vérifier qu’une erreur `auth/invalid-credential` affiche une erreur
      compréhensible et ne laisse pas l’application bloquée.
- [ ] Supprimer le compte avec une connexion récente.
- [ ] Supprimer le compte après une session ancienne et vérifier que la
      réauthentification Google s’ouvre puis se termine correctement.
- [ ] Vérifier la suppression du compte dans Firebase Authentication.
- [ ] Vérifier la suppression du document `users/{uid}` et du profil
      `userProfiles/{uid}`.
- [ ] Après suppression, vérifier le retour à la page de connexion.
- [ ] Tenter d’ouvrir directement `/dashboard`, `/settings`, `/calendar` et
      `/shop` après suppression : aucune page privée ne doit rester accessible.
- [ ] Supprimer un compte depuis Firebase Console puis actualiser l’application :
      la session locale doit être invalidée et l’utilisateur renvoyé vers login.

## 2. Synchronisation du couple

- [ ] Compte A génère un code.
- [ ] Compte B saisit le code.
- [ ] Vérifier que les deux comptes reçoivent le bon `linkedTo`.
- [ ] Vérifier que les deux comptes arrivent sur la saisie de date.
- [ ] Vérifier qu’aucun appareil ne passe directement au Dashboard avec une
      ancienne `coupleDate`.
- [ ] Saisir deux dates différentes : rester sur la saisie de date.
- [ ] Saisir la même date sur les deux appareils : arriver au Dashboard sur les
      deux appareils sans rechargement manuel.
- [ ] Rafraîchir chaque appareil pendant la synchronisation : ne pas revenir en
      boucle sur `/onboarding/sync`.
- [ ] Entrer un code invalide, expiré et son propre code.
- [ ] Quitter le couple depuis A, actualiser B et vérifier que B passe aussi en
      mode solo.
- [ ] En mode solo, vérifier que le bouton « Quitter le couple » est absent.
- [ ] En mode solo, vérifier que « Entrer un code partenaire » est présent.
- [ ] Quitter puis se resynchroniser avec la même personne.
- [ ] Quitter puis se resynchroniser avec une personne différente.
- [ ] Vérifier qu’un ancien code ou ancien cache AsyncStorage ne resynchronise
      jamais automatiquement avec l’ancien partenaire.
- [ ] Pendant une erreur Firestore temporaire, vérifier que le couple n’est pas
      désynchronisé automatiquement.

## 3. Partenaire supprimé ou indisponible

- [ ] Supprimer le compte du partenaire depuis Firebase Console.
- [ ] Vérifier que le Dashboard n’affiche pas un avatar rose ou un `?` cliquable.
- [ ] Vérifier que les fonctions multijoueur sont grisées et non utilisables.
- [ ] Vérifier qu’un partenaire supprimé ne bloque pas la navigation.
- [ ] Vérifier qu’un utilisateur peut supprimer son propre compte même si l’autre
      compte a déjà été supprimé.
- [ ] Vérifier que la reconnexion après suppression force une nouvelle session.

## 4. Question du jour

- [ ] Ouvrir la question du jour sur les deux appareils.
- [ ] Vérifier que la question est identique pour les deux comptes.
- [ ] Vérifier que le thème réel est affiché.
- [ ] Répondre sur A puis B et vérifier le déverrouillage des réponses.
- [ ] Actualiser pendant le chargement.
- [ ] Couper le réseau : vérifier un message d’erreur puis un bouton de retry.
- [ ] Vérifier qu’une permission Firestore refusée ne provoque pas de boucle ni de
      désynchronisation.
- [ ] Vérifier qu’un slot déjà existant est réutilisé.
- [ ] Vérifier le changement de question le jour suivant.

## 5. Questions illimitées et catégories

- [ ] Ouvrir Questions Illimitées sans catégorie.
- [ ] Ouvrir chaque catégorie : Amour, Fun, Profond, Intime, Tu préfères,
      Famille, Débat, Futur, Souvenir, Rêve, Quotidien et Défi.
- [ ] Vérifier que le thème affiché correspond à la question.
- [ ] Vérifier que Rêve, Quotidien et Défi ne sont pas affichés à tort comme
      « Illimité ».
- [ ] Vérifier qu’une catégorie verrouillée affiche le nom de la catégorie
      requise, et non le nom décalé de la catégorie cliquée.
- [ ] Répondre à 10 questions d’Amour : déverrouiller Fun.
- [ ] Répondre à 10 questions de Fun : déverrouiller Profond.
- [ ] Répéter jusqu’à Défi et vérifier chaque seuil.
- [ ] Vérifier le cas particulier Tu préfères avec ses choix A/B.
- [ ] Cliquer sur Réessayer après une erreur : conserver la catégorie dans l’URL.
- [ ] Avancer avec A puis B et vérifier que les réponses sont bien synchronisées.
- [ ] Actualiser pendant le chargement : aucune attente infinie.

## 6. Calendrier et séries

- [ ] Ouvrir le calendrier sur ordinateur.
- [ ] Ouvrir le calendrier sur mobile.
- [ ] Vérifier que le fond couvre correctement l’écran sans être trop bas.
- [ ] Vérifier que le fond reste visible sur petit écran.
- [ ] Vérifier le mini-calendrier.
- [ ] Cliquer sur le mini-calendrier et vérifier la série en cours.
- [ ] Vérifier le record de série et ses dates.
- [ ] Vérifier les jours complétés après une question répondue à deux.
- [ ] Vérifier un couple sans historique.
- [ ] Vérifier une erreur de permissions : affichage dégradé sans crash.
- [ ] Mesurer le chargement : pas de spinner permanent et retour visible en
      moins de 8 secondes sur réseau normal.

## 7. Dashboard, roulette, économie et boutique

- [ ] Mesurer l’ouverture du Dashboard sur une session froide et chaude.
- [ ] Vérifier l’absence de spinner permanent.
- [ ] Ouvrir la roulette sur ordinateur et mobile.
- [ ] Vérifier que la roulette affiche son résultat et son gain.
- [ ] Vérifier qu’un double clic ne double pas la récompense.
- [ ] Vérifier que le solde est identique après actualisation.
- [ ] Vérifier le calendrier de récompense quotidienne.
- [ ] Vérifier les quêtes et la réclamation d’une récompense.
- [ ] Vérifier que les prix boutique sont cohérents avec les gains de roulette.
- [ ] Acheter un objet avec assez de pétales.
- [ ] Acheter avec un solde insuffisant : achat refusé sans solde négatif.
- [ ] Vérifier qu’un objet acheté reste possédé après déconnexion.
- [ ] Vérifier que les cosmétiques personnels restent après sortie du couple.
- [ ] Équiper/déséquiper un fond, une bordure et un tag.
- [ ] Vérifier l’avatar après déconnexion/reconnexion.

## 8. Suppression et conservation des données

- [ ] Quitter un couple : conserver les cosmétiques personnels.
- [ ] Se resynchroniser avec le même partenaire : retrouver ses cosmétiques.
- [ ] Se resynchroniser avec une autre personne : ne pas exposer les données de
      l’ancien couple et vérifier le comportement prévu des cosmétiques.
- [ ] Vérifier que l’ancien partenaire ne voit plus les nouvelles réponses.
- [ ] Vérifier que les réponses et données du couple sont bien isolées par
      `couples/{uid1_uid2}`.

## 9. Réseau, permissions et performance

- [ ] Tester avec réseau lent.
- [ ] Tester une coupure réseau pendant chaque écran critique.
- [ ] Tester une reconnexion Firebase après expiration de session.
- [ ] Vérifier qu’aucun `permission-denied` non traité ne reste dans la console.
- [ ] Vérifier que les listeners Firestore sont désabonnés en quittant chaque
      écran.
- [ ] Vérifier que Dashboard, roulette, calendrier, question du jour et
      illimité ont chacun une limite de chargement.
- [ ] Déployer les règles Firestore sur un projet de test, jamais directement
      sur la production sans sauvegarde.

## 10. À ajouter avec chaque fonctionnalité

- [ ] Ajouter au moins un test unitaire d’invariant.
- [ ] Ajouter un test E2E du parcours utilisateur nominal.
- [ ] Ajouter un test E2E d’erreur réseau ou permission.
- [ ] Ajouter le cas de régression à cette checklist.
- [ ] Tester ordinateur et mobile.
- [ ] Tester un compte solo, un couple nouvellement créé et un couple existant.
- [ ] Vérifier le lint et `npm run test:unit`.
