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
