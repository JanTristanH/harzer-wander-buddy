# UX/UI audit — Harzer Wander Buddy

Started: 2026-11-05. Baseline: `9a51605`. Review scale: 1–10.

## Acceptance and evidence

The requested acceptance criterion is **at least 8.5 in every category and every reviewed flow**, not an average. An independent reviewer records each round. Missing evidence is recorded as **not evaluated**, never as a passing score. Visual review does not establish screen-reader support, offline reliability, native rendering, or successful writes. These require separate interaction checks. Scores are professional judgment, not measurements or a claim of user testing.

Screenshots use an isolated local memory backend. Its synthetic stamps and parking spot are UI fixtures, not authoritative hiking information. No production writes are part of this audit. Existing local Auth/SecureStore/onboarding changes are excluded from the design commit.

## Reference research

Sources accessed 2026-11-05. Product documentation establishes capabilities; it does not prove the quality of every competitor screen or the exact current installed-app appearance. Marketing screenshots are dated references, not live competitor tests.

| Reference | Relevant behavior | Application to HWB |
| --- | --- | --- |
| [Google Maps: map layers and legends](https://support.google.com/maps/answer/3092439?hl=en) | Separates terrain, transport and POI information; describes map symbols and unavailable layers. | Keep map controls identifiable; expose active filters and distinguish stamp/parking/status beyond color. |
| [Komoot: route planner](https://www.komoot.com/help/routeplanner) | Start/end and waypoint actions, route editing, undo, elevation and surface information. | Give route planning a clear action hierarchy and legible route metrics; preserve map context. Do not imply HWB has unimplemented Komoot features. |
| [Komoot official screenshot press kit](https://newsroom.komoot.com/assets/232106/) | Reference for map/route summary/action arrangement. | Compare hierarchy and information grouping, without copying its branding or using press screenshots as HWB evidence. |
| [Harz-App: tourism association](https://www.harzinfo.de/service/harz-app) | Tour descriptions, topographic maps, elevation, duration/distance/difficulty and downloads. | Judge outdoor readability and regional information clarity; make network and data limitations explicit. |
| [Official Wandernadel Community App](https://www.harzer-wandernadel.de/die-wandernadel/harzer-wandernadel-community-app/) | Personal stamp collection, coordinates and stamp descriptions; supplements the paper passport. | Keep stamp identity, collection state and next action clear. Do not confuse a digital record with replacement of the official passport. |
| [Apple HIG: accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Readable text, sufficient contrast, scalable layouts, descriptive controls and alternatives to color alone. | Check normal text against 4.5:1; preserve scaling and meaningful labels. Use comfortable touch targets (48 dp target for this Android audit). |
| [Apple HIG: layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Relative importance, alignment, grouping, progressive disclosure, adaptability. | Put the task before decoration, share margins and radii, constrain wide reading layouts, test short/narrow/large-text views. |

Apple guidance informs principles; Android remains an Android interface. The repository is Expo SDK 54; no SDK upgrade or new SDK-56-only component dependency is required for this work.

## Coverage inventory

| Area | Required flows and states |
| --- | --- |
| Entry | Startup/loading, login, auth return/logout, onboarding profile/location/friend steps |
| Stamps | Guest/personal/group list; number/place search; filters; progress; empty/loading/error; fast scrolling |
| Map | Search, markers, selection sheet, stamp/parking/status filters, location/zoom/north/refresh, group actions, error/offline |
| Tours | List/search/filter/sort/create; detail/planning/waypoints/edit/save/delete; locked/missing tour |
| Friends | Connected/request/search states; send/accept/decline/withdraw; guest |
| Profile | Own/other profile, achievements/timeline/comparison/settings/edit/logout |
| POI details | Stamp/parking; pictures, visits, notes, nearby points, navigation/share/stamp/group actions |
| Administration | Dashboard; stamp/parking lists/editors; field validation; backend jobs |
| Shared | Tab bar, guest gates, offline/loading/error/success feedback, menus/group selection/dialogs |

## Baseline findings

The read-only reviewer found these issues before implementation. These are findings, **not numerical UI scores**:

- Small light text on the progress gradient (`#3f8158 → #60926f → #d2c18f`) has endpoint contrast ratios approximately 4.22, 3.24 and 1.61:1 against `#f5f3ee`. A gradient requires checking its weakest relevant area.
- Search placeholder `#7b8776` on white is about 3.77:1. Several controls are only 28–40 dp high.
- Map icon actions lack labels/roles; filter chips lack selected states; custom switches lack checked semantics.
- The tab bar combines unrelated icon families; screen styling largely bypasses the existing theme.
- Technical backend/loading copy reaches the UI. Map zero-result search needs explicit feedback.
- Reduced-motion handling, large text, keyboard focus, native system bars, signed-in flows and wide layouts require runtime evidence.

## Score ledger

Every review round must append its actual scores and evidence below. No scores have yet been assigned. Categories: icons; color/contrast; typography; visual hierarchy; spacing/layout; radius/forms; buttons/interactions; navigation; map UX; forms/search; feedback/system states; accessibility; responsive design; consistency; information quality; polish/brand. Screen/flow scores are tracked separately.

## Validation log

- Local CAP memory backend starts successfully. Initially empty; synthetic fixture seed prepared outside production.
- Development web startup encountered an icon-font timeout during initial compilation. Error-overlay captures are rejected as UI review evidence. A production web export is being prepared for deterministic asset serving.
- Native Android boot started with the repository-prescribed emulator workflow. A successful application session has not yet been demonstrated.

## Outstanding acceptance

No claim that the 8.5 threshold is met until the independent review and coverage evidence support it. Native iOS and signed-in/admin workflows require their own evidence; guest web screenshots cannot certify them.

## Round 1 — independent baseline review

Evidence: seven rendered screenshots in `screenshots/before/`, guest web, 390×844, local synthetic data. Reviewer inspected every image. No interaction verified in this round. All values below are the original reviewer scores, including failures.

| Category | Score /10 | Reviewer finding |
| --- | ---: | --- |
| Icons | 6.5 | Tour icon too heavy; location panel lacks a symbol. |
| Colors/contrast | 5.5 | Progress gradient washes out text; faint helper and disabled labels. |
| Typography | 6.5 | Small dense list; early title truncation; awkward entry headings. |
| Visual hierarchy | 7.0 | Guest progress dominates; onboarding action unclear. |
| Spacing/layout | 6.0 | List cards touch; onboarding footer covers content. |
| Radii/forms | 7.5 | Recognizable rounded language; large radii at too many levels. |
| Buttons/interactions | 6.0 | Entry CTA priority differs; small chips; unclear disabled action. |
| Navigation | 7.5 | Labeled tabs; login lacks visible return. |
| Map UX | 7.0 | Pins and map area clear; unavailable location unexplained; legend needs work. |
| Forms/search | 6.0 | Small placeholder, clipped filters, no clear-search action. |
| Feedback/system states | 6.0 | Guest gates clear; location and disabled completion need explanations. |
| Accessibility | 4.5 | Provisional partial score: contrast, target sizes, missing control semantics. |
| Responsive design | Not evaluated | Only one viewport; no cross-size conclusion possible. |
| Consistency | 7.0 | Cohesive palette/mascot; icon, headings and CTA drift. |
| Information quality | 6.0 | ASCII umlauts; notification promise lacks matching onboarding action. |
| Polish/brand | 6.5 | Distinctive mascot; card overlap, copy and footer weaken finish. |

| Visible screen | Score /10 |
| --- | ---: |
| Stamp list | 6.5 |
| Map | 7.0 |
| Tours guest gate | 7.0 |
| Friends guest gate | 7.0 |
| Profile guest gate | 7.0 |
| Login | 6.5 |
| Onboarding first guest state | 5.0 |

Unreviewed: authentication itself, signed-in surfaces, tour planning, detail pages, writes, friend actions, profile edit/timeline, admin, map selection, search result states, errors/loading/offline, large fonts, other viewports, native interaction. These are not passes.

## Round 2 — independent review after the first changes

Reviewer inspected all 28 submitted PNGs in `screenshots/round-2/` (320/390/768/1440 px). The reviewer rejected unready map/detail captures as evidence of their loaded states. Scores remain below acceptance.

| Category | Score /10 | Reviewer finding |
| --- | ---: | --- |
| Icons | 8.0 | Consistent tabs and visible location icon; map attribution control visually loud. |
| Colors/contrast | 8.0 | Progress text now readable; disabled friend action too faint. |
| Typography | 7.0 | Better headings/titles; 320px login breaks Willkommen inside the word. |
| Visual hierarchy | 7.5 | Clear actions; guest progress still misleading and dominant. |
| Spacing/layout | 6.5 | Rows separated but excess blank space; parking footer paints over content. |
| Radii/forms | 8.0 | More controlled shapes and contours; some detail drift. |
| Buttons/interactions | 7.5 | Larger controls, clear/back actions; guest browse too far down. |
| Navigation | 8.0 | Precise Stempel label and visible back path; signed-in paths unverified. |
| Map UX | 7.0 | Better controls; most captures still loading tiles. |
| Forms/search | 8.0 | Clear and empty states; keyboard ring needs polish. |
| Feedback/system states | 7.0 | Better list loading; technical detail copy and unresolved map loading. |
| Accessibility | 7.0 | Larger targets and semantics; footer collision; native screen reader unverified. |
| Responsive design | 6.5 | Bounded reading widths; narrow heading break and oversized wide map search. |
| Consistency | 7.5 | Shared palette/icons; detail font and guest-card positioning drift. |
| Information quality | 7.5 | Improved German; guest 0% and permission wording still confusing. |
| Polish/brand | 7.5 | Stronger identity; gaps, word break and footer prevent completion. |

| Screen/state | Score /10 |
| --- | ---: |
| Stamp list, loaded | 7.0 |
| Stamp list, loading | 8.0 |
| Stamp search, empty | 8.0 |
| Search keyboard focus | 7.5 |
| Map (partial loading evidence) | 7.0 |
| Map filter | Not finally evaluated — capture during fade |
| Tours guest gate | 8.0 |
| Friends guest gate | 8.0 |
| Profile guest gate | 7.5 |
| Login across widths | 7.0 |
| Onboarding | 8.0 |
| Stamp detail, loading only | 6.5 |
| Parking detail, guest | 6.5 |

### Round 2 interaction and build evidence

- Chromium exercised list search/clear/open-detail; filter open/toggle/close and zoom; guest onboarding to list; login back to list. No page errors. Sixteen viewport/screen checks found no horizontal document overflow. This does not prove every element fits or native layouts work.
- The switch click ran, but the first DOM assertion returned a null `aria-checked`; this is **not a pass for accessibility semantics**. Explicit ARIA state is added in the next round alongside native accessibility state, and must be retested.
- All 110 Jest tests in 28 suites passed using `--config jest.config.js --runInBand --testTimeout=20000`. Initial run had one load-related timeout and one old ASCII-copy expectation; the latter was updated to query the accessible action name.
- Lint: zero errors, two existing require-import warnings in map primitives.
- Web export completed. Native local release assembled twice, with cache reuse (947 actionable tasks; second run 927 up to date). An APK build is not native UI validation.
- Emulator boot took about 12 minutes; proxy helper timed out and the emulator exited before usable app interaction. Retry in progress. No native UI pass claimed.
- Auth0 rejects localhost callbacks at ports 8081 and 8083 with “Callback URL mismatch”. Signed-in flows remain blocked. Production is not used as a substitute test backend.
- Typecheck initially reported two existing explicit `.tsx` imports and one nullable-token error in the preserved local Auth change. Configuration now allows the existing explicit file imports; Auth source remains untouched.

## Round 3 changes being verified

Remove guest-only 0% progress, fill list row space with controlled 12px separation, add meaningful fallback stamp artwork, give narrow login headings full width, expose browse action near the top of onboarding, describe denied location permissions, and reserve normal layout space for stamp/parking action footers. Explicit web switch/selected state supplements native accessibility state. Wide map search controls are bounded.

## Round 3 — independent review with loaded maps/details

Reviewer inspected all 22 PNGs in `screenshots/round-3/` and the browser-check log. Previous word-break, guest-progress, row-gap and onboarding-footer defects were resolved. Scores apply to guest web only.

| Category | Score /10 | Remaining finding |
| --- | ---: | --- |
| Icons | 8.5 | Consistent navigation and meaningful fallback stamp artwork. |
| Colors/contrast | 8.5 | Legible active surfaces; complete all-state contrast audit still pending. |
| Typography | 8.5 | Narrow heading fixed; clear hierarchy and consistent Sans. |
| Visual hierarchy | 8.0 | Large image-free detail heroes and repeated login gates dominate. |
| Spacing/layout | 8.0 | Controlled list gaps and reserved footer; detail placeholders too tall. |
| Radii/forms | 8.5 | Coherent restrained shapes. |
| Buttons/interactions | 8.0 | Core guest actions checked; location disabled without explanation, filter completion misplaced. |
| Navigation | 8.5 | Clear tabs/back and verified guest paths. |
| Map UX | 8.0 | Loaded tiles and good pins; narrow top pin obscured, location/attribution need polish. |
| Forms/search | 8.5 | Clear/empty/detail behavior proven; visible focus styling still rough. |
| Feedback/system states | 8.0 | Permissions clearer; guest labels imply known personal visits. |
| Accessibility | 7.5 | Improved semantics and targets; modal/keyboard/large text/native evidence incomplete. |
| Responsive design | 8.0 | Widths improved; narrow marker padding and wide navigation need confirmation. |
| Consistency | 8.0 | Stronger system; personal guest labels and older gate positioning remain. |
| Information quality | 8.0 | Clearer copy; guest visit status and location explanation still needed. |
| Polish/brand | 8.0 | Strong improvement; detail placeholders, repeated gates and attribution stand out. |

| Screen/state | Score /10 |
| --- | ---: |
| Stamp list | 8.5 |
| Stamp search, empty | 8.5 |
| Search keyboard focus | 8.0 |
| Login | 8.5 |
| Onboarding with bottom scroll evidence | 8.5 |
| Map | 8.0 |
| Map filters | 8.0 |
| Stamp detail, guest | 7.5 |
| Parking detail, guest | 7.5 |

No new score was assigned to the three guest gates in this round; their earlier scores remain. Signed-in/admin/native flows remained unscored at this point.

### Runtime clarification after round 3

The user identified port 4004 as the intended local web entry point. Serving the exported app at the existing CAP `/app/rnweb` route accepts the Auth0 callback. The first authenticated attempt exposed missing issuer/audience in the memory-backend launch (500 bearer configuration error). The backend was restarted with the app's matching public Auth0 issuer and audience; JWT verification remains enabled. No production backend is substituted. Signed-in review is now in progress.

## First signed-in review — intermediate source on the supplied baseline

Actual Auth0 login was exercised through port 4004. JWT lookup used the environment's proxy; application data requests and profile/onboarding updates went only to the local memory backend. The six screenshots below were taken through SPA navigation after onboarding, with zero page errors. They show mostly empty account states at 390×844. No browser storage or tokens were exported.

| Screen | Score /10 | Independent reviewer finding |
| --- | ---: | --- |
| Stamp list | 8.5 | Appropriate personal progress and clear hierarchy/group control. |
| Map | 8.0 | Search too narrow beside group control; location state unexplained in this capture. |
| Tours, empty account | 6.5 | Old light gradient/white text remains; Serif title, small controls, technical POI copy and competing create actions. |
| Friends, empty account | 7.5 | Clear friendly invitation; older typography/chips and duplicate search actions. |
| Profile, new account | 7.0 | Understandable metrics/timeline; oversized Serif heading/pink avatar, dense null-value cards and unclear active filter. |
| Stamp detail, unvisited | 8.0 | Clearer compact hero and notes; four footer actions compete, note placeholder faint, lower scroll evidence needed. |

These are additional original scores, not replacements for the guest scores. Tour creation, friend requests, profile/note edits, stamping, group writes, populated states, failure/offline and native interactions remain unverified by these images.

## Upstream divergence discovered during PR preparation

The supplied checkout began at `9a51605`. Fetching origin/develop revealed `0c1b6f3`, 77 commits ahead, including changes to onboarding, search, stamp details, preview builds, map styles and group-stamping actions. Consequently all evidence above applies to the supplied baseline plus the recorded intermediate design changes, **not to current develop**. The user has been asked whether to transfer this work onto current develop or continue on the supplied revision. Existing local Auth/SecureStore/onboarding source changes remain untouched and separately preserved. No assertion that the requested global 8.5 threshold is met is justified.

## Authorized transfer to current develop

The user selected current develop as the PR base. The design work was transferred onto `0c1b6f3` on branch `design/ux-ui-review`, retaining the newer search, multiple selection, grouped stamp status, onboarding wizard and local authentication workflows. The pre-existing local onboarding-storage patch was preserved through a three-way integration and remains uncommitted; its two companion files remain local.

Integrated verification observed 278 passing tests in 53 suites and a passing TypeScript check. Lint had only the two existing map-primitives require-import warnings after integration cleanup. New screenshot evidence and browser-checks are under the workspace's `artifacts/ui-audit/current`: 21 guest viewport checks had no document overflow, and an actual local visit write produced a visited stamp state. The browser also logged six React hydration mismatch errors; these are unresolved and prevent treating that run as error-free.

A further requested fetch found six more develop commits through `bf3a5c8`, including native offline visit/note synchronization. This update is being integrated before final review. Historical scores above remain attached to their original source/evidence; none are a final score for the new base.

## Develop review 1 — 0c1b6f3 plus transferred changes

The independent reviewer inspected all 36 PNGs in `screenshots/develop-round-1/` and the browser log. Later source corrections and the subsequent six develop commits are not credited to this image round.

| Category | Score /10 | Concrete remaining issue |
| --- | ---: | --- |
| Icons | 8.5 | Coherent line icons and active navigation. |
| Colors/contrast | 8.5 | Readable green actions; visual assessment, not a full WCAG measurement. |
| Typography | 8.5 | Consistent functional Sans; distinct onboarding display type. |
| Visual hierarchy | 8.0 | Guest onboarding action did not name the guest path. |
| Spacing/layout | 7.5 | Desktop list stretched; image-free hero and detail-end whitespace. |
| Radii/forms | 8.5 | Coherent component shapes. |
| Buttons/interactions | 8.0 | Duplicate create/search actions; immediate stamp success not captured. |
| Navigation | 8.0 | Desktop tab width changes across screenshots; group selector not opened. |
| Map UX | 8.0 | Better overlay padding; narrow pins overlap and group/search compete. |
| Forms/search | 8.0 | Readable inputs; current filter/multiple-selection interactions not evidenced. |
| Feedback/system states | 7.5 | Good empty states, but six hydration errors and no captured immediate stamp acknowledgement. |
| Accessibility | 7.5 (partial) | Visual readability; current keyboard, focus, native and screen-reader checks missing. |
| Responsive design | 7.0 | 21 checks without document overflow; stretched list and inconsistent desktop tabs. |
| Consistency | 8.0 | Stronger main screens; duplicate actions and navigation drift. |
| Information quality | 8.0 | Clear permissions; guest action and Timeline terminology need work. |
| Polish/brand | 8.0 | Strong identity; desktop stretching and empty detail hero remain. |

| Guest screen | 320 px | 390 px | 1440 px |
| --- | ---: | ---: | ---: |
| List | 8.0 | 8.5 | 6.5 |
| Map | 7.5 | 8.0 | 8.0 |
| Login | 8.5 | 8.5 | 8.5 |
| Onboarding | 7.5 | 7.5 | 7.5 |
| Tours | 8.5 | 8.5 | 8.5 |
| Friends | 8.5 | 8.5 | 7.5 |
| Profile | 8.5 | 8.5 | 8.5 |

| Signed-in screen/state, 390 px | Score /10 |
| --- | ---: |
| Onboarding 0 — welcome | 8.5 |
| Onboarding 1 — name | 8.5 |
| Onboarding 2 — avatar | 8.5 |
| Onboarding 3 — optional location | 8.5 |
| Onboarding 4 — optional friends | 8.5 |
| List | 8.5 |
| Map | 8.0 |
| Tours, empty | 8.0 |
| Friends, empty | 8.0 |
| Profile | 8.0 |
| Stamp detail | 7.5 |
| Stamp detail, scroll 500 | 8.5 |
| Stamp detail, scroll 1100 | 8.0 |
| Stamp detail, scroll 1800 | 8.0 |
| Stamp after visit | 7.5 |

The local visit write changed the action to “Erneut stempeln”. The screenshot delay exceeded the existing 2400ms toast duration, so that image does not show the immediate acknowledgement. This is a capture limitation, not evidence that no toast was rendered. The reviewer also requested clearer nearby feedback, consistent desktop widths and loaded group/multiple-selection flows. No score was assigned to unseen flows.

## Develop review 2 — guest matrix (bf3a5c8 + working tree)

Independent reviewer inspected all 28 guest images and three search/filter states in `screenshots/develop-round-2`. Each value below is a separate recorded score. Signed-in review remains pending in this round.

| Screen | 320 | 390 | 768 | 1440 |
| --- | ---: | ---: | ---: | ---: |
| Guest list | 8.0 | 8.5 | 8.5 | 8.5 |
| Guest map | 8.0 | 8.5 | 8.5 | 8.5 |
| Guest login | 8.5 | 8.5 | 8.5 | 8.5 |
| Guest onboarding | 8.0 | 8.0 | 8.5 | 8.0 |
| Guest tours | 8.5 | 8.5 | 8.5 | 8.5 |
| Guest friends | 8.5 | 8.5 | 8.5 | 8.5 |
| Guest profile | 8.5 | 8.5 | 8.5 | 8.5 |

Search focus: **7.5**; search empty: **7.5**; map filter: **8.5**. Rest findings: double input focus outline, low clear icon, crowded 320px list/map, and onboarding content requiring a scroll/end proof. Guest guidance still describes authenticated profile setup. Desktop width and navigation consistency improved.

Interaction capture: 28 viewport checks without horizontal document overflow; actual SSO/onboarding, search clear/empty, map switches, multiple selection/cancel and local visit acknowledgement passed. Group interaction timed out and must be diagnosed. One map `getZoom` exception remains; this run is not browser-error-free. See `develop-round-2-browser-checks.json`. Screenshots of signed-in states are evidence only until reviewed separately.

### Develop review 2 — signed-in and category scores

Reviewer inspected 20 additional images (51 total in this round), and the browser check file. These scores precede the subsequent focus, profile, group-avatar and layout corrections.

| Signed-in image | Score /10 |
| --- | ---: |
| List 390 / 1440 | 8.0 / 8.5 |
| Map 390 / 1440 | 8.5 / 8.5 |
| Tours 390 / 1440 | 8.5 / 8.5 |
| Friends 390 / 1440 | 8.5 / 8.0 |
| Profile 390 / 1440 | 8.0 / 6.5 |
| Onboarding 0 / 1 / 2 / 3 / 4 | 8.5 / 8.5 / 8.5 / 8.5 / 8.5 |
| Group open | 8.0 visual only |
| Multiple selected | 7.5 |
| Stamp detail / bottom / success | 8.5 / 8.5 / 8.5 |

| Category | Score /10 |
| --- | ---: |
| Icons | 8.5 |
| Color/contrast | 8.5 |
| Typography | 8.5 |
| Visual hierarchy | 8.5 |
| Spacing/layout | 8.0 |
| Radii/forms | 8.5 |
| Buttons/interactions | 8.0 |
| Navigation | 8.5 |
| Map UX | 8.0 |
| Forms/search | 7.5 |
| Feedback/system states | 8.5 |
| Accessibility | 7.5 partial |
| Responsive/adaptive | 7.5 |
| Consistency | 8.0 |
| Information quality | 8.0 |
| Polish/brand | 8.0 |

Remaining findings: stretched desktop profile; friends search action far outside its content column; redundant selection cancel actions; blank group avatar; high grouped rows; mixed profile filter colors and English Timeline copy. Native, screen-reader, offline/error and several secondary flows remain unevaluated. A visible state never substitutes for the failed group interaction check.

## Develop review 4 — expanded flows

All 41 PNGs in `screenshots/develop-round-4` inspected independently. No browser pageerrors. Real local writes demonstrated: visit, accepted fictional friend request, and created empty tour. Tour creation does not establish a complete route. Group confirmation still failed; root cause was a data-query transition unmounting the open selector. This round precedes the draft-selection and keyboard repairs.

| Category | Score /10 |
| --- | ---: |
| Icons | 8.5 |
| Color/contrast | 8.0 |
| Typography | 8.5 |
| Visual hierarchy | 8.0 |
| Spacing/layout | 8.5 |
| Radii/forms | 8.5 |
| Buttons/interactions | 7.5 |
| Navigation | 8.5 |
| Map UX | 7.5 |
| Forms/search | 8.0 |
| Feedback/system states | 8.5 |
| Accessibility | 7.5 partial |
| Responsive/adaptive | 8.5 |
| Consistency | 8.0 |
| Information quality | 8.0 |
| Polish/brand | 8.0 |

| Image/state | Score /10 |
| --- | ---: |
| Guest list 320 | 8.5 |
| Search focus 320 / 390 | 8.5 / 8.5 |
| Search empty 320 / 390 | 8.0 / 8.5 |
| Guest onboarding initial 320 / 390 / 768 / 1440 | 8.0 / 8.5 / 8.5 / 8.5 |
| Guest onboarding end 320 / 390 / 768 / 1440 | 8.5 / 8.5 / 8.5 / 8.5 |
| Signed list 390 / 1440 | 8.5 / 8.5 |
| Signed map 390 / 1440 | 8.5 / 8.5 |
| Signed tours 390 / 1440 | 8.5 / 8.5 |
| Signed friends 390 / 1440 | 8.5 / 8.5 |
| Signed profile 390 / 1440 | 8.5 / 8.5 |
| Profile edit | 8.0 |
| Friend request / accepted / search | 8.0 / 8.5 / 7.5 |
| Group open | 8.0 visual; 5.0 flow |
| Multiple selected | 8.0 |
| Map filter / keyboard filter 320 | 8.5 / 8.5 visual |
| Onboarding 0 / 1 / 2 / 3 / 4 | 8.5 / 8.5 / 8.5 / 8.5 / 8.5 |
| Stamp detail / bottom / success | 8.5 / 8.5 / 8.5 |
| Tour created / bottom | 6.5 / 6.5 |

Findings: low-contrast tour-map hint, no clear empty-tour start action, technical metric placeholders; narrow focus inside friend search, small friend actions; group count ambiguous beside total including self; narrow empty-state guidance below illustration. Profile save/upload/validation, full route editing, native, screen readers and offline/error scenarios remained unverified. The next iteration addresses the specific findings without treating missing evidence as a pass.

### Diagnostic runs 3 and 5

These runs have no independent numerical review. Their browser records are retained rather than treated as successful rounds. Run 3 exposed a local-fixture timing issue (buddy records seeded after the friends query) and a capture locator error; fixtures now seed before authenticated API reads. Run 5 exercised Space and exposed the React Native Web checkable-role gap. Its group assertion failed; the follow-up adds explicit Space activation for non-button checkable elements. The run-4 keyboard record likewise preserves the failed switch assertion. Escape/clear and all four onboarding-end reachability checks passed. None of these logs establish native or screen-reader support.

Source changes through `a9e9d8b` pass 374 tests in 67 suites and TypeScript. Lint has zero errors and the two existing require-import warnings in map-primitives.ts. The contrast samples in `contrast-checks.json` all exceed 4.5:1; this is not an exhaustive rendered-screen contrast audit.

### Build and interaction evidence after repairs

- Android local x86 release compiled successfully: **BUILD SUCCESSFUL in 8m 56s**, 982 tasks (481 executed, 501 up-to-date). This establishes compilation, not a native UI/gesture/accessibility pass. The software emulator previously stalled during boot/package-manager operations; no usable signed-in native session was observed.
- Final keyboard record: all **7 checks passed**, including account-action reachability at 320/390/768/1440, clearing search with Enter, switching parking with Space, and closing map filter with Escape.
- Axe WCAG 2 A/AA + 2.1 AA on guest list, map, login, onboarding and tours: **zero violations on each route**. See `axe-guest-checks.json`. This limited automated scan does not certify all screens or assistive technologies.

## Develop review 6 — a9e9d8b

Independent reviewer inspected all 66 main PNGs and 13 keyboard PNGs (nine byte-identical duplicates), 42/42 browser checks and 7/7 keyboard checks. No pageerrors. Group confirmation/clear, profile-name save and first tour-point addition now pass. Scores below precede the profile-refresh and precise-fit corrections.

| Category | Score /10 |
| --- | ---: |
| Icons | 8.5 |
| Color/contrast | 8.5 |
| Typography | 8.5 |
| Visual hierarchy | 8.5 |
| Spacing/layout | 8.5 |
| Radii/forms | 8.5 |
| Buttons/interactions | 8.5 |
| Navigation | 8.5 |
| Map UX | 8.0 |
| Forms/search | 8.5 |
| Feedback/system states | 8.0 |
| Accessibility | 8.0 Web partial |
| Responsive/adaptive | 8.5 |
| Consistency | 8.0 |
| Information quality | 8.0 |
| Polish/brand | 8.5 |

| Guest image prefix | 320 | 390 | 768 | 1440 |
| --- | ---: | ---: | ---: | ---: |
| List | 8.5 | 8.5 | 8.5 | 8.5 |
| Map | 8.0 | 8.5 | 8.5 | 8.5 |
| Login | 8.5 | 8.5 | 8.5 | 8.5 |
| Onboarding | 8.5 | 8.5 | 8.5 | 8.5 |
| Onboarding end | 8.5 | 8.5 | 8.5 | 8.5 |
| Tours | 8.5 | 8.5 | 8.5 | 8.5 |
| Friends | 8.5 | 8.5 | 8.5 | 8.5 |
| Profile | 8.5 | 8.5 | 8.5 | 8.5 |

| Additional image/state | Score /10 |
| --- | ---: |
| Search focus / empty | 8.5 / 8.5 |
| Map filter | 8.5 |
| Signed list 390 / 1440 | 8.5 / 8.5 |
| Signed map 390 / 1440 | 8.5 / 8.5 |
| Signed tours 390 / 1440 | 8.5 / 8.5 |
| Signed friends 390 / 1440 | 8.5 / 8.5 |
| Signed profile 390 / 1440 | 8.5 / 8.5 |
| Profile edit / saved | 8.5 / 6.5 |
| Friends request / accepted / search | 8.5 / 8.5 / 8.5 |
| Group open / selected | 8.5 / 8.0 |
| Multiple selected | 8.5 |
| Onboarding 0 / 1 / 2 / 3 / 4 | 8.5 / 8.5 / 8.5 / 8.5 / 8.5 |
| Stamp detail / bottom / success | 8.5 / 8.5 / 8.5 |
| Tour created / bottom | 8.0 / 8.5 |
| Tour search / point selected / point added | 8.0 / 8.5 / 8.5 |
| Keyboard guest list 320 | 8.5 |
| Keyboard onboarding initial 320 / 390 / 768 / 1440 | 8.5 / 8.5 / 8.5 / 8.5 |
| Keyboard onboarding end 320 / 390 / 768 / 1440 | 8.5 / 8.5 / 8.5 / 8.5 |
| Keyboard search focus 320 / empty 320 | 8.5 / 8.5 |
| Keyboard map filter 320 / map zoomed 320 | 8.5 / 8.5 |

Specific remaining findings: profile shows one visit in history but zero visited/completion after name save; dense pin overlap in 320 overview and tour map; small group status signs/high group cards. Accessibility has measured Web evidence but lacks complete dialog-focus and screen-reader verification. Multileg route calculation/reordering, navigation outdoors, image upload, offline/errors and native UI remain unverified. Android compilation alone does not pass those flows.

## Develop review 7 — 6a6bf27 (independent review interrupted)

New runtime evidence is in `screenshots/develop-round-7`, with `develop-round-7-browser-checks.json` and `develop-round-7-keyboard-checks.json`.

- **13/13 browser interaction checks passed**, no pageerrors. Includes profile save with visited count 1, first tour point present in the sequence after leaving fullscreen, and 24 Tab/Shift+Tab steps inside each of three named dialogs (map filters, group selection, friend search). Their actual accessibility trees are saved as `.aria.txt`.
- **8/8 additional checks passed**, including Escape returning focus to the map-filter trigger.
- All **376 tests in 68 suites passed**; TypeScript passed. Lint: zero errors, two existing require-import warnings. New fit tests check fractional fitting while retaining whole-step gesture zoom, including the failure path.
- Android local x86 release build succeeded; the repeat build succeeded in **1m 28s**, with 959/982 tasks up-to-date. Native UI was not validated: the emulator showed a System UI ANR. On 2026-11-06 the user took ownership of Android runtime testing; the agent stopped its emulator attempt and retained build caches.

Actual partial reviewer findings before interruption:

| Screen/state | New independent score /10 | Finding |
| --- | ---: | --- |
| Map overview 320 | **8.5** | Better fit, all numbers recognizable, less overlap. |
| Profile saved | Not newly scored | Reviewer confirmed visited 1, completion 13%, latest visit and history 1/1 agree. |
| Group selected | Not newly scored | Reviewer confirmed larger status symbols. |
| Tour created | Not newly scored | Reviewer requested the lower scroll evidence because the first-point action starts below the footer in the initial view; `tour-created-bottom.png` is supplied. |

The review agent then failed with **“Your workspace is out of credits. Add credits to continue.”** No complete new category or screen scores were returned. The last complete category table remains review 6; it must not be silently replaced with passing values after implementation fixes. The requested threshold of 8.5 everywhere is therefore **not yet independently established**. The PR remains a draft pending the remaining review and the user's Android test. Native, actual screen-reader, multileg routing/reordering, image-upload and offline/error coverage must not be inferred from these Web checks.

## Repeated final review — 2026-11-06, source 6a6bf27

The independent reviewer completed the previously interrupted review: all 35 PNGs in round 7, including the lower tour screenshot, plus all three ARIA trees and the browser, keyboard, axe and contrast records were newly inspected. No code changes were included in these scores.

| Category | Score /10 | Main finding |
| --- | ---: | --- |
| Icons | 8.5 | Larger group status signs; consistent icon style. |
| Color/contrast | 8.5 | Readable surfaces; measured central color combinations. |
| Typography | 8.5 | Clear sizes and hierarchy. |
| Visual hierarchy | 8.5 | Main tasks and tour entry explained. |
| Spacing/layout | 8.0 | Tour instruction overlaps the plus control. |
| Radii/forms | 8.5 | Consistent cards, dialogs and inputs. |
| Buttons/interactions | 8.5 | Main interactions and writes demonstrated. |
| Navigation | 8.5 | Consistent tabs and reachable content. |
| Map UX | 7.5 | Tour scroll capture shifts away from Harz and clips pins. |
| Forms/search | 8.5 | Clear focus, results and successful name save. |
| Feedback/system states | 8.0 | Tour totals contradict the selected first point. |
| Accessibility | 8.5 for evidenced Web scope | Named controls, dialog focus containment and return; no screen-reader certification. |
| Responsive/adaptive | 8.5 | Bounded desktop and usable mobile content. |
| Consistency | 8.0 | Tour totals do not match the visible point. |
| Information quality | 8.0 | Tour zeros/placeholders insufficiently explained. |
| Polish/brand | 8.0 | Tour overlap and camera movement remain. |

| Newly inspected PNG | Score /10 |
| --- | ---: |
| signed-list-390 / signed-list-1440 | 8.5 / 8.5 |
| signed-map-390 / signed-map-1440 | 8.5 / 8.5 |
| signed-tours-390 / signed-tours-1440 | 8.5 / 8.5 |
| signed-friends-390 / signed-friends-1440 | 8.5 / 8.5 |
| signed-profile-390 / signed-profile-1440 | 8.5 / 8.5 |
| profile-edit / profile-saved | 8.5 / 8.5 |
| group-open / group-selected / multiple-selected | 8.5 / 8.5 / 8.5 |
| map-overview-320 | 8.5 |
| friends-request / friends-request-accepted / friends-search | 8.5 / 8.5 / 8.5 |
| map-filter / search-focus / search-empty | 8.5 / 8.5 / 8.5 |
| onboarding-0 / onboarding-1 / onboarding-2 / onboarding-3 / onboarding-4 | 8.5 / 8.5 / 8.5 / 8.5 / 8.5 |
| stamp-detail / stamp-bottom / stamp-success | 8.5 / 8.5 / 8.5 |
| tour-created | 8.0 |
| tour-created-bottom | 7.0 |
| tour-search | 7.5 |
| tour-point-selected | 8.0 |
| tour-point-added | 7.5 |

Guest matrix carried forward (not newly inspected as a full matrix): list/login/tours/friends/profile and onboarding start/end at 320/390/768/1440 each 8.5; map at 390/768/1440 each 8.5. Map 320 is replaced only by the newly inspected round-7 overview, 8.5.

The repetition uncovered that the former lower tour capture changed the camera rather than just scrolling the page, while the instruction overlapped zoom and a single draft point still showed zero server totals. Those concrete findings start the next correction round. Native testing remains with the user; screen-reader, offline/error, upload and multileg-route/reordering coverage is not implied.
