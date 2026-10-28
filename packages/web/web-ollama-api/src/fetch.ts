/**
 * `OllamaFetchProvider`: a `WebFetchProvider` backed by Ollama Cloud's
 * `POST /api/web_fetch`, the fetch half of the same web capability the search
 * provider uses. One request per fetch, no model request.
 * @module @deepseek-ai/dsh-web-ollama-api/fetch
 */

import type { WebFetchProvider, WebFetchRequest, WebFetchResult } from '@deepseek-ai/dsh-web'
import {
  dispatchOllamaWeb, hasOllamaCredential, invalidResponse, isRecord, ollamaEndpoint,
  type OllamaWebAuth,
} from './transport.ts'

/** Stable id this provider registers under in the fetch registry. */
export const OLLAMA_FETCH_PROVIDER_ID = 'ollama-cloud-fetch'

/** Authentication and endpoint values snapshotted for one fetch. */
export interface OllamaFetchProviderOptions extends OllamaWebAuth {
  /** Fetch endpoint base or the full `/api/web_fetch` URL. */
  fetchBaseURL: string
}

/**
 * Fetch one page through the Ollama Cloud web API. The API reports neither the
 * target's status nor a final redirect URL, and it fails when the page yields
 * no content, so a success is the requested page retrieved with HTTP 200.
 */
export class OllamaFetchProvider implements WebFetchProvider {
  readonly id = OLLAMA_FETCH_PROVIDER_ID
  /** Brand name the provider picker shows; the same in every locale. */
  readonly title = 'Ollama Cloud'
  /** Picker description: what this provider suits and what it costs or cannot do. */
  readonly description: NonNullable<WebFetchProvider['description']> = {
    en: 'Fetches public URLs on Ollama Cloud servers and returns Markdown. Uses an Ollama Cloud API key, may incur API charges, and cannot reach intranet or loopback addresses.',
    zh: '由 Ollama Cloud 服务端抓取公网页面并返回 Markdown。使用 Ollama Cloud API 密钥，可能产生计费，且无法访问内网和本机',
    ja: 'Ollama Cloud のサーバーで公開 URL を取得して Markdown を返します。Ollama Cloud の API キーを使用し、API 料金が発生する場合があり、イントラネットやループバックのアドレスには到達できません。',
    es: 'Obtiene URL públicas en servidores de Ollama Cloud y devuelve Markdown. Usa una clave de API de Ollama Cloud, puede generar cargos de API y no puede alcanzar direcciones de intranet ni de bucle local.',
    fr: 'Récupère les URL publiques sur les serveurs d\'Ollama Cloud et renvoie du Markdown. Utilise une clé API Ollama Cloud, peut entraîner des frais d\'API et ne peut pas atteindre les adresses d\'intranet ou de bouclage.',
    de: 'Ruft öffentliche URLs auf Ollama Cloud-Servern ab und liefert Markdown. Verwendet einen Ollama Cloud API-Schlüssel, kann API-Kosten verursachen und erreicht weder Intranet- noch Loopback-Adressen.',
    ru: 'Загружает публичные URL на серверах Ollama Cloud и возвращает Markdown. Использует ключ API Ollama Cloud, может приводить к оплате API и не достигает адресов интрасети и локальной петли.',
    pt: 'Busca URLs públicas nos servidores do Ollama Cloud e retorna Markdown. Usa uma chave de API do Ollama Cloud, pode gerar cobranças de API e não alcança endereços de intranet ou de loopback.',
  }

  /**
   * @param resolveOptions - the options for the NEXT fetch, snapshotted once at
   * each fetch's entry so one fetch never mixes two settings sections.
   */
  constructor(private readonly resolveOptions: () => OllamaFetchProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    return hasOllamaCredential(options) && URL.canParse(options.fetchBaseURL)
  }

  fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    const options = this.resolveOptions()
    return dispatchOllamaWeb(options, {
      endpoint: ollamaEndpoint(options.fetchBaseURL, 'web_fetch'),
      body: { url: request.url },
      decode: (payload): WebFetchResult => {
        if (!isRecord(payload) || typeof payload.content !== 'string') throw invalidResponse()
        return {
          url: request.url,
          statusCode: 200,
          body: { kind: 'text', content: payload.content },
          truncated: false,
        }
      },
      subject: 'fetch',
    }, signal)
  }
}
