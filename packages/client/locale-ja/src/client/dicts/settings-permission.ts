/** Japanese dictionary for the `settings.permission` namespace (client/ui-permission-presets/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings.permission` key union declared by @deepseek-ai/dsh-client-ui-permission-presets.
import type {} from '@deepseek-ai/dsh-client-ui-permission-presets/client'

/** `settings.permission` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings.permission'> = {
  'title': '権限',
  'description': '新規セッションのデフォルト権限モードを選択します',
  'loading': '読み込み中',
  'unavailable': '利用不可',
  'preset.readOnly': '閲覧のみ',
  'preset.workspaceWrite': 'ワークスペース内の変更',
  'preset.fullAccess': 'フルアクセス',
  'confirm.title': 'フルアクセスを有効にしますか？',
  'confirm.description': 'フルアクセスを有効にすると、新規セッションの確認ステップが減り、機密性の高い操作、ファイルの変更、外部コマンドなど、より多くの操作を直接実行できます。信頼できる後続タスクにのみ使用してください。',
  'confirm.acknowledge': 'リスクを理解した上で続行します',
  'confirm.cancel': 'キャンセル',
  'confirm.enable': 'フルアクセスを有効にする',
}
