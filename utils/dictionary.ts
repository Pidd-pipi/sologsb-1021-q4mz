import type { DictionaryEntry, DuplicatePair, ReviewComment } from '~/types/dictionary';

/** 可被逐字段审校的字段 */
export const REVIEW_FIELDS = [
  'headword', 'pronunciation', 'partOfSpeech', 'definition',
  'dialectVariants', 'examples', 'sources', 'synonyms', 'notes'
] as const;

export type ReviewField = (typeof REVIEW_FIELDS)[number];

export const FIELD_LABELS: Record<string, string> = {
  headword: '词形',
  pronunciation: '发音',
  partOfSpeech: '词性',
  definition: '释义',
  dialectVariants: '方言变体',
  examples: '例句',
  sources: '来源',
  synonyms: '同义词',
  notes: '备注'
};

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

/** 取出词条某字段当前的结构化值 */
export const getFieldValue = (entry: DictionaryEntry, field: string): unknown => {
  if (field in entry) return (entry as Record<string, unknown>)[field];
  return undefined;
};

/** 把字段值序列化成便于审校对照的文本 */
export const serializeFieldValue = (field: string, value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (field === 'synonyms') return (value as string[]).join('、');
    if (field === 'dialectVariants') {
      return (value as DictionaryEntry['dialectVariants'])
        .map((item) => [item.dialect, item.form, item.pronunciation].filter(Boolean).join(' / '))
        .filter(Boolean)
        .join('；');
    }
    if (field === 'examples') {
      return (value as DictionaryEntry['examples'])
        .map((item) => [item.text, item.translation].filter(Boolean).join(' — '))
        .filter(Boolean)
        .join('；');
    }
    if (field === 'sources') {
      return (value as DictionaryEntry['sources'])
        .map((item) => [item.title, item.citation].filter(Boolean).join('：'))
        .filter(Boolean)
        .join('；');
    }
    return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('；');
  }
  return String(value);
};

export const sameFieldValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 意见锚定的那一版字段内容，是否已经和当前字段不一致（即需要复核） */
export const isCommentStale = (entry: DictionaryEntry, comment: ReviewComment) => {
  if (!comment.anchor) return false;
  return !sameFieldValue(comment.anchor.value, getFieldValue(entry, comment.field));
};

/** 界面上的有效状态：resolved 但字段已变 → stale；其余沿用存储状态 */
export type EffectiveCommentStatus = ReviewCommentStatus | 'stale';

export const effectiveCommentStatus = (entry: DictionaryEntry, comment: ReviewComment): EffectiveCommentStatus => {
  if (isCommentStale(entry, comment)) return 'stale';
  return comment.status;
};

/** 仍需处理的意见：未解决的，或字段已变、等待主审复核的 */
export const isCommentPending = (entry: DictionaryEntry, comment: ReviewComment) => {
  if (comment.status === 'open') return true;
  return isCommentStale(entry, comment);
};

export const countPendingComments = (entry: DictionaryEntry) =>
  entry.reviewerComments.filter((comment) => isCommentPending(entry, comment)).length;

export const normalizeWord = (value: string) => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s·.'’\-_()[\]{}，。！？、]/g, '');

const bigrams = (value: string) => {
  const text = normalizeWord(value);
  if (text.length < 2) return text ? [text] : [];
  return Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2));
};

export const similarity = (left: string, right: string) => {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.length || !b.length) return 0;
  const remaining = [...b];
  let hits = 0;
  a.forEach((token) => {
    const index = remaining.indexOf(token);
    if (index >= 0) {
      hits += 1;
      remaining.splice(index, 1);
    }
  });
  return (2 * hits) / (a.length + b.length);
};

export const findDuplicates = (entries: DictionaryEntry[]): DuplicatePair[] => {
  const pairs: DuplicatePair[] = [];
  entries.forEach((left, index) => {
    entries.slice(index + 1).forEach((right) => {
      const headwordScore = similarity(left.headword, right.headword);
      const synonymScore = Math.max(0, ...left.synonyms.map((word) => similarity(word, right.headword)), ...right.synonyms.map((word) => similarity(word, left.headword)));
      const meaningScore = similarity(left.definition, right.definition) * .35;
      const score = Math.max(headwordScore, synonymScore * .92, meaningScore);
      if (score < .62) return;
      const reasons: string[] = [];
      if (headwordScore === score) reasons.push('词形高度相似');
      if (synonymScore * .92 === score) reasons.push('同义词交叉命中');
      if (meaningScore === score) reasons.push('释义相近');
      if (left.pronunciation && right.pronunciation && similarity(left.pronunciation, right.pronunciation) > .72) reasons.push('发音相近');
      pairs.push({ leftId: left.id, rightId: right.id, score: Math.min(1, score), reasons });
    });
  });
  return pairs.sort((a, b) => b.score - a.score);
};

export const referencesToEntry = (entries: DictionaryEntry[], target: DictionaryEntry) => {
  const names = new Set([target.headword, ...target.synonyms].map(normalizeWord));
  return entries.filter((entry) => entry.id !== target.id && (
    entry.synonyms.some((synonym) => names.has(normalizeWord(synonym)))
    || entry.definition.includes(target.headword)
    || entry.examples.some((example) => names.has(normalizeWord(example.source)))
  ));
};
