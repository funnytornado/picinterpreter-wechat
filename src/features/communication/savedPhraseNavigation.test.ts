import { describe, expect, test } from 'vitest'
import type { CommunicationSavedPhraseEntry } from '@cboard-communication-core/repository'
import { filterSavedPhrasesByLifeContext } from '@cboard-communication-core/savedPhraseManagement'
import { buildSavedPhraseManagementUrl, readSavedPhraseLifeContext } from './savedPhraseNavigation'

// Model the actual WeChat route: it exposes the encoded query value, not
// URLSearchParams' already-decoded value.
function routeValue(context: string | null): string | undefined {
  return buildSavedPhraseManagementUrl(context).split('&lifeContext=')[1]
}

describe('saved phrase shortcut -> management life context', () => {
  test.each([
    '出门', '吃饭', '聊天', '公园 & 咖啡/茶? #1', '散步 🌳',
    '50%休息', 'A+B', '%20', '%E5%87%BA%E9%97%A8'
  ])('round-trips the exact category %s once', context => {
    const raw = routeValue(context)
    expect(raw).toBe(encodeURIComponent(context))
    expect(readSavedPhraseLifeContext(raw)).toBe(context)
  })

  test('keeps all distinct from uncategorized', () => {
    expect(buildSavedPhraseManagementUrl(null)).not.toContain('lifeContext=')
    expect(readSavedPhraseLifeContext(routeValue(null))).toBe(null)
    expect(buildSavedPhraseManagementUrl('')).toContain('&lifeContext=')
    expect(readSavedPhraseLifeContext(routeValue(''))).toBe('')
  })

  test.each(['出门', '未分类', 'A+B', '%', '%ZZ', '%E0%A4%A'])(
    'preserves literal or malformed legacy parameter %s without throwing', value => {
      expect(readSavedPhraseLifeContext(value)).toBe(value)
    }
  )

  test('selects the original entries without changing order, identity or statistics', () => {
    const items: CommunicationSavedPhraseEntry[] = [
      { id: 'synthetic-7', sentence: '请帮我拿外套。', lifeContext: '出门', usageCount: 2, createdAt: 1,
        output: [{ id: 'same', label: '合成林安', personId: 'synthetic-a' }, { id: 'same', label: '合成林安', personId: 'synthetic-b' }] },
      { id: 'synthetic-8', sentence: '我想去公园。', lifeContext: '出门', usageCount: 1, createdAt: 2, output: [] },
      { id: 'synthetic-other', sentence: '我想喝水。', lifeContext: '吃饭', createdAt: 3, output: [] },
      { id: 'synthetic-none', sentence: '请再说一遍。', createdAt: 4, output: [] }
    ]
    const before = JSON.stringify(items)
    const raw = routeValue('出门')!
    // This is the previous bug, kept as a differential regression assertion.
    expect(filterSavedPhrasesByLifeContext(items, raw)).toHaveLength(0)
    const selected = filterSavedPhrasesByLifeContext(items, readSavedPhraseLifeContext(raw))
    expect(selected.map(item => item.id)).toEqual(['synthetic-7', 'synthetic-8'])
    expect(selected[0]).toBe(items[0])
    expect(selected[1]).toBe(items[1])
    expect(filterSavedPhrasesByLifeContext(items, readSavedPhraseLifeContext(undefined))).toHaveLength(4)
    expect(filterSavedPhrasesByLifeContext(items, readSavedPhraseLifeContext('')).map(item => item.id)).toEqual(['synthetic-none'])
    expect(JSON.stringify(items)).toBe(before)
  })
})
