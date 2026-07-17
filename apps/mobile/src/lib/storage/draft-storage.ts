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
    // Bug #259: 长期使用会积累数千条草稿，导致 multiGet 一次性 JSON.parse 引发
    // OOM（Android 上比较常见）。仅取最近 100 条 + 过期草稿跳过：savedAt > now-30d
    // 才保留，否则视为残留可清理（已超过 30 天的本地草稿大概率已被云端接管）。
    const RECENT_LIMIT = 100;
    const RECENT_DAYS = 30;
    const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const allKeys = await AsyncStorage.getAllKeys();
    const draftKeys = allKeys.filter((k) => k.startsWith(DRAFT_PREFIX));
    if (draftKeys.length === 0) return [];
    const entries = await AsyncStorage.multiGet(draftKeys);
    const drafts: LocalDraft[] = [];
    const expiredKeys: string[] = [];
    for (const [k, raw] of entries) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as LocalDraft;
        const savedMs = Date.parse(parsed.savedAt);
        if (Number.isFinite(savedMs) && savedMs < cutoff) {
          expiredKeys.push(k);
          continue;
        }
        drafts.push(parsed);
      } catch (err) {
        // 单条解析失败直接丢弃，附 key 一起清掉。
        expiredKeys.push(k);
        console.warn('[DraftStorage] parse error, scheduling cleanup', err);
      }
    }
    // 异步清理过期/损坏条目，不 await（不阻塞调用方）。
    if (expiredKeys.length > 0) {
      void AsyncStorage.multiRemove(expiredKeys).catch((err) => {
        console.warn('[DraftStorage] cleanup error', err);
      });
    }
    drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return drafts.slice(0, RECENT_LIMIT);
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
  // Bug #258: 之前顺序同步所有本地草稿，100 个 × 1 秒 = 100 秒，UI 转圈很久。
  // 改并发，但限制并发数为 5（避免同时 push 触发后端 rateLimit 5/min 把同 IP
  // 后续请求全部挡掉；正好对得上学生 save draft 的 30/min 限流上限）。
  const drafts = await listLocalDrafts();
  const CONCURRENCY = 5;
  let synced = 0;
  let failed = 0;
  for (let i = 0; i < drafts.length; i += CONCURRENCY) {
    const slice = drafts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((d) => syncDraftToCloud(d.taskId)));
    for (const ok of results) {
      if (ok) synced++;
      else failed++;
    }
  }
  return { synced, failed };
}
