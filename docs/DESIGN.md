# p99 design direction

North star: a quiet workbench that turns an app link or a few words into useful feature references and a tailored build brief.

## The main task

The default flow has two steps: describe or link the app, then select the features to add. Both inputs and the action belong to one pale lilac surface. Numbered required labels establish the sequence. App name, platform, stack, integration notes and package.json are all behind the collapsed **App details (optional)** disclosure. No technical profile is needed to search. Link analysis supplies available public page context and passive technology hints; unknown implementation details remain for the coding agent to inspect in the actual repository.

The user's correction takes precedence over adding more visible configuration. Keep the main flow simple and do the analysis in p99. Do not reintroduce a setup questionnaire or visible technical sidebar.

## Visual system

Preserve the existing #FCFCFC canvas, DM Sans, quiet lilac/pink accents, physical pill controls, pale blue primary action and square pink robot. The centered desktop heading is 48px, with 36px mobile type. The form is at most 720px wide; mobile inputs use 16px text. Labels, helper text and optional context remain legible without competing with the two required steps. The compact mobile header reserves space for the robot and every navigation action.

The single form container is a functional grouping, not a decorative card grid. Existing horizontally moving feature suggestions remain; do not introduce unrelated animation or imagery. Feature selection, optional context, empty states, exhausted guest quota and modal return should preserve the app idea.

## Motion and states

The form input and results query share a layout identity. Existing robot expressions and the icon search scene reflect the search state. Physical controls retain their pressed and hover states. Optional context opens with height and opacity transitions and a rotating chevron. Reduced-motion preferences suppress decorative movement.

Results retain one app per selected feature and the source evidence. The document viewer shows literal monospace Markdown, with source available to copy or download. Premium retains its one-time 30-day pass, allowance and kit contents. Pricing and sign-in are dialogs; returning from them should preserve form state.

## Subtraction and verification

Removed the redundant “Shape your build brief” heading, technical sidebar heading and instruction, and the visible platform/stack setup. Shortened the integration-notes placeholder. The main explanation is now a single sentence about the two inputs.

Oil UI polish evidence: `screenshots/oil-before-desktop.png`, `screenshots/oil-before-home.png`, `screenshots/oil-after-desktop.png`, `screenshots/oil-after-mobile.png`, and `screenshots/oil-mobile-details.png`. Current desktop captures use 1280×900; mobile captures use 390×844 and include the full page. See `OIL-REVIEW.md` for the independent existing-interface review and verification limits. Older implementation checks are recorded in `VERIFICATION.md`.
