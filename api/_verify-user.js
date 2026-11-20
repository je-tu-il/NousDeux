/** Authorize from a Firebase ID token, never from a client-supplied UID. */
module.exports = async function verifyUser(req, res, admin) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  try {
    const token = await admin.auth().verifyIdToken(header.slice(7), true);
    if (req.body?.requesterUserId && req.body.requesterUserId !== token.uid) {
      res.status(403).json({ error: 'Account mismatch' });
      return null;
    }
    return token.uid;
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication' });
    return null;
  }
};
