/** Japanese dictionary for the `question` namespace (client/ui-user-questions/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `question` key union declared by @deepseek-ai/dsh-client-ui-user-questions.
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client'

/** `question` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'question'> = {
  'error.incomplete': '先にこの質問に回答してください。',
  'error.unanswered': '選択肢を選ぶか、自由回答を入力してください。',
  'nav.prev': '前の質問',
  'nav.next': '次の質問',
  'nav.minimize': '質問カードを折りたたむ',
  'nav.maximize': '質問カードを展開',
  'nav.cancel': 'すべての質問を破棄',
  'option.recommended': '推奨',
  'custom.placeholder': '回答を入力',
  'action.skip': 'この質問をスキップ',
  'action.next': '次へ',
  'plan.header': 'プランの確認',
  'plan.approve': '承認',
  'plan.decline': '拒否',
  'plan.discuss': '会話で相談',
}
