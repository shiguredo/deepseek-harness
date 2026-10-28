/** Locale bundles for the Ollama Cloud web provider's settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type OllamaSearchSettingsLocaleKey =
  | 'title' | 'description'
  | 'useOllama' | 'useOllamaHint'
  | 'apiKey' | 'apiKeyHint' | 'apiKeySet' | 'apiKeyUnset'
  | 'searchBaseUrl' | 'searchBaseUrlHint' | 'fetchBaseUrl' | 'fetchBaseUrlHint'
  | 'maxResults' | 'maxResultsHint'
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable'
  | 'save' | 'saving' | 'saveFailed' | 'invalidNumber'

/** English copy. */
export const en: Record<OllamaSearchSettingsLocaleKey, string> = {
  title: 'Ollama Cloud search',
  description: 'Set up the Ollama Cloud web search and fetch providers.',
  useOllama: 'Use Ollama Cloud for web search and fetch',
  useOllamaHint: 'On selects both Ollama Cloud operations; off restores the deployment\'s own selection.',
  apiKey: 'API key',
  apiKeyHint: 'Stored outside the settings file. Leave blank to keep the current key.',
  apiKeySet: 'A key is configured.',
  apiKeyUnset: 'No key is configured; this provider cannot search or fetch until one is set.',
  searchBaseUrl: 'Search API URL',
  searchBaseUrlHint: 'Include the API prefix, such as https://ollama.com. The provider appends /api/web_search. Leave blank to restore the default.',
  fetchBaseUrl: 'Fetch API URL',
  fetchBaseUrlHint: 'Include the API prefix, such as https://ollama.com. The provider appends /api/web_fetch. Leave blank to restore the default.',
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
  title: 'Ollama Cloud 搜索',
  description: '设置 Ollama Cloud 的网页搜索与抓取提供方。',
  useOllama: '网页搜索与抓取都使用 Ollama Cloud',
  useOllamaHint: '开启即选中 Ollama Cloud 的两项能力；关闭则恢复本部署自己的选择。',
  apiKey: 'API Key',
  apiKeyHint: '不写入设置文件。留空表示保持当前密钥。',
  apiKeySet: '已配置密钥。',
  apiKeyUnset: '未配置密钥；设置之前该提供方无法搜索或抓取。',
  searchBaseUrl: '搜索 API 地址',
  searchBaseUrlHint: '填写含 API 前缀的地址，例如 https://ollama.com；程序追加 /api/web_search，留空恢复默认。',
  fetchBaseUrl: '抓取 API 地址',
  fetchBaseUrlHint: '填写含 API 前缀的地址，例如 https://ollama.com；程序追加 /api/web_fetch，留空恢复默认。',
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
  title: 'Ollama Cloud 検索',
  description: 'Ollama Cloud の Web 検索とページ取得の提供元を設定します。',
  useOllama: 'Web 検索とページ取得に Ollama Cloud を使う',
  useOllamaHint: 'オンにすると Ollama Cloud の 2 つの機能をまとめて選び、オフにするとこのデプロイ独自の選択に戻します。',
  apiKey: 'API キー',
  apiKeyHint: '設定ファイルには書き込みません。空欄のままにすると現在のキーを保持します。',
  apiKeySet: 'キーが設定されています。',
  apiKeyUnset: 'キーが未設定です。設定するまでこの提供元は検索も取得もできません。',
  searchBaseUrl: '検索 API URL',
  searchBaseUrlHint: 'https://ollama.com のように API プレフィックスまで含めます。続きに /api/web_search が追加されます。空欄にすると既定値に戻ります。',
  fetchBaseUrl: '取得 API URL',
  fetchBaseUrlHint: 'https://ollama.com のように API プレフィックスまで含めます。続きに /api/web_fetch が追加されます。空欄にすると既定値に戻ります。',
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
  title: 'Búsqueda de Ollama Cloud',
  description: 'Configure los proveedores de búsqueda y descarga web de Ollama Cloud.',
  useOllama: 'Usar Ollama Cloud para la búsqueda y la descarga web',
  useOllamaHint: 'Activado selecciona ambas operaciones de Ollama Cloud; desactivado restaura la selección propia de la implementación.',
  apiKey: 'Clave de API',
  apiKeyHint: 'Se guarda fuera del archivo de configuración. Déjelo vacío para conservar la clave actual.',
  apiKeySet: 'Hay una clave configurada.',
  apiKeyUnset: 'No hay ninguna clave configurada; este proveedor no puede buscar ni descargar hasta que se configure una.',
  searchBaseUrl: 'URL de la API de búsqueda',
  searchBaseUrlHint: 'Incluya el prefijo de la API, como https://ollama.com. El proveedor añade /api/web_search. Déjelo vacío para restaurar el valor predeterminado.',
  fetchBaseUrl: 'URL de la API de descarga',
  fetchBaseUrlHint: 'Incluya el prefijo de la API, como https://ollama.com. El proveedor añade /api/web_fetch. Déjelo vacío para restaurar el valor predeterminado.',
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
  title: 'Recherche Ollama Cloud',
  description: "Configurez les fournisseurs de recherche et de récupération web d'Ollama Cloud.",
  useOllama: 'Utiliser Ollama Cloud pour la recherche et la récupération web',
  useOllamaHint: "Activé, les deux opérations d'Ollama Cloud sont sélectionnées ; désactivé, la sélection propre au déploiement est rétablie.",
  apiKey: "Clé d'API",
  apiKeyHint: 'Stockée hors du fichier de configuration. Laissez vide pour conserver la clé actuelle.',
  apiKeySet: 'Une clé est configurée.',
  apiKeyUnset: "Aucune clé n'est configurée ; ce fournisseur ne peut ni rechercher ni récupérer avant qu'une clé soit définie.",
  searchBaseUrl: "URL de l'API de recherche",
  searchBaseUrlHint: "Incluez le préfixe de l'API, par exemple https://ollama.com. Le fournisseur ajoute /api/web_search. Laissez vide pour rétablir la valeur par défaut.",
  fetchBaseUrl: "URL de l'API de récupération",
  fetchBaseUrlHint: "Incluez le préfixe de l'API, par exemple https://ollama.com. Le fournisseur ajoute /api/web_fetch. Laissez vide pour rétablir la valeur par défaut.",
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
  title: 'Ollama Cloud Suche',
  description: 'Richten Sie die Web-Suche und den Web-Abruf von Ollama Cloud ein.',
  useOllama: 'Ollama Cloud für Websuche und Web-Abruf verwenden',
  useOllamaHint: 'Eingeschaltet wählt beide Ollama-Cloud-Funktionen; ausgeschaltet stellt die eigene Auswahl der Installation wieder her.',
  apiKey: 'API-Schlüssel',
  apiKeyHint: 'Wird außerhalb der Einstellungsdatei gespeichert. Leer lassen, um den aktuellen Schlüssel zu behalten.',
  apiKeySet: 'Ein Schlüssel ist eingerichtet.',
  apiKeyUnset: 'Es ist kein Schlüssel eingerichtet; dieser Anbieter kann erst nach dem Setzen eines Schlüssels suchen und abrufen.',
  searchBaseUrl: 'Such-API-URL',
  searchBaseUrlHint: 'Geben Sie das API-Präfix an, etwa https://ollama.com. Der Anbieter hängt /api/web_search an. Leer lassen, um den Standard wiederherzustellen.',
  fetchBaseUrl: 'Abruf-API-URL',
  fetchBaseUrlHint: 'Geben Sie das API-Präfix an, etwa https://ollama.com. Der Anbieter hängt /api/web_fetch an. Leer lassen, um den Standard wiederherzustellen.',
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
  title: 'Поиск Ollama Cloud',
  description: 'Настройте провайдеры веб-поиска и загрузки страниц Ollama Cloud.',
  useOllama: 'Использовать Ollama Cloud для веб-поиска и загрузки страниц',
  useOllamaHint: 'Включено — выбраны обе возможности Ollama Cloud; выключено — восстанавливается выбор самого развёртывания.',
  apiKey: 'Ключ API',
  apiKeyHint: 'Хранится вне файла настроек. Оставьте пустым, чтобы сохранить текущий ключ.',
  apiKeySet: 'Ключ настроен.',
  apiKeyUnset: 'Ключ не настроен; без него этот провайдер не может ни искать, ни загружать страницы.',
  searchBaseUrl: 'URL API поиска',
  searchBaseUrlHint: 'Укажите префикс API, например https://ollama.com. Провайдер допишет /api/web_search. Оставьте пустым, чтобы восстановить значение по умолчанию.',
  fetchBaseUrl: 'URL API загрузки',
  fetchBaseUrlHint: 'Укажите префикс API, например https://ollama.com. Провайдер допишет /api/web_fetch. Оставьте пустым, чтобы восстановить значение по умолчанию.',
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
  title: 'Pesquisa do Ollama Cloud',
  description: 'Configure os provedores de pesquisa e de busca de páginas do Ollama Cloud.',
  useOllama: 'Usar o Ollama Cloud para pesquisa e busca de páginas',
  useOllamaHint: 'Ligado seleciona as duas operações do Ollama Cloud; desligado restaura a seleção própria da implantação.',
  apiKey: 'Chave de API',
  apiKeyHint: 'Guardada fora do arquivo de configurações. Deixe em branco para manter a chave atual.',
  apiKeySet: 'Há uma chave configurada.',
  apiKeyUnset: 'Nenhuma chave está configurada; este provedor não pesquisa nem busca páginas até que uma seja definida.',
  searchBaseUrl: 'URL da API de pesquisa',
  searchBaseUrlHint: 'Inclua o prefixo da API, como https://ollama.com. O provedor acrescenta /api/web_search. Deixe em branco para restaurar o padrão.',
  fetchBaseUrl: 'URL da API de busca de páginas',
  fetchBaseUrlHint: 'Inclua o prefixo da API, como https://ollama.com. O provedor acrescenta /api/web_fetch. Deixe em branco para restaurar o padrão.',
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
