import assert from 'node:assert/strict'
import test from 'node:test'
import { WebError } from '@deepseek-ai/dsh-web'
import {
  Config,
  DdgsSearchProvider,
  DdgsWebError,
} from '../lib/index.js'

const unavailableOptions = {
  pythonBin: '/path/that/does/not/exist/python3',
  maxResults: 5,
  timeoutMs: 20_000,
  backend: 'auto',
}

test('reports unavailable when Python cannot import ddgs', () => {
  const provider = new DdgsSearchProvider(unavailableOptions)
  assert.equal(provider.available(), false)
})

test('rejects invalid plugin configuration', () => {
  assert.deepEqual(Config({ maxResults: 5, timeoutMs: 20_000 }), {
    maxResults: 5,
    timeoutMs: 20_000,
  })
  assert.throws(() => Config({ maxResults: 0 }), { name: 'ValidationError' })
  assert.throws(() => Config({ timeoutMs: 120_001 }), { name: 'ValidationError' })
  assert.throws(() => Config({ pythonBin: '' }), { name: 'ValidationError' })
  assert.throws(() => Config({ backend: '' }), { name: 'ValidationError' })
})

test('exposes provider failures as structured web errors', async () => {
  const error = new DdgsWebError('failed', 'WEB_PROVIDER_ERROR')
  assert.equal(error instanceof WebError, true)
  assert.equal(error.code, 'WEB_PROVIDER_ERROR')

  const provider = new DdgsSearchProvider(unavailableOptions)
  await assert.rejects(
    provider.search({ query: '   ' }),
    candidate => candidate instanceof WebError && candidate.code === 'WEB_INVALID_QUERY',
  )
})
