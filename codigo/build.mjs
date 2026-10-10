// Gera um único arquivo dist/index.html com todo o jogo (sem dependências externas).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['safari16'],
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/index.html', 'utf8').replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');

// Versão para o GitHub Pages (app instalável): página completa + manifesto + service worker + ícones
import { copyFileSync, rmSync } from 'node:fs';
const version = (readFileSync('src/config.js', 'utf8').match(/version:\s*'([^']+)'/) || [])[1] || 'dev';
const head = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cerne">
<meta name="theme-color" content="#bfe1ea">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
`;
const tail = `
<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
</html>
`;
rmSync('site', { recursive: true, force: true });
mkdirSync('site', { recursive: true });
writeFileSync('site/index.html', head + html + tail);
writeFileSync('site/sw.js', readFileSync('pwa/sw.js', 'utf8').replace('__VERSION__', version));
for (const f of ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png']) copyFileSync('pwa/' + f, 'site/' + f);
writeFileSync('site/.nojekyll', '');
console.log('site/ pronto para o GitHub Pages (versão ' + version + ')');
