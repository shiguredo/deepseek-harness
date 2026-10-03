/** Japanese dictionary for the `sidebarTerminal` namespace (client/ui-sidebar-terminal/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `sidebarTerminal` key union declared by @deepseek-ai/dsh-client-ui-sidebar-terminal.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-terminal/src/client/locales.ts'

/** `sidebarTerminal` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'sidebarTerminal'> = {
  'shortcut.noSession': '先にセッションを選択してください',
  'recoveryFailed': 'ターミナルの復元に失敗しました: {message}',
  'retryRecovery': 'ターミナルの復元を再試行',
  'shell': 'シェルを選択',
  'shellLoading': 'シェルを読み込んでいます…',
  'shellEmpty': '利用できるシェルがありません',
  'description': 'セッションのワークスペースでコマンドを実行します',
  'title': 'ターミナル',
  'new': '新しいターミナル',
  'loading': 'ターミナル環境を読み込んでいます…',
  'creating': '起動しています…',
  'connecting': '接続しています…',
  'disconnected': '接続が切断されました。',
  'reconnect': '再接続',
  'readonly': 'このページは現在読み取り専用です。',
  'control': '入力を引き継ぐ',
  'closed': 'ターミナルは閉じられました。',
  'exited': 'プロセスが終了しました（{code}）',
  'failed': 'ターミナルエラー: {message}',
  'rename': 'ターミナル名',
  'unavailable': '利用できません',
  'retry': '再試行',
  'cleanupFailed': 'ターミナル「{title}」を終了できませんでした: {message}',
  'missingTerminal': 'このターミナルは存在しません。新しいターミナルを開いてください。',
  'inputFull': '入力バッファが満杯です。再接続して再試行してください。',
  'attachmentEnded': 'ターミナル接続が終了しました。再接続してください。',
  'invalidOutput': 'ターミナル画面を受信できませんでした。再接続してください。',
  'terminalLimit': 'ターミナル数の上限に達しました。不要なターミナルを閉じて再試行してください。終了済みのターミナルも数に含まれます。',
}
