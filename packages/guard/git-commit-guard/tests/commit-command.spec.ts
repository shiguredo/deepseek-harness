import { describe, expect, it } from 'vitest'
import { commandDetailOf, commitSubcommandOf } from '../src/commit-command.ts'

describe('commitSubcommandOf', () => {
  it('recognizes the commit-creating subcommands', () => {
    expect(commitSubcommandOf('git commit -m "x"')).toBe('commit')
    expect(commitSubcommandOf('git commit-tree HEAD^{tree}')).toBe('commit-tree')
    expect(commitSubcommandOf('git merge feature')).toBe('merge')
    expect(commitSubcommandOf('git rebase main')).toBe('rebase')
    expect(commitSubcommandOf('git cherry-pick abc123')).toBe('cherry-pick')
    expect(commitSubcommandOf('git revert HEAD')).toBe('revert')
    expect(commitSubcommandOf('git am patch.mbox')).toBe('am')
  })

  it('ignores read-only and informational commands', () => {
    expect(commitSubcommandOf('git status')).toBeUndefined()
    expect(commitSubcommandOf('git log --grep commit')).toBeUndefined()
    expect(commitSubcommandOf('grep -rn "git commit" docs')).toBeUndefined()
    expect(commitSubcommandOf('echo "git commit"')).toBeUndefined()
    expect(commitSubcommandOf('ls')).toBeUndefined()
  })

  it('skips git global options before the subcommand', () => {
    expect(commitSubcommandOf('git -C repo commit -m x')).toBe('commit')
    expect(commitSubcommandOf('git -c user.name=x commit -m x')).toBe('commit')
    expect(commitSubcommandOf('git --no-pager commit -m x')).toBe('commit')
    expect(commitSubcommandOf('git --git-dir=.git commit -m x')).toBe('commit')
    expect(commitSubcommandOf('git -- commit -m x')).toBe('commit')
  })

  it('recognizes git behind wrappers and shell payloads', () => {
    expect(commitSubcommandOf('sudo git commit -m x')).toBe('commit')
    expect(commitSubcommandOf('env GIT_AUTHOR_NAME=x git commit -m x')).toBe('commit')
    expect(commitSubcommandOf('sh -c "git commit -m x"')).toBe('commit')
    expect(commitSubcommandOf('bash -c "git -C repo commit -m x"')).toBe('commit')
    expect(commitSubcommandOf('eval "git commit -m x"')).toBe('commit')
    expect(commitSubcommandOf('/usr/bin/git commit -m x')).toBe('commit')
  })

  it('looks at every segment separated by shell operators', () => {
    expect(commitSubcommandOf('cd repo && git commit -m x')).toBe('commit')
    expect(commitSubcommandOf('true; git merge main')).toBe('merge')
    expect(commitSubcommandOf('git add . | tee log')).toBeUndefined()
    expect(commitSubcommandOf('git status\ngit commit -m x')).toBe('commit')
  })

  it('handles assignment-only segments, plain shell scripts, and wrapper values', () => {
    expect(commitSubcommandOf('FOO=bar')).toBeUndefined()
    expect(commitSubcommandOf('sh script.sh')).toBeUndefined()
    expect(commitSubcommandOf('env -i git commit -m x')).toBe('commit')
  })

  it('looks through wrappers without a nested commit and past option values', () => {
    expect(commitSubcommandOf('sh -c "echo hi"')).toBeUndefined()
    expect(commitSubcommandOf('eval "echo hi"')).toBeUndefined()
    expect(commitSubcommandOf('sudo -i FOO=bar git commit -m x')).toBe('commit')
    expect(commitSubcommandOf('git')).toBeUndefined()
    expect(commitSubcommandOf('git --')).toBeUndefined()
  })

  it('ignores unmatched quoting and empty input', () => {
    expect(commitSubcommandOf('')).toBeUndefined()
    expect(commitSubcommandOf('git "commit" -m x')).toBe('commit')
  })
})

describe('commandDetailOf', () => {
  it('trims the command and caps its length', () => {
    expect(commandDetailOf('  git commit -m x  ')).toBe('git commit -m x')
    expect(commandDetailOf('x'.repeat(600))).toHaveLength(500)
  })
})
