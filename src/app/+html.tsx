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
        <title>NousDeux</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            height: 100%;
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
            min-height: 100vh;
            min-height: 100dvh;
            flex: 1;
            background-color: #FFF5F2;
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
