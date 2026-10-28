/**
 * Recognition of push-creating Git commands in shell command strings.
 *
 * Detection is intentionally conservative: it recognizes the common ways an
 * agent starts Git (`git`, `git.exe`, a path ending in `git` or `git.exe`, a
 * shell wrapper, a shell `-c` payload, a PowerShell `-Command` payload, or a
 * `cmd /c` payload) and the global options that may precede the subcommand.
 * Anything it does not recognize is left to the user's own review; the guard is
 * an accident guard, not a sandbox.
 *
 * PowerShell is a real supported dialect, not an extension of POSIX syntax:
 * the call operator `&` and `C:\` paths are ordinary command text here, and
 * `cmd` and `pwsh` payload flags introduce a nested command string the same way
 * `sh -c` does.
 *
 * @module @deepseek-ai/dsh-git-push-guard/push-command
 */

/** Read a character whose index the caller proved in range. */
function charAt(text: string, index: number): string {
  return text[index] as string
}

/** Git subcommands that publish to a remote without a prior explicit approval. */
const PUSH_SUBCOMMANDS = new Set(['push'])

/** Git global options that consume the following word; every other option is a flag. */
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix'])

/** Windows executable suffixes a program word may carry. */
const WINDOWS_EXECUTABLE_SUFFIXES = ['.exe', '.com', '.cmd', '.bat'] as const

/** Shells whose payload is another command string, and the flags that introduce it. */
const SHELL_FLAGS: ReadonlyMap<string, readonly string[]> = new Map([
  ['sh', ['-c']],
  ['bash', ['-c']],
  ['zsh', ['-c']],
  ['dash', ['-c']],
  ['fish', ['-c']],
  ['pwsh', ['-c', '-command']],
  ['powershell', ['-c', '-command']],
  ['cmd', ['/c', '/k']],
])

/** Shells that accept POSIX short-option clusters such as `-lc`. */
const POSIX_SHELLS = new Set(['sh', 'bash', 'zsh', 'dash'])

/** Programs that wrap another command and may precede it in one segment. */
const WRAPPERS = new Set(['sudo', 'env', 'command', 'builtin', 'nohup', 'time', 'exec', 'xargs', 'start'])

/** Environment assignments that may precede a command, including PowerShell's `$env:` form. */
const ASSIGNMENT = /^(?:\$env:|\$)?[A-Za-z_][A-Za-z0-9_]*=/u

/** POSIX short-option cluster carrying `c`, which makes the next word a command string. */
const SHELL_COMMAND_CLUSTER = /^-[^-]*c/u

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
 * Strip a directory prefix and a Windows executable suffix from a command word.
 * @param word - one command word.
 * @returns the executable's base name.
 */
function executableName(word: string): string {
  const separator = Math.max(word.lastIndexOf('/'), word.lastIndexOf('\\'))
  const base = separator === -1 ? word : word.slice(separator + 1)
  const lower = base.toLowerCase()
  for (const suffix of WINDOWS_EXECUTABLE_SUFFIXES) {
    if (lower.endsWith(suffix)) return base.slice(0, -suffix.length)
  }
  return base
}

/**
 * Return the nested command string a shell segment runs, if its arguments
 * contain a payload flag.
 * @param words - the segment's words; the first word is the shell.
 * @param flags - the flags that introduce a nested command string for this shell.
 * @param posix - whether the shell accepts POSIX short-option clusters.
 * @returns the nested command string, or undefined for a plain script run.
 */
function shellPayloadIn(words: readonly string[], flags: readonly string[], posix: boolean): string | undefined {
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index] as string
    const lower = word.toLowerCase()
    if (flags.includes(lower) || (posix && SHELL_COMMAND_CLUSTER.test(lower))) {
      return words.slice(index + 1).join(' ')
    }
    if (!lower.startsWith('-') && !lower.startsWith('/')) return undefined
  }
  return undefined
}

/**
 * Return the push-creating Git subcommand one command segment runs.
 * @param segment - one shell command segment.
 * @returns the matched subcommand, or undefined.
 */
function pushSubcommandIn(segment: string): string | undefined {
  let current = words(segment)
  while (current.length > 0) {
    while (current.length > 0 && ASSIGNMENT.test(current[0] as string)) current = current.slice(1)
    if (current.length === 0) break
    const head = executableName(current[0] as string).toLowerCase()
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
      if (subcommand !== undefined && PUSH_SUBCOMMANDS.has(subcommand)) return subcommand
      break
    }
    const flags = SHELL_FLAGS.get(head)
    if (flags !== undefined) {
      const nested = shellPayloadIn(current, flags, POSIX_SHELLS.has(head))
      if (nested !== undefined) {
        const subcommand = pushSubcommandOf(nested)
        if (subcommand !== undefined) return subcommand
      }
      break
    }
    if (head === 'eval') {
      const nested = pushSubcommandOf(current.slice(1).join(' '))
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
 * Return the push-creating Git subcommand a shell command runs, if any.
 * @param command - one shell command string.
 * @returns the matched subcommand, or undefined.
 */
export function pushSubcommandOf(command: string): string | undefined {
  for (const segment of segments(command)) {
    const subcommand = pushSubcommandIn(segment)
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
