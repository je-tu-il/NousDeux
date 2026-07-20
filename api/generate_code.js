const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}
const db = admin.firestore();

// Generates a 6-character alphanumeric code
function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { requesterUserId } = req.body;
  if (!requesterUserId) {
    return res.status(400).json({ error: 'Missing requesterUserId' });
  }

  try {
    const code = generateCode();
    // Valid for 15 minutes
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await db.collection('pairing_codes').doc(code).set({
      userId: requesterUserId,
      expiresAt: expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, code, expiresAt });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
