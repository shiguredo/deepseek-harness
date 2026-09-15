/**
 * GitHub remote parsing for the `workspaceGit` namespace: which repository a
 * configured remote URL names, when that URL addresses github.com.
 *
 * @module @deepseek-ai/dsh-api-workspace-git/github
 */

import type { WorkspaceGitGithub } from './types.ts'

/** Scheme prefix of URL-shaped remotes (`https://`, `ssh://`, `git://`). */
const SCHEME_URL = /^[a-z][a-z\d+.-]*:\/\//i

/** Repository suffix a remote URL may carry (`moqt-js.git`). */
const GIT_SUFFIX = '.git'

/**
 * Read the GitHub repository a remote URL names.
 * @param remoteUrl - a configured remote URL in either spelling git stores.
 * @returns the `owner/repo` slug and canonical https URL, or null when the URL names anything else.
 */
export function githubRepository(remoteUrl: string): WorkspaceGitGithub | null {
  const remote = splitRemote(remoteUrl)
  if (remote === null || remote.host !== 'github.com') return null
  const segments = remote.path.split('/').filter(segment => segment !== '')
  if (segments.length !== 2) return null
  const [owner, repository] = segments as [string, string]
  const name = repository.endsWith(GIT_SUFFIX)
    ? repository.slice(0, -GIT_SUFFIX.length)
    : repository
  // A path whose repository segment is only the suffix names no repository.
  if (name === '') return null
  return { slug: `${owner}/${name}`, url: `https://github.com/${owner}/${name}` }
}

/**
 * Split one remote URL into its host and path, accepting both spellings git
 * stores: scheme URLs and scp-like `[user@]host:path` remotes.
 * @param remoteUrl - configured remote URL.
 * @returns the lower-cased host and the raw path, or null for an unrecognized spelling.
 */
function splitRemote(remoteUrl: string): { host: string; path: string } | null {
  if (SCHEME_URL.test(remoteUrl)) {
    try {
      const parsed = new URL(remoteUrl)
      return { host: parsed.hostname.toLowerCase(), path: parsed.pathname }
    } catch {
      // Swallows the URL parser's rejection (a malformed remote): an unparsable
      // URL names no repository, and nothing else reaches this arm.
      return null
    }
  }
  // An scp-like remote has no scheme: everything before the first colon is
  // `[user@]host`, and everything after it is the path.
  const colon = remoteUrl.indexOf(':')
  if (colon === -1) return null
  const authority = remoteUrl.slice(0, colon)
  const path = remoteUrl.slice(colon + 1)
  if (authority === '' || path === '') return null
  const host = authority.slice(authority.lastIndexOf('@') + 1)
  return { host: host.toLowerCase(), path }
}
