<script setup lang="ts">
import { computed, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useDictionaryStore } from '~/store/dictionary';
import type { ReviewComment } from '~/types/dictionary';
import {
  FIELD_LABELS, countPendingComments, effectiveCommentStatus, fieldLabel,
  getFieldValue, serializeFieldValue
} from '~/utils/dictionary';

const store = useDictionaryStore();
const emit = defineEmits<{ versions: [] }>();
const commentField = ref('definition');
const commentText = ref('');
const filter = ref<'all' | 'stale' | 'open' | 'resolved'>('all');
const entry = computed(() => store.selectedEntry);

const enriched = computed(() => (entry.value?.reviewerComments ?? []).map((comment) => {
  const current = serializeFieldValue(comment.field, getFieldValue(entry.value!, comment.field));
  return { comment, status: effectiveCommentStatus(entry.value!, comment), current };
}));
const comments = computed(() =>
  enriched.value.filter((item) => {
    if (filter.value === 'all') return true;
    return item.status === filter.value;
  })
);
const pendingCount = computed(() => (entry.value ? countPendingComments(entry.value) : 0));
const staleCount = computed(() => enriched.value.filter((item) => item.status === 'stale').length);
const resolvedCount = computed(() => (entry.value?.reviewerComments ?? []).length - pendingCount.value);

const decide = (comment: ReviewComment, decision: 'resolved' | 'open') => {
  if (!entry.value) return;
  store.decideComment(entry.value.id, comment.id, decision);
  if (decision === 'resolved') {
    MessagePlugin.success('已判定“处理完了”，意见锚到当前字段版本');
  } else {
    MessagePlugin.warning('已判定“还得调整”，意见继续挂起等待修改');
  }
};

const addComment = () => {
  if (!entry.value || !commentText.value.trim()) return;
  store.addComment(entry.value.id, commentField.value, commentText.value);
  commentText.value = '';
};

const statusMeta = {
  open: { label: '待处理', theme: 'warning' as const },
  stale: { label: '待复核', theme: 'danger' as const },
  resolved: { label: '已解决', theme: 'success' as const }
};
</script>

<template>
  <aside v-if="entry" class="panel review-panel">
    <div class="panel-head review-head">
      <div><span class="eyebrow">03 / REVIEW</span><h2>审校与回复</h2></div>
      <button class="version-link" @click="emit('versions')">版本 {{ store.versions.length }}</button>
    </div>
    <div class="review-summary">
      <div><strong>{{ pendingCount }}</strong><span>待处理</span></div>
      <div><strong>{{ staleCount }}</strong><span>待复核</span></div>
      <div><strong>{{ resolvedCount }}</strong><span>已解决</span></div>
    </div>
    <div v-if="entry.submittedAt" class="baseline-line">
      当前审校依据：第 {{ entry.submittedRevision }} 版提交（{{ new Date(entry.submittedAt).toLocaleString('zh-CN') }}）
    </div>
    <div v-else class="baseline-line no-baseline">词条尚未提交待审，新意见将按当前内容锚定</div>
    <div class="comment-filter">
      <button :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
      <button :class="{ active: filter === 'stale' }" @click="filter = 'stale'">待复核 {{ staleCount }}</button>
      <button :class="{ active: filter === 'open' }" @click="filter = 'open'">待处理</button>
      <button :class="{ active: filter === 'resolved' }" @click="filter = 'resolved'">已解决</button>
    </div>
    <div class="comment-list">
      <article
        v-for="{ comment, status, current } in comments"
        :key="comment.id"
        class="comment-card"
        :class="{ resolved: status === 'resolved', stale: status === 'stale' }"
      >
        <header>
          <t-tag size="small" variant="light" :theme="statusMeta[status].theme">{{ fieldLabel(comment.field) }} · {{ statusMeta[status].label }}</t-tag>
          <span>{{ comment.author }}</span>
          <time>{{ new Date(comment.createdAt).toLocaleDateString('zh-CN') }}</time>
        </header>
        <p>{{ comment.message }}</p>

        <div v-if="comment.anchor" class="anchor-box">
          <div class="anchor-version" :class="{ drifted: status === 'stale' }">
            <span class="anchor-tag">意见所审版本</span>
            <time>r{{ comment.anchor.revision ?? '—' }} · {{ new Date(comment.anchor.at).toLocaleDateString('zh-CN') }}</time>
            <small v-if="comment.anchor.note">{{ comment.anchor.note }}</small>
          </div>
          <div class="anchor-text original">{{ comment.anchor.valueText || '（当时为空）' }}</div>
          <div v-if="status === 'stale'" class="anchor-compare">
            <div class="anchor-compare-head"><span class="anchor-tag drift">字段已变 · 待复核</span><small>原内容与当前内容均保留</small></div>
            <div class="anchor-text current">{{ current || '（当前为空）' }}</div>
          </div>
          <div v-if="comment.anchor.origin" class="anchor-origin">锚点 {{ comment.anchor.origin }}</div>
        </div>

        <div v-if="comment.anchorHistory?.length" class="anchor-history">
          <details>
            <summary>历史锚定版本（{{ comment.anchorHistory.length }}）</summary>
            <div v-for="(old, index) in [...comment.anchorHistory].reverse()" :key="index" class="history-item">
              <time>r{{ old.revision ?? '—' }} · {{ new Date(old.at).toLocaleString('zh-CN') }}</time>
              <p>{{ old.valueText || '（当时为空）' }}</p>
              <small v-if="old.note">{{ old.note }}</small>
            </div>
          </details>
        </div>

        <div v-for="reply in comment.replies" :key="reply.id" class="reply" :class="{ decision: reply.kind === 'decision' }">
          <strong>{{ reply.author }}</strong>
          <span>{{ reply.message }}</span>
          <time>{{ new Date(reply.createdAt).toLocaleString('zh-CN') }}</time>
        </div>

        <div class="reply-box">
          <t-textarea v-model="store.fieldReplyDrafts[comment.id]" :autosize="{ minRows: 1, maxRows: 3 }" placeholder="逐字段回复这条意见…" />
          <t-button
            size="small" theme="primary" variant="outline"
            @click="store.replyComment(entry!.id, comment.id, store.fieldReplyDrafts[comment.id] || ''); store.fieldReplyDrafts[comment.id] = ''"
          >回复</t-button>
        </div>

        <div v-if="status !== 'resolved'" class="decision-row">
          <span class="decision-hint">{{ status === 'stale' ? '字段已变，请主审复核这一版' : '主审结论' }}</span>
          <t-button size="small" theme="success" variant="outline" @click="decide(comment, 'resolved')">✓ 处理完了</t-button>
          <t-button size="small" theme="warning" variant="outline" @click="decide(comment, 'open')">✎ 还得调整</t-button>
        </div>
        <button v-else class="resolve-button" @click="store.reopenComment(entry!.id, comment.id)">↺ 重新打开意见</button>
      </article>
      <t-empty v-if="!comments.length" description="当前筛选下没有审校意见" />
    </div>
    <div class="new-comment">
      <div class="new-comment-title"><strong>新增逐字段意见</strong><span>Ctrl + Enter 提交</span></div>
      <t-select v-model="commentField" size="small">
        <t-option v-for="(label, field) in FIELD_LABELS" :key="field" :value="field" :label="label" />
      </t-select>
      <p class="anchor-hint">待审词条的新意见自动绑定最近一次“提交待审”的字段版本。</p>
      <t-textarea v-model="commentText" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="指出需要修改、补充或确认的内容" @keydown.ctrl.enter="addComment" @keydown.meta.enter="addComment" />
      <t-button block theme="primary" size="small" :disabled="!commentText.trim()" @click="addComment">提交审校意见</t-button>
    </div>
  </aside>
</template>
