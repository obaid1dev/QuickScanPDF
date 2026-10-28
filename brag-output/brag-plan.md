# Brag Plan: QuickScan PDF

## What is this app?

QuickScan PDF is an offline Android document scanner on Google Play — point the camera, the native scanner auto-detects the page edges, auto-crops, and saves a real PDF on-device. No account, no cloud, no signup: the app's own copy says "Your scans stay on your device."

## The angle

Scanner apps usually feel like a chore. This one's claim is that the machine does the boring part: it finds the edges, it crops, it builds the PDF — and unlike giant cloud scanners, everything stays in your pocket. The video plays that as quiet confidence: one paper document walks in, a finished PDF walks out, and the whole journey is visually local (nothing flies off to a cloud). The outro relies on the app's actual strongest line — "Your scans stay on your device" — because it is the one scanner claim the big names can't make.

## Hook (first 2-3 seconds)

A sheet of paper skids in on a dark stage; scanner corner brackets snap onto its edges with a single crisp tick, then the paper instant-crops into a clean page thumbnail. Line lands: **"Paper in. PDF out."** Motion is the hook — the app's actual auto-crop behavior demonstrated in under 2 seconds.

## Key moments (the middle)

- The auto edge-detection moment: brackets on a camera view slide from "searching" to locked on a document, then the page auto-crops — this is the real native scanner flow, recreated.
- The dashboard filling up: scanned document cards (with page counts and a PDF tag) stack into the Scans list one by one, folders included — recreating the app's home screen.
- One simulated tap: a document card is tapped and a "Share as PDF" action sheet slides up — the app's actual happy path ending.

## Outro / punchline

Two quiet claims on the dark stage, then the logo:
1. "Works offline" (grounded: core flow needs no internet)
2. "Your scans stay on your device." (verbatim app copy from its iOS infoPlist permission strings)
Then the QuickScan PDF icon + wordmark and a Google Play chip. Music resolves on the final strong cue.

## User flow worth showing

entry → key action → result:
1. Tap the camera FAB on the dashboard → scanner opens.
2. Camera frames the document → edges detected → auto-crop.
3. Document appears in the Scans list → share as PDF.

All three beats are shown: the scan moment is the centerpiece, and the dashboard scene carries entry and result.

## Tone

- Preset: `polished`
- Creative direction: quiet premium product film; confidence through restraint, not hype
- Interpretation: fewer scenes with longer holds, clean crossfades/slides, typography stays calm, restraint in SFX (2-3 subtle cues). No loud captions, no meme energy. One confident demo beat at the center.

## Format: landscape — 1920x1080
## Duration: 20 seconds

## Visual identity (from the project)

- Background: `#09090B` (dark palette, `constants/theme.ts` — the app's original look)
- Surface / raised: `#18181B` / `#27272A`, hairline border `#3F3F46`
- Accent: `#2563EB` (primary), with `#2C5EBD` (splash / adaptive-icon background) as a soft secondary accent or glow
- Text: `#FAFAFA` primary, `#A1A1AA` secondary
- Display font: app uses the system font — use a clean geometric sans (Inter or system-ui), 600/700 weights only
- Body font: same family, regular
- Strongest visual element: the scanner frame with corner brackets; the dark dashboard with document cards; the app icon (`assets/icon.png`, copy into composition assets)

## Share copy (draft)

QuickScan PDF scans like your phone is the scanner: edges found, page cropped, PDF made — and every scan stays on your device. Offline by default, free on Google Play.

## Audio direction

- Role: warm bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady and clean — best for `polished`)
- Music treatment: start at 0.0 at 0.30–0.35 volume, hold steady, gentle fade under the final logo
- Music cue guidance: preset read from `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md` (~110 BPM). Strong cue targets: **8.74s** → the moment page edges lock/auto-crop in Scene 2; **13.11s** → the "Share as PDF" payoff in Scene 3; **17.47s** → logo landing in Scene 4 (1-3 locks max — use at most these three). Beat grid windows (0.56–4.91) for Scene 1's crop snap and page thumbnails; sequential card reveals in Scene 3 snap to every other beat.
- Audio-reactive treatment: subtle; let the accent-blue glow / scan frame presence breathe gently with RMS on the hero moments. No waveform/equalizer visuals.
- SFX posture: sparse; motion-matched with professional restraint
- Audio-coupled moments: bracket snap + auto-crop tick (Scene 1 & 2, `impact`/`interface` family), card-by-card document arrivals (Scene 3, `casino/card-*` or soft `drop`), simulated tap → share sheet (Scene 3, `interface/click`), soft logo land (Scene 4)
- Restraint rule: nothing aggressive, no comedic bonks, never more than one SFX per beat; the music carries the energy

## Storyboard

### Scene 1 — Hook: "Paper in. PDF out." — 3.5s
Dark `#09090B` stage. A paper sheet skids/fans in; scanner corner brackets snap onto its corners; on the lock, the sheet visibly crops into a crisp page thumbnail that settles as a small floating card. Headline types/stamps in: "Paper in. PDF out." App icon bottom-corner presence established early (brand anchor).
Sequential/interaction: yes — sheet arrives → brackets snap (4 corners) → crop flash → thumbnail settles; headline stamps in fast and holds.
Audio intent: confident opening tick; music bed enters on a clean beat.
Audio-coupled idea: bracket snap + crop hit on the same instant; soft drop for the thumbnail settle.
Music: steady/clean bed from 0.0.
Transition mood: soft slide → Scene 2.

### Scene 2 — The scan: auto edge detection — 5.5s
Recreated camera view inside a phone mockup: a document (receipt/letter look) on a dark desk. Corner brackets drift as if searching, then snap to the page's real edges and gain an accent-blue edge highlight. Page auto-crops (background desk dims/scales away, page fills the frame). Zero-effort framing is the point. Caption chips (short labels, held long enough to read): "Edges detected" → "Auto-crop". Beat-lock the edge-lock/auto-crop payoff to the 8.74s strong cue (scene-relative ~5.2s).
Sequential/interaction: yes — brackets search → lock 4 corners → auto-crop flash → page fills frame.
Audio intent: quiet anticipation building to one crisp lock.
Audio-coupled idea: search drift (no sound) → lock/crop accent hit → soft page settle.
Music: bed continues, brief low-swell under the search.
Transition mood: soft crossfade → Scene 3.

### Scene 3 — The library: scans saved as PDFs — 6s
Recreated dashboard ("Scans" header): document cards slide into the list one by one — e.g. "Rent agreement · 2 pages · PDF", "Electricity bill · 1 page · PDF" — plus a folder tile among them (recreating the app's folders). Page-count chips and PDF tags arrive with the cards (reveal ~0.5-0.6s apart, then the full set holds so it stays readable). Simulated tap on one card → "Share as PDF" sheet slides up with a share icon. Beat-lock the share-sheet payoff to the 13.11s strong cue (scene-relative ~4.1s); cards snap to every other beat.
Sequential/interaction: yes — 3 cards + folder stack in sequence; then simulated tap → share sheet.
Audio intent: satisfaction through accumulation, then one clear click.
Audio-coupled idea: card-place sounds (first and last only, per restraint), one `click` on the tap.
Music: bed at full presence.
Transition mood: smooth wipe/slide → Scene 4.

### Scene 4 — Outro: offline + on-device — 5s
Back to the dark stage: two quiet claim lines land one after another — "Works offline", then "Your scans stay on your device." (verbatim app copy) — each holding ≥1.2s. App icon centers up with a soft accent-blue `#2C5EBD` glow; wordmark "QuickScan PDF" lands; a Google Play chip ("Get it on Google Play") fades in last. Music fades under the logo; final cue soft.
Sequential/interaction: claims appear sequentially; logo is the final lock (beat-lock toward 17.47s strong cue, scene-relative ~2.5s).
Audio intent: the energy resolves; everything slows by one notch.
Audio-coupled idea: soft logo land on the strong cue; no SFX after that.
Music: fade-out under logo.
Transition mood: end hold.

**Music mood for this video:** steady/clean (vol-12), professional warmth
**Audio summary:** A clean steady bed opens with the paper-snap hook, breathes under the scan search-and-lock, carries the satisfying card accumulation, and fades out on the on-device claim so the last thing the viewer hears is calm — matching the app's strongest claim.

## Notes

- All copy on screen is grounded: feature labels, "Your scans stay on your device", dashboard structure are from the project (AGENTS.md, `app.json` infoPlist strings, `app/(tabs)/index.tsx`), or generic scene connective text.
- Fake document titles ("Rent agreement", "Electricity bill") are plausible fictional stand-ins for real scanned files — no real user data exists.
- App icon from `assets/icon.png` is used as the brand mark.
