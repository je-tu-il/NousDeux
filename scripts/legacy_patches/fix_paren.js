const fs = require('fs');
let code = fs.readFileSync('src/components/StreakCalendar.tsx', 'utf8');

if (code.includes('{!compact && (<Text style={styles.streakLabel}>')) {
  // Find where it's unclosed
  const start = code.indexOf('{!compact && (<Text style={styles.streakLabel}>');
  const viewEnd = code.indexOf('</View>', start);
  const textEnd = code.lastIndexOf('</Text>', viewEnd);
  
  if (textEnd !== -1) {
    // If it's not closed already
    const checkString = code.substring(textEnd, viewEnd);
    if (!checkString.includes(')}')) {
      code = code.substring(0, textEnd + 7) + ')}' + code.substring(textEnd + 7);
      fs.writeFileSync('src/components/StreakCalendar.tsx', code);
      console.log("Fixed StreakCalendar unclosed paren!");
    } else {
      console.log("Already closed.");
    }
  }
}
