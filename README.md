# Lantern Keeper: website

The game's website, served free by GitHub Pages: https://extremeknight.github.io/lantern-keeper-site/

| Path | What it is |
| --- | --- |
| `index.html` | The home page: the game's pitch, features, gallery, platforms, news and FAQ |
| `downloads.html` | Downloads; recommends the right file for the visitor's device (list from `downloads.json`) |
| `news.html` | Every update (from `news.json`) |
| `support.html` | Support and FAQ |
| `privacy-policy.html`, `terms.html` | The Privacy Policy and Terms of Service |
| `play/` | The game itself (the web version, built by the game's `tools/build-web.js`) |
| `service.json` | Read by the game: the address of its co-op server (`{"coop": "wss://..."}`) |
| `assets/` | The stylesheet, the script, fonts (Jersey 10, SIL OFL) and images (real screenshots of the game) |

## Editing pages

The pages are generated: edit the page's body in `tools/pages/`, then run

```
node tools/build-site.js      # writes the .html files, sitemap.xml and robots.txt
node tools/serve.js           # preview at http://localhost:8730/lantern-keeper-site/
node tools/check-site.js      # checks every page at five screen sizes (needs Playwright from the game's repository)
```

The shared header, footer and icons are in `tools/build-site.js`; the look is `assets/site.css`. The legal pages'
text lives in `tools/pages/privacy-policy.html` and `tools/pages/terms.html` (copy changes to the game's `docs/` too).

`downloads.json` and `news.json` are written by the game's `tools/publish-release.js` when a version is published;
`news.json` can be edited by hand to polish an entry. The site uses no cookies, trackers or outside services.
