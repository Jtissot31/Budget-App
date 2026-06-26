// Learn more https://docs.expo.io/guides/customizing-metro
const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite web: bundle the wa-sqlite WASM module.
config.resolver.assetExts.push('wasm');
// lucide-react-native ships ESM icon modules as .mjs
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}


// Dev server headers required for SharedArrayBuffer / OPFS on web.
const selectionExportPath = path.resolve(__dirname, 'lib/designSystemLucideSelection.json');

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url === '/__design-system/lucide-selection' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Expected JSON array' }));
            return;
          }
          const names = [...new Set(parsed.filter((n) => typeof n === 'string' && n.length > 0))].sort();
          fs.writeFileSync(selectionExportPath, `${JSON.stringify(names, null, 2)}\n`, 'utf8');
          // eslint-disable-next-line no-console
          console.log(`[design-system] Exported ${names.length} Lucide icons → lib/designSystemLucideSelection.json`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, count: names.length }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
      return;
    }

    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  };
};

module.exports = config;