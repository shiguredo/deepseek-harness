/** Japanese dictionary for the `sidebarExcel` namespace (client/ui-sidebar-documentpreview/src/client/excel/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `sidebarExcel` key union declared by @deepseek-ai/dsh-client-ui-sidebar-documentpreview.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/excel/locales.ts'

/** `sidebarExcel` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'sidebarExcel'> = {
  'title': 'スプレッドシート',
  'language': 'ja',
  'loading': 'スプレッドシートを開いています…',
  'invalid': 'このスプレッドシートを開けませんでした。ファイル形式・内容・パスワード保護を確認してください。',
  'tooLarge': 'このブックはプレビューのサイズ上限を超えています。',
  'timeout': 'ブックの読み込みがタイムアウトしました。ファイルを小さくして再試行してください。',
  'encoding': 'このテキスト形式の文字コードを判別できませんでした。UTF-8 または BOM 付き UTF-16 で保存し直して再試行してください。',
  'formulaWarning': 'このブックには数式が含まれています。表示結果が欠けていたり不正確な場合があります。',
  'unsupportedNotice': 'このプレビューはブック内の{features}に対応していません。完全な表示にはシステムアプリで開いてください。',
  'charts': 'グラフ',
  'images': '画像',
  'shapes': '図形',
  'conditionalFormatting': '条件付き書式',
  'featureSeparator': '、',
  'retry': '再試行',
}
