/** Japanese dictionary for the `skill` namespace (client/ui-skill/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `skill` key union declared by @deepseek-ai/dsh-client-ui-skill.
import type {} from '@deepseek-ai/dsh-client-ui-skill/client'

/** `skill` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'skill'> = {
  'row.title': 'スキル',
  'row.running': 'スキルを読み込み中',
  'row.preparing': 'スキルを準備中',
  'row.failed': 'スキルの読み込みに失敗しました',
  'row.stopped': 'スキルの読み込みを中止しました',
  'row.instructions': '指示',
  'row.inspect': '表示',
  'menu.userOnly': 'ユーザーのみ',
}
