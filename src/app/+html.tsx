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
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>NousDeux</title>
        <ScrollViewStyleReset />
      </head>
      <body className="notranslate" translate="no">{children}</body>
    </html>
  );
}
