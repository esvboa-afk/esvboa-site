// Zero-dependency static site build for ESVBOA.
//   content/site.json     site-wide settings, nav, shared links
//   content/events.json   the event schedule (feeds Events page, home page, and the .ics calendar)
//   src/layout.html       shared header/footer
//   src/pages/*.html      one file per page, with a small front-matter block
//   static/               copied as-is into dist/
// Run: node build.mjs   (output goes to dist/)

import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const read = (p) => readFileSync(join(root, p), 'utf8');

const site = JSON.parse(read('content/site.json'));
const events = JSON.parse(read('content/events.json'))
  .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
const layout = read('src/layout.html');

const warnings = [];

// ---------- helpers ----------
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pad = (n) => String(n).padStart(2, '0');
const todayISO = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, dow: new Date(y, m - 1, d).getDay() };
};
const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
};
const lastDay = (e) => e.endDate || e.date;

function lookup(ctx, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}
function render(str, ctx, where) {
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = lookup(ctx, path);
    if (v === undefined) throw new Error(`Unknown placeholder {{${path}}} in ${where}`);
    return v;
  });
}

function parseFrontMatter(text, where) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${where} is missing a front-matter block`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

// ---------- events ----------
function eventHtml(e) {
  const d = parseDate(e.date);
  const when = [
    DAYS[d.dow] + (e.endDate ? ` to ${DAYS[parseDate(e.endDate).dow]}` : ''),
    e.start ? fmtTime(e.start) + (e.end ? ` to ${fmtTime(e.end)}` : '') : '',
  ].filter(Boolean).join(', ');
  return `<article class="event" data-date="${lastDay(e)}">
  <div class="event-date" aria-hidden="true"><span class="m">${MONTHS[d.m - 1]}</span><span class="d">${d.d}</span><span class="y">${d.y}</span></div>
  <div class="event-body">
    <h3>${esc(e.title)}${e.sample ? ' <span class="badge-sample">Sample</span>' : ''}</h3>
    <p class="event-when"><span class="visually-hidden">${MONTHS[d.m - 1]} ${d.d}, ${d.y}. </span>${esc(when)}</p>
    ${e.location ? `<p class="event-where">${esc(e.location)}</p>` : ''}
    ${e.type ? `<p class="event-type">${esc(e.type)}</p>` : ''}
    ${e.details ? `<p class="event-details">${esc(e.details)}</p>` : ''}
    ${e.link ? `<p><a class="text-link" href="${esc(e.link)}">${esc(e.linkLabel || 'More details')}</a></p>` : ''}
  </div>
</article>`;
}

const upcoming = events.filter((e) => lastDay(e) >= todayISO);
const past = events.filter((e) => lastDay(e) < todayISO).reverse();

function nextCardHtml(e, visible) {
  const d = parseDate(e.date);
  const when = [DAYS[d.dow], e.start ? fmtTime(e.start) : ''].filter(Boolean).join(', ');
  return `<div class="next-card" data-date="${lastDay(e)}"${visible ? '' : ' hidden'}>
  <div class="event-date" aria-hidden="true"><span class="m">${MONTHS[d.m - 1]}</span><span class="d">${d.d}</span><span class="y">${d.y}</span></div>
  <div class="next-body">
    <h2 class="next-title">${esc(e.title)}${e.sample ? ' <span class="badge-sample">Sample</span>' : ''}</h2>
    <p>${esc(when)}${e.location ? `<br>${esc(e.location)}` : ''}</p>
  </div>
  <a class="btn btn-ink" href="/events/">All events</a>
</div>`;
}

const nextCards = upcoming.slice(0, 5).map((e, i) => nextCardHtml(e, i === 0)).join('\n');

// ---------- calendar feed ----------
function icsEscape(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function fold(line) {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}
function buildIcs() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ESVBOA//Website//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(site.name + ' events')}`, 'X-WR-TIMEZONE:America/Detroit',
  ];
  let count = 0;
  for (const e of events) {
    if (e.sample) continue; // never push sample entries to members' phones
    count++;
    const ymd = (iso) => iso.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${e.id}@esvboa.org`, `DTSTAMP:${stamp}`);
    if (e.start) {
      // Floating local time: shows at the same wall-clock time on every device.
      lines.push(`DTSTART:${ymd(e.date)}T${e.start.replace(':', '')}00`);
      const endTime = e.end || e.start;
      lines.push(`DTEND:${ymd(lastDay(e))}T${endTime.replace(':', '')}00`);
    } else {
      const next = new Date(parseDate(lastDay(e)).y, parseDate(lastDay(e)).m - 1, parseDate(lastDay(e)).d + 1);
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`,
        `DTEND;VALUE=DATE:${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`);
    }
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.details) lines.push(`DESCRIPTION:${icsEscape(e.details)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count };
}

// ---------- pages ----------
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'static'), dist, { recursive: true });

const navHtml = (current) =>
  site.nav.map((n) => {
    const active = n.href === current ? ' aria-current="page"' : '';
    return `<li><a href="${n.href}"${active}>${esc(n.label)}</a></li>`;
  }).join('\n          ');

const sitemapUrls = [];
const pageFiles = readdirSync(join(root, 'src/pages')).filter((f) => f.endsWith('.html'));

for (const file of pageFiles) {
  const where = `src/pages/${file}`;
  const { meta, body } = parseFrontMatter(read(where), where);
  const slug = (meta.slug || '').replace(/^\/|\/$/g, '');
  const is404 = meta.out === '404.html';
  const href = slug ? `/${slug}/` : '/';
  const canonical = site.url + href;

  const ctx = {
    site,
    link: site.links,
    year: String(new Date().getFullYear()),
    next_cards: nextCards,
    next_empty_hidden: upcoming.length ? ' hidden' : '',
    upcoming_events: upcoming.map(eventHtml).join('\n'),
    past_events: past.map(eventHtml).join('\n'),
    no_upcoming_hidden: upcoming.length ? ' hidden' : '',
    past_hidden: past.length ? '' : ' hidden',
  };

  const content = render(body, ctx, where);
  if (/class="todo"/.test(content)) warnings.push(`${where}: has placeholder content to fill in`);

  const title = meta.title === 'Home' ? `${site.name} | ${site.fullName}` : `${meta.title} | ${site.name}`;
  const html = render(layout, {
    ...ctx,
    title_full: esc(title),
    description: esc(meta.description || site.fullName),
    canonical,
    bodyclass: meta.bodyclass || '',
    nav: navHtml(href),
    content,
    robots: is404 ? '<meta name="robots" content="noindex">' : '',
  }, 'src/layout.html');

  if (is404) {
    writeFileSync(join(dist, '404.html'), html);
  } else {
    const dir = slug ? join(dist, slug) : dist;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    sitemapUrls.push(canonical);
  }
}

const ics = buildIcs();
writeFileSync(join(dist, 'events.ics'), ics.text);

writeFileSync(join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    sitemapUrls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

// ---------- report ----------
console.log(`Built ${pageFiles.length} pages -> dist/`);
console.log(`Events: ${events.length} total, ${upcoming.length} upcoming, ${ics.count} in events.ics (samples excluded)`);
if (events.some((e) => e.sample)) warnings.push('content/events.json: contains sample events (marked "sample": true)');
for (const w of warnings) console.log(`NOTE  ${w}`);
