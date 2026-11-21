/** The installation id an app-identifying account sign-in presents, and what a malformed record does. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AGENT_HOST_ID_FILE_NAME, readAgentHostId } from '../src/installation-id.ts'

const dirs: string[] = []

/** A temporary directory holding one id file's surroundings. */
async function tempPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-agent-host-id-'))
  dirs.push(dir)
  return join(dir, AGENT_HOST_ID_FILE_NAME)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('readAgentHostId', () => {
  it('creates one id on first use and returns it on every later call', async () => {
    const path = await tempPath()

    const first = await readAgentHostId(path)
    expect(first).toMatch(UUID)
    await expect(readFile(path, 'utf8')).resolves.toBe(`${first}\n`)
    await expect(readAgentHostId(path)).resolves.toBe(first)
  })

  it('accepts a hand-edited file that only differs in whitespace', async () => {
    const path = await tempPath()
    await writeFile(path, '3f2b8c1a-9d4e-4a71-8c55-0b6f2d9e7a10  \n\n')

    await expect(readAgentHostId(path)).resolves.toBe('3f2b8c1a-9d4e-4a71-8c55-0b6f2d9e7a10')
  })

  it('refuses a record that is not a UUID instead of minting a second installation', async () => {
    const path = await tempPath()
    await writeFile(path, 'not-an-id\n')

    await expect(readAgentHostId(path)).rejects.toMatchObject({
      code: 'INVALID_AGENT_HOST_ID',
      message: expect.stringContaining(path) as string,
    })
  })

  it('settles concurrent first calls on the id one of them wrote', async () => {
    const path = await tempPath()

    const ids = await Promise.all(Array.from({ length: 5 }, () => readAgentHostId(path)))

    expect(new Set(ids).size).toBe(1)
    await expect(readFile(path, 'utf8')).resolves.toBe(`${ids[0]}\n`)
  })
})
