// 为 raw.githack.com 分支预览转换目录链接：
// raw.githack.com 不会自动把 /xxx/ 解析到 /xxx/index.html，
// 因此构建后把 HTML 里的站内目录链接补上 index.html，并注入点击兜底（处理 Pagefind 动态搜索结果）。
import fs from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

const CLICK_FIX = `<script>document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;try{var u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname.endsWith('/')){u.pathname+='index.html';a.href=u.toString();}}catch(_){}},true);</script>`;

function fixHref(raw) {
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) {
    return raw;
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
    return raw;
  }
  const m = raw.match(/^([^?#]*)(.*)$/);
  if (!m) return raw;
  const [, pathname, tail] = m;
  if (!pathname) return raw;
  if (pathname.endsWith('/')) {
    return `${pathname}index.html${tail}`;
  }
  return raw;
}

let count = 0;
for await (const f of walk(DIST)) {
  let html = await fs.readFile(f, 'utf8');
  html = html.replace(/<a\b([^>]*?)\bhref="([^"]*)"/g, (full, pre, href) => {
    const next = fixHref(href);
    if (next !== href) count++;
    return `<a${pre}href="${next}"`;
  });
  if (html.includes('</body>') && !html.includes('u.pathname.endsWith')) {
    html = html.replace('</body>', `${CLICK_FIX}</body>`);
  }
  await fs.writeFile(f, html);
}
console.log(`githack 链接处理完成：更新 ${count} 处目录链接`);
