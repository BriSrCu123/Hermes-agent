import { execFileSync } from 'node:child_process'
import https from 'node:https'
import path from 'node:path'

import { normalizeGitHubRepository, rawInstallScriptUrl, validateRemoteInstallScript } from './release-source.mjs'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function downloadText(url, attempt = 1) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'RuyiHermesAgent-release-preflight/1' }, timeout: 20_000 }, response => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`HTTP ${response.statusCode} from ${url}`))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        body += chunk
        if (body.length > 2_000_000) request.destroy(new Error(`response too large from ${url}`))
      })
      response.on('end', () => resolve(body))
      response.on('error', reject)
    })
    request.on('timeout', () => request.destroy(new Error(`timeout fetching ${url}`)))
    request.on('error', reject)
  }).catch(error => {
    if (attempt >= 3) throw error
    return new Promise(resolve => setTimeout(resolve, attempt * 800)).then(() => downloadText(url, attempt + 1))
  })
}

async function main() {
  const commit = git(['rev-parse', 'HEAD'])
  const repository =
    normalizeGitHubRepository(process.env.HERMES_BUILD_REPOSITORY) ||
    normalizeGitHubRepository(process.env.GITHUB_REPOSITORY) ||
    normalizeGitHubRepository(git(['remote', 'get-url', 'origin']))

  if (!repository) throw new Error('could not resolve GitHub owner/repo from origin')

  for (const scriptName of ['install.ps1', 'install.sh']) {
    const url = rawInstallScriptUrl(repository, commit, scriptName)
    const source = await downloadText(url)
    validateRemoteInstallScript(scriptName, source, repository)
    console.log(`[verify-install-source] ${scriptName}: ${url}`)
  }
  console.log(`[verify-install-source] OK: ${repository}@${commit.slice(0, 12)}`)
}

main().catch(error => {
  console.error(`[verify-install-source] ERROR: ${error.message}`)
  console.error('Commit and push the release files to origin before packaging the portable EXE.')
  process.exit(1)
})
