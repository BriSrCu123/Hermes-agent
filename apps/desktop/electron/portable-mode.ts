import path from 'node:path'

export type PortableMode =
  | { enabled: false }
  | {
      enabled: true
      executableDir: string
      dataDir: string
      hermesHome: string
      userDataDir: string
    }

export function resolvePortableMode({
  env = process.env,
  platform = process.platform,
  pathModule = path
}: {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform | string
  pathModule?: typeof path
} = {}): PortableMode {
  const configuredDir = env.PORTABLE_EXECUTABLE_DIR?.trim()

  if (platform !== 'win32' || !configuredDir || !pathModule.isAbsolute(configuredDir)) {
    return { enabled: false }
  }

  const executableDir = pathModule.resolve(configuredDir)
  const dataDir = pathModule.join(executableDir, 'data')

  return {
    enabled: true,
    executableDir,
    dataDir,
    hermesHome: pathModule.join(dataDir, 'hermes'),
    userDataDir: pathModule.join(dataDir, 'RuyiHermesAgent')
  }
}

export function applyPortableEnvironment(mode: PortableMode, env: NodeJS.ProcessEnv = process.env) {
  if (!mode.enabled) return

  env.HERMES_DESKTOP_PORTABLE = '1'
  env.HERMES_HOME ||= mode.hermesHome
}

export function shouldRegisterDeepLinkProtocol(mode: PortableMode) {
  return !mode.enabled
}

export function portableUpdateStatus(mode: PortableMode, fetchedAt = Date.now()) {
  if (!mode.enabled) return null

  return {
    supported: false,
    reason: 'portable-build',
    message: 'Replace the portable executable to update. The adjacent data folder is preserved.',
    fetchedAt
  }
}
