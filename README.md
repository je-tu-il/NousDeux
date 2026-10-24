# ❤️ NousDeux — L'Application Mobile Complice pour les Couples

[![Release](https://img.shields.io/github/v/release/je-tu-il/NousDeux?color=pink&label=Version)](https://github.com/je-tu-il/NousDeux/releases/latest)
[![Build Android](https://github.com/je-tu-il/NousDeux/actions/workflows/build-android.yml/badge.svg)](https://github.com/je-tu-il/NousDeux/actions/workflows/build-android.yml)
[![Build iOS](https://github.com/je-tu-il/NousDeux/actions/workflows/build-ios.yml/badge.svg)](https://github.com/je-tu-il/NousDeux/actions/workflows/build-ios.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/Plateformes-Android%20%7C%20iOS%20%7C%20Web-purple.svg)](https://github.com/je-tu-il/NousDeux/releases/latest)

> **NousDeux** est une application mobile intimiste conçue pour rapprocher les couples au quotidien : questions et dilemmes quotidiens, suivi de flammes (streaks), widgets d'écran d'accueil interactifs, personnalisation d'avatars et carnet de souvenirs partagés.

---

## 📲 Téléchargement Direct & Installation (Pour les Utilisateurs)

Retrouvez les installateurs sur la page des [**Dernières Versions (Releases)**](https://github.com/je-tu-il/NousDeux/releases/latest) :

### 🤖 Sur Android (Samsung, Xiaomi, Pixel, Oppo...)
1. Téléchargez le fichier **`NousDeux.apk`** depuis la dernière Release.
2. Ouvrez le fichier sur votre smartphone.
3. Si votre téléphone affiche une alerte de sécurité *"Source inconnue"*, cliquez sur **Paramètres** puis cochez **Autoriser l'installation depuis cette source**.
4. Validez l'installation et lancez **NousDeux** !

### 🍏 Sur iPhone & iPad (iOS)
1. Téléchargez le fichier **`NousDeux.ipa`**.
2. Installez-le facilement via votre gestionnaire de sideloading favori :
   - [AltStore](https://altstore.io/) (recommandé sans jailbreak)
   - [SideStore](https://sidestore.io/) (autonome sans PC après configuration)
   - [Sideloadly](https://sideloadly.io/) (installation USB en 1 clic)
   - [TrollStore](https://github.com/opa334/TrollStore) (si version iOS compatible)

---

## ✨ Fonctionnalités Principales

- 💬 **Questions & Dilemmes Quotidiens** : Une nouvelle question chaque jour dans 12 thématiques (Amour, Intime, Souvenirs, Débats, Futurs projets, Défis, Famille, Fun, Rêves...). Découvrez la réponse de votre moitié une fois que vous avez tous les deux répondu !
- 🔥 **Système de Streaks & Calendrier** : Gardez la flamme vivante avec un compteur de jours consécutifs et visualisez vos moments forts sur un calendrier interactif.
- 📱 **Widgets iOS & Android** :
  - **Question du Jour** : Affichez la question directement sur votre écran d'accueil sans ouvrir l'application.
  - **Compteur de Flammes** : Gardez toujours un œil sur votre série de jours complices.
- 🎨 **Avatars & Cosmétiques** : Personnalisez vos profils de couple avec des cadres, des bordures animées et des récompenses à débloquer via la boutique.
- 💌 **Messagerie & Notes Privées** : Un espace sécurisé réservé uniquement à votre duo, synchronisé en temps réel via Firebase Firestore.
- 🪙 **Quêtes Quotidiennes & Boutique** : Complétez vos quêtes de couple, gagnez des cœurs et débloquez de nouveaux éléments de personnalisation.

---

## 🛠️ Stack Technique

- **Framework** : [React Native](https://reactnative.dev/) (0.85) avec [Expo SDK 56](https://expo.dev/)
- **Langage** : TypeScript
- **Base de données & Auth** : Firebase (Firestore, Auth, Realtime Database)
- **Widgets natifs** : Swift (WidgetKit avec support iOS 17 containerBackground)
- **CI/CD** : GitHub Actions (compilation automatisée des APK Release et IPA non signés)

---

## 💻 Démarrage en Développement

### Prérequis
- [Node.js](https://nodejs.org/) (v20+)
- [Expo CLI](https://docs.expo.dev/)

```bash
# Installation des dépendances
npm install --legacy-peer-deps

# Lancement du serveur de développement Metro
npx expo start
```

- Scannez le QR code affiché dans le terminal avec l'application **Expo Go** (Android/iOS).
- Appuyez sur `w` pour prévisualiser dans le navigateur web.

---

## 📄 Licence

Ce projet est distribué sous licence **MIT**. Consultez le fichier [LICENSE](LICENSE) pour plus de détails.
