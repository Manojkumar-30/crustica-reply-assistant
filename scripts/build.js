// npm run build
// 1. validates the static site (syntax, imports, manifest, icons, service worker file list)
// 2. copies `public/` to `dist/` and stamps a content-hash build id into the service worker cache name,
//    so every deployment gets a fresh offline cache and old caches are removed.
// No dependencies. Deploy the `dist` folder (or `public` directly: both work).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');
const errors = [];
const fail = (m) => errors.push(m);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}
const files = walk(SRC);

/* 1. syntax of every JS file */
for (const f of files.filter((x) => x.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) fail(`syntax error in ${rel(f)}\n${r.stderr.split('\n').slice(0, 4).join('\n')}`);
}

/* 2. every relative import resolves to a real file */
for (const f of files.filter((x) => x.endsWith('.js') && !x.endsWith('sw.js'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(f), m[1].split('?')[0]);
    if (!fs.existsSync(target)) fail(`broken import in ${rel(f)}: ${m[1]}`);
  }
}

/* 3. index.html references */
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
  if (/^(https?:|data:|\/\/)/.test(m[1])) { fail(`index.html uses an external or absolute URL: ${m[1]}`); continue; }
  if (m[1].startsWith('/')) fail(`index.html uses an absolute path (breaks sub-folder hosting): ${m[1]}`);
  if (!fs.existsSync(path.join(SRC, m[1]))) fail(`index.html references a missing file: ${m[1]}`);
}

/* 4. manifest */
const mf = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const expect = { name: 'Crustica Reply Assistant', short_name: 'Crustica Reply', display: 'standalone', theme_color: '#0F5132', background_color: '#FFF8ED' };
for (const [k, v] of Object.entries(expect)) if (mf[k] !== v) fail(`manifest.${k} should be ${v}, found ${mf[k]}`);
if (!mf.start_url || mf.start_url.startsWith('/')) fail('manifest.start_url must be relative (e.g. "./")');
const pngSize = (p) => { const b = fs.readFileSync(p); return b.slice(0, 8).toString('hex') === '89504e470d0a1a0a' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
for (const need of [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]) {
  const ic = (mf.icons || []).find((i) => i.sizes === need[0] && i.purpose === need[1]);
  if (!ic) { fail(`manifest is missing a ${need[0]} ${need[1]} icon`); continue; }
  const p = path.join(SRC, ic.src);
  if (!fs.existsSync(p)) { fail(`manifest icon missing on disk: ${ic.src}`); continue; }
  const sz = pngSize(p); if (!sz || `${sz[0]}x${sz[1]}` !== need[0]) fail(`icon ${ic.src} is not really ${need[0]}`);
}
if (!fs.existsSync(path.join(SRC, 'icons/apple-touch-icon.png'))) fail('icons/apple-touch-icon.png missing (needed for iPhone home screen)');

/* 5. service worker pre-cache list */
const sw = fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8');
if (!sw.includes('__BUILD_ID__')) fail('sw.js must contain the __BUILD_ID__ placeholder');
const shellBlock = (/const SHELL = \[([\s\S]*?)\];/.exec(sw) || [])[1] || '';
const shell = [...shellBlock.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
if (!shell.length) fail('could not read SHELL list from sw.js');
for (const f of shell) if (f !== './' && !fs.existsSync(path.join(SRC, f))) fail(`sw.js pre-caches a missing file: ${f}`);
for (const f of files.filter((x) => /\.(js|css|html|json)$/.test(x) && !x.endsWith('sw.js') && !x.endsWith('package.json'))) {
  const r = './' + path.relative(SRC, f).replace(/\\/g, '/');
  if (!shell.includes(r)) fail(`${r} is not in the service worker pre-cache list (offline mode would break)`);
}

/* 6. no secrets / no external calls */
for (const f of files.filter((x) => /\.(js|html)$/.test(x))) {
  const src = fs.readFileSync(f, 'utf8');
  if (/(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|api[_-]?key\s*[:=]\s*['"][^'"]{8,})/i.test(src)) fail(`possible API key in ${rel(f)}`);
  if (/\bfetch\s*\(\s*['"`]https?:/.test(src)) fail(`external fetch in ${rel(f)}`);
}

if (errors.length) { console.error('\nBuild FAILED:\n - ' + errors.join('\n - ')); process.exit(1); }

/* 7. build output */
const hash = crypto.createHash('sha1');
for (const f of files.sort()) hash.update(rel(f)).update(fs.readFileSync(f));
const buildId = hash.digest('hex').slice(0, 10);
fs.rmSync(OUT, { recursive: true, force: true });
for (const f of files) {
  const to = path.join(OUT, path.relative(SRC, f));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (f.endsWith(path.join('public', 'sw.js'))) fs.writeFileSync(to, sw.replace(/__BUILD_ID__/g, buildId));
  else fs.copyFileSync(f, to);
}
const kb = Math.round(files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1024);
console.log(`Build OK: ${files.length} files, ${kb} KB, build id ${buildId}\nOutput: dist/   (deploy this folder)`);
