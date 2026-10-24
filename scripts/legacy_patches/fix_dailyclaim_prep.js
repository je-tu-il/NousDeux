const fs = require('fs');
let code = fs.readFileSync('src/components/DailyClaim.tsx', 'utf8');

// 1. Add compact to DailyClaimProps
if (!code.includes('compact?: boolean;')) {
  code = code.replace(
    'interface DailyClaimProps {',
    'interface DailyClaimProps {\n  compact?: boolean;'
  );
}

// 2. Destructure compact
code = code.replace(
  '({ coupleId, myUid, wallet, onClaimed }: DailyClaimProps)',
  '({ coupleId, myUid, wallet, onClaimed, compact = false }: DailyClaimProps)'
);

// 3. Fix the render error: the styles cannot dynamically use `compact` from outside.
// Let's replace the inline styles where we injected `compact` with a cleaner approach.
// But wait, the `compact ? ... : ...` strings were injected INSIDE StyleSheet.create!
// I need to undo the StyleSheet.create modification and move the logic inline or into a function.

// Since I injected compact dynamically into the style sheet, let's revert StyleSheet.create to a function:
code = code.replace(
  'const styles = StyleSheet.create({',
  'const getStyles = (compact: boolean) => StyleSheet.create({'
);

// We must also find where `styles` is used and change it to `getStyles(compact)`.
// But an easier way in React Native is just to memoize it inside the component:
// Or since the component uses `styles.something`, let's just make `styles` local to the component.

// Actually, `getStyles(compact)` would be best.
// Let's change the `const styles = StyleSheet.create({` block to `const getStyles = (compact?: boolean) => StyleSheet.create({`
// and then inside the component, `const styles = useMemo(() => getStyles(compact), [compact]);`

// But we can also just revert the strings! Let's check how many times `styles.` is used.
