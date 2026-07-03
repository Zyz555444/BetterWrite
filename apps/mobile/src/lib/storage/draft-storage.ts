import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_PREFIX = '@betterwrite/draft/';

export interface LocalDraft {
  taskId: string;
  content: string;
  wordCount: number;
  durationMs: number;
  savedAt: string;
}

function key(taskId: string): string {
  return `${DRAFT_PREFIX}${taskId}`;
}

export async function saveLocalDraft(
  taskId: string,
  body: { content: string; wordCount: number; durationMs: number },
): Promise<void> {
  try {
    const draft: LocalDraft = {
      taskId,
      content: body.content,
      wordCount: body.wordCount,
      durationMs: body.durationMs,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key(taskId), JSON.stringify(draft));
    console.log(`[DraftStorage] saved taskId=${taskId} words=${body.wordCount}`);
  } catch (err) {
    console.warn(`[DraftStorage] saveLocalDraft error taskId=${taskId}`, err);
  }
}

export async function getLocalDraft(taskId: string): Promise<LocalDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(taskId));
    if (!raw) return null;
    return JSON.parse(raw) as LocalDraft;
  } catch (err) {
    console.warn(`[DraftStorage] getLocalDraft error taskId=${taskId}`, err);
    return null;
  }
}

export async function removeLocalDraft(taskId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(taskId));
    console.log(`[DraftStorage] removed taskId=${taskId}`);
  } catch (err) {
    console.warn(`[DraftStorage] removeLocalDraft error taskId=${taskId}`, err);
  }
}

export async function listLocalDrafts(): Promise<LocalDraft[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const draftKeys = allKeys.filter((k) => k.startsWith(DRAFT_PREFIX));
    if (draftKeys.length === 0) return [];
    const entries = await AsyncStorage.multiGet(draftKeys);
    const drafts: LocalDraft[] = [];
    for (const [, raw] of entries) {
      if (raw) {
        try {
          drafts.push(JSON.parse(raw) as LocalDraft);
        } catch (err) {
          console.warn('[DraftStorage] parse error, skipping', err);
        }
      }
    }
    return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch (err) {
    console.warn('[DraftStorage] listLocalDrafts error', err);
    return [];
  }
}
