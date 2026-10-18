import { expect, test } from 'vitest'
import { DEFAULT_BOARD_FIXTURES } from '../../fixtures/defaultBoard'
import { createWechatCommunicationRepository } from '../../platform/communicationRepository'
import { buildDevicePrivateRuntimePictogram } from '@cboard-communication-core/runtimePictogram'
import {
  runReceiverSession, refreshReceiverMissingItems, retainReceiverItemAsText,
  buildConfirmedReceiverHistory, restoreReceiverWorkspaceFromRecord
} from './receiverSession'

test.each(['这杯水太热吗？', '这碗汤很热。', '水热不热？'])('packaged person-heat picture stays blocked on match and backfill: %s', text => {
  const state = runReceiverSession(text, DEFAULT_BOARD_FIXTURES)
  const hot = state.reviewItems.find(item => item.token.includes('热'))!
  expect(hot.tile!.id).toBe('tuyujia-builtin-object-heat')
  const restored = refreshReceiverMissingItems(state, DEFAULT_BOARD_FIXTURES, [{
    id: 'old-heat', token: hot.token, normalizedToken: hot.token, status: 'resolved',
    resolvedPictogramId: 'SyS0fA96XqtW', reviewedByCaregiver: true
  } as any])
  expect(restored).toBe(state)
  expect(restored.reviewItems.map(item => item.token).join('')).toBe(text)
})

test('personal sensation still uses the existing packaged hot-person asset', () => {
  const state = runReceiverSession('我很热', DEFAULT_BOARD_FIXTURES)
  expect(state.reviewItems.find(item => item.token.includes('热'))!.tile!.tile.image).toBe('/assets/cboard-default/38329bea3476fac5.png')
})

test('unknown nickname and AI boundaries cannot pick the small-size picture on refresh', () => {
  expect(runReceiverSession('请帮我找小岚', DEFAULT_BOARD_FIXTURES).segments).toEqual(['请帮我', '找', '小岚'])
  const state = runReceiverSession('请找小岚', DEFAULT_BOARD_FIXTURES, { preSegmented: ['请', '找', '小', '岚'] })
  const next = refreshReceiverMissingItems(state, DEFAULT_BOARD_FIXTURES, [{
    id: 'small', token: '小', normalizedToken: '小', status: 'resolved',
    resolvedPictogramId: 'r18bVC96m9t-', reviewedByCaregiver: true
  } as any])
  expect(next.reviewItems.find(item => item.token === '小')!.tile).toBeNull()
})

test('private name photo survives repository restart, confirmation and restore without a catalog', () => {
  const values = new Map<string, unknown>()
  const storage = { getStorageSync: (k: string) => values.get(k) ?? '', setStorageSync: (k: string, v: unknown) => { values.set(k, JSON.parse(JSON.stringify(v))) }, removeStorageSync: (k: string) => { values.delete(k) } }
  const repo = createWechatCommunicationRepository(storage)
  const [record] = repo.recordMissingTokens({ tokens: ['小岚'], rawText: '请找小岚' })
  const photo = buildDevicePrivateRuntimePictogram({ recordId: 'synthetic-person', label: '小岚', image: 'data:image/png;base64,c3ludGhldGlj' })!
  repo.reviewMissingToken(record.id, { status: 'resolved', resolvedPictogramId: photo.id, resolvedPictogram: photo, reviewedByCaregiver: true })
  let state = refreshReceiverMissingItems(runReceiverSession('请找小岚', DEFAULT_BOARD_FIXTURES), DEFAULT_BOARD_FIXTURES, createWechatCommunicationRepository(storage).loadMissingTokens())
  expect(state.reviewItems.find(item => item.token === '小岚')!.tile!.tile.image).toBe(photo.image)
  for (const missing of state.reviewItems.filter(item => !item.tile)) state = retainReceiverItemAsText(state, missing.id)
  const saved = JSON.parse(JSON.stringify(buildConfirmedReceiverHistory(state)))
  const restored = restoreReceiverWorkspaceFromRecord(saved, [])!.session
  expect(restored.outputPreview.map(item => item.vocalization).join('')).toBe('请找小岚')
  expect(restored.reviewItems.find(item => item.token === '小岚')!.tile!.tile.image).toBe(photo.image)
  expect(runReceiverSession('请找小岚', DEFAULT_BOARD_FIXTURES).reviewItems.find(item => item.token === '小岚')!.tile).toBeNull()
})
