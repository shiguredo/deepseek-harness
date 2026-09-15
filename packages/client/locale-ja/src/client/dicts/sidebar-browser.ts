/** Japanese dictionary for the `sidebarBrowser` namespace (client/ui-sidebar-browser/src/client/locales.ts). */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the `sidebarBrowser` key union declared by @deepseek-ai/dsh-client-ui-sidebar-browser.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-browser/client'

/** `sidebarBrowser` copy in Japanese, complete against the owner's key union. */
export const ja: LocaleDictOf<'sidebarBrowser'> = {
  'shortcut.noSession': '先にセッションを開いてください',
  'type.label': 'ブラウザー',
  'guide.title': 'ブラウザー',
  'guide.description': 'Web ページを閲覧する',
  'address.placeholder': 'HTTP(S) アドレスを入力',
  'address.changed': 'URL が変更されました',
  'back': '戻る',
  'forward': '進む',
  'reload': '再読み込み',
  'go': '移動',
  'external': 'システムブラウザーで開く',
  'sandbox.disable': 'サンドボックス制限を無効にする',
  'sandbox.enable': 'サンドボックス制限を元に戻す',
  'sandbox.warning': 'サンドボックス制限が無効です。ページはトップレベルのアプリを遷移でき、ダウンロード・モーダルダイアログ・入力ロックを利用できます。',
  'start': 'HTTP(S) アドレスを入力して閲覧を開始',
  'loading': '開いています…',
  'restore.previous': '前回開いたページ',
  'restore.action': 'ページを復元',
  'error.empty': 'アドレスを入力してください。',
  'error.invalid': 'このアドレスは無効か、長すぎます。',
  'error.protocol': '対応するのは HTTP と HTTPS のアドレスのみです。ローカルファイルにはドキュメントプレビューを使用してください。',
  'error.credentials': 'アドレスにユーザー名やパスワードを含めることはできません。',
  'error.application-origin': '埋め込みブラウザーで DSH アプリ自体を開くことはできません。',
  'load.failed': 'ページを読み込めませんでした。再読み込みするか、システムブラウザーで開いてください。',
  'load.failed.detail': 'ページの読み込みに失敗しました（{code}）: {description}',
  'address.unknown': 'ページが遷移しました。現在のキャリアでは新しい URL を読み取れません。',
}
