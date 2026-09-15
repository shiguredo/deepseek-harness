/** `gitBranch` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'gitBranch'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'branch.tooltip': '分支 {ref}',
  'detached.tooltip': '游离 HEAD {ref}',
  'worktree.tooltip': '(工作树 {name})',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<GitBranchKey, string> = {
  'branch.tooltip': 'Branch {ref}',
  'detached.tooltip': 'Detached HEAD {ref}',
  'worktree.tooltip': '(worktree {name})',
}

/** Key domain of the `gitBranch` namespace (zh is the source of truth). */
export type GitBranchKey = keyof typeof zh
