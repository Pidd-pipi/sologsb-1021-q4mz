<script setup lang="ts">
import { computed, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useDictionaryStore } from '~/store/dictionary';
import { FIELD_LABELS, blockingCommentCount, isBlockingComment, serializeField } from '~/utils/dictionary';
import type { ReviewComment } from '~/types/dictionary';

const store = useDictionaryStore();
const emit = defineEmits<{ versions: [] }>();
const commentField = ref('definition');
const commentText = ref('');
const filter = ref<'all' | 'open' | 'resolved' | 'recheck'>('all');
const entry = computed(() => store.selectedEntry);

const commentState = (comment: ReviewComment) => {
  if (comment.needsRecheck) return { key: 'recheck', label: '待复核', theme: 'danger' as const };
  if (comment.status === 'resolved') return { key: 'resolved', label: '处理完了', theme: 'success' as const };
  if (comment.verdict === 'adjust') return { key: 'adjust', label: '还得调整', theme: 'warning' as const };
  return { key: 'open', label: '待处理', theme: 'warning' as const };
};

const comments = computed(() => (entry.value?.reviewerComments ?? []).filter((comment) => {
  if (filter.value === 'recheck') return !!comment.needsRecheck;
  if (filter.value === 'resolved') return comment.status === 'resolved' && !comment.needsRecheck;
  if (filter.value === 'open') return isBlockingComment(comment);
  return true;
}));

const blocking = computed(() => (entry.value ? blockingCommentCount(entry.value) : 0));
const recheckCount = computed(() => entry.value?.reviewerComments.filter((item) => item.needsRecheck).length ?? 0);
const resolvedCount = computed(() => entry.value?.reviewerComments.filter((item) => item.status === 'resolved' && !item.needsRecheck).length ?? 0);

const verdictLabels = { done: '处理完了', adjust: '还得调整' } as const;
const fieldLabel = (field: string) => FIELD_LABELS[field] || field;
const currentContent = (comment: ReviewComment) => (entry.value ? serializeField(entry.value, comment.field) : '');
const olderAnchors = (comment: ReviewComment) => (comment.anchorHistory ?? []).filter((anchor) => anchor.content !== comment.anchoredContent);

const addComment = () => {
  if (!entry.value || !commentText.value.trim()) return;
  store.addComment(entry.value.id, commentField.value, commentText.value);
  commentText.value = '';
};

const submit = () => {
  if (!entry.value) return;
  store.submitForReview(entry.value.id);
  MessagePlugin.success('已提交待审：各字段当前版本已记录，新意见将绑定这一版');
};
</script>

<template>
  <aside v-if="entry" class="panel review-panel">
    <div class="panel-head review-head">
      <div><span class="eyebrow">03 / REVIEW</span><h2>审校与回复</h2></div>
      <button class="version-link" @click="emit('versions')">版本 {{ store.versions.length }}</button>
    </div>
    <div class="review-summary">
      <div><strong>{{ blocking }}</strong><span>待处理</span></div>
      <div><strong>{{ recheckCount }}</strong><span>待复核</span></div>
      <div><strong>{{ resolvedCount }}</strong><span>已处理</span></div>
    </div>
    <div class="submit-review" :class="{ on: entry.status === 'review' }">
      <span v-if="entry.submittedAt">锚定版本：{{ new Date(entry.submittedAt).toLocaleString('zh-CN') }}</span>
      <span v-else>尚未提交待审，新意见将绑定字段当前版本</span>
      <t-button size="small" theme="primary" variant="outline" :disabled="entry.status === 'review'" @click="submit">
        {{ entry.status === 'review' ? '待审中' : '提交待审并记录版本' }}
      </t-button>
    </div>
    <div class="comment-filter">
      <button :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
      <button :class="{ active: filter === 'open' }" @click="filter = 'open'">待处理 {{ blocking }}</button>
      <button :class="{ active: filter === 'recheck' }" @click="filter = 'recheck'">待复核 {{ recheckCount }}</button>
      <button :class="{ active: filter === 'resolved' }" @click="filter = 'resolved'">已处理</button>
    </div>
    <div class="comment-list">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="comment-card"
        :class="{ resolved: comment.status === 'resolved' && !comment.needsRecheck, recheck: comment.needsRecheck }"
      >
        <header>
          <t-tag size="small" variant="light" :theme="commentState(comment).theme">{{ fieldLabel(comment.field) }} · {{ commentState(comment).label }}</t-tag>
          <span>{{ comment.author }}</span>
          <time>{{ new Date(comment.createdAt).toLocaleDateString('zh-CN') }}</time>
        </header>
        <p>{{ comment.message }}</p>

        <div v-if="comment.originHeadword" class="origin-line">来自合并词条“{{ comment.originHeadword }}”，锚点随意见保留</div>

        <div v-if="comment.needsRecheck" class="anchor-diff">
          <div class="anchor-version old">
            <strong>意见针对的版本（绑定内容）</strong>
            <pre>{{ comment.anchoredContent || '（当时为空）' }}</pre>
          </div>
          <div class="anchor-arrow">↓ 字段已变化，待主审复核</div>
          <div class="anchor-version current">
            <strong>当前内容</strong>
            <pre>{{ currentContent(comment) || '（当前为空）' }}</pre>
          </div>
        </div>
        <details v-else-if="olderAnchors(comment).length" class="anchor-history">
          <summary>查看历次绑定版本（{{ olderAnchors(comment).length + 1 }} 版）</summary>
          <div v-for="(anchor, index) in olderAnchors(comment)" :key="index" class="anchor-version old">
            <strong>{{ anchor.note || '历史版本' }} · {{ new Date(anchor.at).toLocaleDateString('zh-CN') }}</strong>
            <pre>{{ anchor.content || '（当时为空）' }}</pre>
          </div>
        </details>

        <div v-for="reply in comment.replies" :key="reply.id" class="reply">
          <strong>{{ reply.author }}</strong>
          <span>{{ reply.message }}</span>
          <time>{{ new Date(reply.createdAt).toLocaleString('zh-CN') }}</time>
        </div>

        <div v-if="comment.verdictAt && !comment.needsRecheck" class="verdict-line">
          主审最近判定：{{ verdictLabels[comment.verdict!] }} · {{ new Date(comment.verdictAt).toLocaleString('zh-CN') }}
          <span v-if="comment.verdicts && comment.verdicts.length > 1">（共判定 {{ comment.verdicts.length }} 次）</span>
        </div>

        <div class="reply-box">
          <t-textarea v-model="store.fieldReplyDrafts[comment.id]" :autosize="{ minRows: 1, maxRows: 3 }" placeholder="编辑逐字段回复这条意见…" />
          <t-button size="small" theme="primary" variant="outline" @click="store.replyComment(entry!.id, comment.id, store.fieldReplyDrafts[comment.id] || ''); store.fieldReplyDrafts[comment.id] = ''">回复</t-button>
        </div>

        <div class="verdict-actions">
          <t-button size="small" theme="success" variant="outline" @click="store.verdictComment(entry!.id, comment.id, 'done')">✓ 处理完了</t-button>
          <t-button size="small" theme="warning" variant="outline" @click="store.verdictComment(entry!.id, comment.id, 'adjust')">还得调整</t-button>
          <button v-if="comment.status === 'resolved' && !comment.needsRecheck" class="reopen-button" @click="store.reopenComment(entry!.id, comment.id)">↺ 重新打开</button>
        </div>
      </article>
      <t-empty v-if="!comments.length" description="当前筛选下没有审校意见" />
    </div>
    <div class="new-comment">
      <div class="new-comment-title"><strong>新增逐字段意见</strong><span>Ctrl + Enter 提交</span></div>
      <t-select v-model="commentField" size="small">
        <t-option v-for="(label, field) in FIELD_LABELS" :key="field" :value="field" :label="label" />
      </t-select>
      <t-textarea v-model="commentText" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="指出需要修改、补充或确认的内容；意见绑定提交待审时的字段版本" @keydown.ctrl.enter="addComment" @keydown.meta.enter="addComment" />
      <t-button block theme="primary" size="small" :disabled="!commentText.trim()" @click="addComment">提交审校意见</t-button>
    </div>
  </aside>
</template>
