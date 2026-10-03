/** Japanese dictionary for the `settings` namespace (client/ui-settings-general/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings` key union declared by @deepseek-ai/dsh-client-ui-settings-general.
import type {} from '@deepseek-ai/dsh-client-ui-settings-general/client'

/** `settings` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings'> = {
  'trigger': '設定',
  'shortcut.open': '設定を開く',
  'desktop.update.available': '更新',
  'desktop.update.checking': '更新を確認しています…',
  'desktop.update.progress': '{percent}%…',
  'desktop.update.verifying': '更新ファイルを検証しています…',
  'desktop.update.installing': '再起動を準備しています…',
  'desktop.update.ready': 'インストールして再起動',
  'desktop.update.retry': '更新を再試行',
  'desktop.update.versionDetail': '{label} — V{version}',
  'desktop.update.downloadDetail': '更新をダウンロード中: {percent}%\n対象バージョン: V{version}',
  'desktop.update.checkFailed': '更新の確認に失敗しました。しばらくしてから再試行してください',
  'desktop.update.downloadFailed': '更新のダウンロードに失敗しました。再試行してください',
  'desktop.update.installFailed': '更新のインストールに失敗しました。しばらくしてから再試行してください',
  'desktop.update.checkNetworkFailed': '更新の確認に失敗しました。しばらくしてから再試行してください。接続が中断されました。ネットワークを確認して再試行してください',
  'desktop.update.downloadNetworkFailed': '更新のダウンロードに失敗しました。再試行してください。接続が中断されました。ネットワークを確認して再試行してください',
  'desktop.update.installNetworkFailed': '更新のインストールに失敗しました。しばらくしてから再試行してください。接続が中断されました。ネットワークを確認して再試行してください',
  'desktop.update.stopFailed': 'タスクを安全に停止できませんでした。更新はインストールされていません。しばらくしてから再試行してください',
  'desktop.update.tasksChanged': '新しいタスクが開始されました。更新の確認をもう一度行ってください',
  'desktop.update.tasksUnavailable': 'タスクの状態を確認できません。ワークスペースが準備できてから更新を再試行してください',
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
  'general.currentVersion': '現在のバージョン: {version}',
  'developerTools.title': 'コード作業ツール',
  'developerTools.description': '軌跡、このターンのコード差分、新しい会話での Agent プリセット切り替えを表示します',
  'developerTools.error': '設定を保存できませんでした。再試行してください',
}
