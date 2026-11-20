const fs = require('node:fs');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function main() {
  const projectId = 'demo-nousdeux';
  initializeApp({ projectId });
  const db = getFirestore();
  const people = [];
  for (const [name, code] of [['Camille', 'TEST01'], ['Alex', 'TEST02']]) {
    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${name.toLowerCase()}-${Date.now()}@example.invalid`, password: 'local-tests-only-123', returnSecureToken: true }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    people.push({ ...result, name, code });
  }
  const coupleId = people.map((person) => person.localId).sort().join('_');
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    await db.doc(`users/${p.localId}`).set({ pseudo: p.name, age: '27', pairingCode: p.code, linkedTo: people[1 - i].localId, coupleDate: '2025-01-01', linkedAt: new Date().toISOString(), needsDate: false });
    await db.doc(`pairing_codes/${p.code}`).set({ creatorUid: p.localId });
    await db.doc(`userProfiles/${p.localId}`).set({ selectedBackground: 'bg_free_1', selectedBorder: 'bd_free_1', selectedTag: 'tag_free_0', selectedWidget: 'widget_streak_7' });
  }
  await db.doc(`couples/${coupleId}`).set({ createdAt: new Date().toISOString() });
  await db.doc(`couples/${coupleId}/economy/wallet`).set({ petals: 5000, totalEarned: 5000, streak: 7, lastClaimDate: '' });
  await db.doc(`couples/${coupleId}/inventory/cosmetics`).set({ backgrounds: ['bg_free_1'], borders: ['bd_free_1'], tags: [], widgets: ['widget_default', 'widget_streak_7'] });
  fs.writeFileSync('.expo/test-accounts.json', JSON.stringify({ people, coupleId }, null, 2));
  console.log('Two fictitious accounts ready in demo-nousdeux (localhost only).');
  await db.terminate();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
