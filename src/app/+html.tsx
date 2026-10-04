import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="fr" className="notranslate" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Language" content="fr" />
        <meta name="language" content="French" />
        <meta name="google" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>NousDeux — Jeu complice pour couple</title>
        <meta name="description" content="NousDeux est l'application quotidienne pour renforcer votre complicité amoureuse : une question chaque jour, des anecdotes partagées, la roue des gages et une flamme à faire grandir ensemble." />
        <meta name="keywords" content="jeu couple, questions couple, amour, complicité, relation, application couple, défis couple" />
        <meta property="og:title" content="NousDeux — Le jeu complice pour les couples" />
        <meta property="og:description" content="Chaque jour, une question en amoureux, des anecdotes complices et une flamme à faire grandir ensemble." />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="NousDeux — Le jeu complice pour les couples" />
        <meta name="twitter:description" content="Chaque jour, une question en amoureux, des anecdotes complices et une flamme à faire grandir ensemble." />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            height: 100%;
            width: 100%;
            max-width: 100%;
            min-height: 100vh;
            min-height: 100dvh;
            background-color: #FFF5F2;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            -webkit-tap-highlight-color: transparent;
          }
          #root {
            display: flex;
            height: 100%;
            width: 100%;
            max-width: 100%;
            min-height: 100vh;
            min-height: 100dvh;
            flex: 1;
            background-color: #FFF5F2;
            overflow: hidden;
          }
          @media (prefers-color-scheme: dark) {
            html, body, #root {
              background-color: #1A1514;
            }
          }
        `}} />
      </head>
      <body className="notranslate" translate="no">{children}</body>
    </html>
  );
}
