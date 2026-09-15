/** `settings.font` namespace dictionaries (the Font row's copy). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.font'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'fontFamily.title': '字体',
  'fontFamily.description': '同时应用于界面文字和代码，留空则使用浏览器默认字体',
  'fontFamily.placeholder': '例如 "Hiragino Sans", "Noto Sans JP"',
} satisfies Record<string, string>

/** The settings.font namespace key union. */
export type FontKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'fontFamily.title': 'Font',
  'fontFamily.description': 'Applies to UI text and code; leave empty for the browser default',
  'fontFamily.placeholder': 'e.g. "Hiragino Sans", "Noto Sans JP"',
} satisfies Record<FontKey, string>
