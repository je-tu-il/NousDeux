const fs = require('fs');
let code = fs.readFileSync('src/components/StreakCalendar.tsx', 'utf8');

// Inside component inject styles
if (!code.includes('const styles = getStyles(compact);')) {
  code = code.replace(
    'const now = new Date();',
    'const styles = getStyles(compact);\n  const now = new Date();'
  );
}

// Replace global styles
if (code.includes('const styles = StyleSheet.create({')) {
  code = code.replace(
    'const styles = StyleSheet.create({',
    'const getStyles = (compact: boolean) => StyleSheet.create({'
  );
}

fs.writeFileSync('src/components/StreakCalendar.tsx', code);
console.log("Fixed StreakCalendar.tsx!");
