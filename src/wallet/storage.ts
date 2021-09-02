import os from 'os'
import { EncryptedWallet, Wallet, decryptWallet, encryptWallet } from './wallet'
import { HashPair, compare, createSalt, hash } from './hash'
import { dirname, sep } from 'path'
import { mkdir, readFile, stat, writeFile } from 'fs'

export type FileWallet = EncryptedWallet & {
  secret: HashPair
}

export type SimpleReadFn = (secretKey: string) => Promise<Wallet>
export type SimpleWriteFn = (wallet: Wallet, secretKey: string) => Promise<void>

const checkFile = (file: string) => new Promise<boolean>((resolve, reject) => {
  stat(file, (err, info) => {
    if (err !== null) {
      if (err.code === 'ENOENT') return resolve(false)
      return reject(err)
    }
    if (info.isDirectory()) return reject(`${file} is a directory`)
    return resolve(info.isFile())
  })
})

const prepareDirectory = (file: string) => new Promise<void>((resolve, reject) => {
  const dir = dirname(file)
  mkdir(dir, { recursive: true }, err => {
    if (err !== null) return reject(err)
    return resolve()
  })
})

export const createFileWallet = (wallet: Wallet, secretKey: string): FileWallet => ({
  ...encryptWallet(wallet, secretKey),
  secret: hash(secretKey, createSalt())
})

export const defaultFile = (): string => `${os.homedir}${sep}.xe-wallet.json`

export const decryptFileWallet = (wallet: FileWallet, secretKey: string): Wallet => {
  if (!compare(secretKey, wallet.secret)) throw new Error('invalid secret key')
  return decryptWallet(wallet, secretKey)
}

export const readWallet = (file: string): Promise<FileWallet> => new Promise((resolve, reject) => {
  checkFile(file)
    .then(fileExists => {
      if (!fileExists) return reject(`not found in ${file}`)
      readFile(file, (err, data) => {
        if (err !== null) return reject(err)
        const wallet = JSON.parse(data.toString())
        return resolve(wallet)
      })
    })
    .catch(err => reject(`failed to read wallet from ${file}: ${err}`))
})

export const withFile = (file: string): [SimpleReadFn, SimpleWriteFn] => [
  async (secretKey) => decryptFileWallet(await readWallet(file), secretKey),
  async (wallet, secretKey) => writeWallet(file, createFileWallet(wallet, secretKey))
]

export const writeWallet = (file: string, wallet: FileWallet): Promise<void> => new Promise((resolve, reject) => {
  prepareDirectory(file)
    .then(() => {
      const data = JSON.stringify(wallet)
      writeFile(file, data, err => {
        if (err !== null) return reject(err)
        return resolve()
      })
    })
    .catch(err => reject(`failed to write wallet to ${file}: ${err}`))
})