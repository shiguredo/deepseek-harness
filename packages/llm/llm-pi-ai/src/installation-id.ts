/**
 * The stable installation id an account sign-in may present as this app's
 * agent host. OpenAI's Sign in with ChatGPT identifies the app, not the route,
 * so it asks for a UUID that must stay the same on every later sign-in.
 *
 * The id lives under the Harness home beside the other installation records, so
 * every profile and every Web instance presents one installation. A malformed
 * file fails the sign-in instead of silently minting a second installation,
 * because the issuer's device list would then hold an entry nobody can revoke.
 *
 * OpenAI's guide asks for one stable, opaque host id per installation, sent as
 * `ext_agent_host_id`; this adapter stores the bare UUID and pi-ai sends
 * `urn:uuid:<uuid>`. The id is not a credential: it names the host whose plan
 * usage the issuer attributes and never authenticates a request. A credential
 * copied to another host travels without it.
 *
 * @module dsh-llm-pi-ai/installation-id
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { HarnessError } from '@deepseek-ai/dsh-error'

/** File under the Harness home holding this installation's agent host id. */
export const AGENT_HOST_ID_FILE_NAME = 'agent-host-id'

/** Error code of an agent host id file this harness cannot present. */
export const INVALID_AGENT_HOST_ID = 'INVALID_AGENT_HOST_ID'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One stored id, without the newline a hand-edited file may add. */
function parseAgentHostId(path: string, content: string): string {
  const trimmed = content.trim()
  if (!UUID.test(trimmed)) {
    throw new HarnessError(
      `the agent host id at ${path} is not a UUID; delete the file to let this installation present a new id`,
      INVALID_AGENT_HOST_ID,
    )
  }
  return trimmed
}

/** Read the stored id, or `undefined` when the file does not exist yet. */
async function readStored(path: string): Promise<string | undefined> {
  try {
    return parseAgentHostId(path, await readFile(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Read this installation's agent host id, creating it on first use.
 *
 * Concurrent first sign-ins agree on one id: the write refuses to replace an
 * existing file, and the loser re-reads the winner's value.
 * @param path - the id file; defaults to the Harness home's installation record.
 * @returns the stable UUID this installation presents.
 * @throws {HarnessError} `INVALID_AGENT_HOST_ID` when the stored file is malformed.
 */
export async function readAgentHostId(path: string = dshHomePath(AGENT_HOST_ID_FILE_NAME)): Promise<string> {
  const stored = await readStored(path)
  if (stored !== undefined) return stored
  await mkdir(dirname(path), { recursive: true })
  const created = randomUUID()
  try {
    await writeFile(path, `${created}\n`, { flag: 'wx', mode: 0o600 })
    return created
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const raced = await readStored(path)
    if (raced !== undefined) return raced
    throw error
  }
}
