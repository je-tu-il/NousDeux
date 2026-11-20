// query-string 7 expects a CommonJS decoder. The patched decoder is ESM;
// normalize its default export for Node 20.19+ and Metro without changing parsing.
const fs = require('node:fs');
const target = require.resolve('query-string');
const source = fs.readFileSync(target, 'utf8');
const before = "const decodeComponent = require('decode-uri-component');";
const after = "const decoderModule = require('decode-uri-component');\nconst decodeComponent = decoderModule.default || decoderModule;";
if (source.includes(before)) fs.writeFileSync(target, source.replace(before, after));
else if (!source.includes(after)) throw new Error('query-string changed; review the secure decoder adapter.');
