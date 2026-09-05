const fs = require('fs');
let code = fs.readFileSync('src/app/settings.tsx', 'utf8');

if (!code.includes('const [showComingSoon, setShowComingSoon]')) {
  // Find where other states are declared, e.g. setSavedIndicator
  code = code.replace(
    "const [savedIndicator, setSavedIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');",
    "const [savedIndicator, setSavedIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');\n  const [showComingSoon, setShowComingSoon] = useState(false);"
  );
  fs.writeFileSync('src/app/settings.tsx', code);
  console.log("Added showComingSoon state!");
} else {
  console.log("Already present.");
}
