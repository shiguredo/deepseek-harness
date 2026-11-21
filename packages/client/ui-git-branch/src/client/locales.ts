/** `gitBranch` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'gitBranch'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'branch.tooltip': '分支 {ref}',
  'detached.tooltip': '游离 HEAD {ref}',
  'worktree.tooltip': '(工作树 {name})',
  'path.tooltip': '位于 {path}',
  'dialog.title': '检出',
  'dialog.branch': '分支',
  'dialog.commit': '提交',
  'dialog.worktree': '工作树',
  'dialog.path': '路径',
  'dialog.repository': '仓库',
  'dialog.none': '—',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<GitBranchKey, string> = {
  'branch.tooltip': 'Branch {ref}',
  'detached.tooltip': 'Detached HEAD {ref}',
  'worktree.tooltip': '(worktree {name})',
  'path.tooltip': 'at {path}',
  'dialog.title': 'Checkout',
  'dialog.branch': 'Branch',
  'dialog.commit': 'Commit',
  'dialog.worktree': 'Worktree',
  'dialog.path': 'Path',
  'dialog.repository': 'Repository',
  'dialog.none': '—',
}

/** Japanese dictionary, key-identical to the Chinese source of truth. */
export const ja: Record<GitBranchKey, string> = {
  'branch.tooltip': 'ブランチ {ref}',
  'detached.tooltip': 'デタッチド HEAD {ref}',
  'worktree.tooltip': '（ワークツリー {name}）',
  'path.tooltip': '{path} にあります',
  'dialog.title': 'チェックアウト',
  'dialog.branch': 'ブランチ',
  'dialog.commit': 'コミット',
  'dialog.worktree': 'ワークツリー',
  'dialog.path': 'パス',
  'dialog.repository': 'リポジトリ',
  'dialog.none': '—',
}

/** Spanish dictionary, key-identical to the Chinese source of truth. */
export const es: Record<GitBranchKey, string> = {
  'branch.tooltip': 'Rama {ref}',
  'detached.tooltip': 'HEAD desacoplado {ref}',
  'worktree.tooltip': '(árbol de trabajo {name})',
  'path.tooltip': 'en {path}',
  'dialog.title': 'Checkout',
  'dialog.branch': 'Rama',
  'dialog.commit': 'Commit',
  'dialog.worktree': 'Árbol de trabajo',
  'dialog.path': 'Ruta',
  'dialog.repository': 'Repositorio',
  'dialog.none': '—',
}

/** French dictionary, key-identical to the Chinese source of truth. */
export const fr: Record<GitBranchKey, string> = {
  'branch.tooltip': 'Branche {ref}',
  'detached.tooltip': 'HEAD détaché {ref}',
  'worktree.tooltip': '(arbre de travail {name})',
  'path.tooltip': 'dans {path}',
  'dialog.title': 'Checkout',
  'dialog.branch': 'Branche',
  'dialog.commit': 'Commit',
  'dialog.worktree': 'Arbre de travail',
  'dialog.path': 'Chemin',
  'dialog.repository': 'Dépôt',
  'dialog.none': '—',
}

/** German dictionary, key-identical to the Chinese source of truth. */
export const de: Record<GitBranchKey, string> = {
  'branch.tooltip': 'Branch {ref}',
  'detached.tooltip': 'Detached HEAD {ref}',
  'worktree.tooltip': '(Worktree {name})',
  'path.tooltip': 'unter {path}',
  'dialog.title': 'Checkout',
  'dialog.branch': 'Branch',
  'dialog.commit': 'Commit',
  'dialog.worktree': 'Worktree',
  'dialog.path': 'Pfad',
  'dialog.repository': 'Repository',
  'dialog.none': '—',
}

/** Russian dictionary, key-identical to the Chinese source of truth. */
export const ru: Record<GitBranchKey, string> = {
  'branch.tooltip': 'Ветка {ref}',
  'detached.tooltip': 'Отсоединённый HEAD {ref}',
  'worktree.tooltip': '(рабочее дерево {name})',
  'path.tooltip': 'в {path}',
  'dialog.title': 'Checkout',
  'dialog.branch': 'Ветка',
  'dialog.commit': 'Коммит',
  'dialog.worktree': 'Рабочее дерево',
  'dialog.path': 'Путь',
  'dialog.repository': 'Репозиторий',
  'dialog.none': '—',
}

/** Portuguese dictionary, key-identical to the Chinese source of truth. */
export const pt: Record<GitBranchKey, string> = {
  'branch.tooltip': 'Branch {ref}',
  'detached.tooltip': 'HEAD desanexado {ref}',
  'worktree.tooltip': '(worktree {name})',
  'path.tooltip': 'em {path}',
  'dialog.title': 'Checkout',
  'dialog.branch': 'Branch',
  'dialog.commit': 'Commit',
  'dialog.worktree': 'Worktree',
  'dialog.path': 'Caminho',
  'dialog.repository': 'Repositório',
  'dialog.none': '—',
}

/** Key domain of the `gitBranch` namespace (zh is the source of truth). */
export type GitBranchKey = keyof typeof zh
