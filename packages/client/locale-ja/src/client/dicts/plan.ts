/** Japanese dictionary for the `plan` namespace (client/ui-plan/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `plan` key union declared by @deepseek-ai/dsh-client-ui-plan.
import type {} from '@deepseek-ai/dsh-client-ui-plan/client'

/** `plan` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'plan'> = {
  'chip.label': 'Plan',
  'preview.title': 'プラン',
  'preview.document': 'プラン · Markdown',
  'preview.action': '開く',
  'preview.open': 'プランをサイドバーで開く',
  'preview.full': '全文を表示',
  'preview.openNamed': 'プランを開く: {title}',
  'preview.loading': 'プランを読み込んでいます…',
  'preview.failed': 'プランを読み込めませんでした',
  'preview.invalidAddress': 'プランのアドレスが無効です',
  'preview.historyUnavailable': 'セッション履歴を利用できません',
  'preview.notFound': 'このプランが見つかりません',
  'preview.unavailable': 'プランのプレビューを利用できません',
  'preview.expired': 'この一時プランプレビューは有効期限が切れました。承認待ちのカードから開き直してください',
  'chip.on.aria': 'プランモードはオンです。押すとオフになります',
  'chip.on.title': 'プランモードはオン — クリックでオフ（/plan off）',
  'chip.exitFailed': 'プランモードの終了に失敗しました',
}
