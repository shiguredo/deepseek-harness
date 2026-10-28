import { describe, expect, it } from 'vitest'
import { commandDetailOf, pushSubcommandOf } from '../src/push-command.ts'

describe('pushSubcommandOf', () => {
  it('recognizes a git push and its arguments', () => {
    expect(pushSubcommandOf('git push')).toBe('push')
    expect(pushSubcommandOf('git push origin main')).toBe('push')
    expect(pushSubcommandOf('git push --force-with-lease origin main')).toBe('push')
  })

  it('ignores commands that do not publish to a remote', () => {
    expect(pushSubcommandOf('git status')).toBeUndefined()
    expect(pushSubcommandOf('git log --grep push')).toBeUndefined()
    expect(pushSubcommandOf('git commit -m x')).toBeUndefined()
    expect(pushSubcommandOf('git merge main')).toBeUndefined()
    expect(pushSubcommandOf('git rebase main')).toBeUndefined()
    expect(pushSubcommandOf('git cherry-pick abc123')).toBeUndefined()
    expect(pushSubcommandOf('grep -rn "git push" docs')).toBeUndefined()
    expect(pushSubcommandOf('echo "git push"')).toBeUndefined()
    expect(pushSubcommandOf('ls')).toBeUndefined()
  })

  it('skips git global options before the subcommand', () => {
    expect(pushSubcommandOf('git -C repo push')).toBe('push')
    expect(pushSubcommandOf('git -c user.name=x push')).toBe('push')
    expect(pushSubcommandOf('git --no-pager push')).toBe('push')
    expect(pushSubcommandOf('git --git-dir=.git push')).toBe('push')
    expect(pushSubcommandOf('git -- push')).toBe('push')
  })

  it('recognizes git behind POSIX wrappers and shell payloads', () => {
    expect(pushSubcommandOf('sudo git push')).toBe('push')
    expect(pushSubcommandOf('env GIT_SSH_COMMAND=ssh git push')).toBe('push')
    expect(pushSubcommandOf('sh -c "git push"')).toBe('push')
    expect(pushSubcommandOf('bash -c "git -C repo push"')).toBe('push')
    expect(pushSubcommandOf('bash -lc "git push"')).toBe('push')
    expect(pushSubcommandOf('eval "git push"')).toBe('push')
    expect(pushSubcommandOf('/usr/bin/git push')).toBe('push')
    expect(pushSubcommandOf('sudo -i FOO=bar git push')).toBe('push')
    expect(pushSubcommandOf('env -i git push')).toBe('push')
    expect(pushSubcommandOf('xargs -0 git push')).toBe('push')
  })

  it('recognizes the Windows executable and path forms', () => {
    expect(pushSubcommandOf('git.exe push')).toBe('push')
    expect(pushSubcommandOf('GIT.EXE push')).toBe('push')
    expect(pushSubcommandOf('git.cmd push')).toBe('push')
    expect(pushSubcommandOf('git.bat push')).toBe('push')
    expect(pushSubcommandOf('C:\\Program Files\\Git\\bin\\git.exe push')).toBeUndefined()
    expect(pushSubcommandOf('"C:\\Program Files\\Git\\bin\\git.exe" push')).toBe('push')
    expect(pushSubcommandOf('& "C:\\Program Files\\Git\\bin\\git.exe" push')).toBe('push')
    expect(pushSubcommandOf('& git push')).toBe('push')
  })

  it('recognizes PowerShell and cmd payload flags', () => {
    expect(pushSubcommandOf('pwsh -Command "git push"')).toBe('push')
    expect(pushSubcommandOf('pwsh -command "git push"')).toBe('push')
    expect(pushSubcommandOf('pwsh -NoProfile -Command "git push origin main"')).toBe('push')
    expect(pushSubcommandOf('pwsh -c "git push"')).toBe('push')
    expect(pushSubcommandOf('powershell.exe -Command "git push"')).toBe('push')
    expect(pushSubcommandOf('cmd /c "git push"')).toBe('push')
    expect(pushSubcommandOf('cmd.exe /d /s /c "git push"')).toBe('push')
    expect(pushSubcommandOf('cmd /k git push')).toBe('push')
  })

  it('skips PowerShell environment assignments before the command', () => {
    expect(pushSubcommandOf('$env:GIT_SSH_COMMAND="ssh"; git push')).toBe('push')
    expect(pushSubcommandOf('$GIT_TRACE=1 git push')).toBe('push')
    expect(pushSubcommandOf('FOO=bar BAZ=qux git push')).toBe('push')
    expect(pushSubcommandOf('FOO=bar')).toBeUndefined()
  })

  it('looks at every segment separated by shell operators', () => {
    expect(pushSubcommandOf('cd repo && git push')).toBe('push')
    expect(pushSubcommandOf('true; git push')).toBe('push')
    expect(pushSubcommandOf('false || git push')).toBe('push')
    expect(pushSubcommandOf('git status\ngit push')).toBe('push')
    expect(pushSubcommandOf('git add . | tee log')).toBeUndefined()
  })

  it('leaves quoted separators, script runs, and incomplete payloads alone', () => {
    expect(pushSubcommandOf('echo "a && git push"')).toBeUndefined()
    expect(pushSubcommandOf("echo 'a; git push'")).toBeUndefined()
    expect(pushSubcommandOf('sh script.sh')).toBeUndefined()
    expect(pushSubcommandOf('sh -x')).toBeUndefined()
    expect(pushSubcommandOf('pwsh -lc "git push"')).toBeUndefined()
    expect(pushSubcommandOf('sh -c')).toBeUndefined()
    expect(pushSubcommandOf('sh -c "echo hi"')).toBeUndefined()
    expect(pushSubcommandOf('eval "echo hi"')).toBeUndefined()
    expect(pushSubcommandOf('sudo -i')).toBeUndefined()
  })

  it('handles empty and malformed command text', () => {
    expect(pushSubcommandOf('')).toBeUndefined()
    expect(pushSubcommandOf('  ')).toBeUndefined()
    expect(pushSubcommandOf('git')).toBeUndefined()
    expect(pushSubcommandOf('git --')).toBeUndefined()
    expect(pushSubcommandOf('git "push" -m x')).toBe('push')
    expect(pushSubcommandOf('git "" push')).toBeUndefined()
  })
})

describe('commandDetailOf', () => {
  it('trims the command and caps its length', () => {
    expect(commandDetailOf('  git push  ')).toBe('git push')
    expect(commandDetailOf('x'.repeat(600))).toHaveLength(500)
  })
})
