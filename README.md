# ESVBOA website

Static site for the East Side Volleyball Officials Association. No dependencies: just Node 20+.
Built from `src/` and `content/` into `dist/`, hosted as a Render static site from this GitHub repo.

## Run it locally

```bash
npm run dev        # builds, then serves http://localhost:8080
npm run build      # build only (output in dist/)
```

## Where things live

| To change...                | Edit                                   |
| --------------------------- | -------------------------------------- |
| An event, date, or location | `content/events.json`                  |
| Email, nav menu, shared links (Google Docs, MHSAA, Facebook) | `content/site.json` |
| Page text                   | `src/pages/<page>.html`                |
| Header, footer, `<head>`    | `src/layout.html`                      |
| Colors, fonts, spacing      | `static/css/styles.css` (tokens at the top) |
| Board photos                | `static/images/board/` (320x320 JPG), referenced in `src/pages/esvboa-board.html`; a member without a photo shows an initials tile |
| Logo                        | replace `static/images/logo.jpg`       |
| Michigan outline and Detroit star in the home hero | replace `static/images/michigan-outline.svg` (hand-plotted; the star is the `metro-detroit` shape in that file; hidden on phones) |

### Events

Add an object to `content/events.json`. One edit updates the Events page, the "next event" card on the
home page, and the calendar feed at `/events.ics` that members can subscribe to.

```json
{ "id": "fall-meeting", "title": "Fall meeting", "type": "Meeting",
  "date": "2026-09-14", "start": "19:00", "end": "20:30",
  "location": "Roseville, MI", "details": "Optional note.",
  "link": "https://...", "linkLabel": "Register" }
```

- `start`/`end` are 24-hour `HH:MM` and optional. Leave them off for an all-day event.
- Multi-day: add `"endDate": "YYYY-MM-DD"`.
- `"sample": true` marks placeholder entries. They show a "Sample" tag and are **left out of `/events.ics`**.
  Delete the three samples in the file before launch.
- Past events move into a collapsed "Past events" list on their own, in the visitor's browser,
  so the site does not need a rebuild to stay current.

### Adding a page

Create `src/pages/my-page.html` starting with:

```
---
title: My page
slug: my-page
description: One sentence for search results.
---
```

Then add it to `nav` in `content/site.json` if it belongs in the menu. Links to shared URLs use
`{{link.name}}` so each URL lives in one place.

## Still to fill in

The build prints a `NOTE` for each page that still has a yellow dashed "Content to add" box:
the 2026 pre-season clinic presentations and iLearn series (Learn), the board (Board), a mission
statement (About), and any extra links (Links). These were not reachable when the site was built,
so copy them over from the Wix site.

## Deploy on Render

1. Push this repo to GitHub.
2. In Render: **New > Blueprint**, pick the repo. It reads `render.yaml`
   (or create a Static Site manually: build command `node build.mjs`, publish directory `dist`).
3. Open the `onrender.com` URL and click through every page before touching DNS.
4. Add custom domains `www.esvboa.org` and `esvboa.org` in the service settings, then follow Render's DNS instructions.
   Render redirects one of the pair to the other.
5. Point `esvboa.com` at `https://www.esvboa.org` with forwarding at your registrar (a 301 redirect).
   Render cannot redirect one domain name to a different one by itself.

Verify on first deploy: that `/about-us` (no trailing slash) reaches `/about-us/`, and that the
`routes` redirects in `render.yaml` work. If either does not, adjust in the Render dashboard.

### Cutover checklist

- A day or two before: lower the TTL on the existing DNS records so the switch is quick to reverse.
- Check the domains have no email (MX) records before changing DNS. The site's contact address is a Gmail address, so probably none.
- Keep the Wix site running for a few days after the switch.
- `render.yaml` redirects the two old Wix URLs that changed (`/event-list`, `/copy-of-learn`).
  Other pages keep their old addresses on purpose, so existing links and search results still work.

## Fonts

Headings use Barlow Condensed and body text uses Barlow, loaded from Google Fonts in `src/layout.html`.
If the site should not call Google at all, download the fonts, put them in `static/fonts/`,
and swap the `<link>` for `@font-face` rules. Until the fonts load, the site falls back to system fonts.
