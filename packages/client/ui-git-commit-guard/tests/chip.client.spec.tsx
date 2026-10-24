// @vitest-environment jsdom

/**
 * Composer guard chip: it reads and writes one Session's own setting over the
 * state route, re-reads on focus and visibility, and reports failures in
 * place. Fetch is stubbed at the global boundary.
 */

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { act, fireEvent, waitFor } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { apply, inject } from '../src/client/index.ts'
import { en, ja } from '../src/client/locales.ts'

const SESSION = SessionId('guard-session')

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Mount the browser half and retain one fixture Session for the chip. */
async function bench(language: 'en' | 'ja' = 'en'): Promise<SlotTestRuntime> {
  const host = await SlotTestRuntime.create()
  onTestFinished(() => host.dispose())
  const locale = new LocaleRuntime(host.ctx)
  if (language === 'ja') locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })
  locale.setLocale(language)
  host.ctx.provide('locale', locale)
  host.slots.installLocale(locale)
  await host.declare({ 'conversation.input.left': { kind: 'list', scope: 'session' } })
  await host.mount({ inject: [...inject], apply })
  await host.sessions.add({ id: SESSION })
  host.sessions.retainFor(host.ctx, SESSION)
  return host
}

/** Render the composer chip for the fixture Session. */
function chip(host: SlotTestRuntime) {
  const session = host.sessions.retainFor(host.ctx, SESSION)
  return host.renderSlot('conversation.input.left', {}, { session })
}

describe('composer guard chip', () => {
  it('reads this Session through the session-addressed route and shows its own setting', async () => {
    const fetchMock = vi.fn(async () => Response.json({ default: true, session: false }))
    vi.stubGlobal('fetch', fetchMock)
    const view = chip(await bench())
    const button = await view.view.findByRole('button', { name: en['chipOff'] })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('title')).toBe(en['chipOffTitle'])
    expect(fetchMock).toHaveBeenCalledWith('/commit-guard/state?session=guard-session', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
  })

  it('toggles only this Session and follows the stored answer', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (
      init?.method === 'POST'
        ? Response.json({ default: true, session: true })
        : Response.json({ default: true, session: false })
    ))
    vi.stubGlobal('fetch', fetchMock)
    const view = chip(await bench())
    const off = await view.view.findByRole('button', { name: en['chipOff'] })
    fireEvent.click(off)
    const on = await view.view.findByRole('button', { name: en['chipOn'] })
    expect(on.getAttribute('aria-pressed')).toBe('true')
    expect(on.getAttribute('title')).toBe(en['chipOnTitle'])
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(post?.[0]).toBe('/commit-guard/state')
    expect(post?.[1]?.body).toBe(JSON.stringify({ enabled: true, sessionId: SESSION }))
  })

  it('disables the chip while the write is in flight', async () => {
    let settlePost!: (response: Response) => void
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      init?.method === 'POST'
        ? new Promise<Response>((resolve) => { settlePost = resolve })
        : Promise.resolve(Response.json({ default: true, session: false }))
    ))
    vi.stubGlobal('fetch', fetchMock)
    const view = chip(await bench())
    const off = await view.view.findByRole('button', { name: en['chipOff'] })
    fireEvent.click(off)
    await waitFor(() => { expect(off).toHaveProperty('disabled', true) })
    await act(async () => { settlePost(Response.json({ default: true, session: true })) })
    const on = await view.view.findByRole('button', { name: en['chipOn'] })
    expect(on).toHaveProperty('disabled', false)
  })

  it('re-reads on window focus and on tab visibility', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(Response.json({ default: true, session: false }))
    fetchMock.mockResolvedValueOnce(Response.json({ default: true, session: true }))
    fetchMock.mockResolvedValueOnce(Response.json({ default: true, session: false }))
    vi.stubGlobal('fetch', fetchMock)
    const view = chip(await bench())
    await view.view.findByRole('button', { name: en['chipOff'] })
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(await view.view.findByRole('button', { name: en['chipOn'] })).toBeTruthy()
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(await view.view.findByRole('button', { name: en['chipOff'] })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('reports a failed read in place and keeps the chip inert', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const view = chip(await bench())
    const button = await view.view.findByRole('button', { name: en['statusLoading'] })
    await waitFor(() => { expect(button.getAttribute('title')).toBe(en['chipFailed']) })
    expect(button).toHaveProperty('disabled', true)
  })

  it('reports a failed write in place without changing the shown setting', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (
      init?.method === 'POST' ? new Response(null, { status: 500 }) : Response.json({ default: true, session: false })
    ))
    vi.stubGlobal('fetch', fetchMock)
    const view = chip(await bench())
    const off = await view.view.findByRole('button', { name: en['chipOff'] })
    fireEvent.click(off)
    await waitFor(() => { expect(off.getAttribute('title')).toBe(en['chipFailed']) })
    expect(off.getAttribute('aria-pressed')).toBe('false')
    expect(off.textContent).toBe(en['chipOff'])
  })

  it('reports an answer without the addressed Session value as a failed read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ default: true })))
    const view = chip(await bench())
    const button = await view.view.findByRole('button', { name: en['statusLoading'] })
    await waitFor(() => { expect(button.getAttribute('title')).toBe(en['chipFailed']) })
  })

  it('shows the loading label until the first session-addressed answer', async () => {
    let settleGet!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { settleGet = resolve })))
    const view = chip(await bench())
    const button = view.view.getByRole('button', { name: en['statusLoading'] })
    expect(button).toHaveProperty('disabled', true)
    expect(button.getAttribute('title')).toBe(en['chipOffTitle'])
    await act(async () => { settleGet(Response.json({ default: true, session: true })) })
    expect(await view.view.findByRole('button', { name: en['chipOn'] })).toBeTruthy()
  })

  it('ignores a read that settles after unmount', async () => {
    let settleGet!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { settleGet = resolve })))
    const host = await bench()
    chip(host)
    await host.dispose()
    await act(async () => { settleGet(Response.json({ default: true, session: false })) })
  })

  it('ignores a failed read that settles after unmount', async () => {
    let rejectGet!: (error: Error) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_resolve, reject) => { rejectGet = reject })))
    const host = await bench()
    chip(host)
    await host.dispose()
    await act(async () => { rejectGet(new Error('offline')) })
  })

  it('renders the Japanese copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ default: true, session: true })))
    const view = chip(await bench('ja'))
    const button = await view.view.findByRole('button', { name: ja['chipOn'] })
    expect(button.getAttribute('title')).toBe(ja['chipOnTitle'])
  })
})
