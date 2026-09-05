const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const badReturn = `  return (
    <{/* NOUVEAU HEADER : LinearGradient Mon Profil + Wallet */}`;

const goodReturn = `  return (
    <View style={styles.root}>
      <ImageBackground source={require('../../assets/images/bg_home.png')} style={styles.container} resizeMode="cover">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* NOUVEAU HEADER : LinearGradient Mon Profil + Wallet */}`;

if (code.includes(badReturn)) {
  code = code.replace(badReturn, goodReturn);
  fs.writeFileSync('src/app/dashboard.tsx', code);
  console.log("Fixed dashboard return!");
} else {
  console.log("Could not find bad return.");
}
