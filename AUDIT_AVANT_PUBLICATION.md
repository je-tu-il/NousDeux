# NousDeux — revue locale avant publication

**État : version de test corrigée et vérifiée. Aucune publication ni aucun push. Cette revue ne vaut pas validation finale par les stores.**

Les modifications déjà présentes dans le dossier au début de la revue ont été conservées. `RetourUser.txt` et `.user_notes/Sugesst.md` ont été consultés ; leur historique n’a pas été réécrit.

## Ce qui a changé

| Sujet signalé | Intervention | Vérification |
| --- | --- | --- |
| Logo lent, actualisation nécessaire, crash web | Une seule restauration de session, attente du stockage et de Firebase, écran de reprise avec « Réessayer », petit logo de 192 px, suppression du faux client Firebase déconnecté | Démarrage et actualisation à 320, 390, 768 et 1440 px ; premier chargement d’un couple fictif |
| Ancien profil ou ancien couple affiché | Réinitialisation complète au changement d’UID, nouvelle pile de navigation par compte, réponses réseau anciennes ignorées, données de widgets rattachées au compte | Tests de changement de compte, UID local périmé, retour navigateur et réponses Firestore tardives |
| Tableau de bord cassé | Balise JSX en trop et imports manquants corrigés ; cartes de navigation rendues avec de vrais conteneurs ; accès Widgets et Paramètres nommés | Compilation et parcours connecté local |
| Retour Synchronisation | Provenance explicite depuis l’avatar ; retour à l’avatar pendant ce parcours et au dashboard depuis le dashboard | Contrôles de navigation ; validation physique mobile encore requise |
| Paramètres qui plantent sur le web | Styles des liens aplatis avant transmission à la navigation ; interrupteurs natifs accessibles | Ouverture des paramètres et changement de thème dans le navigateur connecté |
| Boutique lente | Catalogue visible sans écran bloquant ; fonds et aperçus optimisés ; conservation des originaux | Ouverture avec un compte fictif ; export web |
| Lisibilité et aspect premium | Accueil entièrement revu, palette prune/crème, hiérarchie et espacements, panneaux plus opaques, textes secondaires contrastés, cartes et avatars harmonisés | Inspection visuelle téléphone, tablette et ordinateur |
| Widgets périmés, mauvaise question, série artificielle | Série initiale à zéro, date locale, changement de jour et reprise d’activité, lecture du vrai slot quotidien, synchronisation du style, séparation des caches par compte | Tests des données et ouverture de l’écran widgets ; rafraîchissement système iOS/Android à vérifier sur appareils |
| Récompenses qui se reverrouillent | Reconnaissance de l’inventaire et du widget équipé ; bordure équipée conservée après perte de série ; attribution des récompenses sans écraser un achat concurrent | Tests existants et inspection du code ; essai physique encore requis |
| Connexion Apple | Dépendances compatibles, nonce cryptographique et bouton Apple natif | Compilation ; connexion réelle non certifiée sans build signé et configuration Apple/Firebase |
| Mise à jour obligatoire | Retrait de l’identifiant App Store inventé ; URL iOS réelle attendue dans `app_config/global.iosStoreUrl` ; pas de boucle de rechargement web | Tests du composant et de la configuration |
| Suppression de compte | Confirmation Google/Apple adaptée à la plateforme, suppression des réponses imbriquées avant leurs parents, lots limités à 400, prise en compte du solo et des archives connues, erreur Auth non masquée | Suppression réelle d’un compte fictif : Auth, profil et réponse imbriquée disparus |
| Confidentialité | Retrait des promesses incorrectes de chiffrement de bout en bout ; nouvelles écritures refusées si le chiffrement est indisponible ; ancien format encore lisible | Aller-retour AES, refus du faux chiffrement Base64, compatibilité des anciens messages |
| Sécurité | API de jumelage authentifiées par jeton, restriction des modifications du profil du partenaire, dépendances corrigées | Rejet d’une usurpation d’UID et d’une modification de pseudo par le partenaire |
| Support sans connexion | Préparation d’un e-mail avec le contenu saisi, au lieu d’une écriture Firestore interdite ; aucun envoi automatique | Compilation ; client mail à vérifier sur appareil |

### Performance et dépendances

- Images d’ambiance et aperçus utilisés : **125,61 Mo → 4,08 Mo**, soit **−96,8 %**. Les originaux restent présents ; les références de l’app utilisent les versions optimisées.
- Expo **57** et React Native **0.86.3**, après lecture de la documentation imposée d’Expo 56 puis des notes de migration 57. Cette migration traite la régression mémoire Hermes signalée sur Expo 56 : [notes officielles Expo](https://expo.dev/changelog/sdk-57).
- Firebase **12.19.0**, notamment pour ses correctifs de restauration de session et de stockage Safari : [notes officielles Firebase](https://firebase.google.com/support/release-notes/js).
- Firebase Admin **14.5.0**, avec adaptation des API serveur à ses imports modulaires.
- Correctifs ciblés de `decode-uri-component`, `@grpc/grpc-js` et `brace-expansion`. L’adaptateur CommonJS/ESM du décodeur est réappliqué par `postinstall` et couvert par un test de paramètres de navigation.

## Vérifications et limites

| Contrôle final | Résultat |
| --- | --- |
| TypeScript | Aucune erreur |
| Tests unitaires | **109 réussis** |
| Navigateur, parcours publics | **15 réussis** ; 3 anciens tests avec session réelle ignorés |
| Navigateur, comptes fictifs isolés | **5 réussis**, dont réponses en direct et suppression de compte |
| Expo Doctor | **21/21** |
| Analyse du code | **0 erreur**, 150 avertissements à traiter lors d’un nettoyage ultérieur |
| Audit dépendances | **0 critique, 0 élevée, 15 modérées** |
| Exports web, iOS et Android | Réussis |
| Génération Android | Réussie |

Résultats et journaux reproductibles dans `.expo/` :

- `unit-audit.txt` : suite unitaire, dont restauration de session, chiffrement, widgets, suppression et configuration de production.
- `e2e-final.log` : démarrage, actualisation, consentement, pages publiques et isolation d’un ancien compte.
- `local-tests.log` : comptes fictifs, navigation connectée, thème, protection du pseudo, réponses des deux partenaires en temps réel et suppression de compte.
- `doctor-audit.txt` : contrôles de compatibilité Expo.
- `eslint.json` : analyse du code ; les avertissements historiques restent distingués des erreurs.
- `dependency-audit-final.json` : audit des dépendances ; les alertes modérées restantes ne sont pas déclarées résolues.
- `web-final.log` et `native-final.log` : exports web et JavaScript iOS/Android.
- `prebuild-android.log` : génération du projet Android.

Les exports JavaScript natifs **ne sont pas** un AAB ou un IPA signé. La génération iOS native est indisponible sur cette machine Windows. Aucun test sur appareil physique, aucune certification Apple/Google et aucune validation de console Firebase de production ne sont prétendus.

## Aperçu de test sans données réelles

**http://127.0.0.1:8083** utilise le projet fictif `demo-nousdeux` et les émulateurs locaux. Les tests connectés ne créent, ne modifient et ne suppriment aucun compte réel.

Pour relancer :

```powershell
npx --yes firebase-tools@14.26.0 emulators:start --only "auth,firestore" --project demo-nousdeux --config firebase.test.json
```

Dans un autre terminal :

```powershell
npm run test:e2e:local
node scripts/serve-preview.cjs .expo/emulator-web 8083
```

Les comptes de test sont recréés à chaque passage par `seed-local-test.cjs`. Leurs informations sont uniquement dans `.expo/test-accounts.json`, ignoré par Git. Le mode émulateur est explicite et interdit par la configuration des builds de production.

L’export normal `dist-test` utilise la configuration Firebase habituelle du projet. Il n’est pas présenté comme une base de données de test isolée. Pour les essais avec comptes fictifs, utiliser le port **8083**.

## Conditions restantes avant les stores

1. **Builds signés et appareils réels** : produire un AAB de distribution et un IPA signé, avec les comptes développeur et certificats appropriés, puis tester Google/Apple, les photos, le clavier, le retour Android et les widgets sur de vrais appareils.
2. **Publicités** : fournir `ADMOB_ANDROID_APP_ID` et `ADMOB_IOS_APP_ID` réels dans l’environnement EAS de production. Le build de production refuse les identifiants d’exemple. Vérifier les unités interstitielles distinctes des unités récompensées et mettre en place/valider le consentement publicitaire avant diffusion réelle. Aucun consentement réglementaire complet n’est prétendu dans cette revue.
3. **OAuth** : vérifier les domaines autorisés, empreintes de signature Android, capacité Sign in with Apple et configuration du fournisseur Apple dans Firebase sur les builds signés.
4. **Serveur** : les règles et API corrigées sont uniquement dans ce dossier. Elles n’ont pas été déployées. La lecture des profils reste largement autorisée aux comptes connectés pour préserver le fonctionnement actuel de la recherche par code ; une séparation des champs publics et privés mérite une revue avant ouverture publique.
5. **Anciennes données orphelines** : la nouvelle procédure supprime les sous-collections connues avant leurs parents. Les réponses déjà orphelines d’anciennes versions exigent un nettoyage serveur séparé ; aucune donnée réelle n’a été nettoyée pendant cette revue.
6. **Fiches et déclarations stores** : renseigner confidentialité/Data Safety, classification du contenu, support, suppression de compte, captures natives et compte de revue. Fournir la véritable URL App Store pour les mises à jour obligatoires.
7. **Dernier contrôle des dépendances** : conserver le rapport des alertes modérées restantes et les qualifier avant diffusion ; zéro alerte élevée/critique ne signifie pas absence de tout risque.

Le profil EAS `preview` reste interne. Le profil `production` prépare un AAB Android et refuse les paramètres de test dangereux, mais aucun build distant ni envoi store n’a été lancé.
