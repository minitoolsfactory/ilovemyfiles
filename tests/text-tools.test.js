import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/components/client/data-tools.astro', import.meta.url), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1];
const registered = {};
const context = {
  window: { iLoveMyFilesModulesReady: Promise.resolve(), iLoveMyFilesModules: registered },
  TextEncoder,
  TextDecoder,
  Uint8Array,
  btoa,
  atob,
  crypto: { subtle: { digest: async () => new Uint8Array() } },
  DOMParser: class {
    parseFromString(source) {
      const decoded = source
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
      return { documentElement: { textContent: decoded } };
    }
  },
  globalThis: {}
};
context.globalThis = context;
vm.runInNewContext(source, context);
await context.window.iLoveMyFilesModulesReady;
const tools = registered['data-tools'];

test('URL encoding and decoding are inverse for Unicode input', () => {
  const encoded = tools.convertUrl('hi there 🌍');
  assert.equal(encoded, 'hi%20there%20%F0%9F%8C%8D');
  assert.equal(tools.convertUrl(encoded, { mode: 'decode' }), 'hi there 🌍');
});

test('binary and hex converters round-trip UTF-8', () => {
  assert.equal(tools.binaryToText(tools.textToBinary('Hello 🌍')), 'Hello 🌍');
  assert.equal(tools.hexToText(tools.textToHex('café')), 'café');
  assert.throws(() => tools.binaryToText('10201'), /binary groups/);
});

test('text helpers preserve first unique line and sort numerically', () => {
  assert.equal(tools.deduplicateLines('a\nb\na'), 'a\nb');
  assert.equal(tools.sortLines('item 10\nitem 2'), 'item 2\nitem 10');
  assert.equal(tools.addLineNumbers('one\ntwo'), '1. one\n2. two');
  assert.equal(tools.removeEmptyLines('a\n  \nb'), 'a\nb');
  assert.equal(tools.replaceText('a.a', { search: '.', replacement: 'x' }), 'axa');
});

test('calculators validate inputs and compute expected values', () => {
  assert.equal(tools.calculatePercentage('20 150'), '30');
  assert.equal(tools.calculatePercentage('100 125', 'change'), '25%');
  assert.equal(tools.dateDifference('2026-01-01\n2026-01-05'), 'Calendar days: 4\nWeekdays (excluding weekends): 2');
  assert.equal(tools.convertNumberBase('FF', { from: 16, to: 2 }), '11111111');
  assert.equal(tools.morseEncode('SOS'), '... --- ...');
  assert.equal(tools.morseDecode('... --- ...'), 'SOS');
});

test('developer converters validate and handle common inputs', () => {
  assert.equal(tools.convertBase32('foo'), 'MZXW6===');
  assert.equal(tools.base64UrlConvert('??', { mode: 'encode' }), 'Pz8');
  assert.equal(tools.octalToText(tools.textToOctal('Hi')), 'Hi');
  assert.equal(tools.convertAscii('65 66', { mode: 'decode' }), 'AB');
  assert.equal(tools.generateSlug('Crème brûlée!'), 'creme-brulee');
  assert.equal(tools.makeCron({ minute: '*/5', hour: '*', day: '*', month: '*', weekday: '*' }), '*/5 * * * *');
  assert.throws(() => tools.makeCron({ minute: '90' }), /Invalid cron field/);
  assert.deepEqual(JSON.parse(JSON.stringify(tools.regexMatches('\\d+', 'g', 'a12b3'))).map(match => match.match), ['12', '3']);
  assert.equal(tools.chmodDetails('755'), 'Octal: 755\nSymbolic: rwxr-xr-x\nDecimal: 493');
  assert.equal(tools.sqlInsertToCsv("INSERT INTO people (name, age) VALUES ('Ada', 37), ('Li', 8);"), 'name,age\nAda,37\nLi,8');
});

test('HTML entity encoding and decoding cover common cases', () => {
  assert.equal(tools.htmlEntities('<tag a="x">&\'hi\'</tag>'), '&lt;tag a=&quot;x&quot;&gt;&amp;&#39;hi&#39;&lt;/tag&gt;');
  const decoded = tools.htmlEntities('&lt;p&gt;Tom &amp; Jerry&#39;s&lt;/p&gt;', { mode: 'decode' });
  assert.equal(decoded, "<p>Tom & Jerry's</p>");
});

test('JSON/YAML and text diff helpers are exposed and compare correctly', () => {
  assert.equal(typeof tools.jsonYaml, 'function');
  assert.equal(tools.compareText('one\ntwo\nthree', 'one\nold\nthree'), '  one\n- old\n+ two\n  three');
  assert.equal(tools.compareText('same', 'same'), '  same');
  assert.equal(tools.compareText('a\nb\nc\nd', 'a\nx\nc\ny'), '  a\n- x\n+ b\n  c\n- y\n+ d');
  assert.throws(() => tools.compareText('a\n'.repeat(50001), 'b\n'.repeat(50001)), /50,000 lines/);
});

test('CSV and JSON Lines converters preserve quoted values and reject ambiguous headers', () => {
  const jsonl = tools.csvJsonl('name,note\nAda,"hello, world"');
  assert.equal(jsonl, '{"name":"Ada","note":"hello, world"}');
  assert.equal(tools.csvJsonl(jsonl, { direction: 'jsonl-to-csv' }), 'name,note\nAda,"hello, world"');
  assert.throws(() => tools.csvJsonl('name,name\na,b'), /unique/);
  assert.throws(() => tools.csvJsonl('{bad}', { direction: 'jsonl-to-csv' }), /line 1/);
});

test('image palette extractor reports unavailable-image errors clearly', async () => {
  await assert.rejects(() => tools.extractImagePalette(null), /Choose a supported image/);
});

test('UUID decoder validates and breaks down UUID fields', () => {
  const report = tools.decodeUuid('550e8400-e29b-41d4-a716-446655440000');
  assert.match(report, /Version: 4/);
  assert.match(report, /Variant: RFC 4122 \/ RFC 9562/);
  assert.match(report, /Time low: 550e8400/);
  assert.throws(() => tools.decodeUuid('not-a-uuid'), /valid UUID/);
});

test('Lorem Ipsum generator respects paragraph and word limits', () => {
  const generated = tools.generateLorem({ paragraphs: 2, words: 4, startWithLorem: true });
  assert.equal(generated, 'Lorem ipsum dolor sit.\n\nElit sed do eiusmod.');
  assert.equal(tools.generateLorem({ paragraphs: 1, words: 1 }).split(/\s+/).length, 1);
  assert.equal(tools.generateLorem({ paragraphs: 0, words: 0 }).split('\n\n').length, 3);
});

test('XML formatting escapes text and attribute values', async () => {
  const source = fs.readFileSync(new URL('../src/components/client/data-tools.astro', import.meta.url), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1];
  const document = {
    documentElement: { nodeName: 'root', attributes: [{ name: 'label', value: 'A & "B"' }], childNodes: [
      { nodeType: 1, nodeName: 'item', attributes: [], childNodes: [{ nodeType: 3, nodeValue: 'x < y' }] }
    ] },
    querySelector: () => null
  };
  const domContext = { DOMParser: class { parseFromString() { return document; } } };
  const code = source.slice(source.indexOf('function formatXml'), source.indexOf('\n  function utf8ToBase64'));
  const run = new Function('DOMParser', `${code}; return formatXml;`)(domContext.DOMParser);
  assert.equal(run('<root/>'), '<?xml version="1.0" encoding="UTF-8"?>\n<root label="A &amp; &quot;B&quot;">\n  <item>x &lt; y</item>\n</root>');
});

test('font converter reads a supported font, converts bytes, and rejects OTF output', async () => {
  const source = fs.readFileSync(new URL('../src/components/client/data-tools.astro', import.meta.url), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1];
  const code = source.slice(source.indexOf('const FONT_FORMATS'), source.indexOf('\n      window.iLoveMyFilesModules[\'data-tools\']', source.indexOf('const FONT_FORMATS')));
  const fakeFont = { write: ({ type }) => new Uint8Array([type === 'woff' ? 1 : 2, 3, 4]) };
  const converterCode = code.replace("await import('fonteditor-core')", 'await importFontEditor()');
  const convert = new Function('importFontEditor', `${converterCode}; return convertFont;`)(async () => ({ createFont: () => fakeFont, woff2: { isInited: true, init: async () => {} } }));
  const file = { name: 'my-font.ttf', arrayBuffer: async () => new Uint8Array([0, 1, 2]).buffer };
  const result = await convert(file, 'woff');
  assert.equal(result.name, 'my-font.woff');
  assert.equal(result.blob.type, 'font/woff');
  assert.equal(result.blob.size, 3);
  await assert.rejects(() => convert(file, 'otf'), /OTF output is not supported/);
});
