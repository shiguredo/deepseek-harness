/** Japanese dictionary for the `settings.subagent` namespace (client/ui-settings-subagent/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `settings.subagent` key union declared by @deepseek-ai/dsh-client-ui-settings-subagent.
import type {} from '@deepseek-ai/dsh-client-ui-settings-subagent/client'

/** `settings.subagent` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'settings.subagent'> = {
  'overridden': 'オーバーライド済み',
  'reset': 'デフォルトに戻す',
  'readOnly': 'このデプロイの設定は読み取り専用です。',
  'unavailable': 'このプラグインは現在読み込まれていないため、設定できません。',
  'save': '保存',
  'saving': '保存中…',
  'saveFailed': 'このデプロイは値を受理しませんでした。修正できるよう残しています。',
  'subagentTitle': 'Subagent',
  'subagentDescription': 'Subagent の再帰階層・同時数・モデルを設定します。',
  'subagentLimitsTitle': '実行制限',
  'subagentMaxDepth': '最大再帰深度',
  'subagentDepthHelpLabel': '最大再帰深度について',
  'subagentDepthHelp': 'Agent が Subagent を作成できる階層の深さを制限します。',
  'subagentDepthZero': 'Subagent を無効化',
  'subagentDepthOne': 'メイン Agent のみ Subagent を作成できる',
  'subagentDepthOverride': 'ツールが独自の最大再帰深度を定義している場合は、その設定が優先されます。',
  'subagentMaxActive': 'Subagent の並列数上限',
  'subagentCapacityHelpLabel': 'Subagent の並列数上限について',
  'subagentCapacityHelp': '同じメイン Agent 配下で、すべての再帰階層を通じて同時に存在できる Subagent の合計数です。メイン Agent は含みません。上限に達すると新しい起動リクエストは拒否されます。',
  'subagentDepthInvalid': '0 以上の整数を入力してください。',
  'subagentCapacityInvalid': '1 以上の整数を入力してください。',
  'subagentModelSelectionTitle': 'モデル選択',
  'subagentModelSelectionToggle': 'Agent に Subagent のモデル選択を許可する',
  'subagentModelSelectionChoose': '有効にすると、Agent は下の許可済みモデルから Subagent ごとにプロバイダー・モデル・推論強度を選べます。新しいセッションにのみ適用されます。',
  'subagentModelSelectionAllowed': 'Agent が選択できるモデル',
  'subagentModelSelectionLoading': 'モデルを読み込んでいます…',
  'subagentModelSelectionLoadFailed': 'モデルを読み込めませんでした。',
  'subagentModelSelectionRetry': '再試行',
  'subagentModelSelectionPartial': '一部のモデルプロバイダーを読み込めませんでした。保存済みの選択は削除できます。',
  'subagentModelSelectionUnavailable': '現在利用できません',
  'subagentModelSelectionUnavailableGroup': '保存済みだが現在利用できません',
  'subagentModelSelectionEmpty': '現在モデルを公開しているプロバイダーはありません。',
  'subagentModelSelectionRequired': '保存する前にモデルを 1 つ以上選択してください。',
  'subagentModelSelectionConflict': '設定が別の場所で変更されました。変更を破棄して再試行してください。',
  'subagentModelSelectionOff': 'Subagent は設定済みのデフォルトを使用するか、親 Agent のモデルを継承します。保存済みのモデル選択は保持されます。',
}
