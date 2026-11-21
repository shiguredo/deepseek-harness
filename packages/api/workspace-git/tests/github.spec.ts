/** GitHub remote parsing over the spellings git stores. */

import { describe, expect, it } from 'vitest'
import { githubRepository } from '../src/github.ts'

describe('githubRepository', () => {
  it.each([
    ['https://github.com/shiguredo/moqt-js.git', 'shiguredo/moqt-js'],
    ['https://github.com/shiguredo/moqt-js', 'shiguredo/moqt-js'],
    ['https://github.com/shiguredo/moqt-js/', 'shiguredo/moqt-js'],
    ['http://github.com/shiguredo/moqt-js.git', 'shiguredo/moqt-js'],
    ['git://github.com/shiguredo/moqt-js.git', 'shiguredo/moqt-js'],
    ['ssh://git@github.com/shiguredo/moqt-js.git', 'shiguredo/moqt-js'],
    ['ssh://git@github.com:22/shiguredo/moqt-js.git', 'shiguredo/moqt-js'],
    ['git@github.com:shiguredo/moqt-js.git', 'shiguredo/moqt-js'],
    ['github.com:shiguredo/moqt-js.git', 'shiguredo/moqt-js'],
    ['HTTPS://GitHub.COM/Shiguredo/Moqt-JS.git', 'Shiguredo/Moqt-JS'],
  ])('reads %s as the github.com repository %s', (remoteUrl, slug) => {
    expect(githubRepository(remoteUrl)).toEqual({ slug, url: `https://github.com/${slug}` })
  })

  it.each([
    'https://gitlab.com/shiguredo/moqt-js.git',
    'git@bitbucket.org:shiguredo/moqt-js.git',
    'https://gist.github.com/shiguredo/1a2b3c.git',
    'https://github.com/shiguredo',
    'https://github.com/shiguredo/moqt-js/extra',
    'https://github.com/shiguredo/.git',
    'file:///srv/git/moqt-js.git',
    'https:///shiguredo/moqt-js.git',
    'no-url-here',
    ':shiguredo/moqt-js.git',
    'git@github.com:',
    'https://github.com:99999999/shiguredo/moqt-js.git',
  ])('names no repository behind %s', (remoteUrl) => {
    expect(githubRepository(remoteUrl)).toBeNull()
  })
})
