const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

// Find the start and end of the header banner block
const startText = "{/* NOUVEAU HEADER : LinearGradient avec Partenaire + R";
const startIndex = code.indexOf(startText);
// The block ends at </LinearGradient>
const endText = "</LinearGradient>";
const endIndex = code.indexOf(endText, startIndex) + endText.length;

if (startIndex !== -1 && endIndex !== -1) {
  const originalBlock = code.substring(startIndex, endIndex);

  const getDaysSince = `
  const getDaysSince = (dateString?: string) => {
    if (!dateString) return '0';
    const diff = new Date().getTime() - new Date(dateString).getTime();
    return Math.floor(diff / (1000 * 3600 * 24)).toString();
  };
  `;

  // We need to inject this helper if it doesn't exist
  if (!code.includes('const getDaysSince')) {
    code = code.replace("const formattedDate = partner?.coupleDate", getDaysSince + "\n  const formattedDate = partner?.coupleDate");
  }

  const newHeader = `{/* NOUVEAU HEADER : LinearGradient Mon Profil + Wallet */}
        <LinearGradient
          colors={['#FF9A8B', '#FF6A88']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.headerBanner}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* Mon Profil */}
            <Pressable
              style={[styles.partnerBadge, { flex: 1, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, padding: 0 }]}
              onPress={() => setShowMyProfile(true)}
            >
              {renderAvatar(store.avatarUrl, store.pseudo || 'Moi', false, myProfile)}
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }} numberOfLines={1}>{store.pseudo}</Text>
                {myProfile?.selectedTag && getCosmeticById(myProfile.selectedTag) && (
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 }} numberOfLines={1}>
                    {getCosmeticById(myProfile.selectedTag)?.emoji} {getCosmeticById(myProfile.selectedTag)?.name}
                  </Text>
                )}
              </View>
            </Pressable>

            {/* Wallet */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 20 }}>
              <CoinWallet petals={wallet?.petals ?? 0} size="small" theme="white" />
            </View>
          </View>
        </LinearGradient>

        {/* --- LIGNE EN COUPLE + REGLAGES --- */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 12 }}>
          {/* BLOC 1: EN COUPLE AVEC (Plus large, flex: 2) */}
          <Pressable 
            style={{ flex: 2, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
            onPress={() => setShowPartnerProfile(true)}
          >
            {renderAvatar(partner?.avatarUrl, partner?.pseudo || '?', true, partnerProfile)}
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: '#4A3B39', fontSize: 13, fontWeight: '600' }}>En couple avec</Text>
              <Text style={{ color: '#FF6A88', fontSize: 16, fontWeight: 'bold' }} numberOfLines={1}>{partner?.pseudo}</Text>
              <Text style={{ color: '#A99693', fontSize: 11, marginTop: 2 }}>{getDaysSince(partner?.coupleDate)} jours</Text>
            </View>
          </Pressable>

          {/* BLOC 2: REGLAGES (Moins large, flex: 1) */}
          <Pressable 
            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 20, padding: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
            onPress={() => router.push('/settings')}
          >
            <Settings color="#FF6A88" size={32} />
            <Text style={{ color: '#4A3B39', fontSize: 12, marginTop: 6, fontWeight: '700' }}>Réglages</Text>
          </Pressable>
        </View>`;

  // Actually replace it in the code
  const reCoded = code.substring(0, startIndex) + newHeader + code.substring(endIndex);
  fs.writeFileSync('src/app/dashboard.tsx', reCoded);
  console.log("Successfully replaced header layout!");
} else {
  console.log("Could not find start/end index.");
}
