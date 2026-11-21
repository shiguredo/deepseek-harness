/**
 * Wire types for Ollama Cloud's web APIs: web search
 * (`POST https://ollama.com/api/web_search`) and web fetch
 * (`POST https://ollama.com/api/web_fetch`). Types only — no runtime code.
 * Search returns a flat `results[]` whose entries carry a URL, an optional
 * title, and optional page `content`; fetch returns one page as Markdown with
 * its title and the links the page carries.
 *
 * @module @deepseek-ai/dsh-web-ollama-api/types
 */

/** Request body sent to Ollama's search endpoint. */
export interface OllamaSearchRequest {
  query: string
  /** Ollama's result-count control; the seam still enforces the bound on return. */
  max_results: number
}

/** One entry of Ollama's flat `results[]`. */
export interface OllamaResult {
  title?: string | null
  url: string
  content?: string | null
}

/** Ollama's search response envelope. */
export interface OllamaSearchResponse {
  results?: OllamaResult[]
}

/** Request body sent to Ollama's fetch endpoint. */
export interface OllamaFetchRequest {
  url: string
}

/** Ollama's fetch response envelope. */
export interface OllamaFetchResponse {
  title?: string | null
  content?: string | null
  links?: string[] | null
}

/** Ollama's error response envelope (best-effort; fields vary by failure). */
export interface OllamaError {
  error?: string
  message?: string
}
