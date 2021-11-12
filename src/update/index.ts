// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

import { Network } from '../main'
import { createHash } from 'crypto'
import path from 'path'
import pkg from '../../package.json'
import superagent from 'superagent'
import { SemVer, parse } from 'semver'
import { arch, platform, tmpdir } from 'os'
import { createWriteStream, mkdtempSync, readFile } from 'fs'

export type DownloadInfo = {
  checksum: string
  file: string
}

export type VersionStatus = {
  current: SemVer
  latest: SemVer
  requireUpdate: boolean
}

const calcDigest = async (file: string): Promise<string> => new Promise<string>((resolve, reject) => {
  console.log('calculating digest for', file)
  readFile(file, (err, data) => {
    if (err) {
      console.log('error calculating digest', err)
      return reject(err)
    }
    const hash = createHash('sha256').update(data).digest('hex')
    console.log('hash calculated:', hash)
    resolve(hash)
  })
})

const downloadURL = async (url: string, file: string) => new Promise<void>((resolve, reject) => {
  console.log('downloading', url, 'to', file)
  const stream = createWriteStream(file)
  const request = superagent.get(url)
  request.pipe(stream)
  request.on('end', () => resolve())
  request.on('error', reject)
})

export const download = async (network: Network): Promise<DownloadInfo> => {
  try {
    const csURL = network.files.latestChecksumURL(normalizedPlatform(), arch())
    const csResponse = await superagent.get(csURL)
    const checksum = csResponse.text.trim()

    const file = mkdtempSync(path.join(tmpdir(), 'edge-update-')) + path.sep + 'edge'
    const buildURL = network.files.latestBuildURL(normalizedPlatform(), arch(), ext())
    await downloadURL(buildURL, file)

    const filesum = await calcDigest(file)
    if (checksum === filesum) return { checksum, file }
    throw new Error(`checksum mismatch (${filesum} vs. ${checksum})`)
  }
  catch (err) {
    throw new Error(`failed to download latest binary: ${err}`)
  }
}

const ext = (): string => normalizedPlatform() === 'windows' ? '.exe' : ''

export const latestVersion = async (network: Network): Promise<SemVer> => {
  const url = network.files.latestVersionURL(normalizedPlatform(), arch())
  try {
    const response = await superagent.get(url)
    const sv = parse(response.text.trim())
    if (sv === null) throw new Error(`server provided invalid version "${response.text}"`)
    return sv
  }
  catch (err) {
    throw new Error(`unable to retrieve latest version: ${err}`)
  }
}

const normalizedPlatform = (): string => {
  const p = platform()
  if (p === 'darwin') return 'macos'
  if (p === 'win32') return 'windows'
  return p
}

export const status = async (network: Network): Promise<VersionStatus> => {
  const current = parse(pkg.version)
  if (current === null) throw new Error('invalid package version')
  const latest = await latestVersion(network)
  const requireUpdate = latest.compare(current) > 0
  return { current, latest, requireUpdate }
}
