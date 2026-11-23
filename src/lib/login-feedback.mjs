export function getLoginFeedback(provider, error) {
  const code = String(error?.code ?? '');
  const label = provider === 'apple' ? 'Apple' : 'Google';

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'SIGN_IN_CANCELLED':
    case 'ERR_REQUEST_CANCELED':
    case 'ERR_CANCELED':
      return null;
    case 'auth/popup-blocked':
      return `Autorise les fenêtres pop-up pour NousDeux, puis réessaie avec ${label}.`;
    case 'auth/network-request-failed':
      return 'Vérifie ta connexion Internet, puis réessaie.';
    case 'auth/account-exists-with-different-credential':
      return 'Connecte-toi avec la méthode utilisée à la création de ton compte.';
    case 'auth/too-many-requests':
      return 'Attends quelques instants avant de réessayer.';
  }

  if (error?.name === 'auth-popup-timeout') {
    return `La fenêtre ${label} ne répond plus. Ferme-la, puis réessaie.`;
  }
  return `La connexion avec ${label} a échoué. Réessaie ou contacte le support si le problème persiste.`;
}
