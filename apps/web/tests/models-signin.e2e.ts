// Web e2e scenario: a provider card's account sign-in, end to end through the
// real wire. The dormant pi-ai catalog contributes openai-codex as a
// provider-native account; selecting it in the add card shows the sign-in
// section, and starting it must reach the browser step rather than an empty
// panel — the flow's browser-or-device-code question is answered at the seam,
// because this surface completes through the browser or its redirect URL. The
// paste field is always offered, which is the path a browser on another machine
// takes. Zero model calls: the panel's views are authorization-domain
// traffic, and each attempt is cancelled before it could commit a record.
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchWebScaffold, watchConsole, type WebScaffold } from './scaffold.ts'
import { openSettings, ZH_BROWSER_LOCALE } from './support.ts'

describe('web e2e: a provider card signs in through its own flow', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('opens the browser step directly, offers the paste field, and cancels without storing a record', async () => {
    await openSettings(page, 'zh')
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.waitFor({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '模型', exact: true }).click()
    const add = dialog.getByRole('button', { name: '添加模型提供商' })
    await add.waitFor({ timeout: 10_000 })
    await expect.poll(async () => add.isEnabled(), { timeout: 10_000 }).toBe(true)
    await add.click()
    await dialog.getByLabel('提供商', { exact: true }).selectOption('openai-codex')

    const start = dialog.getByRole('button', { name: 'OpenAI (ChatGPT plan)', exact: true })
    await start.waitFor({ timeout: 10_000 })
    await expect.poll(() => dialog.getByText('未登录。').count(), { timeout: 10_000 }).toBe(1)
    await start.click()

    // The flow's own method question — browser or headless device code — is
    // answered at the seam, so the panel opens straight on the browser step
    // instead of an empty running panel waiting for a choice.
    const attempt = dialog.getByLabel('登录')
    await attempt.waitFor({ timeout: 15_000 })
    await expect.poll(() => dialog.getByText('Select OpenAI Codex login method:').count()).toBe(0)

    // The browser step now runs: it names the page it waits on and always
    // accepts the redirect URL a remote browser's address bar carries.
    await expect.poll(() => attempt.getByRole('link', { name: '打开登录页面' }).count(), { timeout: 15_000 }).toBe(1)
    await expect.poll(() => attempt.getByLabel('重定向 URL').isEnabled(), { timeout: 15_000 }).toBe(true)
    expect(await attempt.getByRole('link', { name: '打开登录页面' }).getAttribute('href')).toMatch(/^https:\/\/auth\.openai\.com\//)

    await attempt.getByRole('button', { name: '取消' }).click()
    await expect.poll(() => dialog.getByLabel('登录').count(), { timeout: 10_000 }).toBe(0)
    // A cancelled attempt leaves the card signed out.
    await expect.poll(() => dialog.getByText('未登录。').count(), { timeout: 10_000 }).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
  }, 120_000)

  it('keeps the account actions inside the card editor', async () => {
    // Saved, the provider becomes a collapsed row: it summarizes the account
    // state and offers no way to change it until its editor is opened.
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.getByRole('button', { name: '保存' }).click()
    const row = dialog.getByRole('button', { name: '编辑 openai-codex' })
    await row.waitFor({ timeout: 15_000 })
    const start = dialog.getByRole('button', { name: 'OpenAI (ChatGPT plan)', exact: true })
    await expect.poll(() => start.count(), { timeout: 10_000 }).toBe(0)
    await expect.poll(() => dialog.getByText('提供方账号').count()).toBe(0)
    // The cancelled attempt stored nothing, so the collapsed row carries no
    // account mark either.
    await expect.poll(() => dialog.getByRole('img', { name: '已通过 ChatGPT 登录' }).count()).toBe(0)

    await row.click()
    await start.waitFor({ timeout: 15_000 })
    expect(tripwire.pageErrors).toEqual([])
  }, 120_000)

})
