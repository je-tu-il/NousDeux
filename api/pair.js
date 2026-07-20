const admin = require('firebase-admin');

// Initialize Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}
const db = admin.firestore();

/**
 * Serverless Function to handle atomic pairing
 * POST payload: { code: string, requesterUserId: string }
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, requesterUserId } = req.body;
  if (!code || !requesterUserId) {
    return res.status(400).json({ error: 'Missing code or requesterUserId' });
  }

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

      // Create new couple
      const coupleRef = db.collection('couples').doc();
      t.set(coupleRef, {
        partnerA: partnerUserId,
        partnerB: requesterUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update both users
      const userARef = db.collection('users').doc(partnerUserId);
      const userBRef = db.collection('users').doc(requesterUserId);
      
      t.update(userARef, { coupleId: coupleRef.id });
      t.update(userBRef, { coupleId: coupleRef.id });
      
      // Delete the consumed code
      t.delete(codeRef);

      return coupleRef.id;
    });

    return res.status(200).json({ success: true, coupleId: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
