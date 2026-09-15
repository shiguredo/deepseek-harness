/** Japanese dictionary for the `sidebarFiles` namespace (client/ui-sidebar-files/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `sidebarFiles` key union declared by @deepseek-ai/dsh-client-ui-sidebar-files.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-files/src/client/locales.ts'

/** `sidebarFiles` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'sidebarFiles'> = {
  'shortcut.noSession': '先にセッションを選択してください',
  'type.label': 'ファイル',
  'guide.title': 'ワークスペースのファイル',
  'guide.description': 'セッションのワークスペース内のファイルを閲覧します',
  'loading': '読み込み中…',
  'empty': '空のディレクトリ',
  'truncated': '項目が多すぎるため、一部のみ表示しています。',
  'noWorkspace': 'このセッションにはワークスペースディレクトリがありません。',
  'reload': '再読み込み',
  'entry.other': 'ファイルでもディレクトリでもないため、開けません。',
  'error.notFound': 'このディレクトリは存在しません。移動または削除された可能性があります。',
  'error.outsideWorkspace': 'このディレクトリはワークスペース外にあるため、サイドバーでは読み込みません。',
  'error.notDirectory': 'これはディレクトリではありません。',
  'error.unavailable': '読み込みに失敗しました：{message}',
  'autoRefresh': '自動更新',
  'autoRefresh.enable': '自動更新を有効にする',
  'autoRefresh.disable': '自動更新を無効にする',
}
