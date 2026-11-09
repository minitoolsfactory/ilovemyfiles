import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { TOOLS } = JSON.parse(fs.readFileSync(path.join(root, 'src/data/tools.json'), 'utf8'));
const urls = [
  'https://ilovemyfiles.com/',
  ...TOOLS.map(tool => `https://ilovemyfiles.com${tool.section === 'tools' ? `/tools/${tool.slug}/` : `/${tool.slug}/`}`),
  'https://ilovemyfiles.com/tools/cbse-result-analyzer/'
];
const unique = [...new Set(urls)].sort((a, b) => a === 'https://ilovemyfiles.com/' ? -1 : b === 'https://ilovemyfiles.com/' ? 1 : a.localeCompare(b));
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(root, 'public/sitemap.xml'), xml);
console.log(`Wrote sitemap with ${unique.length} canonical URLs.`);
