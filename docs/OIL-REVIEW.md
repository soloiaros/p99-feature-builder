# Oil UI polish review — 15 October 2026

Scope: existing-interface polish and simplification, preserving p99's white/lilac surface, physical controls and pink robot. One independent screenshot review, without a numeric score.

## Findings and fixes

- The two numbered inputs and collapsed optional technical context match the intended simple flow. Keep this structure.
- Quota copy and action disagreed. The action now reads **Sign in to continue** for an exhausted guest, or **View Premium** for an exhausted account. The guest action opens sign-in even when the app field is empty; it does not require an unnecessary search form submission.
- The mobile action was below the first viewport. Reduced the introduction/form gaps, input height and disclosure spacing while preserving heading sizes and the three suggestion rows. In the final 390×844 capture with one selected feature, the action fits before the viewport bottom.
- Hide the empty-selection hint after choosing a feature; retain the selected chips and counter. Removed the repeated footer wordmark.
- Preserve existing robot/search animation and moving suggestions. Optional details use the existing height/opacity disclosure with rotating chevron.

The reviewer inspected desktop, mobile and expanded-details screenshots against `DESIGN.md`, without implementation context. The primary agent verified the fixes in the browser and replaced the final captures. No second independent review was requested or performed.

## Verification

- TypeScript check: passed.
- Focused feature-selection tests: 16 passed, including a short `habit app` description without a technical profile, blank optional stack fallback and rejection of blank input.
- Three consecutive smoke runs passed: each exercised Habit tracker, Daily journal and Fitness companion through analyze, match and Markdown brief generation. No feature selection was replaced, and an unsupported feature remained explicitly unmatched.
- Browser: select a feature with Enter, expand/collapse technical details, clear optional stack, open exhausted-guest sign-in and close it. The app description and selected feature remained. The updated sign-in action also works with an empty app description.
- Visual evidence inspected at 1280×900 and 390×844, including the expanded mobile context form. Captures are full-page PNGs in `screenshots/oil-*.png`.
- Native zoom shortcuts did not change the browser's reported viewport/device ratio. Actual 200% browser zoom and a motion recording were not verified. No screenshot-lint report was available from the host capture tool.
- Google/GitHub sign-in remains disabled until provider credentials are configured; browser checks stop at that explicit setup state. These changes are local, not deployed.
