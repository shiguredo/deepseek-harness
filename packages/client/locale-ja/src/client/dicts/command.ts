/** Japanese dictionary for the `command` namespace (client/ui-commands/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `command` key union declared by @deepseek-ai/dsh-client-ui-commands.
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'

/** `command` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'command'> = {
  'section.add': '追加',
  'section.commands': 'コマンド',
  'label.goal': 'ゴール',
  'label.plan': 'プラン',
  'label.feedback': 'フィードバック',
  'label.compact': '圧縮',
  'label.permission': '権限',
  'label.export': 'エクスポート',
  'description.goal': '長期タスクのゴールを設定または表示します',
  'description.plan': 'プランモードを開始または終了します',
  'description.feedback': 'このセッションに関するフィードバックを記録します',
  'description.compact': '以前の会話履歴を圧縮します',
  'description.permission': '権限プリセットを切り替えます（サンドボックスモードと承認ポリシー）',
  'description.export': '現在のセッションログを ZIP アーカイブとしてダウンロードします',
  'token.goal': 'ゴール',
  'token.plan': 'プラン',
  'token.feedback': 'フィードバック',
  'token.compact': '圧縮',
  'token.permission': '権限',
  'token.export': 'エクスポート',
  'search.placeholder': '検索…',
  'search.aria': 'オプションを絞り込む',
  'status.loading': 'オプションを読み込んでいます…',
  'status.applying': '適用しています…',
  'status.empty': 'オプションがありません',
  'overlay.aria': '/{command} のオプション',
  'listbox.aria': '/{command} の一致項目',
  'notice.attachmentsUnsupported': '/{command} は添付ファイルを受け付けません。先に添付ファイルを削除してください',
}
