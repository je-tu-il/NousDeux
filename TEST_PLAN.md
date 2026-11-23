
- [ ] Actualiser pendant le chargement.
- [ ] Couper le réseau : vérifier un message d’erreur puis un bouton de retry.
- [ ] Vérifier qu’une permission Firestore refusée ne provoque pas de boucle ni de
      désynchronisation.
- [ ] Se resynchroniser avec le même partenaire : retrouver ses cosmétiques.
- [ ] Se resynchroniser avec une autre personne : ne pas exposer les données de
      l’ancien couple et vérifier le comportement prévu des cosmétiques.
- [ ] Vérifier que l’ancien partenaire ne voit plus les nouvelles réponses.
- [ ] Vérifier que les réponses et données du couple sont bien isolées par
      `couples/{uid1_uid2}`.
QUand je crée un compte et qu'on me demande le prenom, des que je tape une lettre ca me passe a l'age
Quand notre partenaire passe a la question suivante, laisser la reponse afficher sur l'ecran et marquer en desosus ce qu'il y avais deja :"X est deja a la suivante !"
Et laisse la transformation de bouton Rejoindre X mais retire le > en trop
Quand on actualise ou passe au dashboard sans avoir rempli le prenom, ca nous met sur un dashboard sans pseudo rien
Rediriger vers le remplissage des infos tant que tout n'es pas rempli
Sur un petit format ca rend mal 
Quetes "recompenses" depasse sur le dessous de la case, retirer le texte recompense et "cosmetique" de boutique a un certain point et passer juste au logo si trop peu larger
Appliquer cette idée a chaque elements du site

Si pp disparait ?
SI on se resynchro avec la meme personne on garde les cosmetiques l'argent. Si un des 2 a changer de couple avant de se remettre ca ne marche plus.
Faire en sorte qu'il y ai un pop up esthetique montrant le debloquage
Quete ?
A la place d'erreur mettre pop up ui
Mettre un message d'erreur si mauvais code de synchro (code inexistant, son propre code)
Verif nouveau com^te 0
Unmatched rout custom
Process de test
- **Audit de `RetourUser.txt` et des notes produit**
  - Vérifiés dans le code et couverts par des tests de régression ou des scénarios existants : redirection des profils incomplets, isolation du couple lors d’un changement de compte, accès au chat après synchronisation, déduplication des liens widget, reprise au démarrage web et mise à jour obligatoire via la configuration distante.
  - Présents dans l’interface : action de synchronisation agrandie sur le dashboard, retour de Synchronisation vers Avatar ou Dashboard, retour Boutique depuis Widgets vers Dashboard, panneaux lisibles pour Synchronisation et les textes légaux, accès Paramètres et Widgets, récompense publicitaire à la demande.
  - Vérifier sur appareils : connexion Apple avec un build signé, question et série du widget après minuit, rafraîchissement après changement de thème, lisibilité sur les fonds personnalisés, cadrage sur petit écran Android et temps de première ouverture de la boutique. Les appels et les styles sont présents dans le code, et ces essais doivent confirmer le résultat.
  - À arbitrer : publicité automatique au lancement et publicité web. La récompense à la demande sur mobile suit un parcours distinct.
  - Idées des notes encore à cadrer : quiz de connaissance du partenaire, jeu de curseurs, bilan mensuel et autres pistes de rétention. Leur présence dans les notes ne signifie pas qu’elles sont livrées.
