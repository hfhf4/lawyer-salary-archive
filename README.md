# Lawyer Salary Archive

Builds a searchable, self-contained HTML archive of the public **Lawyer Salary** thread on Salary.sg Forums:

https://forums.salary.sg/income-jobs/771-lawyer-salary.html

## How it works

- Downloads forum pages politely and caches them.
- Extracts post number, author, date, content and source link.
- Builds one offline HTML file: `lawyer-salary-archive.html`.
- Search and year/author filters run entirely in the browser.
- Cached pages are reused; the newest pages are refreshed so later runs pick up new posts.

## Run on GitHub (no local installation)

Open **Actions → Build lawyer salary archive → Run workflow**.

- `pages = 5` is a quick test.
- `pages = 0` builds the entire thread.
- `refresh_tail = 3` refreshes the newest three pages on repeat runs.

When the workflow finishes, download the `lawyer-salary-archive` artifact from the workflow run and open the HTML file in a browser.

The workflow also runs a five-page smoke test whenever the scraper/workflow itself is changed on `main`.

## Notes

This is an independent personal archive tool. It is not affiliated with Salary.sg. Keep request delays enabled and use the archive responsibly.
