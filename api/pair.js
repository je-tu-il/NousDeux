const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const admin = { auth: getAuth };
const verifyUser = require('./_verify-user');

// Initialize Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: applicationDefault()
  });
}
const db = getFirestore();

/**
 * Serverless Function to handle atomic pairing
 * POST payload: { code: string, requesterUserId: string }
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requesterUserId = await verifyUser(req, res, admin);
  if (!requesterUserId) return;
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ error: 'Invalid pairing code' });

  try {
    const codeRef = db.collection('pairing_codes').doc(code);
    const result = await db.runTransaction(async (t) => {
      const codeDoc = await t.get(codeRef);
      if (!codeDoc.exists) {
        throw new Error('Code invalid or expired');
      }
      
      const { userId: partnerUserId, expiresAt } = codeDoc.data();
      
      if (Date.now() > expiresAt) {
        t.delete(codeRef);
        throw new Error('Code expired');
      }
      
      if (partnerUserId === requesterUserId) {
         throw new Error('Cannot pair with yourself');
      }

      // Verify both user documents exist before attempting to link
      const userARef = db.collection('users').doc(partnerUserId);
      const userBRef = db.collection('users').doc(requesterUserId);
      const [userADoc, userBDoc] = await Promise.all([
        t.get(userARef),
        t.get(userBRef),
      ]);

      if (!userADoc.exists) {
        throw new Error('Partner user account not found');
      }
      if (!userBDoc.exists) {
        throw new Error('Your user account not found. Please re-login.');
      }

      // Create new couple
      const coupleRef = db.collection('couples').doc();
      t.set(coupleRef, {
        partnerA: partnerUserId,
        partnerB: requesterUserId,
        createdAt: FieldValue.serverTimestamp()
      });

      // Update both users — use set(merge) for resilience against race conditions
      t.set(userARef, { coupleId: coupleRef.id }, { merge: true });
      t.set(userBRef, { coupleId: coupleRef.id }, { merge: true });
      
      // Delete the consumed code
      t.delete(codeRef);

      return coupleRef.id;
    });

    return res.status(200).json({ success: true, coupleId: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
