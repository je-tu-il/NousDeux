const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

if (!code.includes('headerBanner:')) {
  code = code.replace(
    'const styles = StyleSheet.create({',
    "const styles = StyleSheet.create({\n  headerBanner: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, marginBottom: 20 },"
  );
  fs.writeFileSync('src/app/dashboard.tsx', code);
  console.log("Added headerBanner to styles");
}
