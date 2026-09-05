const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  '<{/* NOUVEAU HEADER', 
  '<View style={styles.root}><ImageBackground source={require(\'../../assets/images/bg_home.png\')} style={styles.container} resizeMode="cover"><ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>{/* NOUVEAU HEADER'
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed dashboard return again!");
