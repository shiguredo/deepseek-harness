/** Japanese dictionary for the `schedule.catalog` namespace (client/ui-schedule/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `schedule.catalog` key union declared by @deepseek-ai/dsh-client-ui-schedule.
import type {} from '@deepseek-ai/dsh-client-ui-schedule/client'

/** `schedule.catalog` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'schedule.catalog'> = {
  'trigger.one': '{count} 件のリマインダー',
  'trigger.other': '{count} 件のリマインダー',
  'list.aria': '有効なリマインダー',
  'status.scheduled': '予定済み',
  'status.overdue': '期限超過',
  'frequency.once': '1 回',
  'frequency.every': '{value}{unit}ごと',
  'unit.day.one': '日',
  'unit.day.other': '日',
  'unit.hour.one': '時間',
  'unit.hour.other': '時間',
  'unit.minute.one': '分',
  'unit.minute.other': '分',
  'unit.second.one': '秒',
  'unit.second.other': '秒',
  'relative.now': '期限到来',
  'relative.future': '{value}{unit}後',
  'relative.overdue': '{value}{unit}超過',
}
