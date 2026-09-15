/** Japanese dictionary for the `settings` namespace (client/ui-settings-general/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings` key union declared by @deepseek-ai/dsh-client-ui-settings-general.
import type {} from '@deepseek-ai/dsh-client-ui-settings-general/client'

/** `settings` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings'> = {
  'trigger': '設定',
  'title': '設定',
  'close': '閉じる',
  'openDocument': '設定ファイルを開く',
  'openDocument.error': '設定ファイルを開けませんでした',
  'general.nav': '一般',
  'connection.error': '接続エラー',
  'connection.connecting': '自動再接続中',
  'connection.connected': '接続済み',
  'connection.reconnect': '接続エラー。クリックして今すぐ再接続',
  'connection.restart': '接続が切断されました。自動再接続中です。クリックして今すぐ再接続',
}
