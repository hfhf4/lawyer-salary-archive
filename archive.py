#!/usr/bin/env python3
import argparse, html, json, re, time
from pathlib import Path
from urllib.parse import urljoin

from curl_cffi import requests
from bs4 import BeautifulSoup

BASE = "https://forums.salary.sg/income-jobs/771-lawyer-salary.html"
CACHE = Path("cache")
OUT = Path("lawyer-salary-archive.html")


def page_url(n):
    return BASE if n == 1 else f"https://forums.salary.sg/income-jobs/771-lawyer-salary-{n}.html"


def get(session, n, refresh=False, delay=1.0):
    CACHE.mkdir(exist_ok=True)
    p = CACHE / f"page-{n:04d}.html"
    if p.exists() and not refresh:
        return p.read_text("utf-8", errors="replace")
    r = session.get(page_url(n), timeout=30)
    r.raise_for_status()
    text = r.text
    if "Lawyer Salary" not in text:
        raise RuntimeError(f"Unexpected response on page {n}")
    p.write_text(text, "utf-8")
    time.sleep(delay)
    return text


def last_page(markup):
    soup = BeautifulSoup(markup, "html.parser")
    nums = [1]
    for a in soup.find_all("a", href=True):
        m = re.search(r"771-lawyer-salary-(\d+)\.html", a["href"])
        if m:
            nums.append(int(m.group(1)))
    return max(nums)


def clean_fragment(node):
    node = BeautifulSoup(str(node), "html.parser")
    root = node.find()
    for bad in root.find_all(["script", "style"]):
        bad.decompose()
    for img in root.find_all("img"):
        img.replace_with(img.get("alt") or "")
    for a in root.find_all("a", href=True):
        a["href"] = urljoin(BASE, a["href"])
        a["target"] = "_blank"
        a["rel"] = "noopener noreferrer"
    return "".join(str(x) for x in root.contents).strip()


def parse_posts(markup, page):
    soup = BeautifulSoup(markup, "html.parser")
    posts = []
    for body in soup.select('[id^="post_message_"]'):
        m = re.search(r"post_message_(\d+)", body.get("id", ""))
        if not m:
            continue
        pid = m.group(1)
        container = body.find_parent(id=re.compile(r"^post\d+$"))
        if container is None:
            container = body.find_parent("table") or body.parent
        author = "Unknown"
        date = ""
        if container:
            a = container.select_one("a.bigusername") or container.select_one('a[href*="member.php"]')
            if a:
                author = a.get_text(" ", strip=True) or author
            text = container.get_text(" ", strip=True)
            dm = re.search(r"(?:Today|Yesterday|\d{1,2}-\d{1,2}-\d{4}),?\s+\d{1,2}:\d{2}\s*(?:AM|PM)", text, re.I)
            if not dm:
                dm = re.search(r"\d{1,2}-\d{1,2}-\d{4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)", text, re.I)
            if dm:
                date = dm.group(0)
        posts.append({
            "id": pid,
            "page": page,
            "author": author,
            "date": date,
            "html": clean_fragment(body),
            "text": body.get_text(" ", strip=True),
            "link": f"https://forums.salary.sg/showpost.php?p={pid}&postcount=1",
        })
    return posts


def year_of(s):
    m = re.search(r"(20\d{2})", s or "")
    return m.group(1) if m else ""


def build(posts):
    authors = sorted({p["author"] for p in posts}, key=str.lower)
    years = sorted({year_of(p["date"]) for p in posts if year_of(p["date"])}, reverse=True)
    cards = []
    for p in posts:
        search = html.escape((p["author"] + " " + p["date"] + " " + p["text"]).lower(), quote=True)
        cards.append(f'''<article class="post" id="post-{p['id']}" data-author="{html.escape(p['author'], quote=True)}" data-year="{year_of(p['date'])}" data-search="{search}">
<div class="meta"><a href="{p['link']}" target="_blank" rel="noopener">#{p['id']}</a><b>{html.escape(p['author'])}</b><span>{html.escape(p['date'])}</span><span>page {p['page']}</span></div>
<div class="body">{p['html']}</div></article>''')
    data = json.dumps({"posts": len(posts), "pages": max((p["page"] for p in posts), default=0)})
    author_opts = "".join(f'<option value="{html.escape(a, quote=True)}">{html.escape(a)}</option>' for a in authors)
    year_opts = "".join(f'<option value="{y}">{y}</option>' for y in years)
    doc = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lawyer Salary Archive</title><style>
:root{{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#202124;background:#f6f7f9}}body{{margin:0}}header{{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #ddd;padding:14px}}.wrap{{max-width:1000px;margin:auto}}h1{{font-size:20px;margin:0 0 8px}}.controls{{display:grid;grid-template-columns:1fr 140px 190px;gap:8px}}input,select{{font:inherit;padding:9px;border:1px solid #bbb;border-radius:7px}}#status{{font-size:13px;color:#666;margin-top:7px}}main{{padding:14px}}.post{{background:white;border:1px solid #ddd;border-radius:9px;margin:0 0 12px;padding:14px}}.meta{{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;color:#666;margin-bottom:10px}}.meta a{{font-weight:700}}.body{{line-height:1.55;overflow-wrap:anywhere}}.body img{{max-width:100%}}.body table{{max-width:100%}}.hidden{{display:none}}@media(max-width:650px){{.controls{{grid-template-columns:1fr}}}}
</style></head><body><header><div class="wrap"><h1>Lawyer Salary — searchable archive</h1><div class="controls"><input id="q" type="search" placeholder="Search all posts…" autofocus><select id="year"><option value="">All years</option>{year_opts}</select><select id="author"><option value="">All authors</option>{author_opts}</select></div><div id="status"></div></div></header><main class="wrap">{''.join(cards)}</main>
<script>const meta={data};const posts=[...document.querySelectorAll('.post')],q=document.querySelector('#q'),yr=document.querySelector('#year'),au=document.querySelector('#author'),st=document.querySelector('#status');function f(){{let s=q.value.trim().toLowerCase(),y=yr.value,a=au.value,n=0;for(const p of posts){{let ok=(!s||p.dataset.search.includes(s))&&(!y||p.dataset.year===y)&&(!a||p.dataset.author===a);p.classList.toggle('hidden',!ok);if(ok)n++}}st.textContent=n.toLocaleString()+' of '+meta.posts.toLocaleString()+' posts · '+meta.pages.toLocaleString()+' pages'}}q.addEventListener('input',f);yr.addEventListener('change',f);au.addEventListener('change',f);f();</script></body></html>'''
    OUT.write_text(doc, "utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-pages", type=int, default=0, help="0 = all pages")
    ap.add_argument("--refresh-tail", type=int, default=3)
    ap.add_argument("--delay", type=float, default=1.0)
    args = ap.parse_args()

    s = requests.Session(impersonate="chrome")
    first = get(s, 1, delay=args.delay)
    total = last_page(first)
    if total == 1:
        probe = get(s, 2, delay=args.delay)
        if parse_posts(probe, 2):
            raise RuntimeError("Could not determine final page safely; forum pagination changed")
    target = min(total, args.max_pages) if args.max_pages else total
    print(f"Thread pages detected: {total}; building pages 1-{target}")

    all_posts = []
    refresh_from = max(1, target - max(args.refresh_tail, 0) + 1)
    for n in range(1, target + 1):
        markup = first if n == 1 and n < refresh_from else get(s, n, refresh=n >= refresh_from, delay=args.delay)
        parsed = parse_posts(markup, n)
        if not parsed:
            raise RuntimeError(f"No posts parsed on page {n}; stopping rather than producing a bad archive")
        all_posts.extend(parsed)
        if n % 50 == 0 or n == target:
            print(f"Parsed {n}/{target} pages ({len(all_posts)} posts)")

    seen = set(); posts = []
    for p in all_posts:
        if p["id"] not in seen:
            seen.add(p["id"]); posts.append(p)
    build(posts)
    print(f"Wrote {OUT} with {len(posts)} posts")

if __name__ == "__main__":
    main()
