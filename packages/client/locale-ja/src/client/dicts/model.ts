/** Japanese dictionary for the `model` namespace (client/ui-model-selection/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `model` key union declared by @deepseek-ai/dsh-client-ui-model-selection.
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'

/** `model` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'model'> = {
  'provider.account': 'DeepSeek アカウント',
  'command.label': 'モデル',
  'command.description': 'この会話で使用するモデルを選択します',
  'option.loadError': 'カタログの読み込みに失敗しました：{message}',
  'option.deepseekV4Flash.description': '高速・高効率・低コスト。目的が明確なタスクや定型タスク、並列タスクに適しています。',
  'option.deepseekV4Pro.description': 'エージェント型コーディング、知識、複雑な推論に優れます。複雑なタスクや品質重視のタスクに適していますが、コストは高くなります。',
  'trigger.fallback': 'モデルを選択',
  'trigger.loading': 'モデルを読み込んでいます…',
  'trigger.selectAria': 'モデルを選択',
  'trigger.aria': 'モデルを選択、現在 {model}',
  'trigger.ariaEffort': 'モデルを選択、現在 {model}、推論レベル {effort}',
  'menu.aria': 'モデルと推論レベル',
  'menu.model': 'モデル',
  'menu.effort': '推論レベル',
  'effort.providerDefault': 'デフォルト',
  'status.loading': 'モデル一覧を更新しています…',
  'error.action': 'モデル操作に失敗しました：{message}',
  'error.sessionInUse': 'このセッションは既に使用中です（他の dsh web やデスクトップアプリなど、別の DSH が実行中の可能性があります）。他の DSH を終了してから再試行してください',
  'action.reload': '再読み込み',
  'warning.groupLoad': '{name} の読み込みに失敗しました：{message}',
  'empty.models': '利用可能なモデルがありません。',
  'empty.efforts': 'このモデルには推論レベルがありません。',
}
