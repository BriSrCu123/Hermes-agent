const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

function normalizeGitHubRepository(value) {
  if (!value) return null
  const raw = String(value).trim().replace(/^git\+/, '').replace(/\.git$/i, '')
  if (REPOSITORY_RE.test(raw)) return raw
  const match = raw.match(/github\.com[/:]([^/]+)\/([^/#]+)$/i)
  return match && REPOSITORY_RE.test(`${match[1]}/${match[2]}`) ? `${match[1]}/${match[2]}` : null
}

function rawInstallScriptUrl(repository, commit, scriptName = 'install.ps1') {
  if (!REPOSITORY_RE.test(String(repository || ''))) throw new Error(`invalid GitHub repository slug: ${repository}`)
  if (!/^[0-9a-f]{40}$/i.test(String(commit || ''))) throw new Error(`release commit must be a full SHA: ${commit}`)
  if (scriptName !== 'install.ps1' && scriptName !== 'install.sh') throw new Error(`unsupported install script: ${scriptName}`)
  return `https://raw.githubusercontent.com/${repository}/${commit}/scripts/${scriptName}`
}

function validateRemoteInstallScript(scriptName, source, repository) {
  const required =
    scriptName === 'install.ps1'
      ? [/\[string\]\$RepoSlug/, /github\.com:\$RepoSlug/, /github\.com\/\$RepoSlug/]
      : [/--repo-slug/, /REPO_SLUG=/]

  for (const pattern of required) {
    if (!pattern.test(source)) throw new Error(`${scriptName} at the pinned commit is stale (missing ${pattern})`)
  }
  if (!source.includes(repository)) throw new Error(`${scriptName} does not contain the expected repository ${repository}`)
}

export { normalizeGitHubRepository, rawInstallScriptUrl, validateRemoteInstallScript }
