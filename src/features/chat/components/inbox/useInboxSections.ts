import { useCallback, useState } from 'react';

export type InboxSectionKey = 'pinned' | 'channels' | 'groups' | 'direct';

export const INBOX_SECTION_ORDER: readonly InboxSectionKey[] = [
  'pinned',
  'channels',
  'groups',
  'direct',
];

export const INBOX_SECTION_LABEL: Record<InboxSectionKey, string> = {
  pinned: 'Pinned',
  channels: 'Channels',
  groups: 'Groups',
  direct: 'Direct',
};

const STORAGE_KEY = 'voca:inbox-sections';

const readCollapsed = (): InboxSectionKey[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is InboxSectionKey =>
      INBOX_SECTION_ORDER.includes(value as InboxSectionKey)
    );
  } catch {
    return [];
  }
};

/** Remembers which inbox sections the user folded away, across reloads. */
export function useInboxSections() {
  const [collapsed, setCollapsed] = useState<InboxSectionKey[]>(readCollapsed);

  const toggleSection = useCallback((key: InboxSectionKey) => {
    setCollapsed((current) => {
      const next = current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key];

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (key: InboxSectionKey) => collapsed.includes(key),
    [collapsed]
  );

  return { isCollapsed, toggleSection };
}
