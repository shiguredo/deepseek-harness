/** Locale bundles for the Ollama Cloud web provider's settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type OllamaSearchSettingsLocaleKey =
  | 'title' | 'description'
  | 'useOllama' | 'useOllamaHint' | 'apiKeyUnset'
  | 'maxResults' | 'maxResultsHint'
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable'
  | 'save' | 'saving' | 'saveFailed' | 'invalidNumber'

/** English copy. */
export const en: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Web search and page fetch with Ollama Cloud',
  description: 'Set up the Ollama Cloud web search and fetch providers.',
  useOllama: 'Use Ollama Cloud for web search and fetch',
  useOllamaHint: 'On selects both Ollama Cloud operations; off restores the deployment\'s own selection.',
  apiKeyUnset: 'No Ollama Cloud API key is configured. These providers use the key of the Ollama Cloud model provider (OLLAMA_CLOUD_API_KEY); set it in the Models settings.',
  maxResults: 'Results per search',
  maxResultsHint: 'Results returned per search when the caller requests no smaller bound.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
}

/** Simplified Chinese copy. */
export const zh: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: '使用 Ollama Cloud 的网页搜索与页面获取',
  description: '设置 Ollama Cloud 的网页搜索与抓取提供方。',
  useOllama: '网页搜索与抓取都使用 Ollama Cloud',
  useOllamaHint: '开启即选中 Ollama Cloud 的两项能力；关闭则恢复本部署自己的选择。',
  apiKeyUnset: '未配置 Ollama Cloud API Key。网页搜索与抓取使用 Ollama Cloud 模型提供方的密钥（OLLAMA_CLOUD_API_KEY），请在模型设置中配置。',
  maxResults: '每次搜索结果数',
  maxResultsHint: '调用方未要求更小的上限时，单次搜索返回的结果条数。',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidNumber: '请填数字；留空表示使用默认值。',
}

/** Japanese copy. */
export const ja: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Ollama Cloud を利用した Web 検索とページ取得',
  description: 'Ollama Cloud の Web 検索とページ取得の提供元を設定します。',
  useOllama: 'Web 検索とページ取得に Ollama Cloud を使う',
  useOllamaHint: 'オンにすると Ollama Cloud の 2 つの機能をまとめて選び、オフにするとこのデプロイ独自の選択に戻します。',
  apiKeyUnset: 'Ollama Cloud の API キーが設定されていません。Web 検索と取得は Ollama Cloud モデルのキー（OLLAMA_CLOUD_API_KEY）を使うため、モデル設定で設定してください。',
  maxResults: '1 回の検索結果数',
  maxResultsHint: '呼び出し側がより小さい上限を指定しないときに、1 回の検索で返す件数です。',
  overridden: '上書き済み',
  reset: '既定値に戻す',
  readOnly: 'このデプロイでは設定は読み取り専用です。',
  unavailable: 'このプラグインは読み込まれていないため、現在は設定できません。',
  save: '保存',
  saving: '保存中…',
  saveFailed: 'このデプロイは入力値を受け付けませんでした。修正できるよう値はそのまま残しています。',
  invalidNumber: '数値を入力してください。空欄にすると既定値を使います。',
}

/** Spanish copy. */
export const es: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Búsqueda y obtención de páginas web con Ollama Cloud',
  description: 'Configure los proveedores de búsqueda y descarga web de Ollama Cloud.',
  useOllama: 'Usar Ollama Cloud para la búsqueda y la descarga web',
  useOllamaHint: 'Activado selecciona ambas operaciones de Ollama Cloud; desactivado restaura la selección propia de la implementación.',
  apiKeyUnset: 'No hay ninguna clave de API de Ollama Cloud configurada. Estos proveedores usan la clave del proveedor de modelos Ollama Cloud (OLLAMA_CLOUD_API_KEY); configúrela en los ajustes de Modelos.',
  maxResults: 'Resultados por búsqueda',
  maxResultsHint: 'Resultados devueltos por búsqueda cuando quien llama no pide un límite menor.',
  overridden: 'Sobrescrito',
  reset: 'Restaurar el valor predeterminado',
  readOnly: 'Esta implementación guarda la configuración en modo de solo lectura.',
  unavailable: 'Este complemento no está cargado, así que ahora mismo no se puede configurar.',
  save: 'Guardar',
  saving: 'Guardando…',
  saveFailed: 'La implementación no aceptó estos valores; se conservaron para que los corrija.',
  invalidNumber: 'Introduzca un número o déjelo vacío para usar el valor predeterminado.',
}

/** French copy. */
export const fr: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Recherche et récupération de pages web avec Ollama Cloud',
  description: "Configurez les fournisseurs de recherche et de récupération web d'Ollama Cloud.",
  useOllama: 'Utiliser Ollama Cloud pour la recherche et la récupération web',
  useOllamaHint: "Activé, les deux opérations d'Ollama Cloud sont sélectionnées ; désactivé, la sélection propre au déploiement est rétablie.",
  apiKeyUnset: 'Aucune clé d\'API Ollama Cloud n\'est configurée. Ces fournisseurs utilisent la clé du fournisseur de modèles Ollama Cloud (OLLAMA_CLOUD_API_KEY) ; configurez-la dans les réglages des modèles.',
  maxResults: 'Résultats par recherche',
  maxResultsHint: "Résultats renvoyés par recherche lorsque l'appelant ne demande pas de limite plus petite.",
  overridden: 'Remplacé',
  reset: 'Rétablir la valeur par défaut',
  readOnly: 'Ce déploiement enregistre les réglages en lecture seule.',
  unavailable: "Ce greffon n'est pas chargé, il ne peut donc pas être configuré pour le moment.",
  save: 'Enregistrer',
  saving: 'Enregistrement…',
  saveFailed: "Le déploiement n'a pas accepté ces valeurs ; elles ont été conservées pour que vous les corrigiez.",
  invalidNumber: 'Saisissez un nombre ou laissez vide pour utiliser la valeur par défaut.',
}

/** German copy. */
export const de: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Websuche und Seitenabruf mit Ollama Cloud',
  description: 'Richten Sie die Web-Suche und den Web-Abruf von Ollama Cloud ein.',
  useOllama: 'Ollama Cloud für Websuche und Web-Abruf verwenden',
  useOllamaHint: 'Eingeschaltet wählt beide Ollama-Cloud-Funktionen; ausgeschaltet stellt die eigene Auswahl der Installation wieder her.',
  apiKeyUnset: 'Es ist kein API-Schlüssel für Ollama Cloud eingerichtet. Diese Anbieter verwenden den Schlüssel des Ollama-Cloud-Modellanbieters (OLLAMA_CLOUD_API_KEY); richten Sie ihn in den Modelleinstellungen ein.',
  maxResults: 'Ergebnisse pro Suche',
  maxResultsHint: 'Ergebnisse pro Suche, wenn der Aufrufer keine kleinere Grenze anfordert.',
  overridden: 'Überschrieben',
  reset: 'Auf Standard zurücksetzen',
  readOnly: 'Diese Installation speichert Einstellungen schreibgeschützt.',
  unavailable: 'Dieses Plugin ist nicht geladen und kann derzeit nicht eingerichtet werden.',
  save: 'Speichern',
  saving: 'Speichern…',
  saveFailed: 'Die Installation hat diese Werte nicht übernommen; sie bleiben zur Korrektur erhalten.',
  invalidNumber: 'Geben Sie eine Zahl ein oder lassen Sie das Feld leer, um den Standard zu verwenden.',
}

/** Russian copy. */
export const ru: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Веб-поиск и загрузка страниц через Ollama Cloud',
  description: 'Настройте провайдеры веб-поиска и загрузки страниц Ollama Cloud.',
  useOllama: 'Использовать Ollama Cloud для веб-поиска и загрузки страниц',
  useOllamaHint: 'Включено — выбраны обе возможности Ollama Cloud; выключено — восстанавливается выбор самого развёртывания.',
  apiKeyUnset: 'Ключ API Ollama Cloud не настроен. Эти провайдеры используют ключ поставщика моделей Ollama Cloud (OLLAMA_CLOUD_API_KEY); задайте его в настройках моделей.',
  maxResults: 'Результатов на поиск',
  maxResultsHint: 'Сколько результатов возвращает один поиск, если вызывающая сторона не задала меньший предел.',
  overridden: 'Переопределено',
  reset: 'Восстановить значение по умолчанию',
  readOnly: 'В этом развёртывании настройки хранятся только для чтения.',
  unavailable: 'Этот плагин не загружен, поэтому сейчас его нельзя настроить.',
  save: 'Сохранить',
  saving: 'Сохранение…',
  saveFailed: 'Развёртывание не приняло эти значения; они сохранены, чтобы вы могли их исправить.',
  invalidNumber: 'Введите число или оставьте поле пустым, чтобы использовать значение по умолчанию.',
}

/** Portuguese copy. */
export const pt: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Pesquisa e obtenção de páginas na web com Ollama Cloud',
  description: 'Configure os provedores de pesquisa e de busca de páginas do Ollama Cloud.',
  useOllama: 'Usar o Ollama Cloud para pesquisa e busca de páginas',
  useOllamaHint: 'Ligado seleciona as duas operações do Ollama Cloud; desligado restaura a seleção própria da implantação.',
  apiKeyUnset: 'Nenhuma chave de API do Ollama Cloud está configurada. Esses provedores usam a chave do provedor de modelos Ollama Cloud (OLLAMA_CLOUD_API_KEY); configure-a nas configurações de Modelos.',
  maxResults: 'Resultados por pesquisa',
  maxResultsHint: 'Resultados devolvidos por pesquisa quando quem chama não pede um limite menor.',
  overridden: 'Substituído',
  reset: 'Restaurar o padrão',
  readOnly: 'Esta implantação guarda as configurações somente para leitura.',
  unavailable: 'Este plugin não está carregado, então não pode ser configurado agora.',
  save: 'Salvar',
  saving: 'Salvando…',
  saveFailed: 'A implantação não aceitou estes valores; eles foram mantidos para você corrigir.',
  invalidNumber: 'Digite um número ou deixe em branco para usar o padrão.',
}

/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export function formLabels(t: (key: OllamaSearchSettingsLocaleKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
