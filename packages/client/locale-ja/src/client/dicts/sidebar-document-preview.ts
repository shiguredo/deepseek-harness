/** Japanese dictionary for the `sidebarDocumentPreview` namespace (client/ui-sidebar-documentpreview/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `sidebarDocumentPreview` key union declared by @deepseek-ai/dsh-client-ui-sidebar-documentpreview.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'

/** `sidebarDocumentPreview` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'sidebarDocumentPreview'> = {
  'loading': '読み込み中…',
  'loadMore': 'さらに読み込む',
  'changed': 'ファイルが更新されました。現在は古い内容を表示しています。',
  'reloadNow': '再読み込み',
  'reload': 'ファイルを再読み込み',
  'wrap.enable': '行の折り返しをオンにする',
  'wrap.disable': '行の折り返しをオフにする',
  'wrap.aria': '行の折り返し',
  'openWith': '表示方法',
  'viewer.text': 'プレーンテキスト',
  'unsupportedFile': 'この形式のファイルは、まだプレビューできません。',
  'resourceUnavailable': 'ファイルリソースサービスを利用できません。',
  'rendererUnavailable': '{name} プレビューを利用できません。',
  'error.notFound': 'ファイルが存在しません。移動または削除された可能性があります。',
  'error.tooLarge': '1 ページの内容が上限 {limit} を超えているため、読み込めません。',
  'error.notText': 'テキストファイルではないため、現在プレビューできません。',
  'error.notRegularFile': 'このパスは通常のファイルではないため、表示できる内容がありません。',
  'error.unavailable': '読み込みに失敗しました：{message}',
  'retry': '再試行',
  'autoRefresh': '自動更新',
  'autoRefresh.enable': '自動更新を有効にする',
  'autoRefresh.disable': '自動更新を無効にする',
}
