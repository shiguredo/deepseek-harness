/** Japanese dictionary for the `job` namespace (client/ui-jobs/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `job` key union declared by @deepseek-ai/dsh-client-ui-jobs.
import type {} from '@deepseek-ai/dsh-client-ui-jobs/client'

/** `job` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'job'> = {
  'count.live.one': '{count} 件のバックグラウンドジョブを実行中',
  'count.live.other': '{count} 件のバックグラウンドジョブを実行中',
  'count.idle.one': '{count} 件のバックグラウンドジョブ',
  'count.idle.other': '{count} 件のバックグラウンドジョブ',
  'list.aria': 'バックグラウンドジョブ',
  'status.running': '実行中',
  'status.stopping': '停止中',
  'status.completed': '完了',
  'status.killed': 'キャンセル済み',
  'status.failed': '失敗',
  'duration.seconds': '{seconds}秒',
  'duration.minutes': '{minutes}分{seconds}秒',
  'duration.hours': '{hours}時間{minutes}分',
  'duration.title.live': '実行時間 {duration}',
  'duration.title.done': '所要時間 {duration}',
}
