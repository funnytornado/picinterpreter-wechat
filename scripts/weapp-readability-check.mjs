// Read-only layout checks against the currently open, isolated simulator page.
// Usage: node scripts/weapp-readability-check.mjs <isolated-project> [list|overlay]
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const project = process.argv[2]
const mode = process.argv[3] || 'list'
const cli = process.env.WECHATIDE_SKILL_CLI
assert.ok(project && path.isAbsolute(project), 'Pass the absolute isolated simulator project path')
assert.ok(cli, 'Set WECHATIDE_SKILL_CLI to the installed official wechatide CLI')
assert.ok(['list', 'overlay'].includes(mode), 'Mode must be list or overlay')

function call(tool, options = {}) {
  const args = ['-c', 'Codex', tool, '--project', project]
  for (const [name, value] of Object.entries(options)) args.push(`--${name}`, String(value))
  const windows = process.platform === 'win32'
  const result = spawnSync(windows ? process.env.ComSpec || 'cmd.exe' : cli,
    windows ? ['/d', '/s', '/c', 'call', cli, ...args] : args,
    { encoding: 'utf8', windowsHide: true, timeout: 45_000 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const output = result.stdout
  const response = JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1))
  assert.equal(response.ok, true, JSON.stringify(response))
  assert.notEqual(response.result?.success, false, JSON.stringify(response))
  return response.result
}
const element = (selector, action, options = {}) =>
  call('automation_element_action', { selector, action, ...options })
const font = selector => Number.parseFloat(element(selector, 'style', { name: 'font-size' }))
const system = call('automation_runtime_info', { action: 'systemInfo' }).systemInfo.result
const pageClass = element('.communication-page', 'attribute', { name: 'class' })
const extraLarge = pageClass.includes('--font-extra-large')
const large = pageClass.includes('--font-large')
const report = { mode, width: system.windowWidth, height: system.windowHeight,
  font: extraLarge ? 'extra-large' : large ? 'large' : 'normal', checks: [] }
const check = (condition, message) => { assert.ok(condition, message); report.checks.push(message) }

if (mode === 'list') {
  const xml = element('.phrase-manager__list', 'outerWxml')
  const rowIds = [...xml.matchAll(/<view\b[^>]*id="(saved-phrase-[^"]+)"/g)].map(match => match[1])
  check(rowIds.length >= 8, 'At least eight fixture phrases are rendered')
  const minFont = extraLarge ? 18 : large ? 16 : 14
  for (const id of rowIds) {
    const row = `#${id}`
    const size = element(row, 'size')
    const fallbacks = call('automation_page_action', { action: 'querySelectorAll',
      selector: `${row} .pictogram-image-fallback` }).elements
    if (fallbacks.length) {
      const fallback = `${row} .pictogram-image-fallback`
      const box = element(fallback, 'size'), origin = element(fallback, 'offset')
      for (const child of ['.pictogram-image-fallback__text', '.pictogram-image-fallback__retry']) {
        const textBox = element(`${fallback} ${child}`, 'size')
        const textOrigin = element(`${fallback} ${child}`, 'offset')
        check(textOrigin.top >= origin.top && textOrigin.top + textBox.height <= origin.top + box.height + 1,
          `${id}: fallback text is not clipped vertically`)
        check(font(`${fallback} ${child}`) >= minFont, `${id}: fallback follows selected text size`)
      }
    }
    check(size.width <= system.windowWidth, `${id}: row fits the viewport`)
    check(font(`${row} .phrase-manager__sentence`) >= minFont, `${id}: sentence follows selected text size`)
    const markup = element(row, 'outerWxml')
    const view = [...markup.matchAll(/<button\b([^>]*)>查看整句<\/button>/g)]
    assert.equal(view.length, 1, `${id}: one silent viewing action`)
    // Native selectors do not reliably support :nth-child; use the observed ID.
    const selector = `#${view[0][1].match(/\bid="([^"]+)"/)[1]}`
    const button = element(selector, 'size')
    check(font(selector) >= minFont, `${id}: viewing action is readable`)
    check(button.height >= 44 && button.width >= 44, `${id}: viewing target is at least 44px`)
    check(button.width <= size.width, `${id}: viewing action fits its row`)
  }
} else {
  const sentence = element('.phrase-playback-overlay__sentence', 'text')
  check(sentence.length > 0, 'The full sentence is present')
  check(font('.phrase-playback-overlay__sentence') >= (extraLarge ? 28 : large ? 24 : 19),
    'Full sentence follows selected text size')
  const card = element('.phrase-playback-overlay__card', 'size')
  const text = element('.phrase-playback-overlay__sentence', 'size')
  check(card.width <= system.windowWidth && text.width <= card.width, 'Sentence fits the overlay width')
  const missing = call('automation_page_action', { action: 'querySelectorAll',
    selector: '.phrase-playback-overlay__missing' }).elements
  if (missing.length) {
    const placeholder = element('.phrase-playback-overlay__missing', 'size')
    const figure = element('.phrase-playback-overlay__figure', 'size')
    check(placeholder.width >= figure.width - 1 && placeholder.width <= figure.width + 1,
      'Missing-image explanation uses the available figure width')
  }
  for (const selector of ['#phrase-playback-close', '#phrase-playback-replay']) {
    const size = element(selector, 'size')
    check(size.height >= 44 && size.width >= 44, `${selector}: target is at least 44px`)
    check(size.width <= card.width, `${selector}: fits the overlay`)
  }
}
console.log(JSON.stringify(report, null, 2))
