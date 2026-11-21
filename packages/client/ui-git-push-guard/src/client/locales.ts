/**
 * `gitPushGuard` namespace dictionaries: the composer chip that switches one
 * Session's guard and the built-in plugins settings card that sets the default
 * for new Sessions. The package ships no sidebar page, so these two surfaces
 * are the complete dictionary.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'gitPushGuard'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'statusLoading': '加载中…',
  'chipOn': '推送防护已开启',
  'chipOff': '推送防护已关闭',
  'chipOnTitle': '此会话的推送防护已开启。点击可关闭；新会话的默认设置保持不变。',
  'chipOffTitle': '此会话的推送防护已关闭。点击可开启；新会话的默认设置保持不变。',
  'chipFailed': '无法更改此会话的推送防护。',
  'settingsTitle': 'Git 推送防护',
  'settingsSummary': '在 Git 推送执行前请求确认。',
  'settingsDefaultLabel': '新会话的默认设置',
  'settingsHint': '修改只影响新会话；已有会话请在输入框的芯片中切换。',
  'settingsFailed': '无法读取或保存该设置。',
  'settingsOn': '开启',
  'settingsOff': '关闭',
} as const

/** Key domain of the `gitPushGuard` namespace (zh is the source of truth). */
export type GitPushGuardKey = keyof typeof zh

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<GitPushGuardKey, string> = {
  'statusLoading': 'Loading…',
  'chipOn': 'Push guard ON',
  'chipOff': 'Push guard OFF',
  'chipOnTitle': 'Push guard is on for this session. Click to turn it off; the default for new sessions is unchanged.',
  'chipOffTitle': 'Push guard is off for this session. Click to turn it on; the default for new sessions is unchanged.',
  'chipFailed': 'Could not change the push guard for this session.',
  'settingsTitle': 'Git push guard',
  'settingsSummary': 'Asks for confirmation before a git push runs.',
  'settingsDefaultLabel': 'Default for new sessions',
  'settingsHint': 'Changes affect new sessions only; switch an existing session from the composer chip.',
  'settingsFailed': 'Could not read or save this setting.',
  'settingsOn': 'On',
  'settingsOff': 'Off',
}

/** Japanese dictionary. */
export const ja: Record<GitPushGuardKey, string> = {
  'statusLoading': '読み込み中…',
  'chipOn': 'プッシュガード ON',
  'chipOff': 'プッシュガード OFF',
  'chipOnTitle': 'このセッションのプッシュガードは有効です。クリックすると無効になります。新規セッションの既定値は変わりません。',
  'chipOffTitle': 'このセッションのプッシュガードは無効です。クリックすると有効になります。新規セッションの既定値は変わりません。',
  'chipFailed': 'このセッションのプッシュガードを変更できませんでした。',
  'settingsTitle': 'プッシュガード',
  'settingsSummary': 'Git のプッシュ実行前に確認します。',
  'settingsDefaultLabel': '新規セッションの既定値',
  'settingsHint': '変更は新規セッションのみに適用されます。既存のセッションは入力欄のチップで切り替えてください。',
  'settingsFailed': 'この設定を読み書きできませんでした。',
  'settingsOn': 'オン',
  'settingsOff': 'オフ',
}

/** Spanish dictionary. */
export const es: Record<GitPushGuardKey, string> = {
  'statusLoading': 'Cargando…',
  'chipOn': 'Protección de push activada',
  'chipOff': 'Protección de push desactivada',
  'chipOnTitle': 'La protección de push está activada en esta sesión. Haga clic para desactivarla; el valor predeterminado para sesiones nuevas no cambia.',
  'chipOffTitle': 'La protección de push está desactivada en esta sesión. Haga clic para activarla; el valor predeterminado para sesiones nuevas no cambia.',
  'chipFailed': 'No se pudo cambiar la protección de push de esta sesión.',
  'settingsTitle': 'Protección de push de Git',
  'settingsSummary': 'Pide confirmación antes de ejecutar un git push.',
  'settingsDefaultLabel': 'Valor predeterminado para sesiones nuevas',
  'settingsHint': 'Los cambios solo afectan a sesiones nuevas; cambie una sesión existente desde el chip del compositor.',
  'settingsFailed': 'No se pudo leer ni guardar esta configuración.',
  'settingsOn': 'Activado',
  'settingsOff': 'Desactivado',
}

/** French dictionary. */
export const fr: Record<GitPushGuardKey, string> = {
  'statusLoading': 'Chargement…',
  'chipOn': 'Garde des pushes ACTIVÉE',
  'chipOff': 'Garde des pushes DÉSACTIVÉE',
  'chipOnTitle': 'La garde des pushes est activée pour cette session. Cliquez pour la désactiver ; la valeur par défaut des nouvelles sessions reste inchangée.',
  'chipOffTitle': "La garde des pushes est désactivée pour cette session. Cliquez pour l'activer ; la valeur par défaut des nouvelles sessions reste inchangée.",
  'chipFailed': 'Impossible de modifier la garde des pushes de cette session.',
  'settingsTitle': 'Garde des pushes Git',
  'settingsSummary': 'Demande confirmation avant l’exécution d’un git push.',
  'settingsDefaultLabel': 'Valeur par défaut des nouvelles sessions',
  'settingsHint': 'Les modifications ne touchent que les nouvelles sessions ; changez une session existante depuis la puce du compositeur.',
  'settingsFailed': 'Impossible de lire ou d’enregistrer ce réglage.',
  'settingsOn': 'Activé',
  'settingsOff': 'Désactivé',
}

/** German dictionary. */
export const de: Record<GitPushGuardKey, string> = {
  'statusLoading': 'Wird geladen…',
  'chipOn': 'Push-Schutz EIN',
  'chipOff': 'Push-Schutz AUS',
  'chipOnTitle': 'Der Push-Schutz ist für diese Sitzung aktiviert. Klicken Sie, um ihn zu deaktivieren; der Standard für neue Sitzungen bleibt unverändert.',
  'chipOffTitle': 'Der Push-Schutz ist für diese Sitzung deaktiviert. Klicken Sie, um ihn zu aktivieren; der Standard für neue Sitzungen bleibt unverändert.',
  'chipFailed': 'Der Push-Schutz dieser Sitzung konnte nicht geändert werden.',
  'settingsTitle': 'Git-Push-Schutz',
  'settingsSummary': 'Fragt vor einem git push nach Bestätigung.',
  'settingsDefaultLabel': 'Standard für neue Sitzungen',
  'settingsHint': 'Änderungen betreffen nur neue Sitzungen; eine bestehende Sitzung schalten Sie über den Chip in der Eingabezeile um.',
  'settingsFailed': 'Diese Einstellung konnte nicht gelesen oder gespeichert werden.',
  'settingsOn': 'Ein',
  'settingsOff': 'Aus',
}

/** Russian dictionary. */
export const ru: Record<GitPushGuardKey, string> = {
  'statusLoading': 'Загрузка…',
  'chipOn': 'Защита пушей ВКЛ.',
  'chipOff': 'Защита пушей ВЫКЛ.',
  'chipOnTitle': 'Защита пушей включена для этого сеанса. Нажмите, чтобы выключить; значение по умолчанию для новых сеансов не изменится.',
  'chipOffTitle': 'Защита пушей выключена для этого сеанса. Нажмите, чтобы включить; значение по умолчанию для новых сеансов не изменится.',
  'chipFailed': 'Не удалось изменить защиту пушей для этого сеанса.',
  'settingsTitle': 'Защита Git-пушей',
  'settingsSummary': 'Запрашивает подтверждение перед выполнением git push.',
  'settingsDefaultLabel': 'Значение по умолчанию для новых сеансов',
  'settingsHint': 'Изменения касаются только новых сеансов; существующий сеанс переключайте чипом в поле ввода.',
  'settingsFailed': 'Не удалось прочитать или сохранить эту настройку.',
  'settingsOn': 'Включено',
  'settingsOff': 'Выключено',
}

/** Portuguese dictionary. */
export const pt: Record<GitPushGuardKey, string> = {
  'statusLoading': 'Carregando…',
  'chipOn': 'Proteção de push ATIVADA',
  'chipOff': 'Proteção de push DESATIVADA',
  'chipOnTitle': 'A proteção de push está ativada nesta sessão. Clique para desativá-la; o padrão para novas sessões não muda.',
  'chipOffTitle': 'A proteção de push está desativada nesta sessão. Clique para ativá-la; o padrão para novas sessões não muda.',
  'chipFailed': 'Não foi possível alterar a proteção de push desta sessão.',
  'settingsTitle': 'Proteção de push do Git',
  'settingsSummary': 'Pede confirmação antes de um git push.',
  'settingsDefaultLabel': 'Padrão para novas sessões',
  'settingsHint': 'As alterações afetam apenas novas sessões; alterne uma sessão existente pelo chip do compositor.',
  'settingsFailed': 'Não foi possível ler ou salvar esta configuração.',
  'settingsOn': 'Ativado',
  'settingsOff': 'Desativado',
}
