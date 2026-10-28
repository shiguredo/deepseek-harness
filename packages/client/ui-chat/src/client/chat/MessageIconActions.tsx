// Shared IconActions chrome for user and assistant messages: copy, optional
// branch wiring, and optional plugin actions. The message clock renders as a
// sibling line above this row.

import { useId, type ReactNode } from 'react'
import {
  IconBranchOutlineRegular, IconCheckOutlineRegular, IconCopyOutlineRegular, Tooltip, useClipboardCopy,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './MessageIconActions.module.css'

export interface MessageIconActionsProps {
  /** Plain text the copy action writes. */
  text: string
  /** Row whose glyphs it sizes: the user bubble or the assistant completion row. */
  variant: 'user' | 'assistant'
  /** Fork the session at this message; omission hides the branch action. */
  onBranch?: (() => void) | undefined
  /** The message is not a completed transcript tail, so branch stays visible but unavailable. */
  branchUnavailable?: boolean | undefined
  /** Parent layout class composed onto the actions row. */
  className?: string | undefined
  /**
   * Slot-rendered actions owned by independent plugins, placed between the
   * built-in copy and branch controls.
   */
  extraActions?: ReactNode
  /**
   * Icon-row Turn-usage trigger (the TurnUsagePanel pill), seated after the
   * branch control at the end of the icon cluster.
   */
  usageAction?: ReactNode
  /** The owning view's locale seat, passed down as a plain prop. */
  t: ChatViewSlotProps['t']
}

/**
 * Copy / branch (/ usage) IconActions row shared by user and assistant chrome.
 * The row keeps its space with opacity while hidden, so the clock line above
 * never shifts when the icons appear.
 * @param props - Copy text, row variant, branch callback, className.
 * @returns The actions row element.
 */
export function MessageIconActions({
  text, variant, onBranch, branchUnavailable = false, className,
  extraActions, usageAction, t,
}: MessageIconActionsProps) {
  const reasonId = useId()
  const { copied, onCopy } = useClipboardCopy(text)
  return (
    <div className={className === undefined ? css.actions : `${css.actions} ${className}`} data-variant={variant}>
      <Tooltip label={copied ? t('copied') : t('copy')} side="bottom">
        <button type="button" className={css.action} aria-label={copied ? t('copied') : t('copy')} onClick={onCopy}>
          {copied ? <IconCheckOutlineRegular /> : <IconCopyOutlineRegular />}
        </button>
      </Tooltip>
      {extraActions}
      {onBranch !== undefined && (
        <Tooltip label={branchUnavailable ? t('message.branchUnavailable') : t('message.branch')} side="bottom" openOnClick={branchUnavailable}>
          {/* Native disabled buttons do not deliver the hover/focus events Tooltip needs. */}
          <button
            type="button"
            className={css.action}
            aria-label={t('message.branch')}
            aria-disabled={branchUnavailable || undefined}
            aria-describedby={branchUnavailable ? reasonId : undefined}
            data-unavailable={branchUnavailable || undefined}
            onClick={branchUnavailable ? undefined : onBranch}
          >
            <IconBranchOutlineRegular />
          </button>
        </Tooltip>
      )}
      {onBranch !== undefined && branchUnavailable && (
        <span id={reasonId} className={css.visuallyHidden}>{t('message.branchUnavailable')}</span>
      )}
      {usageAction}
    </div>
  )
}
