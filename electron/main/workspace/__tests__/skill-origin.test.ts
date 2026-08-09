import { describe, expect, it } from 'vitest'
import {
  buildWebUrl,
  parseRemoteUrl,
  personalOrigin,
  pluginOrigin,
  projectOrigin,
  refFromHead,
} from '../skill-origin'

describe('parseRemoteUrl', () => {
  it('normalizes an scp-style GitHub remote', () => {
    expect(parseRemoteUrl('git@github.com:acme/skills.git')).toEqual({
      host: 'github',
      label: 'acme/skills',
      repoUrl: 'https://github.com/acme/skills',
    })
  })

  it('strips a trailing .git from an https remote', () => {
    expect(parseRemoteUrl('https://github.com/acme/skills.git')?.repoUrl).toBe(
      'https://github.com/acme/skills',
    )
  })

  it('accepts an https remote without a .git suffix', () => {
    expect(parseRemoteUrl('https://github.com/acme/skills')?.repoUrl).toBe(
      'https://github.com/acme/skills',
    )
  })

  it('handles an ssh:// URL with a user', () => {
    expect(parseRemoteUrl('ssh://git@github.com/acme/skills.git')?.repoUrl).toBe(
      'https://github.com/acme/skills',
    )
  })

  it('strips embedded credentials', () => {
    expect(parseRemoteUrl('https://user:token@github.com/acme/skills.git')?.repoUrl).toBe(
      'https://github.com/acme/skills',
    )
  })

  it('drops a port', () => {
    expect(parseRemoteUrl('https://github.com:443/acme/skills.git')?.repoUrl).toBe(
      'https://github.com/acme/skills',
    )
  })

  it('detects GitLab and preserves subgroups in the label', () => {
    expect(parseRemoteUrl('git@gitlab.com:group/sub/proj.git')).toEqual({
      host: 'gitlab',
      label: 'group/sub/proj',
      repoUrl: 'https://gitlab.com/group/sub/proj',
    })
  })

  it('detects Bitbucket', () => {
    expect(parseRemoteUrl('https://bitbucket.org/team/repo.git')?.host).toBe('bitbucket')
  })

  it('classifies an unknown host as other but still normalizes', () => {
    expect(parseRemoteUrl('https://git.example.com/acme/skills.git')).toEqual({
      host: 'other',
      label: 'acme/skills',
      repoUrl: 'https://git.example.com/acme/skills',
    })
  })

  it('returns null for an unparseable remote', () => {
    expect(parseRemoteUrl('not a url')).toBeNull()
    expect(parseRemoteUrl('')).toBeNull()
  })
})

describe('buildWebUrl', () => {
  const gh = { host: 'github' as const, label: 'acme/skills', repoUrl: 'https://github.com/acme/skills' }

  it('appends a /tree/<ref>/<path> deep link for GitHub', () => {
    expect(buildWebUrl(gh, 'skills/tdd', 'main')).toBe(
      'https://github.com/acme/skills/tree/main/skills/tdd',
    )
  })

  it('defaults the ref to HEAD', () => {
    expect(buildWebUrl(gh, 'skills/tdd')).toBe('https://github.com/acme/skills/tree/HEAD/skills/tdd')
  })

  it('uses /src/ for Bitbucket', () => {
    const bb = { host: 'bitbucket' as const, label: 'team/repo', repoUrl: 'https://bitbucket.org/team/repo' }
    expect(buildWebUrl(bb, 'skills/tdd', 'main')).toBe(
      'https://bitbucket.org/team/repo/src/main/skills/tdd',
    )
  })

  it('falls back to the repo root when there is no subpath', () => {
    expect(buildWebUrl(gh, '')).toBe('https://github.com/acme/skills')
    expect(buildWebUrl(gh, '.')).toBe('https://github.com/acme/skills')
  })
})

describe('refFromHead', () => {
  it('reads an attached branch', () => {
    expect(refFromHead('ref: refs/heads/main\n')).toBe('main')
  })

  it('passes through a detached commit sha', () => {
    expect(refFromHead('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0\n')).toBe(
      'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    )
  })

  it('falls back to HEAD when unknown or missing', () => {
    expect(refFromHead(null)).toBe('HEAD')
    expect(refFromHead('garbage')).toBe('HEAD')
  })
})

describe('personalOrigin', () => {
  it('resolves a .skill-lock.json entry with its exact subfolder', () => {
    expect(
      personalOrigin({
        source: 'vercel-labs/skills',
        sourceType: 'github',
        sourceUrl: 'https://github.com/vercel-labs/skills.git',
        skillPath: 'skills/find-skills/SKILL.md',
      }),
    ).toEqual({
      host: 'github',
      label: 'vercel-labs/skills',
      repoUrl: 'https://github.com/vercel-labs/skills',
      webUrl: 'https://github.com/vercel-labs/skills/tree/HEAD/skills/find-skills',
    })
  })

  it('prefers the entry label over the parsed one', () => {
    expect(personalOrigin({ source: 'nice/label', sourceUrl: 'https://github.com/nice/label.git' })?.label).toBe(
      'nice/label',
    )
  })

  it('links to the repo root when skillPath is missing', () => {
    expect(personalOrigin({ sourceUrl: 'https://github.com/acme/skills.git' })?.webUrl).toBe(
      'https://github.com/acme/skills',
    )
  })

  it('returns null when there is no source url or no entry', () => {
    expect(personalOrigin(undefined)).toBeNull()
    expect(personalOrigin({ source: 'x' })).toBeNull()
  })
})

describe('pluginOrigin', () => {
  it('resolves a git-subdir plugin to the skill folder inside its plugin path', () => {
    expect(
      pluginOrigin(
        {
          source: 'git-subdir',
          url: 'https://github.com/42Crunch-AI/claude-plugins.git',
          path: 'plugins/api-security-testing',
          ref: 'main',
        },
        'api-security-testing',
      ),
    ).toEqual({
      host: 'github',
      label: '42Crunch-AI/claude-plugins',
      repoUrl: 'https://github.com/42Crunch-AI/claude-plugins',
      webUrl:
        'https://github.com/42Crunch-AI/claude-plugins/tree/main/plugins/api-security-testing/skills/api-security-testing',
    })
  })

  it('resolves a {source:github, repo} plugin whose plugin dir is the repo root', () => {
    expect(pluginOrigin({ source: 'github', repo: 'acme/cool-plugin' }, 'my-skill')?.webUrl).toBe(
      'https://github.com/acme/cool-plugin/tree/HEAD/skills/my-skill',
    )
  })

  it('resolves a string-path plugin into the marketplace repo it ships inside', () => {
    const marketplaceRepo = {
      host: 'github' as const,
      label: 'anthropics/claude-plugins-official',
      repoUrl: 'https://github.com/anthropics/claude-plugins-official',
    }
    expect(pluginOrigin('./plugins/code-review', 'code-review', marketplaceRepo)?.webUrl).toBe(
      'https://github.com/anthropics/claude-plugins-official/tree/HEAD/plugins/code-review/skills/code-review',
    )
  })

  it('returns null for a string source with no marketplace repo to anchor it', () => {
    expect(pluginOrigin('./plugins/code-review', 'code-review')).toBeNull()
  })

  it('returns null for an unsupported or missing source', () => {
    expect(pluginOrigin(undefined, 'x')).toBeNull()
    expect(pluginOrigin({ source: 'local' }, 'x')).toBeNull()
  })
})

describe('projectOrigin', () => {
  const gitConfig = `[core]
	repositoryformatversion = 0
[remote "origin"]
	url = https://github.com/klubinskak/flipsy.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
`

  it('resolves a project skill inside a git clone to its path in the repo', () => {
    expect(
      projectOrigin({ gitConfig, head: 'ref: refs/heads/main\n', skillRelPath: '.claude/skills/tdd' }),
    ).toEqual({
      host: 'github',
      label: 'klubinskak/flipsy',
      repoUrl: 'https://github.com/klubinskak/flipsy',
      webUrl: 'https://github.com/klubinskak/flipsy/tree/main/.claude/skills/tdd',
    })
  })

  it('returns null when the git config has no remote', () => {
    expect(projectOrigin({ gitConfig: '[core]\n', head: null, skillRelPath: '.claude/skills/tdd' })).toBeNull()
  })
})
