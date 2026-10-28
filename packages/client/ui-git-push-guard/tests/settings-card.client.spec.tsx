// @vitest-environment jsdom

/**
 * Built-in plugins settings card: the default for new Sessions. It reads and
 * writes the default over the state route and reports failures in place.
 * Fetch is stubbed at the global boundary.
 */

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import { GuardSettingsCard } from '../src/client/SettingsCard.tsx'
import { en, ja } from '../src/client/locales.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Mount the browser half and declare the Plugins page's settings seat. */
async function bench(language: 'en' | 'ja' = 'en'): Promise<SlotTestRuntime> {
  const host = await SlotTestRuntime.create()
  onTestFinished(() => host.dispose())
  const locale = new LocaleRuntime(host.ctx)
  if (language === 'ja') locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })
  locale.setLocale(language)
  host.ctx.provide('locale', locale)
  host.slots.installLocale(locale)
  await host.declare({ 'plugins.shiguredo': { kind: 'list', scope: 'root' } })
  await host.mount({ inject: [...inject], apply })
  return host
}

/** Render the settings card for the requested view. */
function card(host: SlotTestRuntime, view: 'summary' | 'page') {
  return host.renderSlot('plugins.shiguredo', { view }, { only: 'git-push-guard' })
}

describe('built-in settings card', () => {
  it('renders the summary without reading the route', async () => {
    const fetchMock = vi.fn(async () => Response.json({ default: true }))
    vi.stubGlobal('fetch', fetchMock)
    const view = card(await bench(), 'summary')
    expect(view.container.textContent).toContain(en['settingsSummary'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the default and writes changes through the bare route', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (
      init?.method === 'POST' ? Response.json({ default: false }) : Response.json({ default: true })
    ))
    vi.stubGlobal('fetch', fetchMock)
    const host = await bench()
    const view = card(host, 'page')
    const on = await view.view.findByRole('button', { name: en['settingsOn'] })
    await waitFor(() => { expect(on.getAttribute('aria-pressed')).toBe('true') })
    expect(fetchMock).toHaveBeenCalledWith('/push-guard/state', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    fireEvent.click(view.view.getByRole('button', { name: en['settingsOff'] }))
    await waitFor(() => {
      expect(view.view.getByRole('button', { name: en['settingsOff'] }).getAttribute('aria-pressed')).toBe('true')
    })
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(post?.[0]).toBe('/push-guard/state')
    expect(post?.[1]?.body).toBe(JSON.stringify({ enabled: false }))
  })

  it('writes the on choice when the stored default is off', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (
      init?.method === 'POST' ? Response.json({ default: true }) : Response.json({ default: false })
    ))
    vi.stubGlobal('fetch', fetchMock)
    const view = card(await bench(), 'page')
    const on = await view.view.findByRole('button', { name: en['settingsOn'] })
    await waitFor(() => { expect(on.hasAttribute('disabled')).toBe(false) })
    expect(on.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(on)
    await waitFor(() => {
      expect(view.view.getByRole('button', { name: en['settingsOn'] }).getAttribute('aria-pressed')).toBe('true')
    })
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(post?.[1]?.body).toBe(JSON.stringify({ enabled: true }))
  })

  it('reports a failed read and a failed write in place', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 500 })))
    const readFailure = card(await bench(), 'page')
    expect((await readFailure.view.findByRole('alert')).textContent).toBe(en['settingsFailed'])

    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (
      init?.method === 'POST' ? Response.json({}, { status: 500 }) : Response.json({ default: true })
    )))
    const writeFailure = card(await bench(), 'page')
    fireEvent.click(await writeFailure.view.findByRole('button', { name: en['settingsOff'] }))
    expect((await writeFailure.view.findByRole('alert')).textContent).toBe(en['settingsFailed'])
  })

  it('disables the controls until the first read settles', async () => {
    let settle!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { settle = resolve })))
    const view = card(await bench(), 'page')
    const off = await view.view.findByRole('button', { name: en['settingsOff'] })
    expect(off.hasAttribute('disabled')).toBe(true)
    settle(Response.json({ default: false }))
    await waitFor(() => { expect(off.hasAttribute('disabled')).toBe(false) })
  })

  it('drops a read that settles after the card unmounts', async () => {
    const host = await SlotTestRuntime.create()
    const locale = new LocaleRuntime(host.ctx)
    locale.setLocale('en')
    host.ctx.provide('locale', locale)
    host.slots.installLocale(locale)
    await host.declare({ 'plugins.shiguredo': { kind: 'list', scope: 'root' } })
    await host.mount({ inject: [...inject], apply })
    let settle!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { settle = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    host.renderSlot('plugins.shiguredo', { view: 'page' }, { only: 'git-push-guard' })
    await host.dispose()
    settle(Response.json({ default: true }))
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('drops a failed read that settles after the card unmounts', async () => {
    const host = await SlotTestRuntime.create()
    const locale = new LocaleRuntime(host.ctx)
    locale.setLocale('en')
    host.ctx.provide('locale', locale)
    host.slots.installLocale(locale)
    await host.declare({ 'plugins.shiguredo': { kind: 'list', scope: 'root' } })
    await host.mount({ inject: [...inject], apply })
    let fail!: (error: Error) => void
    const fetchMock = vi.fn(() => new Promise<Response>((_resolve, reject) => { fail = reject }))
    vi.stubGlobal('fetch', fetchMock)
    host.renderSlot('plugins.shiguredo', { view: 'page' }, { only: 'git-push-guard' })
    await host.dispose()
    fail(new Error('late failure'))
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the dictionary title localized for the Plugins page', async () => {
    const host = await bench('ja')
    const entry = host.ctx.slots.entries('plugins.shiguredo')[0]
    const label = Reflect.get(entry?.options ?? {}, 'label') as (() => string) | undefined
    expect(label?.()).toBe(ja['settingsTitle'])
    expect(GuardSettingsCard).toBeTypeOf('function')
  })
})
