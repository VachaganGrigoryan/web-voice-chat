/**
 * Background styles for a short text-only post.
 *
 * The style is stored as an identifier, never as CSS, so the set can grow
 * without a schema change and an older client that does not recognise an id
 * renders the text plainly instead of failing. That degradation rule is in the
 * `chat-messaging` delta.
 */

export type PostStyleId =
  | 'plain'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'grape'
  | 'ink';

export interface PostStyle {
  readonly id: PostStyleId;
  readonly label: string;
  /** Tailwind classes for the filled card. `plain` renders no background. */
  readonly className: string;
  /** A small swatch for the picker. */
  readonly swatchClassName: string;
}

export const POST_STYLES: readonly PostStyle[] = [
  {
    id: 'plain',
    label: 'None',
    className: '',
    swatchClassName: 'bg-muted border border-border',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    className: 'bg-gradient-to-br from-orange-500 to-pink-600 text-white',
    swatchClassName: 'bg-gradient-to-br from-orange-500 to-pink-600',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    className: 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white',
    swatchClassName: 'bg-gradient-to-br from-sky-500 to-indigo-600',
  },
  {
    id: 'forest',
    label: 'Forest',
    className: 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white',
    swatchClassName: 'bg-gradient-to-br from-emerald-500 to-teal-700',
  },
  {
    id: 'grape',
    label: 'Grape',
    className: 'bg-gradient-to-br from-violet-500 to-fuchsia-700 text-white',
    swatchClassName: 'bg-gradient-to-br from-violet-500 to-fuchsia-700',
  },
  {
    id: 'ink',
    label: 'Ink',
    className: 'bg-slate-900 text-slate-50',
    swatchClassName: 'bg-slate-900',
  },
];

const BY_ID = new Map(POST_STYLES.map((style) => [style.id, style]));

export const DEFAULT_POST_STYLE: PostStyleId = 'plain';

/** An unknown id degrades to plain rather than throwing or rendering blank. */
export const resolvePostStyle = (id: string | null | undefined): PostStyle =>
  (id ? BY_ID.get(id as PostStyleId) : undefined) ?? BY_ID.get('plain')!;

/**
 * A background only applies to a short, text-only post — the same rule other
 * products use, and the reason it is decided here rather than at each call site.
 */
export const MAX_STYLED_POST_LENGTH = 280;

export const canStylePost = (text: string, attachmentCount: number): boolean =>
  attachmentCount === 0 && text.trim().length > 0 && text.length <= MAX_STYLED_POST_LENGTH;
