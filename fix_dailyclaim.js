const fs = require('fs');
let code = fs.readFileSync('src/components/DailyClaim.tsx', 'utf8');

// Props
if (!code.includes('compact?: boolean;')) {
  code = code.replace(
    'interface DailyClaimProps {',
    'interface DailyClaimProps {\n  compact?: boolean;'
  );
}

// Destructure
if (!code.includes('compact = false')) {
  code = code.replace(
    '{ coupleId, myUid, wallet, onClaimed }: DailyClaimProps',
    '{ coupleId, myUid, wallet, onClaimed, compact = false }: DailyClaimProps'
  );
}

// Inside component inject styles
if (!code.includes('const styles = getStyles(compact);')) {
  code = code.replace(
    'const today = new Date()',
    'const styles = getStyles(compact);\n  const today = new Date()'
  );
}

// Replace global styles
if (code.includes('const styles = StyleSheet.create({')) {
  code = code.replace(
    'const styles = StyleSheet.create({',
    'const getStyles = (compact: boolean) => StyleSheet.create({'
  );
}

fs.writeFileSync('src/components/DailyClaim.tsx', code);
console.log("Fixed DailyClaim.tsx!");
