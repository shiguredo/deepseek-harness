/** Japanese dictionary for the `workflowRun` namespace (client/ui-workflow-run/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `workflowRun` key union declared by @deepseek-ai/dsh-client-ui-workflow-run.
import type {} from '@deepseek-ai/dsh-client-ui-workflow-run/client'

/** `workflowRun` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'workflowRun'> = {
  'run.title': '{name}',
  'run.members.one': '{count} 件のメンバー',
  'run.members.other': '{count} 件のメンバー',
  'run.empty': '開始されたメンバーはありません',
  'phase.unassigned': 'フェーズ未設定',
  'phase.empty': 'フェーズ名が空です',
  'statusCount.running': '実行中 {count}',
  'statusCount.completed': '完了 {count}',
  'statusCount.failed': '失敗 {count}',
  'statusCount.cancelled': 'キャンセル済み {count}',
  'statusCount.interrupted': '中断 {count}',
  'member.empty': 'メンバー名が空です',
  'member.open': '{name} を開く',
  'status.running': '実行中',
  'status.completed': '完了',
  'status.failed': '失敗',
  'status.cancelled': 'キャンセル済み',
  'status.interrupted': '中断',
}
