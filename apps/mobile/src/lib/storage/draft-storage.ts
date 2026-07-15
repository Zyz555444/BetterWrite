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

export async function syncDraftToCloud(taskId: string): Promise<boolean> {
  try {
    const local = await getLocalDraft(taskId);
    if (!local) {
      return false;
    }
    const { fetcher } = await import('../api/fetcher');
    const res = await fetcher.saveDraft(taskId, {
      content: local.content,
      wordCount: local.wordCount,
      durationMs: local.durationMs,
    });
    if (res.success) {
      return true;
    }
    console.warn(`[DraftStorage] sync failed taskId=${taskId}:`, res.error);
    return false;
  } catch (err) {
    console.warn(`[DraftStorage] syncDraftToCloud error taskId=${taskId}`, err);
    return false;
  }
}

export async function loadDraftWithSync(taskId: string): Promise<LocalDraft | null> {
  try {
    const { fetcher } = await import('../api/fetcher');
    const cloudRes = await fetcher.getDraft(taskId);
    if (cloudRes.success && cloudRes.data) {
      const cloud = cloudRes.data;
      const local = await getLocalDraft(taskId);
      if (local && local.savedAt > cloud.updatedAt) {
        return local;
      }
      return {
        taskId,
        content: cloud.content,
        wordCount: cloud.wordCount ?? 0,
        durationMs: cloud.durationMs ?? 0,
        savedAt: cloud.updatedAt,
      };
    }
    return getLocalDraft(taskId);
  } catch (err) {
    console.warn(`[DraftStorage] loadDraftWithSync error taskId=${taskId}`, err);
    return getLocalDraft(taskId);
  }
}

export async function syncAllDrafts(): Promise<{ synced: number; failed: number }> {
  const drafts = await listLocalDrafts();
  let synced = 0;
  let failed = 0;
  for (const draft of drafts) {
    const ok = await syncDraftToCloud(draft.taskId);
    if (ok) synced++;
    else failed++;
  }
  return { synced, failed };
}
