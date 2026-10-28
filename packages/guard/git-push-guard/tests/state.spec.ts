import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadGuardState, saveGuardState, sessionEnabled, type MutableGuardState } from '../src/state.ts'

const directories: string[] = []

function stateFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-git-push-guard-'))
  directories.push(directory)
  return join(directory, 'state.json')
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('loadGuardState', () => {
  it('falls back to the configured default when the file is absent', () => {
    expect(loadGuardState(stateFile(), true)).toEqual({ default: true, sessions: {} })
    expect(loadGuardState(stateFile(), false)).toEqual({ default: false, sessions: {} })
  })

  it('reads the stored default and the boolean session choices', () => {
    const file = stateFile()
    saveGuardState(file, { default: false, sessions: { a: true, b: false } })
    expect(loadGuardState(file, true)).toEqual({ default: false, sessions: { a: true, b: false } })
  })

  it('drops malformed entries and keeps the configured default', () => {
    const file = stateFile()
    saveGuardState(file, { default: true, sessions: {} })
    expect(loadGuardState(file, true)).toEqual({ default: true, sessions: {} })
    expect(loadGuardState(stateFile(), true)).toEqual({ default: true, sessions: {} })
  })

  it('survives a corrupt file', () => {
    const file = stateFile()
    saveGuardState(file, { default: false, sessions: {} })
    expect(loadGuardState(file, true).default).toBe(false)
    expect(loadGuardState(join(file, 'missing'), true)).toEqual({ default: true, sessions: {} })
  })
})

describe('loadGuardState malformed shapes', () => {
  it('falls back for a non-object root and a non-object sessions field', () => {
    const root = stateFile()
    writeFileSync(root, '"text"')
    expect(loadGuardState(root, true)).toEqual({ default: true, sessions: {} })

    const sessions = stateFile()
    writeFileSync(sessions, JSON.stringify({ default: false, sessions: 'x' }))
    expect(loadGuardState(sessions, true)).toEqual({ default: false, sessions: {} })
  })

  it('drops non-boolean session values and keeps a non-boolean default out', () => {
    const file = stateFile()
    writeFileSync(file, JSON.stringify({ default: 'x', sessions: { a: 'yes', b: true } }))
    expect(loadGuardState(file, true)).toEqual({ default: true, sessions: { b: true } })
  })

  it('falls back for unreadable JSON', () => {
    const file = stateFile()
    writeFileSync(file, '{not json')
    expect(loadGuardState(file, false)).toEqual({ default: false, sessions: {} })
  })
})

describe('saveGuardState', () => {
  it('writes one JSON snapshot', () => {
    const file = stateFile()
    saveGuardState(file, { default: true, sessions: { a: false } })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ default: true, sessions: { a: false } })
  })
})

describe('sessionEnabled', () => {
  it('captures the current default on first use and persists it', () => {
    const state: MutableGuardState = { default: true, sessions: {} }
    let persisted = 0
    expect(sessionEnabled(state, 'a', () => { persisted += 1 })).toBe(true)
    expect(persisted).toBe(1)
    expect(state.sessions).toEqual({ a: true })
    expect(sessionEnabled(state, 'a', () => { persisted += 1 })).toBe(true)
    expect(persisted).toBe(1)
  })

  it('returns an explicit session choice without capturing the default', () => {
    const state: MutableGuardState = { default: true, sessions: { a: false } }
    let persisted = 0
    expect(sessionEnabled(state, 'a', () => { persisted += 1 })).toBe(false)
    expect(persisted).toBe(0)
  })
})
