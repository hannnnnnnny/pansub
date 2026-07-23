const assert = require('assert');
const { protectGlossaryTerms, restoreGlossaryTerms } = require('../glossary-utils.js');
const { createAudioTranslator, createTranslationScheduler } = require('../audio-translator.js');

const glossary = {
  version: 'test',
  terms: [
    { terms: ['primary key'], zhCN: '主键', zhTW: '主鍵' },
    { terms: ['database'], zhCN: '数据库', zhTW: '資料庫' }
  ]
};

class FakeTranslator {
  static availabilityResult = 'available';
  static created = [];

  static async availability() {
    return this.availabilityResult;
  }

  static async create(options) {
    this.created.push(options);
    return {
      async translate(text) {
        return `翻译：${text}`;
      },
      destroy() {}
    };
  }
}

async function run() {
  const protectedTerms = protectGlossaryTerms('A primary key belongs to the database.', {
    glossary,
    targetLanguage: 'zh-CN',
    enabled: true
  });
  assert.strictEqual(protectedTerms.replacements.length, 2);
  assert.strictEqual(
    restoreGlossaryTerms('PANSUBTERM0 / PANSUBTERM1', protectedTerms.replacements),
    '主键 / 数据库'
  );

  const local = createAudioTranslator({
    TranslatorClass: FakeTranslator,
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
    allowGoogleFallback: false,
    glossary
  });
  await local.prepare();
  assert.strictEqual(FakeTranslator.created.length, 1);
  const localResult = await local.translate('primary key', { sequence: 1 });
  assert.deepStrictEqual(localResult, {
    sequence: 1,
    text: '翻译：主键',
    provider: 'local'
  });

  const noConsent = createAudioTranslator({
    TranslatorClass: null,
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
    allowGoogleFallback: false,
    glossary
  });
  await assert.rejects(() => noConsent.translate('database', { sequence: 2 }), /GOOGLE_CONSENT_REQUIRED/);

  const fetchCalls = [];
  const fallback = createAudioTranslator({
    TranslatorClass: null,
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
    allowGoogleFallback: true,
    glossary,
    async fetchImpl(url, options) {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        async json() {
          return [[['回退：PANSUBTERM0', 'PANSUBTERM0']]];
        }
      };
    }
  });
  const fallbackResult = await fallback.translate('database', { sequence: 3 });
  assert.strictEqual(fallbackResult.provider, 'google');
  assert.strictEqual(fallbackResult.text, '回退：数据库');
  assert.strictEqual(fetchCalls.length, 1);

  const deferred = new Map();
  const emitted = [];
  const scheduler = createTranslationScheduler({
    translator: {
      translate(text, { sequence }) {
        return new Promise((resolve) => deferred.set(sequence, () => resolve({ sequence, text: `译文 ${text}` })));
      }
    },
    emit: (event) => emitted.push(event),
    stabilityMs: 0,
    minVisibleIntervalMs: 0
  });
  scheduler.push({ kind: 'final', text: 'first' });
  scheduler.push({ kind: 'final', text: 'second' });
  deferred.get(2)();
  await Promise.resolve();
  await Promise.resolve();
  deferred.get(1)();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepStrictEqual(emitted.map((event) => event.text), ['译文 second']);

  const timers = [];
  let partialCalls = 0;
  const partialScheduler = createTranslationScheduler({
    translator: {
      async translate(text, { sequence }) {
        partialCalls += 1;
        return { sequence, text: `译文 ${text}` };
      }
    },
    emit() {},
    stabilityMs: 350,
    minVisibleIntervalMs: 0,
    setTimeoutImpl(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeoutImpl() {}
  });
  partialScheduler.push({ kind: 'partial', text: 'stable words' });
  assert.strictEqual(partialCalls, 0);
  timers[0]();
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(partialCalls, 1);
  partialScheduler.stop();
  scheduler.stop();

  console.log('Audio translator tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
