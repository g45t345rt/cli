import { Network } from '../config'
import { get } from 'https'

type TransactionData = {
  memo?: string
}

type Transaction = {
  timestamp: number
  sender: string
  recipient: string
  amount: number
  data: TransactionData
  nonce: number
  signature: string
  hash: string
  block: {
    height: number
    hash: string
  }
  confirmations: number
}

export const transactions =
  (network: Network, address: string, page: number, limit: number): Promise<Transaction[]> =>
    new Promise((resolve, reject) => {
      const url = `${network.index.baseURL}/transactions/${address}?page=${page}&limit=${limit}`
      get(url, res => {
        res
          .on('data', data => {
            // eslint-disable-next-line max-len
            if (res.statusCode !== 200) return reject(new Error(`failed to query transactions (${res.statusCode}): ${data}`))
            const txs = JSON.parse(data) as { results: Transaction[] }
            return resolve(txs.results)
          })
          .on('error', err => reject(err))
      })
    })
