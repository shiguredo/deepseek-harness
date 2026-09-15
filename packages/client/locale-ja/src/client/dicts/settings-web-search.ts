/** Japanese dictionary for the `settings.webSearch` namespace (client/ui-settings-web-search/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings.webSearch` key union declared by @deepseek-ai/dsh-client-ui-settings-web-search.
import type {} from '@deepseek-ai/dsh-client-ui-settings-web-search/client'

/** `settings.webSearch` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings.webSearch'> = {
  'title': 'Web 検索',
  'description': 'DeepSeek の検索プロバイダーを設定します。',
  'apiKey': 'API キー',
  'apiKeyHint': '設定ファイルには書き込みません。空欄の場合は現在のキーを保持します。',
  'apiKeySet': 'キーを設定済みです。',
  'apiKeyUnset': 'キーが未設定です。設定するまで検索は利用できません。',
  'baseUrl': 'エンドポイント',
  'baseUrlHint': '空欄の場合はプロバイダーのデフォルトを使用します。',
  'maxUses': '1 リクエストあたりの最大検索回数',
  'maxUsesHint': '回答するまでに 1 つのリクエストが検索できる回数です。',
  'overridden': 'オーバーライド済み',
  'reset': 'デフォルトに戻す',
  'readOnly': 'このデプロイの設定は読み取り専用です。',
  'unavailable': 'このプラグインは現在読み込まれていないため、設定できません。',
  'save': '保存',
  'saving': '保存中…',
  'saveFailed': 'このデプロイは値を受理しませんでした。修正できるよう残しています。',
  'invalidNumber': '数値を入力するか、デフォルトを使う場合は空欄にしてください。',
}
