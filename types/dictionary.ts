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

export type CommentVerdict = 'done' | 'adjust';

export interface CommentReply {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface CommentAnchor {
  content: string;
  at: string;
  note?: string;
}

export interface CommentVerdictRecord {
  id: string;
  verdict: CommentVerdict;
  at: string;
}

export interface ReviewComment {
  id: string;
  field: string;
  author: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  replies: CommentReply[];
  /** 意见当前绑定的字段内容版本；主审确认“处理完了”后推进到新版内容 */
  anchoredContent?: string;
  anchoredAt?: string;
  /** 历次锚定版本，首个元素即意见提出时针对的原内容 */
  anchorHistory?: CommentAnchor[];
  /** 绑定版本之后字段又被修改，等待主审复核 */
  needsRecheck?: boolean;
  /** 合并词条时带来的意见，记录原属词条，锚点不丢 */
  originEntryId?: string;
  originHeadword?: string;
  /** 主审最近一次判定 */
  verdict?: CommentVerdict;
  verdictAt?: string;
  /** 历次判定记录，便于回看“哪版内容下的判断” */
  verdicts?: CommentVerdictRecord[];
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
  /** 最近一次“提交待审”时逐字段内容快照，新意见默认绑定这一版 */
  reviewSnapshot?: Record<string, string>;
  submittedAt?: string;
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
