(() => {
  'use strict';
  const THREAD = '771-lawyer-salary';
  const BASE = location.origin + location.pathname.replace(/-\d+\.html$/, '.html');
  const DB_NAME = 'lawyer-salary-archive-v1';
  const STORE = 'pages';
  const DELAY = 700;
  const WORKERS = 2;
  const REFRESH_TAIL = 3;

  if (!location.hostname.endsWith('salary.sg') || !location.pathname.includes(THREAD)) {
    alert('Open the Salary.sg Lawyer Salary thread first, then run this script.');
    return;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pageUrl = n => n === 1 ? BASE : BASE.replace('.html', `-${n}.html`);

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function dbGet(db, key) {
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  function dbPut(db, key, value) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(value, key); t.oncomplete = resolve; t.onerror = () => reject(t.error);
    });
  }

  function totalPages(markup) {
    const d = new DOMParser().parseFromString(markup, 'text/html');
    let max = 1;
    for (const a of d.querySelectorAll('a[href]')) {
      const m = a.getAttribute('href').match(/771-lawyer-salary-(\d+)\.html/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max;
  }

  async function fetchPage(db, n, refresh = false) {
    if (!refresh) {
      const cached = await dbGet(db, n);
      if (cached) return cached;
    }
    const r = await fetch(pageUrl(n), {credentials: 'include'});
    if (!r.ok) throw new Error(`Page ${n}: HTTP ${r.status}`);
    const text = await r.text();
    if (!text.includes('Lawyer Salary')) throw new Error(`Page ${n}: unexpected response`);
    await dbPut(db, n, text);
    return text;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function yearOf(s) { return (String(s).match(/20\d{2}/) || [''])[0]; }

  function postsFrom(markup, page) {
    const d = new DOMParser().parseFromString(markup, 'text/html');
    const out = [];
    for (const body of d.querySelectorAll('[id^="post_message_"]')) {
      const m = body.id.match(/post_message_(\d+)/); if (!m) continue;
      const id = m[1];
      let box = body.parentElement;
      while (box && !(box.id && /^post\d+$/.test(box.id))) box = box.parentElement;
      box ||= body.closest('table') || body.parentElement;
      const a = box?.querySelector('a.bigusername, a[href*="member.php"]');
      const author = a?.textContent.trim() || 'Unknown';
      const all = box?.textContent.replace(/\s+/g, ' ').trim() || '';
      const dm = all.match(/(?:Today|Yesterday|\d{1,2}-\d{1,2}-\d{4}),?\s+\d{1,2}:\d{2}\s*(?:AM|PM)/i);
      const date = dm ? dm[0] : '';
      const clone = body.cloneNode(true);
      clone.querySelectorAll('script,style').forEach(x => x.remove());
      clone.querySelectorAll('img').forEach(img => img.replaceWith(document.createTextNode(img.alt || '')));
      clone.querySelectorAll('a[href]').forEach(link => {
        link.href = new URL(link.getAttribute('href'), location.origin).href;
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      });
      out.push({id, page, author, date, text: body.textContent.replace(/\s+/g,' ').trim(), html: clone.innerHTML,
        link: `${location.origin}/showpost.php?p=${id}&postcount=1`});
    }
    return out;
  }

  function buildHtml(posts) {
    const authors = [...new Set(posts.map(p => p.author))].sort((a,b) => a.localeCompare(b));
    const years = [...new Set(posts.map(p => yearOf(p.date)).filter(Boolean))].sort().reverse();
    const cards = posts.map(p => `<article class="post" id="post-${p.id}" data-author="${esc(p.author)}" data-year="${yearOf(p.date)}"><div class="meta"><a href="${esc(p.link)}" target="_blank" rel="noopener">#${p.id}</a><b>${esc(p.author)}</b><span>${esc(p.date)}</span><span>page ${p.page}</span></div><div class="body">${p.html}</div></article>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lawyer Salary Archive</title><style>
:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#202124;background:#f6f7f9}body{margin:0}header{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #ddd;padding:14px}.wrap{max-width:1000px;margin:auto}h1{font-size:20px;margin:0 0 8px}.controls{display:grid;grid-template-columns:1fr 140px 190px;gap:8px}input,select{font:inherit;padding:9px;border:1px solid #bbb;border-radius:7px}#status{font-size:13px;color:#666;margin-top:7px}main{padding:14px}.post{background:#fff;border:1px solid #ddd;border-radius:9px;margin:0 0 12px;padding:14px}.meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;color:#666;margin-bottom:10px}.meta a{font-weight:700}.body{line-height:1.55;overflow-wrap:anywhere}.body table{max-width:100%}.hidden{display:none}@media(max-width:650px){.controls{grid-template-columns:1fr}}</style></head><body><header><div class="wrap"><h1>Lawyer Salary — searchable archive</h1><div class="controls"><input id="q" type="search" placeholder="Search all posts…" autofocus><select id="year"><option value="">All years</option>${years.map(y=>`<option>${y}</option>`).join('')}</select><select id="author"><option value="">All authors</option>${authors.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select></div><div id="status"></div></div></header><main class="wrap">${cards}</main><script>
const posts=[...document.querySelectorAll('.post')],q=document.querySelector('#q'),yr=document.querySelector('#year'),au=document.querySelector('#author'),st=document.querySelector('#status');let timer;function f(){const s=q.value.trim().toLowerCase(),y=yr.value,a=au.value;let n=0;for(const p of posts){const ok=(!s||p.textContent.toLowerCase().includes(s))&&(!y||p.dataset.year===y)&&(!a||p.dataset.author===a);p.classList.toggle('hidden',!ok);if(ok)n++}st.textContent=n.toLocaleString()+' of '+posts.length.toLocaleString()+' posts'}q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(f,150)});yr.addEventListener('change',f);au.addEventListener('change',f);f();<\/script></body></html>`;
  }

  async function run() {
    const raw = prompt('Pages to archive? Enter 5 for a test, or 0 for the full thread.', '5');
    if (raw === null) return;
    const requested = Number(raw);
    if (!Number.isInteger(requested) || requested < 0) return alert('Enter 0 or a positive whole number.');
    const db = await openDb();
    const first = await fetchPage(db, 1, true);
    const total = totalPages(first);
    if (total < 2) throw new Error('Could not detect thread pagination; stopping safely.');
    const target = requested === 0 ? total : Math.min(requested, total);
    console.log(`Detected ${total} pages. Archiving 1-${target}. Cached pages will be reused.`);
    let next = 1, done = 0;
    const refreshFrom = Math.max(1, target - REFRESH_TAIL + 1);
    async function worker() {
      while (true) {
        const n = next++; if (n > target) return;
        const markup = n === 1 ? first : await fetchPage(db, n, n >= refreshFrom);
        const count = postsFrom(markup, n).length;
        if (!count) throw new Error(`Page ${n}: no posts found; stopped safely.`);
        done++; if (done % 25 === 0 || done === target) console.log(`Fetched/verified ${done}/${target} pages`);
        await sleep(DELAY);
      }
    }
    await Promise.all(Array.from({length: Math.min(WORKERS, target)}, worker));
    console.log('Building searchable HTML…');
    const all = [];
    for (let n=1; n<=target; n++) all.push(...postsFrom(await dbGet(db,n), n));
    const seen = new Set(); const posts = all.filter(p => !seen.has(p.id) && seen.add(p.id));
    const blob = new Blob([buildHtml(posts)], {type:'text/html;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lawyer-salary-archive.html';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 30000);
    console.log(`Done: ${posts.length.toLocaleString()} posts from ${target.toLocaleString()} pages. Download started.`);
    alert(`Done — ${posts.length.toLocaleString()} posts archived. Check your Downloads folder.`);
  }

  run().catch(e => { console.error(e); alert('Archive stopped: ' + e.message + '\n\nCached pages are retained; rerun the script to resume.'); });
})();
