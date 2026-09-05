import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export type LegacyActivityMigrationOptions = {
  legacyCollectionPath: string;
  coupleId: string;
  dryRun?: boolean;
};

export type LegacyActivityMigrationReport = {
  scanned: number;
  detected: number;
  written: number;
  dates: string[];
  skipped: string[];
};

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})[-/_](\d{1,2})[-/_](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getLegacyDate(id: string, data: Record<string, unknown>): string | null {
  for (const value of [id, data.date, data.day, data.dateKey, data.activityDate, data.createdAt]) {
    const normalized = normalizeDate(value);
    if (normalized) return normalized;
  }
  return null;
}

function isCompleted(data: Record<string, unknown>): boolean {
  if (data.bothAnswered === true || data.answered === true || data.complete === true || data.completed === true) return true;
  const answers = data.answers;
  if (Array.isArray(answers) && answers.length >= 2) return true;
  if (answers && typeof answers === 'object' && Object.keys(answers).length >= 2) return true;
  return Boolean(data.answer && data.partnerAnswer);
}

export async function migrateLegacyActivity({ legacyCollectionPath, coupleId, dryRun = true }: LegacyActivityMigrationOptions): Promise<LegacyActivityMigrationReport> {
  const snapshot = await getDocs(collection(db, legacyCollectionPath));
  const report: LegacyActivityMigrationReport = { scanned: snapshot.size, detected: 0, written: 0, dates: [], skipped: [] };
  const targets = new Map<string, string>();

  snapshot.docs.forEach((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const date = getLegacyDate(entry.id, data);
    if (!date || !isCompleted(data)) {
      report.skipped.push(entry.id);
      return;
    }
    report.detected++;
    targets.set(date, entry.id);
  });

  report.dates = [...targets.keys()].sort();
  if (dryRun || targets.size === 0) return report;

  let batch = writeBatch(db);
  let batchSize = 0;
  for (const [date, legacyId] of targets) {
    batch.set(doc(db, 'couples', coupleId, 'daily', date), {
      bothAnswered: true,
      migratedFrom: `${legacyCollectionPath}/${legacyId}`,
      migratedAt: new Date().toISOString(),
    }, { merge: true });
    batchSize++;
    report.written++;
    if (batchSize === 400) {
      await batch.commit();
      batch = writeBatch(db);
      batchSize = 0;
    }
  }
  if (batchSize > 0) await batch.commit();
  return report;
}
