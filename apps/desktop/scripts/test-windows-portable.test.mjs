import assert from 'node:assert/strict'
import test from 'node:test'

import { assertLauncherMachine, portableArtifactName } from './test-windows-portable.mjs'

test('portable artifact uses the target-specific product name', () => {
  assert.equal(
    portableArtifactName({ version: '1.2.3', build: { portable: { artifactName: 'App-Portable-${version}-${arch}.${ext}' } } }, 'x64'),
    'App-Portable-1.2.3-x64.exe'
  )
})

test('portable launcher accepts electron-builder ia32 wrapper around an x64 application', () => {
  assert.doesNotThrow(() => assertLauncherMachine(0x014c, 0x8664))
  assert.doesNotThrow(() => assertLauncherMachine(0x8664, 0x8664))
  assert.throws(() => assertLauncherMachine(0xaa64, 0x8664), /unsupported PE machine/)
})
