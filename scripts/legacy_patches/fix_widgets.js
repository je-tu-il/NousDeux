const fs = require('fs');

// --- 1. Modify StreakCalendar.tsx ---
let streakCode = fs.readFileSync('src/components/StreakCalendar.tsx', 'utf8');

if (!streakCode.includes('compact?: boolean')) {
  streakCode = streakCode.replace(
    'showFullCalendar?: boolean;',
    'showFullCalendar?: boolean;\n  compact?: boolean;'
  );

  streakCode = streakCode.replace(
    'export default function StreakCalendar({ coupleId, showFullCalendar = false }: Props)',
    'export default function StreakCalendar({ coupleId, showFullCalendar = false, compact = false }: Props)'
  );

  streakCode = streakCode.replace(
    'const daysToShow = Math.min(Math.max(streak, 1), 7);',
    'const daysToShow = compact ? Math.min(Math.max(streak, 1), 3) : Math.min(Math.max(streak, 1), 7);'
  );

  // Hide label if compact
  streakCode = streakCode.replace(
    '<Text style={styles.streakLabel}>',
    '{!compact && (<Text style={styles.streakLabel}>'
  );
  streakCode = streakCode.replace(
    '</Text>\n        </View>',
    '</Text>)}\n        </View>'
  );

  // Adjust padding/margin
  streakCode = streakCode.replace(
    'container: {',
    "container: {\n      flex: 1,\n      alignItems: compact ? 'center' : 'stretch',\n      justifyContent: 'center',\n      paddingVertical: compact ? 12 : 16,\n      paddingHorizontal: compact ? 12 : 16,"
  );
  streakCode = streakCode.replace(
    "padding: 16,",
    ""
  );
  streakCode = streakCode.replace(
    "marginBottom: 20,",
    "marginBottom: compact ? 0 : 20,"
  );
  streakCode = streakCode.replace(
    "streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },",
    "streakRow: { flexDirection: compact ? 'column' : 'row', alignItems: 'center', gap: compact ? 2 : 8, marginBottom: compact ? 8 : 14 },"
  );
  streakCode = streakCode.replace(
    "miniRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 6, marginBottom: 4 },",
    "miniRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 0 },"
  );
  
  fs.writeFileSync('src/components/StreakCalendar.tsx', streakCode);
}


// --- 2. Modify DailyClaim.tsx ---
let dailyCode = fs.readFileSync('src/components/DailyClaim.tsx', 'utf8');

if (!dailyCode.includes('compact?: boolean')) {
  dailyCode = dailyCode.replace(
    'export default function DailyClaim() {',
    'export default function DailyClaim({ compact = false }: { compact?: boolean }) {'
  );

  // Change styles of trigger based on compact
  dailyCode = dailyCode.replace(
    "triggerBox: { marginHorizontal: 16, marginBottom: 16,",
    "triggerBox: { marginHorizontal: compact ? 0 : 16, marginBottom: compact ? 0 : 16, flex: 1, height: '100%',"
  );
  dailyCode = dailyCode.replace(
    "triggerGradient: { padding: 16, flexDirection: 'row', alignItems: 'center' },",
    "triggerGradient: { padding: compact ? 12 : 16, flexDirection: compact ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },"
  );
  dailyCode = dailyCode.replace(
    "triggerContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },",
    "triggerContent: { flexDirection: compact ? 'column' : 'row', alignItems: 'center', flex: 1, gap: compact ? 6 : 0 },"
  );
  dailyCode = dailyCode.replace(
    "marginLeft: 12",
    "marginLeft: compact ? 0 : 12, alignItems: compact ? 'center' : 'flex-start'"
  );
  dailyCode = dailyCode.replace(
    "color: 'white', fontSize: 16, fontWeight: '800'",
    "color: 'white', fontSize: compact ? 14 : 16, fontWeight: '800', textAlign: 'center'"
  );
  dailyCode = dailyCode.replace(
    "color: 'rgba(255,255,255,0.9)', fontSize: 13,",
    "color: 'rgba(255,255,255,0.9)', fontSize: compact ? 10 : 13, textAlign: 'center',"
  );
  
  fs.writeFileSync('src/components/DailyClaim.tsx', dailyCode);
}


// --- 3. Modify dashboard.tsx ---
let dashCode = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const dashTarget = `<DailyClaim />

        {/* --- STREAK & CALENDRIER --- */}
        <Link href="/calendar" asChild>
          <Pressable>
            <StreakCalendar coupleId={partner.coupleId} />
          </Pressable>
        </Link>`;

const dashReplacement = `{/* --- WIDGETS LIGNE --- */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 12 }}>
          {/* STREAK */}
          <Link href="/calendar" asChild>
            <Pressable style={{ flex: 1 }}>
              <StreakCalendar coupleId={partner.coupleId} compact={true} />
            </Pressable>
          </Link>

          {/* ROULETTE */}
          <View style={{ flex: 1 }}>
            <DailyClaim compact={true} />
          </View>
        </View>`;

if (dashCode.includes('<DailyClaim />')) {
  dashCode = dashCode.replace(dashTarget, dashReplacement);
  fs.writeFileSync('src/app/dashboard.tsx', dashCode);
}

console.log("Widgets side-by-side done");
