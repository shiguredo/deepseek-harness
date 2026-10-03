/** CSS checks for the completed-turn footer's content spacing. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/client/chat/${name}`, import.meta.url)), 'utf8')

describe('completed-turn spacing', () => {
  it('combines the flow and footer offsets around turn-tail content', () => {
    expect(read('ChatView.module.css')).toMatch(/margin-top:\s*var\(--dsh-chat-flow-gap, 6px\)/)
    const tail = read('TurnTailNodeView.module.css')
    expect(tail).toMatch(/\.root\s*\{[^}]*gap:\s*16px/s)
    expect(tail).toMatch(/\.actions\s*\{[^}]*margin-top:\s*4px/s)
  })

  it('keeps the timestamp line against the action row it dates', () => {
    // The root gap still separates the footer from the content above; the
    // clock cancels all but 2px so the two metadata lines read as one unit,
    // matching the user bubble's own step.
    const tail = read('TurnTailNodeView.module.css')
    expect(tail).toMatch(/\.clock\s*\{[^}]*margin-bottom:\s*-18px/s)
    // The user bubble dates itself below the stack, so its line pulls up instead.
    expect(read('MessageItem.module.css')).toMatch(/\.clock\s*\{[^}]*margin-top:\s*-4px/s)
  })
})
