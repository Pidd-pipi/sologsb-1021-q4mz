import type { DictionaryEntry, DuplicatePair, ReviewComment } from '~/types/dictionary';

/** 可被审校意见锚定的字段 */
export const REVIEW_FIELDS = [
  'headword', 'pronunciation', 'partOfSpeech', 'definition', 'dialectVariants', 'examples', 'sources', 'synonyms', 'notes'
] as const;

export type ReviewField = (typeof REVIEW_FIELDS)[number];

export const FIELD_LABELS: Record<string, string> = {
  headword: '词形', pronunciation: '发音', partOfSpeech: '词性', definition: '释义', dialectVariants: '方言变体', examples: '例句', sources: '来源', synonyms: '同义词', notes: '备注'
};

/** 把任一字段序列化为可稳定比对、可展示的文本版本 */
export const serializeField = (entry: DictionaryEntry, field: string): string => {
  switch (field) {
    case 'dialectVariants':
      return entry.dialectVariants
        .map((variant) => [variant.dialect, variant.form, variant.pronunciation, variant.note].map((part) => part.trim()).filter(Boolean).join('｜'))
        .filter(Boolean)
        .join('\n');
    case 'examples':
      return entry.examples
        .map((example) => [example.text, example.translation, example.source].map((part) => part.trim()).filter(Boolean).join(' — '))
        .filter(Boolean)
        .join('\n');
    case 'sources':
      return entry.sources
        .map((source) => [source.title, source.citation, source.url].map((part) => part.trim()).filter(Boolean).join('｜'))
        .filter(Boolean)
        .join('\n');
    case 'synonyms':
      return entry.synonyms.join('、');
    default:
      return String((entry as Record<string, unknown>)[field] ?? '');
  }
};

/** 主审尚未处理完的意见：未决（open）或字段已变化需复核（resolved 但 needsRecheck） */
export const isBlockingComment = (comment: ReviewComment) => comment.status === 'open' || !!comment.needsRecheck;

export const blockingCommentCount = (entry: DictionaryEntry) => entry.reviewerComments.filter(isBlockingComment).length;

export const entryCanConfirm = (entry: DictionaryEntry) => blockingCommentCount(entry) === 0;


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
