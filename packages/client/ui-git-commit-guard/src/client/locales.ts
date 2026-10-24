/**
 * `gitCommitGuard` namespace dictionaries: the composer chip that switches one
 * Session's guard and the built-in plugins settings card that sets the default
 * for new Sessions. The package ships no sidebar page, so these two surfaces
 * are the complete dictionary.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'gitCommitGuard'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'statusLoading': '加载中…',
  'chipOn': '提交防护已开启',
  'chipOff': '提交防护已关闭',
  'chipOnTitle': '此会话的提交防护已开启。点击可关闭；新会话的默认设置保持不变。',
  'chipOffTitle': '此会话的提交防护已关闭。点击可开启；新会话的默认设置保持不变。',
  'chipFailed': '无法更改此会话的提交防护。',
  'settingsTitle': 'Git 提交防护',
  'settingsSummary': '在提交类 Git 命令执行前请求确认。',
  'settingsDefaultLabel': '新会话的默认设置',
  'settingsHint': '修改只影响新会话；已有会话请在输入框的芯片中切换。',
  'settingsFailed': '无法读取或保存该设置。',
  'settingsOn': '开启',
  'settingsOff': '关闭',
} as const

/** Key domain of the `gitCommitGuard` namespace (zh is the source of truth). */
export type GitCommitGuardKey = keyof typeof zh

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<GitCommitGuardKey, string> = {
  'statusLoading': 'Loading…',
  'chipOn': 'Commit guard ON',
  'chipOff': 'Commit guard OFF',
  'chipOnTitle': 'Commit guard is on for this session. Click to turn it off; the default for new sessions is unchanged.',
  'chipOffTitle': 'Commit guard is off for this session. Click to turn it on; the default for new sessions is unchanged.',
  'chipFailed': 'Could not change the commit guard for this session.',
  'settingsTitle': 'Git commit guard',
  'settingsSummary': 'Asks for confirmation before a commit-creating Git command runs.',
  'settingsDefaultLabel': 'Default for new sessions',
  'settingsHint': 'Changes affect new sessions only; switch an existing session from the composer chip.',
  'settingsFailed': 'Could not read or save this setting.',
  'settingsOn': 'On',
  'settingsOff': 'Off',
}

/** Japanese dictionary. */
export const ja: Record<GitCommitGuardKey, string> = {
  'statusLoading': '読み込み中…',
  'chipOn': 'コミットガード ON',
  'chipOff': 'コミットガード OFF',
  'chipOnTitle': 'このセッションのコミットガードは有効です。クリックすると無効になります。新規セッションの既定値は変わりません。',
  'chipOffTitle': 'このセッションのコミットガードは無効です。クリックすると有効になります。新規セッションの既定値は変わりません。',
  'chipFailed': 'このセッションのコミットガードを変更できませんでした。',
  'settingsTitle': 'コミットガード',
  'settingsSummary': 'コミットを作成する Git コマンドの実行前に確認します。',
  'settingsDefaultLabel': '新規セッションの既定値',
  'settingsHint': '変更は新規セッションのみに適用されます。既存のセッションは入力欄のチップで切り替えてください。',
  'settingsFailed': 'この設定を読み書きできませんでした。',
  'settingsOn': 'オン',
  'settingsOff': 'オフ',
}

/** Spanish dictionary. */
export const es: Record<GitCommitGuardKey, string> = {
  'statusLoading': 'Cargando…',
  'chipOn': 'Protección de commits activada',
  'chipOff': 'Protección de commits desactivada',
  'chipOnTitle': 'La protección de commits está activada en esta sesión. Haga clic para desactivarla; el valor predeterminado para sesiones nuevas no cambia.',
  'chipOffTitle': 'La protección de commits está desactivada en esta sesión. Haga clic para activarla; el valor predeterminado para sesiones nuevas no cambia.',
  'chipFailed': 'No se pudo cambiar la protección de commits de esta sesión.',
  'settingsTitle': 'Protección de commits',
  'settingsSummary': 'Pide confirmación antes de ejecutar un comando Git que cree un commit.',
  'settingsDefaultLabel': 'Valor predeterminado para sesiones nuevas',
  'settingsHint': 'Los cambios solo afectan a sesiones nuevas; cambie una sesión existente desde el chip del compositor.',
  'settingsFailed': 'No se pudo leer ni guardar esta configuración.',
  'settingsOn': 'Activado',
  'settingsOff': 'Desactivado',
}

/** French dictionary. */
export const fr: Record<GitCommitGuardKey, string> = {
  'statusLoading': 'Chargement…',
  'chipOn': 'Garde des commits ACTIVÉE',
  'chipOff': 'Garde des commits DÉSACTIVÉE',
  'chipOnTitle': 'La garde des commits est activée pour cette session. Cliquez pour la désactiver ; la valeur par défaut des nouvelles sessions reste inchangée.',
  'chipOffTitle': "La garde des commits est désactivée pour cette session. Cliquez pour l'activer ; la valeur par défaut des nouvelles sessions reste inchangée.",
  'chipFailed': 'Impossible de modifier la garde des commits de cette session.',
  'settingsTitle': 'Garde des commits',
  'settingsSummary': 'Demande confirmation avant l’exécution d’une commande Git qui crée un commit.',
  'settingsDefaultLabel': 'Valeur par défaut des nouvelles sessions',
  'settingsHint': 'Les modifications ne touchent que les nouvelles sessions ; changez une session existante depuis la puce du compositeur.',
  'settingsFailed': 'Impossible de lire ou d’enregistrer ce réglage.',
  'settingsOn': 'Activé',
  'settingsOff': 'Désactivé',
}

/** German dictionary. */
export const de: Record<GitCommitGuardKey, string> = {
  'statusLoading': 'Wird geladen…',
  'chipOn': 'Commit-Schutz EIN',
  'chipOff': 'Commit-Schutz AUS',
  'chipOnTitle': 'Der Commit-Schutz ist für diese Sitzung aktiviert. Klicken Sie, um ihn zu deaktivieren; der Standard für neue Sitzungen bleibt unverändert.',
  'chipOffTitle': 'Der Commit-Schutz ist für diese Sitzung deaktiviert. Klicken Sie, um ihn zu aktivieren; der Standard für neue Sitzungen bleibt unverändert.',
  'chipFailed': 'Der Commit-Schutz dieser Sitzung konnte nicht geändert werden.',
  'settingsTitle': 'Commit-Schutz',
  'settingsSummary': 'Fragt vor einem Git-Befehl, der einen Commit erzeugt, nach Bestätigung.',
  'settingsDefaultLabel': 'Standard für neue Sitzungen',
  'settingsHint': 'Änderungen betreffen nur neue Sitzungen; eine bestehende Sitzung schalten Sie über den Chip in der Eingabezeile um.',
  'settingsFailed': 'Diese Einstellung konnte nicht gelesen oder gespeichert werden.',
  'settingsOn': 'Ein',
  'settingsOff': 'Aus',
}

/** Russian dictionary. */
export const ru: Record<GitCommitGuardKey, string> = {
  'statusLoading': 'Загрузка…',
  'chipOn': 'Защита коммитов ВКЛ.',
  'chipOff': 'Защита коммитов ВЫКЛ.',
  'chipOnTitle': 'Защита коммитов включена для этого сеанса. Нажмите, чтобы выключить; значение по умолчанию для новых сеансов не изменится.',
  'chipOffTitle': 'Защита коммитов выключена для этого сеанса. Нажмите, чтобы включить; значение по умолчанию для новых сеансов не изменится.',
  'chipFailed': 'Не удалось изменить защиту коммитов для этого сеанса.',
  'settingsTitle': 'Защита коммитов',
  'settingsSummary': 'Запрашивает подтверждение перед командой Git, создающей коммит.',
  'settingsDefaultLabel': 'Значение по умолчанию для новых сеансов',
  'settingsHint': 'Изменения касаются только новых сеансов; существующий сеанс переключайте чипом в поле ввода.',
  'settingsFailed': 'Не удалось прочитать или сохранить эту настройку.',
  'settingsOn': 'Включено',
  'settingsOff': 'Выключено',
}

/** Portuguese dictionary. */
export const pt: Record<GitCommitGuardKey, string> = {
  'statusLoading': 'Carregando…',
  'chipOn': 'Proteção de commits ATIVADA',
  'chipOff': 'Proteção de commits DESATIVADA',
  'chipOnTitle': 'A proteção de commits está ativada nesta sessão. Clique para desativá-la; o padrão para novas sessões não muda.',
  'chipOffTitle': 'A proteção de commits está desativada nesta sessão. Clique para ativá-la; o padrão para novas sessões não muda.',
  'chipFailed': 'Não foi possível alterar a proteção de commits desta sessão.',
  'settingsTitle': 'Proteção de commits',
  'settingsSummary': 'Pede confirmação antes de um comando Git que cria um commit.',
  'settingsDefaultLabel': 'Padrão para novas sessões',
  'settingsHint': 'As alterações afetam apenas novas sessões; alterne uma sessão existente pelo chip do compositor.',
  'settingsFailed': 'Não foi possível ler ou salvar esta configuração.',
  'settingsOn': 'Ativado',
  'settingsOff': 'Desativado',
}
