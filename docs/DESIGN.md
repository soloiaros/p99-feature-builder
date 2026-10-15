# p99 design direction

North star: a quiet white workbench that turns a good app idea into useful references.

The current direction follows the user's interfaces.dev reference: an almost-white canvas, substantial negative space, large left-aligned black typography, and small physical controls. The central home and query column is 760px wide. App icons and the user's square pink robot provide color; primary actions use a restrained pale blue. The earlier mascot and temporary white cube are replaced by the actual robot-heads library.

## Visual system

The canvas is #FCFCFC. DM Sans carries the interface; the home heading is 76px on desktop and scales down to approximately 50px at 390px. Body text is 14–19px; controls, explanatory labels, and source metadata use at least 12px apart from small count/confidence badges.

Buttons share a single physical treatment: white highlight, soft vertical surface gradient, delicate contact shadow, pill silhouette, and a pressed inset state. Primary buttons use the same material in pale blue. Navigation, query editing, feature removal, tabs, accordions, saved projects, and downloads inherit this system. App tiles retain their own physical edges and shadows rather than receiving another enclosing pill.

The homepage is intentionally sparse: one headline, one short description, a generous input, optional example prompts, and a small shelf of app icons farther down. Results widen to a 1120px workbench with a 215px feature rail. On mobile the rail becomes a horizontal strip, the statistics become a three-column grid, and the wireframe remains scrollable at a readable width.

## State continuity

The input and compact query card use the same surface and shared-layout identity. The query stays present while the rest of the page fades for matching. Identified features appear inline and can be refined in place. Header and footer fade out while matching, while the query edit and cancel controls stay available.

At rest, the results query shows two lines and a Refine features control; selecting it expands the editable chips. This leaves the selected feature and its rationale visible together in a 390×844 mobile viewport. Essential text uses stronger contrast while the physical surfaces and shadows remain subtle. Collection metadata and the footer stack naturally on mobile.

The search scene is a persistent Three.js canvas owned by its component. The stylesheet reserves clear space between the compact query and its status text. Results appear without a translated container so that the scene's app objects have stable DOM destinations. Buttons respond immediately to a press; shelf icons lift by four pixels. Reduced-motion preferences suppress decorative movement.

One persistent square robot has a pink shell and white LED screen pixels. It rests beside the wordmark, grows into the middle of the icon orbit while searching, and returns to a smaller position at the top left of results. Clicking it from results preserves the query and restores the search form on the same page. Idle/listening, thinking, searching, happy, working and error expressions reflect the actual task state. Its native click hop and spin stay available without delaying any request. Icons form a slow rotating 3D cloud with varied depth and gentle drift; they fade behind its protected face instead of bunching into a ring. Text and controls stay outside the swarm.

## Verification responsibilities

Integrated browser checks cover desktop and 390px mobile, scene-to-DOM alignment, keyboard operation, feature refinement, brief/download/save flows, and the live Cloudflare deployment. An independent reviewer rated the robot restyle 8/10, then verified the contrast and hierarchy fixes with no remaining material visual blocker. See VERIFICATION.md for measured results and current screenshots.


## 15 October: build brief workspace and Premium

The existing quiet workbench and pink companion remain. A single pale lilac input surface now contains both required inputs, visible platform/stack fields, optional integration details and the submit action. Numbered required labels establish the sequence; only the extra app-details section is labeled optional. The headline now explains tailoring to the user's codebase. Repeated introductory guidance was consolidated into one sentence and short field labels.

The document window retains its existing physical transition but displays literal monospace Markdown source. The complete source remains readable, copyable and downloadable for free. The Premium offer shows the kit contents, one-time 30-day price, search allowance and restore action together. Existing robot/search motion is preserved; the optional detail disclosure uses height/opacity, with no new decorative motion.

Three self-review passes (no numeric score or independent agent review) checked the desktop form, source viewer, and Premium entry point. The review caught a focus conflict when opening Premium from an exiting document; the handoff now waits for document exit before opening the next dialog. Guest allowance copy now explicitly says when the trial is used. A redundant decorative document mockup was removed from the Premium dialog so pricing and the primary action fit in the initial desktop view. Mobile/200% visual checks remain pending because the available browser viewport override did not take effect. Screenshots and verification details are in VERIFICATION.md.
