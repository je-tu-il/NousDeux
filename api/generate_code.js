const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const admin = { auth: getAuth };
const crypto = require('crypto');
const verifyUser = require('./_verify-user');

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault()
  });
}
const db = getFirestore();

// Generates a 6-character alphanumeric code
function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requesterUserId = await verifyUser(req, res, admin);
  if (!requesterUserId) return;

  try {
    const code = generateCode();
    // Valid for 15 minutes
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await db.collection('pairing_codes').doc(code).set({
      userId: requesterUserId,
      expiresAt: expiresAt,
      createdAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, code, expiresAt });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
