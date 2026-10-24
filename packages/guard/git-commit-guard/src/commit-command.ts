/**
 * Recognition of commit-creating Git commands in shell command strings.
 *
 * Detection is intentionally conservative: it recognizes the common ways an
 * agent starts Git (`git`, a path ending in `/git`, a shell wrapper, a shell
 * `-c` payload) and the global options that may precede a subcommand. Anything
 * it does not recognize is left to the user's own review; the guard is an
 * accident guard, not a sandbox.
 *
 * @module @deepseek-ai/dsh-git-commit-guard/commit-command
 */

/** Read a character whose index the caller proved in range. */
function charAt(text: string, index: number): string {
  return text[index] as string
}

/** Git subcommands that create a commit without a prior explicit approval. */
const COMMIT_SUBCOMMANDS = new Set(['commit', 'commit-tree', 'merge', 'rebase', 'cherry-pick', 'revert', 'am'])

/** Git global options that consume the following word; every other option is a flag. */
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix'])

/** Shells whose `-c` payload is another command string. */
const SHELL_COMMANDS = new Set(['sh', 'bash', 'zsh', 'dash', 'fish'])

/** Programs that wrap another command and may precede it in one segment. */
const WRAPPERS = new Set(['sudo', 'env', 'command', 'builtin', 'nohup', 'time', 'exec', 'xargs'])

/**
 * Split a shell command into command segments at unquoted separators.
 * @param command - the whole shell command string.
 * @returns the non-empty segments, in order.
 */
function segments(command: string): string[] {
  const result: string[] = []
  let current = ''
  let quote: string | null = null
  for (let index = 0; index < command.length; index += 1) {
    const char = charAt(command, index)
    if (quote !== null) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      current += char
      continue
    }
    if ((char === '&' && charAt(command, index + 1) === '&') || (char === '|' && charAt(command, index + 1) === '|')) {
      result.push(current)
      current = ''
      index += 1
      continue
    }
    if (char === ';' || char === '|' || char === '&' || char === '\n') {
      result.push(current)
      current = ''
      continue
    }
    current += char
  }
  result.push(current)
  return result.filter(segment => segment.trim().length > 0)
}

/**
 * Split one command segment into words, dropping shell quoting.
 * @param segment - one segment produced by {@link segments}.
 * @returns the words in order.
 */
function words(segment: string): string[] {
  const result: string[] = []
  let current = ''
  let quote: string | null = null
  let started = false
  for (const char of segment) {
    if (quote !== null) {
      if (char === quote) quote = null
      else current += char
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      started = true
      continue
    }
    if (char === ' ' || char === '\t' || char === '\r') {
      if (started) {
        result.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += char
    started = true
  }
  if (started) result.push(current)
  return result
}

/**
 * Strip a directory prefix from an executable word.
 * @param word - one command word.
 * @returns the executable's base name.
 */
function executableName(word: string): string {
  const slash = word.lastIndexOf('/')
  return slash === -1 ? word : word.slice(slash + 1)
}

/**
 * Return the commit-creating Git subcommand one command segment runs.
 * @param segment - one shell command segment.
 * @returns the matched subcommand, or undefined.
 */
function commitSubcommandIn(segment: string): string | undefined {
  let current = words(segment)
  while (current.length > 0) {
    while (current.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/u.test(current[0] as string)) current = current.slice(1)
    if (current.length === 0) break
    const head = executableName(current[0] as string)
    if (head === 'git') {
      let index = 1
      while (index < current.length) {
        const word = current[index] as string
        if (word === '--') {
          index += 1
          break
        }
        if (!word.startsWith('-')) break
        index += GIT_VALUE_OPTIONS.has(word) ? 2 : 1
      }
      const subcommand = current[index]
      if (subcommand !== undefined && COMMIT_SUBCOMMANDS.has(subcommand)) return subcommand
      break
    }
    if (SHELL_COMMANDS.has(head)) {
      const dashC = current.indexOf('-c')
      if (dashC !== -1) {
        const nested = commitSubcommandOf(current.slice(dashC + 1).join(' '))
        if (nested !== undefined) return nested
      }
      break
    }
    if (head === 'eval') {
      const nested = commitSubcommandOf(current.slice(1).join(' '))
      if (nested !== undefined) return nested
      break
    }
    if (WRAPPERS.has(head)) {
      current = current.slice(1)
      while (current.length > 0 && (current[0] as string).startsWith('-')) {
        current = current.slice(1)
        if (current.length > 0 && !(current[0] as string).startsWith('-') && (current[0] as string).includes('=')) current = current.slice(1)
      }
      continue
    }
    break
  }
  return undefined
}

/**
 * Return the commit-creating Git subcommand a shell command runs, if any.
 * @param command - one shell command string.
 * @returns the matched subcommand, or undefined.
 */
export function commitSubcommandOf(command: string): string | undefined {
  for (const segment of segments(command)) {
    const subcommand = commitSubcommandIn(segment)
    if (subcommand !== undefined) return subcommand
  }
  return undefined
}

/**
 * The model-facing command text shown in the confirmation question.
 * @param command - one shell command string.
 * @returns the command, trimmed and capped for the question detail.
 */
export function commandDetailOf(command: string): string {
  return command.trim().slice(0, 500)
}
