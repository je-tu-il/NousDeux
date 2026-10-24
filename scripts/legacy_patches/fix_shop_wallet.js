const fs = require('fs');
let code = fs.readFileSync('src/app/shop.tsx', 'utf8');

// The original shop header is:
// <Text style={styles.headerTitle}>Boutique</Text>
// </LinearGradient>

code = code.replace(
  '<Text style={styles.headerTitle}>Boutique</Text>',
  '<Text style={styles.headerTitle}>Boutique</Text>\n            <CoinWallet petals={wallet?.petals ?? 0} size="small" theme="white" />'
);

// We should also replace the background in shop.tsx from romantic_calendar_bg to nousdeux_warm_background
code = code.replace(/romantic_calendar_bg\.png/g, 'nousdeux_warm_background.png');

fs.writeFileSync('src/app/shop.tsx', code);
console.log("Shop fixed!");
