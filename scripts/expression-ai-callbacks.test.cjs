'use strict';
// Reuse the actual-callback harness used by missing-token-callbacks.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/features/communication/ExpressionWorkspace.tsx');
const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function extract(name, context) {
  let source;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) source = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(source, name);
  const code = ts.transpileModule('module.exports = ' + source, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const box = { module: { exports: {} }, ...context };
  vm.runInNewContext(code, box);
  return box.module.exports;
}
function fixture() {
  const pending = [], actions = [], busy = [], notices = [], scheduled = [];
  let completed = 0;
  const context = {
    session: { pipeline: { outputSnapshot: [{ label: '水' }], candidateSentences: ['水', '我想喝水', '请给我水'] } },
    conversationContext: {}, selectionSignature: 'water', selectionSignatureRef: { current: 'water' },
    aiGenerationRef: { current: 0 }, aiPendingRef: { current: false },
    setIsGeneratingAi: value => busy.push(value), setNotice: value => notices.push(value),
    setAiCompletion: () => completed++,
    buildCommunicationAiSentenceRequest: ({ output, candidateCount }) => ({ pictogramLabels: output.map(t => t.label), candidateCount, context: {} }),
    taroCommunicationAiPort: { generateSentences: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
    dispatch: action => actions.push(action), playCandidateQueue: async () => {}, stopSpeechPlayback: () => {},
    isSpeakingRef: { current: false },
    candidateAutoplayControllerRef: { current: { cancel() {}, schedule: (...args) => scheduled.push(args) } }
  };
  context.invalidatePendingAi = extract('invalidatePendingAi', context);
  context.handlePatientInteraction = extract('handlePatientInteraction', context);
  return { context, actions, busy, pending, notices, scheduled, completed: () => completed,
    generate: extract('handleGenerateAiCandidates', context), select: extract('handleSelectCandidate', context),
    stop: extract('handleStopSpeech', context), edit: extract('handleEditSelectedTile', context), invalidate: context.invalidatePendingAi };
}
const success = { ok: true, value: { candidates: ['AI一', 'AI二', 'AI三'] }, message: '完成' };
test('manual sentence selection wins over a late AI result', async () => {
  const f = fixture(), task = f.generate();
  await f.select('人工选择', 1);
  f.pending[0].resolve(success); await task;
  assert.deepEqual(f.actions.map(a => a.type), ['select-candidate']);
  assert.equal(f.busy.at(-1), false);
});
test('changing pictures rejects the stale response and releases its busy state', async () => {
  const f = fixture(), task = f.generate();
  f.context.selectionSignatureRef.current = 'water-help';
  f.pending[0].resolve(success); await task;
  assert.equal(f.actions.length, 0);
  assert.equal(f.busy.at(-1), false);
});
test('double click makes one provider attempt until completion', async () => {
  const f = fixture(), first = f.generate(), second = f.generate();
  assert.equal(f.pending.length, 1);
  f.pending[0].resolve(success); await Promise.all([first, second]);
  assert.equal(f.actions.length, 1);
  assert.equal(f.busy.at(-1), false);
});
test('an old response cannot release or overwrite a newer request', async () => {
  const f = fixture(), first = f.generate();
  f.invalidate();
  const second = f.generate();
  f.pending[0].resolve(success); await first;
  assert.equal(f.busy.at(-1), true);
  assert.equal(f.actions.length, 0);
  f.pending[1].resolve(success); await second;
  assert.equal(f.actions.length, 1);
  assert.equal(f.busy.at(-1), false);
});
test('stop prevents a late result and autoplay rescheduling', async () => {
  const f = fixture(), task = f.generate();
  f.stop(); f.pending[0].resolve(success); await task;
  assert.equal(f.actions.length, 0);
  assert.equal(f.completed(), 0);
  assert.equal(f.busy.at(-1), false);
});
test('transport exception releases busy state and permits explicit retry', async () => {
  const f = fixture(), first = f.generate();
  f.pending[0].reject(new Error('synthetic offline')); await first;
  assert.equal(f.busy.at(-1), false);
  const second = f.generate(); f.pending[1].resolve(success); await second;
  assert.equal(f.actions.length, 1);
});
test('page disposal never updates state when the response finally arrives', async () => {
  const f = fixture(), task = f.generate();
  f.context.aiGenerationRef.current += 1;
  f.context.aiPendingRef.current = false;
  const before = f.busy.length;
  f.pending[0].resolve(success); await task;
  assert.equal(f.actions.length, 0);
  assert.equal(f.busy.length, before);
});

test('delete then undo rejects a late AI result even when the picture signature is identical', async () => {
  const f = fixture(), task = f.generate();
  f.edit({ type: 'clear' }, 'clear');
  f.edit({ type: 'undo-delete' }, 'undo');
  f.pending[0].resolve(success); await task;
  assert.deepEqual(f.actions.map(a => a.type), ['clear', 'undo-delete']);
  assert.equal(f.pending.length, 1, 'undo must not call the provider');
  assert.equal(f.completed(), 0);
  assert.equal(f.busy.at(-1), false);
});

test('all output edit buttons use the guarded callback and CBoard SVG assets', () => {
  const source = fs.readFileSync(filename, 'utf8');
  for (const [id, action] of [['backspace', 'remove-last'], ['clear', 'clear'], ['undo-delete', 'undo-delete']]) {
    const block = source.match(new RegExp(`<PatientActionButton\\s[^>]*id='expression-${id}-button'[\\s\\S]*?\\n          />`));
    assert.ok(block, id);
    assert.ok(block[0].includes(`handleEditSelectedTile({ type: '${action}' }`), id);
  }
  for (const name of ['Backspace', 'Undo', 'Clear']) {
    const upstream = fs.readFileSync(path.resolve(__dirname, `../../cboard/node_modules/@material-ui/icons/${name}.js`), 'utf8');
    const svg = fs.readFileSync(path.resolve(__dirname, `../src/assets/cboard/output-${name.toLowerCase()}.svg`), 'utf8');
    assert.ok(svg.includes(upstream.match(/d: "([^"]+)"/)[1]), `${name}: exact upstream path`);
  }
});
