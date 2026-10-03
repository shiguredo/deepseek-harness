/** Japanese dictionary for the `question` namespace (client/ui-user-questions/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `question` key union declared by @deepseek-ai/dsh-client-ui-user-questions.
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client'

/** `question` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'question'> = {
  'error.incomplete': '先にこの質問に回答してください。',
  'error.unanswered': '選択肢を選ぶか、自由回答を入力してください。',
  'error.unavailable': '現在は送信できません。しばらくしてから再試行してください。',
  'error.resubmit': '回答が届かないまま作業が続きました。もう一度送信してください。',
  'status.sent': '回答は送信されましたが、パネルを閉じられませんでした。',
  'wait.takeTime': 'ゆっくり回答する',
  'wait.countdown': '{seconds} 秒後に作業を再開します',
  'wait.paused': '一時停止中 · 残り {seconds} 秒',
  'wait.held': '回答するまで待機します',
  'wait.continued': '作業を再開しました。引き続き回答できます',
  'review.status': '回答済み',
  'review.skipped': 'この質問はスキップされました。',
  'reply.label': '以前の未回答の質問に回答する',
  'reply.open': '質問の詳細を展開',
  'reply.close': '質問の詳細を閉じる',
  'reply.answerLabel': '回答: ',
  'reply.skipped': 'スキップ',
  'nav.prev': '前の質問',
  'nav.next': '次の質問',
  'nav.minimize': '質問カードを折りたたむ',
  'nav.maximize': '質問カードを展開',
  'nav.cancel': 'すべての質問を破棄',
  'nav.close': '質問パネルを閉じる（ツール呼び出しから再度開けます）',
  'option.recommended': '推奨',
  'custom.placeholder': '回答を入力',
  'action.skip': 'この質問をスキップ',
  'action.next': '次へ',
  'plan.header': 'プランの確認',
  'plan.approve': '承認',
  'plan.decline': '拒否',
  'plan.discuss': '会話で相談',
}
