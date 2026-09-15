/** Japanese dictionary for the `agent-team` namespace (experimental/client-ui-agent-team/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `agent-team` key union declared by @deepseek-ai/dsh-experimental-client-ui-agent-team.
import type {} from '@deepseek-ai/dsh-experimental-client-ui-agent-team/client'

/** `agent-team` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'agent-team'> = {
  'trigger': 'エージェントチーム',
  'loading': 'チームを読み込んでいます…',
  'unavailable': 'チームを利用できません',
  'failure': 'チームの保存記録が無効です：{message}',
  'empty': '共有タスクはまだありません。会話から作成できます',
  'roster': 'メンバー',
  'tasks': '共有タスク',
  'model': 'モデル',
  'open': 'チームメンバーの会話を開く',
  'current': '現在の会話',
  'owner': 'オーナー',
  'unowned': '未割り当て',
  'blockedBy': 'ブロック元',
  'writeScopes': '書き込み範囲',
  'ready': '開始可能',
  'blocked': '依存関係によりブロック中',
  'task.expand': '展開',
  'task.collapse': '折りたたみ',
  'memberStatus.running': '実行中',
  'memberStatus.inactive': '非アクティブ',
  'memberStatus.provisioning': '準備中',
  'memberStatus.failed': '失敗',
  'status.pending': '未着手',
  'status.in_progress': '進行中',
  'status.completed': '完了',
}
