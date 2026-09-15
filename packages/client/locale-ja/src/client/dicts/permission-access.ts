/** Japanese dictionary for the `permission.access` namespace (client/ui-permission-presets/src/client/index.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `permission.access` key union declared by @deepseek-ai/dsh-client-ui-permission-presets.
import type {} from '@deepseek-ai/dsh-client-ui-permission-presets/client'

/** `permission.access` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'permission.access'> = {
  'mode': 'アクセスモード、現在: {name}',
  'close': '閉じる',
  'preset.readOnly': '閲覧のみ',
  'preset.workspaceWrite': 'ワークスペース内の変更',
  'preset.fullAccess': 'フルアクセス',
  'confirm.title': 'フルアクセスを有効にしますか？',
  'confirm.description': 'フルアクセスを有効にすると、エージェントの確認ステップが減り、機密性の高い操作、ファイルの変更、外部コマンドなど、より多くの操作を直接実行できます。現在のタスクを信頼できる場合にのみ使用を推奨します。',
  'confirm.acknowledge': 'リスクを理解した上で続行します',
  'confirm.cancel': 'キャンセル',
  'confirm.enable': 'フルアクセスを有効にする',
  'auto.label': '自動レビュー',
  'auto.badge': 'EXP',
  'auto.description': 'すべてのネイティブツール呼び出しと PTC 内側呼び出しを同一モデルで実験的にレビューしたうえで、サンドボックスなしで実行します。',
  'auto.confirm.title': '自動レビュー（実験的）を有効にしますか？',
  'auto.confirm.description': '自動レビューはサンドボックスなしで実行します。すべてのネイティブツール呼び出しと PTC 内側呼び出しの前に、現在のエージェントと同じモデルが許可すべきかをレビューします。この機能は実験的で、操作を誤って許可・拒否することがあり、追加のトークンを消費します。',
  'auto.confirm.acknowledge': 'これらのリスクを理解した上で続行します',
  'auto.confirm.enable': '自動レビューを有効にする',
}
