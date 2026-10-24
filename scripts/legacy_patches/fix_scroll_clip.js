const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

// Change safeArea style to NOT have padding, but keep width limits
code = code.replace(
  "safeArea: { flex: 1, padding: 20, paddingTop: Platform.OS === 'web' ? 40 : 60, width: '100%', maxWidth: 500, alignSelf: 'center' },",
  "safeArea: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center' },\n  scrollContent: { padding: 20, paddingTop: Platform.OS === 'web' ? 40 : 60, paddingBottom: 100 },"
);

// Update ScrollView to use scrollContent for contentContainerStyle
code = code.replace(
  "contentContainerStyle={{ paddingBottom: 100 }}",
  "contentContainerStyle={styles.scrollContent}"
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Scroll clipping fixed!");
