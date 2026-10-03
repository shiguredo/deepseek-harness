/** Japanese dictionary for the `settings.theme` namespace (client/ui-theme/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings.theme` key union declared by @deepseek-ai/dsh-client-ui-theme.
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'

/** `settings.theme` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings.theme'> = {
  'appearance.title': '外観',
  'appearance.light': 'ライト',
  'appearance.dark': 'ダーク',
  'appearance.system': 'システム',
  'fontSize.text.title': 'フォントサイズ',
  'fontSize.text.description': '会話の内容にのみ影響します',
  'fontSize.text.increase': 'フォントサイズを大きくする',
  'fontSize.text.decrease': 'フォントサイズを小さくする',
  'fontSize.code.title': 'コードのフォントサイズ',
  'fontSize.code.description': 'コードブロック、インラインコード、ツール出力に使用します',
  'fontSize.code.increase': 'コードのフォントサイズを大きくする',
  'fontSize.code.decrease': 'コードのフォントサイズを小さくする',
  'fontSize.terminal.title': 'ターミナルのフォントサイズ',
  'fontSize.terminal.description': 'サイドバーのターミナルに使用します',
  'fontSize.terminal.increase': 'ターミナルのフォントサイズを大きくする',
  'fontSize.terminal.decrease': 'ターミナルのフォントサイズを小さくする',
  'fontSize.unit': 'px',
  'fontFamily.text.title': '本文フォント',
  'fontFamily.text.description': 'インターフェイスと会話本文に使用します。複数のフォントはコンマで区切り、空欄の場合は既定のフォントを使用します',
  'fontFamily.code.title': 'コードフォント',
  'fontFamily.code.description': 'コードブロック、インラインコード、ツール出力に使用します。複数のフォントはコンマで区切り、空欄の場合は既定のフォントを使用します',
  'fontFamily.terminal.title': 'ターミナルフォント',
  'fontFamily.terminal.description': 'サイドバーのターミナルに使用します。複数のフォントはコンマで区切り、空欄の場合は既定のフォントを使用します',
  'fontFamily.placeholder': '既定',
  'fontSize.more': 'フォント設定をさらに表示',
}
