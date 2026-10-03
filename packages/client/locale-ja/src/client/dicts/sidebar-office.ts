/** Japanese dictionary for the `sidebarOffice` namespace (client/ui-sidebar-documentpreview/src/client/office/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `sidebarOffice` key union declared by @deepseek-ai/dsh-client-ui-sidebar-documentpreview.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/office/index.ts'

/** `sidebarOffice` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'sidebarOffice'> = {
  'title': 'Office ドキュメント',
  'loading': '読み込んでいます…',
  'retry': '再試行',
  'viewMissingFonts': '{count} 種類のフォントがありません。クリックして表示',
  'missingFontsTitle': '不足しているフォント',
  'missingFontsDescription': 'このプレビューでは以下のフォントを利用できません。文字やレイアウトが元のドキュメントと異なる場合があります。',
  'missingFontsCount': '{count} 種類のフォント',
  'closeDetails': 'フォント詳細を閉じる',
  'unavailable': 'Office プレビューを利用できません。DeepSeek Harness を実行しているホストでドキュメントプレビューサービスを有効にしてください。',
  'invalid': 'この Office ファイルをプレビューできません。破損しているか、パスワード保護されているか、拡張子と一致しない可能性があります。',
  'tooLarge': 'Office ファイルまたは変換後の PDF がプレビューのサイズ上限を超えています。ファイルを小さくするか、プレビュー設定を調整してください。',
  'failed': 'Office の変換に失敗し、利用できる PDF を生成できませんでした。ファイルを確認して再試行してください。',
  'timeout': 'Office の変換がタイムアウトしました。再試行してください。',
  'busy': 'Office プレビューの処理が混み合っています。しばらくしてから再試行してください。',
  'changed': '読み込み中にファイルが変更されました。プレビューを開き直してください。',
}
