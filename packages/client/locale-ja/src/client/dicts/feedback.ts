/** Japanese dictionary for the `feedback` namespace (client/ui-message-feedback/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `feedback` key union declared by @deepseek-ai/dsh-client-ui-message-feedback.
import type {} from '@deepseek-ai/dsh-client-ui-message-feedback/src/client/locales.ts'

/** `feedback` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'feedback'> = {
  'action.like': '良い回答',
  'action.likeActive': '評価を取り消す',
  'action.dislike': '問題のある回答',
  'action.dislikeActive': '評価を取り消す',
  'dialog.title': 'フィードバックを送信',
  'dialog.categories': 'フィードバックのカテゴリ',
  'dialog.detail': 'フィードバックの詳細',
  'dialog.hint': '詳細を入力すると改善に役立ちます。送信内容には現在の会話ログが含まれます',
  'category.task-result': 'タスクの結果',
  'category.instruction-following': '指示の理解と遵守',
  'category.product-interaction': '製品の機能と操作性',
  'category.service-stability': '安定性と速度',
  'category.resource-cost': 'リソース使用量とコスト',
  'category.security-privacy-permission': 'セキュリティ、プライバシーと権限',
  'category.other': 'その他',
  'toast.recorded': 'フィードバックありがとうございます',
  'error.conflict': 'このフィードバックは別の場所で変更されました。最新の状態を表示しています',
  'error.load': 'フィードバックの読み込みに失敗しました',
  'error.generic': 'フィードバックの保存に失敗しました',
  'error.noteTooLarge': '説明が長すぎます。短くしてから再送信してください',
}
