#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { isMain } from './utils.mjs'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')
const desktopPackage = JSON.parse(fs.readFileSync(path.join(DESKTOP_ROOT, 'package.json'), 'utf8'))

function renderArtifactName(template, { version, arch }) {
  return String(template)
    .replaceAll('${version}', version)
    .replaceAll('${arch}', arch)
    .replaceAll('${ext}', 'exe')
}

function portableArtifactName(packageJson = desktopPackage, arch = process.arch === 'arm64' ? 'arm64' : 'x64') {
  const template = packageJson?.build?.portable?.artifactName
  if (!template) throw new Error('build.portable.artifactName is not configured')
  return renderArtifactName(template, { version: packageJson.version, arch })
}

function readPeMachine(file) {
  const handle = fs.openSync(file, 'r')
  try {
    const dos = Buffer.alloc(64)
    fs.readSync(handle, dos, 0, dos.length, 0)
    if (dos.readUInt16LE(0) !== 0x5a4d) throw new Error(`not a PE executable: ${file}`)
    const peOffset = dos.readUInt32LE(0x3c)
    const header = Buffer.alloc(6)
    fs.readSync(handle, header, 0, header.length, peOffset)
    if (header.readUInt32LE(0) !== 0x00004550) throw new Error(`invalid PE signature: ${file}`)
    return header.readUInt16LE(4)
  } finally {
    fs.closeSync(handle)
  }
}

function assertLauncherMachine(machine, expectedApplicationMachine) {
  // electron-builder's portable NSIS wrapper is normally ia32 even when the
  // unpacked Electron application is x64. Both are valid launcher layouts.
  if (machine !== 0x014c && machine !== expectedApplicationMachine) {
    throw new Error(`portable launcher has unsupported PE machine 0x${machine.toString(16)}`)
  }
}

function assertProbe(probe, launcherDir) {
  const expectedData = path.join(launcherDir, 'data')
  if (probe.enabled !== true) throw new Error('portable probe did not enable portable mode')
  if (path.resolve(probe.executableDir) !== path.resolve(launcherDir)) {
    throw new Error(`portable launcher directory mismatch: ${probe.executableDir}`)
  }
  if (path.resolve(probe.dataDir) !== path.resolve(expectedData)) {
    throw new Error(`portable data directory mismatch: ${probe.dataDir}`)
  }
  if (path.resolve(probe.hermesHome) !== path.resolve(expectedData, 'hermes')) {
    throw new Error(`portable HERMES_HOME mismatch: ${probe.hermesHome}`)
  }
  if (path.resolve(probe.userDataDir) !== path.resolve(expectedData, 'RuyiHermesAgent')) {
    throw new Error(`portable userData mismatch: ${probe.userDataDir}`)
  }
  if (probe.registerDeepLinkProtocol !== false) throw new Error('portable build would register hermes://')
}

function main() {
  if (process.platform !== 'win32') throw new Error('Windows portable smoke test requires Windows')

  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const expectedApplicationMachine = arch === 'arm64' ? 0xaa64 : 0x8664
  const artifact = path.join(DESKTOP_ROOT, 'release', portableArtifactName(desktopPackage, arch))
  const unpacked = path.join(
    DESKTOP_ROOT,
    'release',
    arch === 'arm64' ? 'win-arm64-unpacked' : 'win-unpacked',
    `${desktopPackage.build.executableName}.exe`
  )

  if (!fs.existsSync(artifact)) throw new Error(`missing portable artifact: ${artifact}`)
  if (!fs.existsSync(unpacked)) throw new Error(`missing unpacked executable: ${unpacked}`)

  assertLauncherMachine(readPeMachine(artifact), expectedApplicationMachine)
  if (readPeMachine(unpacked) !== expectedApplicationMachine) {
    throw new Error(`portable application has the wrong PE architecture for ${arch}`)
  }

  const smokeRoot = path.join(REPO_ROOT, 'tmp', 'desktop-portable-smoke')
  fs.mkdirSync(smokeRoot, { recursive: true })
  const launcherDir = fs.mkdtempSync(path.join(smokeRoot, 'portable-'))
  const launcher = path.join(launcherDir, path.basename(artifact))
  const probePath = path.join(launcherDir, 'portable-probe.json')
  fs.copyFileSync(artifact, launcher)

  try {
    const result = spawnSync(launcher, [], {
      cwd: launcherDir,
      env: { ...process.env, HERMES_DESKTOP_PORTABLE_PROBE: probePath },
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true
    })

    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`portable probe exited ${result.status}: ${result.stderr || result.stdout}`)
    if (!fs.existsSync(probePath)) throw new Error('portable probe did not write its result')
    assertProbe(JSON.parse(fs.readFileSync(probePath, 'utf8')), launcherDir)
    console.log(`[portable-smoke] PASS: ${path.basename(artifact)}`)
  } finally {
    fs.rmSync(launcherDir, { recursive: true, force: true })
  }
}

export { assertLauncherMachine, assertProbe, portableArtifactName, readPeMachine }

if (isMain(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`[portable-smoke] ${error.message}`)
    process.exitCode = 1
  }
}
