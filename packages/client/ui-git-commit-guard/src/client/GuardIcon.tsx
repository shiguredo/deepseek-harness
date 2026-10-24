/** Decorative lock glyph shared by the sidebar entry and the composer chip. */

/** Inputs of the guard glyph: the edge the sidebar or chip asks for. */
export interface GuardIconProps {
  /** Requested square edge in pixels; the sidebar supplies its own. */
  readonly size?: number
  /** Whether the sidebar row is selected; the glyph inherits the row's color. */
  readonly active?: boolean
}

/**
 * Draw the padlock the guard's sidebar entry and composer chip carry. The
 * parent owns the accessible name; the glyph is decorative.
 * @param props - the requested edge and the sidebar's selection flag.
 * @returns the decorative glyph.
 */
export function GuardIcon({ size = 14 }: GuardIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2.5" />
    </svg>
  )
}
