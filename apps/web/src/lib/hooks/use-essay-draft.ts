'use client';

import { fetcher } from '@/lib/api/fetcher';
import { countWords } from '@betterwrite/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseEssayDraftOptions {
  taskId: string;
  wordLimitMin: number;
  wordLimitMax: number;
}

export interface UseEssayDraftReturn {
  content: string;
  setContent: (s: string) => void;
  wordCount: number;
  durationMs: number;
  isReady: boolean;
  checklist: Record<string, boolean>;
  toggleCheck: (key: string) => void;
  saveDraft: () => Promise<void>;
  clearDraft: () => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
}

export const ESSAY_CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'points', label: '我是否覆盖了题目所有要点？' },
  { key: 'tense', label: '时态使用是否统一且正确？' },
  { key: 'thirdPerson', label: '第三人称单数是否正确？' },
  { key: 'connectors', label: '连接词是否使用恰当？' },
  { key: 'wordCount', label: '字数是否达标？' },
  { key: 'spelling', label: '拼写是否已检查？' },
];

const AUTOSAVE_DEBOUNCE_MS = 2000;
const TIMER_INTERVAL_MS = 1000;

function createInitialChecklist(): Record<string, boolean> {
  const init: Record<string, boolean> = {};
  for (const item of ESSAY_CHECKLIST_ITEMS) {
    init[item.key] = false;
  }
  return init;
}

export function useEssayDraft(options: UseEssayDraftOptions): UseEssayDraftReturn {
  const { taskId, wordLimitMin } = options;

  const [content, setContentState] = useState('');
  const [durationMs, setDurationMs] = useState(0);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(createInitialChecklist);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const contentRef = useRef(content);
  const durationMsRef = useRef(durationMs);
  const lastSavedContentRef = useRef<string | null>(null);
  contentRef.current = content;
  durationMsRef.current = durationMs;

  const wordCount = countWords(content);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    console.log(`[useEssayDraft] loadDraft taskId=${taskId}`);
    fetcher
      .getDraft(taskId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const draft = res.data;
          lastSavedContentRef.current = draft.content;
          setContentState(draft.content);
          if (draft.durationMs !== null && draft.durationMs !== undefined) {
            setDurationMs(draft.durationMs);
          }
        } else {
          lastSavedContentRef.current = '';
        }
      })
      .catch((err) => {
        console.warn('[useEssayDraft] loadDraft failed', err);
        lastSavedContentRef.current = '';
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setInterval(() => {
      setDurationMs((prev) => prev + TIMER_INTERVAL_MS);
    }, TIMER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isLoaded]);

  const saveDraft = useCallback(async () => {
    const currentContent = contentRef.current;
    if (currentContent.trim().length === 0) {
      console.log(`[useEssayDraft] saveDraft skipped empty content taskId=${taskId}`);
      return;
    }
    const currentWordCount = countWords(currentContent);
    console.log(
      `[useEssayDraft] saveDraft taskId=${taskId} wordCount=${currentWordCount} durationMs=${durationMsRef.current}`,
    );
    setIsSaving(true);
    try {
      await fetcher.saveDraft(taskId, {
        content: currentContent,
        wordCount: currentWordCount,
        durationMs: durationMsRef.current,
      });
      lastSavedContentRef.current = currentContent;
    } catch (err) {
      console.warn('[useEssayDraft] saveDraft failed', err);
    } finally {
      setIsSaving(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (lastSavedContentRef.current === null) return;
    if (content === lastSavedContentRef.current) return;
    const timer = setTimeout(() => {
      void saveDraft();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content, isLoaded, saveDraft]);

  const clearDraft = useCallback(async () => {
    console.log(`[useEssayDraft] clearDraft taskId=${taskId}`);
    try {
      await fetcher.deleteDraft(taskId);
      lastSavedContentRef.current = null;
      setContentState('');
      setDurationMs(0);
      setChecklist(createInitialChecklist());
    } catch (err) {
      console.warn('[useEssayDraft] clearDraft failed', err);
    }
  }, [taskId]);

  const setContent = useCallback((s: string) => {
    setContentState(s);
  }, []);

  const toggleCheck = useCallback((key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const allChecked = ESSAY_CHECKLIST_ITEMS.every((item) => checklist[item.key] === true);
  const isReady = allChecked && wordCount >= wordLimitMin;

  return {
    content,
    setContent,
    wordCount,
    durationMs,
    isReady,
    checklist,
    toggleCheck,
    saveDraft,
    clearDraft,
    isLoading: !isLoaded,
    isSaving,
  };
}
