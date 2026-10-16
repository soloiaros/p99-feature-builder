# Homepage restoration and results cleanup

16 October 2026

The user chose the deployed homepage as the reference and asked to restore its wording. The homepage headline, supporting line, labels, suggestion hint and footnote now match that reference. Detailed app inputs remain optional and collapsed. Account and Premium controls remain available.

Installed and read [Hardik Pandya's stop-slop](https://github.com/hardikpandya/stop-slop) in the user-level Codex skills directory. Applied its rules to the results page's supporting copy, while preserving the existing headings and brief action wording.

## Results changes

- Show feature, app name, rating and brief action in each row.
- Keep publisher excerpts, category, source links, dates and confidence context inside the closed “Why this app” disclosure.
- Omit unavailable metrics; retain verified/estimated labels for the metrics shown.
- Remove repeated feature tags, the explanatory footer paragraph and the extra no-match instruction. Keep “How we pick” available.
- Shorten the no-match message to “No match in this catalog.” Keep Refine available.
- Put fallback-engine details in a disclosure.
- Replace the heavy result card surface/shadow with white rows and thin separators. Give the icon-only mobile Save action an accessible name.

## Verification

TypeScript check and `git diff --check` passed. Browser checks used a disposable local guest at review.localhost:5187, with a real two-feature search and live matching. Checked evidence expansion, literal Markdown preview, close/return, Save, refresh and reopening the saved result. No auth or quota bypass was added.

Viewed full-page captures at 1280×900 desktop and 390×844 mobile. The restored homepage was compared with the deployed page. Detailed mobile inputs expand and collapse; the final preview leaves them collapsed. No production deployment was performed.

Evidence in `screenshots/`: `home-deployed-reference.png`, `home-restored-desktop.png`, `home-restored-mobile.png`, `home-restored-details-mobile.png`, `results-before-cleanup.png`, `results-clean-desktop.png`, `results-clean-mobile.png`.
