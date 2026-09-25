export type EntryStatus = 'draft' | 'review' | 'disputed' | 'confirmed';

export interface DialectVariant {
  id: string;
  dialect: string;
  form: string;
  pronunciation: string;
  note: string;
}

export interface ExampleSentence {
  id: string;
  text: string;
  translation: string;
  source: string;
}

export interface DictionarySource {
  id: string;
  title: string;
  citation: string;
  url: string;
}

export type ReviewCommentStatus = 'open' | 'resolved';

export type ReviewReplyKind = 'reply' | 'decision';

export interface ReviewReply {
  id: string;
  author: string;
  message: string;
  createdAt: string;
  kind?: ReviewReplyKind;
}

/** 字段意见的锚点：意见针对的那一版字段内容 */
export interface CommentAnchor {
  /** 锚定时间（提交待审 / 主审判定的时间） */
  at: string;
  /** 锚定时的修订号，便于对照版本记录 */
  revision?: number;
  /** 结构化原始值，用于与当前字段内容比对 */
  value: unknown;
  /** 供界面展示的文本形式 */
  valueText: string;
  /** 锚点来源说明（提交版、复核通过、合并带入等） */
  note?: string;
  /** 合并词条时记录意见的原始归属 */
  origin?: string;
}

export interface ReviewComment {
  id: string;
  field: string;
  author: string;
  message: string;
  status: ReviewCommentStatus;
  createdAt: string;
  replies: ReviewReply[];
  /** 本意见当前锚定的字段版本 */
  anchor?: CommentAnchor;
  /** 历次锚定的字段版本，主审每次判定都会留痕 */
  anchorHistory?: CommentAnchor[];
}

export interface DictionaryEntry {
  id: string;
  headword: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  dialectVariants: DialectVariant[];
  examples: ExampleSentence[];
  sources: DictionarySource[];
  synonyms: string[];
  status: EntryStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  reviewerComments: ReviewComment[];
  /** 最近一次“提交待审”的修订号 */
  submittedRevision?: number;
  /** 最近一次“提交待审”的时间 */
  submittedAt?: string;
  /** 提交待审时各字段内容的留底，审校意见绑定这一版 */
  submittedBaseline?: Record<string, unknown>;
}

export interface VersionRecord {
  id: string;
  at: string;
  action: string;
  detail: string;
  entryId?: string;
  before: DictionaryEntry[];
}

export interface AuditRecord {
  id: string;
  at: string;
  action: string;
  detail: string;
  entryIds: string[];
}

export interface DictionarySnapshot {
  revision: number;
  entries: DictionaryEntry[];
  versions: VersionRecord[];
  audit: AuditRecord[];
}

export interface DuplicatePair {
  leftId: string;
  rightId: string;
  score: number;
  reasons: string[];
}
