import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import {
  applyPortableEnvironment,
  portableUpdateStatus,
  resolvePortableMode,
  shouldRegisterDeepLinkProtocol
} from './portable-mode'

test('portable mode only accepts an absolute Windows launcher directory', () => {
  assert.deepEqual(resolvePortableMode({ env: {}, platform: 'win32', pathModule: path.win32 }), { enabled: false })
  assert.deepEqual(
    resolvePortableMode({ env: { PORTABLE_EXECUTABLE_DIR: 'relative' }, platform: 'win32', pathModule: path.win32 }),
    { enabled: false }
  )
})

test('portable mode keeps desktop and Hermes state beside the launcher', () => {
  const mode = resolvePortableMode({
    env: { PORTABLE_EXECUTABLE_DIR: 'D:\\Tools\\RuyiHermesAgent' },
    platform: 'win32',
    pathModule: path.win32
  })

  assert.deepEqual(mode, {
    enabled: true,
    executableDir: 'D:\\Tools\\RuyiHermesAgent',
    dataDir: 'D:\\Tools\\RuyiHermesAgent\\data',
    hermesHome: 'D:\\Tools\\RuyiHermesAgent\\data\\hermes',
    userDataDir: 'D:\\Tools\\RuyiHermesAgent\\data\\RuyiHermesAgent'
  })
  assert.equal(shouldRegisterDeepLinkProtocol(mode), false)
})

test('portable mode preserves an explicit Hermes home override', () => {
  const mode = resolvePortableMode({
    env: { PORTABLE_EXECUTABLE_DIR: 'D:\\Tools' },
    platform: 'win32',
    pathModule: path.win32
  })
  const env: NodeJS.ProcessEnv = { HERMES_HOME: 'E:\\HermesData' }

  applyPortableEnvironment(mode, env)

  assert.equal(env.HERMES_HOME, 'E:\\HermesData')
  assert.equal(env.HERMES_DESKTOP_PORTABLE, '1')
  assert.equal(portableUpdateStatus(mode, 123)?.supported, false)
})
