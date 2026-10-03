/** Japanese dictionary for the `settings.shell` namespace (client/ui-settings-shell/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings.shell` key union declared by @deepseek-ai/dsh-client-ui-settings-shell.
import type {} from '@deepseek-ai/dsh-client-ui-settings-shell/client'

/** `settings.shell` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings.shell'> = {
  'title': 'シェル',
  'description': '各コマンドの実行時間と出力量の上限を設定します。',
  'timeoutMs': 'コマンドのタイムアウト（ミリ秒）',
  'timeoutMsHint': '1 つのコマンドを終了するまで実行できる時間です。',
  'maxOutputBytes': 'ストリームごとの出力上限（バイト）',
  'maxOutputBytesHint': '上限を超えた出力は失われず、一時ファイルに退避されます。',
  'overridden': 'オーバーライド済み',
  'reset': 'デフォルトに戻す',
  'readOnly': 'このデプロイの設定は読み取り専用です。',
  'unavailable': 'このプラグインは現在読み込まれていないため、設定できません。',
  'save': '保存',
  'saving': '保存中…',
  'saveFailed': 'このデプロイは値を受理しませんでした。修正できるよう残しています。',
  'invalidNumber': '数値を入力するか、デフォルトを使う場合は空欄にしてください。',
}
