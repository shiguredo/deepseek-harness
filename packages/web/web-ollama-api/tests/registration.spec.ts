/** Provider registration follows the credential plane: no key, no listed provider. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as ollamaPlugin from '@deepseek-ai/dsh-web-ollama-api'
import { OLLAMA_CREDENTIAL_REF, OLLAMA_FETCH_PROVIDER_ID, OLLAMA_PROVIDER_ID } from '../src/index.ts'

/** The provider ids each capability lists, sorted for a stable comparison. */
function listed(ctx: Context): { search: string[]; fetch: string[] } {
  const providers = ctx.web.listProviders()
  return {
    search: providers.search.map(provider => provider.id).sort(),
    fetch: providers.fetch.map(provider => provider.id).sort(),
  }
}

/** The Ollama entries' picker copy, as the settings page renders it. */
function ollamaEntries(ctx: Context): { titles: (string | undefined)[]; described: boolean[] } {
  const providers = ctx.web.listProviders()
  const search = providers.search.filter(provider => provider.id === OLLAMA_PROVIDER_ID)
  return {
    titles: [...search, ...providers.fetch.filter(provider => provider.id === OLLAMA_FETCH_PROVIDER_ID)].map(provider => provider.title),
    described: [...search, ...providers.fetch.filter(provider => provider.id === OLLAMA_FETCH_PROVIDER_ID)]
      .map(provider => provider.description !== undefined),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('web-ollama-api provider registration', () => {
  it('lists neither provider, and reports the configured id as missing, while no key resolves', async () => {
    vi.stubEnv(OLLAMA_CREDENTIAL_REF, '')
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: OLLAMA_PROVIDER_ID })
    await ctx.plugin(ollamaPlugin, {})
    expect(listed(ctx)).toEqual({ search: [], fetch: [] })
    await expect(ctx.web.search({ query: 'q' })).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' })
    await ctx.fiber.dispose()
  })

  it('lists both providers while the shared environment key resolves', async () => {
    vi.stubEnv(OLLAMA_CREDENTIAL_REF, 'env-key')
    const ctx = new Context()
    await ctx.plugin(WebRuntime, {})
    await ctx.plugin(ollamaPlugin, {})
    expect(listed(ctx)).toEqual({ search: [OLLAMA_PROVIDER_ID], fetch: [OLLAMA_FETCH_PROVIDER_ID] })
    expect(ollamaEntries(ctx)).toEqual({ titles: ['Ollama Cloud', 'Ollama Cloud'], described: [true, true] })
    await ctx.fiber.dispose()
  })

  it('registers the providers when the key is stored and unregisters them when it is removed', async () => {
    vi.stubEnv(OLLAMA_CREDENTIAL_REF, '')
    const dir = await mkdtemp(join(tmpdir(), 'dsh-web-ollama-registration-'))
    const ctx = new Context()
    try {
      await ctx.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
      await ctx.plugin(WebRuntime, {})
      await ctx.plugin(ollamaPlugin, {})
      expect(listed(ctx)).toEqual({ search: [], fetch: [] })

      await ctx.credentials.set(credentialRef(OLLAMA_CREDENTIAL_REF), 'stored-key')
      await vi.waitFor(() => {
        expect(listed(ctx)).toEqual({ search: [OLLAMA_PROVIDER_ID], fetch: [OLLAMA_FETCH_PROVIDER_ID] })
      })

      await ctx.credentials.unset(credentialRef(OLLAMA_CREDENTIAL_REF))
      await vi.waitFor(() => { expect(listed(ctx)).toEqual({ search: [], fetch: [] }) })
    } finally {
      await ctx.fiber.dispose()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('registers a stored key when the credential seam mounts after the provider', async () => {
    vi.stubEnv(OLLAMA_CREDENTIAL_REF, '')
    const dir = await mkdtemp(join(tmpdir(), 'dsh-web-ollama-order-'))
    const path = join(dir, '.credentials.yaml')
    await writeFile(path, `version: 1\nrefs:\n  ${OLLAMA_CREDENTIAL_REF}: stored-key\n`, { mode: 0o600 })
    const ctx = new Context()
    try {
      await ctx.plugin(WebRuntime, {})
      // Rows mount in composition order: the provider row is the one that can
      // resolve before the credential seam exists.
      await ctx.plugin(ollamaPlugin, {})
      expect(listed(ctx)).toEqual({ search: [], fetch: [] })
      await ctx.plugin(LocalCredentialProvider, { path, watch: false })
      await vi.waitFor(() => {
        expect(listed(ctx)).toEqual({ search: [OLLAMA_PROVIDER_ID], fetch: [OLLAMA_FETCH_PROVIDER_ID] })
      })
    } finally {
      await ctx.fiber.dispose()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('unregisters the providers with the plugin, leaving no trace in the lists', async () => {
    const ctx = new Context()
    await ctx.plugin(WebRuntime, {})
    vi.stubEnv(OLLAMA_CREDENTIAL_REF, 'env-key')
    const fiber = await ctx.plugin(ollamaPlugin, {})
    expect(listed(ctx).search).toEqual([OLLAMA_PROVIDER_ID])
    await fiber.dispose()
    expect(listed(ctx)).toEqual({ search: [], fetch: [] })
    await ctx.fiber.dispose()
  })
})
