import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import PhrasePlaybackOverlay from './PhrasePlaybackOverlay'

vi.mock('@tarojs/components', () => ({ View: 'view', Text: 'text', ScrollView: 'scroll-view' }))
vi.mock('./PatientActionButton', () => ({ default: 'action-button' }))
vi.mock('../../components/PictogramImage', () => ({ default: 'pictogram-image' }))

function nodes(value: ReactNode): ReactElement<any>[] {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!isValidElement<{ children?: ReactNode }>(value)) return []
  return [value, ...nodes(value.props.children)]
}
const phrase = (output: any[] = []) => ({
  id: 'synthetic', sentence: '吃完午饭以后，请陪我去花园慢慢散步；如果下雨，就留在走廊里。',
  output, createdAt: 1, lastUsedAt: 1, updatedAt: 1, usageCount: 2
})
function render(item = phrase()) {
  const onReplay = vi.fn(async () => {}), onClose = vi.fn()
  const tree = PhrasePlaybackOverlay({ item, isSpeaking: false, status: '仅查看', onReplay, onClose })
  return { elements: nodes(tree), onReplay, onClose }
}

describe('saved phrase full-sentence view', () => {
  it('keeps the complete sentence without starting playback or changing saved content', () => {
    const item = phrase(), before = JSON.stringify(item)
    const view = render(item)
    const sentence = view.elements.find(node => node.props.className === 'phrase-playback-overlay__sentence')
    expect(sentence?.props.children).toBe(item.sentence)
    expect(view.onReplay).not.toHaveBeenCalled()
    expect(JSON.stringify(item)).toBe(before)
    view.elements.find(node => node.props.id === 'phrase-playback-close')?.props.onClick()
    expect(view.onClose).toHaveBeenCalledOnce()
    expect(view.onReplay).not.toHaveBeenCalled()
  })

  it('retains repeated tiles and same-name people with different identities and images', () => {
    const a = { id: 'person-a', label: '小明', image: '/synthetic/circle.png' }
    const b = { id: 'person-b', label: '小明', image: '/synthetic/square.png' }
    const view = render(phrase([a, a, b]))
    const figures = view.elements.filter(node => node.props.className === 'phrase-playback-overlay__figure')
    const pictures = view.elements.filter(node => node.props.className === 'phrase-playback-overlay__image')
    expect(figures.map(node => node.key)).toEqual(['person-a-0', 'person-a-1', 'person-b-2'])
    expect(pictures.map(node => node.props.src)).toEqual([a.image, a.image, b.image])
  })

  it('retains full long labels and the missing-image explanation', () => {
    const label = '吃完午饭以后先在窗边休息一会儿'
    const view = render(phrase([{ id: 'missing', label, image: '' }]))
    expect(view.elements.find(node => node.props.className === 'phrase-playback-overlay__label')?.props.children).toBe(label)
    expect(view.elements.find(node => node.props.className === 'phrase-playback-overlay__missing')?.props.children).toBe('图片不可用，保留文字')
  })

  it('shows pure-text phrases and removes the overlay when closed', () => {
    expect(render().elements.some(node => node.props.className === 'phrase-playback-overlay__images')).toBe(false)
    expect(PhrasePlaybackOverlay({ item: null, isSpeaking: false, status: '', onReplay: vi.fn(), onClose: vi.fn() })).toBeNull()
  })
})
