/** Japanese dictionary for the `settings.agentLoop` namespace (client/ui-settings-agent-loop/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings.agentLoop` key union declared by @deepseek-ai/dsh-client-ui-settings-agent-loop.
import type {} from '@deepseek-ai/dsh-client-ui-settings-agent-loop/client'

/** `settings.agentLoop` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings.agentLoop'> = {
  'title': 'Agent ループ',
  'description': 'Agent がツール呼び出しをディスパッチする方法を制御します。',
  'maxParallel': '並列ツール呼び出し数',
  'maxParallelHint': '1 つのステップ内で同時に実行できる並列安全な呼び出しの上限です。',
  'overridden': 'オーバーライド済み',
  'reset': 'デフォルトに戻す',
  'readOnly': 'このデプロイの設定は読み取り専用です。',
  'unavailable': 'このプラグインは現在読み込まれていないため、設定できません。',
  'save': '保存',
  'saving': '保存中…',
  'saveFailed': 'このデプロイは値を受理しませんでした。修正できるよう残しています。',
  'invalidNumber': '数値を入力するか、デフォルトを使う場合は空欄にしてください。',
}
