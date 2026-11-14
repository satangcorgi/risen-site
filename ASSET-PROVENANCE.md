# Website image sources

27 September 2026. The four earlier decorative photograph references had no established source permission. They have been replaced by the generated Bible illustrations already selected for Risen. These are illustrations, not a claim that Vin photographed a printed edition. No image-generation claim establishes exclusive copyright ownership.

- `approved-psalm-23.png`: byte-for-byte copy of `/Users/vin/Risen/docs/founder-review-2026-09-14/reference-guided-bible-photo/psalm-23-reference-guided-v2-low-light.png`; SHA-256 `b3982080133a17907994e63cfb08e4bc4c9c3ee3ddef1db7005ea71be1427963`.
- `approved-psalm-demo.png`: byte-for-byte copy of `/Users/vin/Risen/Risen/Resources/Assets.xcassets/psalm-23-bible.imageset/psalm-23-bible.png`; SHA-256 `4cde0bd2132b174f0e94545f440993178326c9236d62a4ea8f92ac765953ecf7`.
- `approved-jeremiah-demo.png`: byte-for-byte copy of `/Users/vin/Risen/Risen/Resources/Assets.xcassets/jeremiah-29-11.imageset/jeremiah-29-11.png`; SHA-256 `c38158e59c0a27b9c9c098527a88d549e1c2ec4df4a6ce542ef35ab003d56e33`.

The original app screenshots are first-party Risen captures. Font and animation-vendor files are unchanged in this pass.

## 8 November 2026 redesign

- `assets/plate-creation-of-light.png`: Gustave Doré, "The Creation of Light" (1866), engraving from the Doré Bible, public domain. The same file ships in the app (`RisenWidget/plate-creation-of-light.png`). The page dithers it live in the browser.
- `assets/risen-icon.png`: the Risen app icon, resized to 256 px. First-party.
- `review.html`: Philippians 4:10-16 in the Berean Standard Bible (public domain), a scan target for App Review.
- The earlier illustrations above stay in `assets/` but the new index no longer uses them.

## 14 November 2026: the dither site

- `assets/v2/book-atlas.jpg`: frames 4 to 60 of the app's own book-opening clip (`Risen/Resources/BookOpening/book-open-NN.jpg`), greyscale, tiled 8 by 8 at 320 px. The page dithers it live. `assets/v2/book-open.jpg` is frame 60, the still shown when WebGL isn't available.
- `assets/v2/0N-*.jpg`, `x-kept.jpg`: first-party Risen captures from the App Store screenshot pipeline (`docs/revamp-2026-11/store/screenshots/iphone/raw`), resized to 660 px wide. `01-open-your-bible.jpg` shows the approved Psalm 23 illustration listed above, unchanged.
- `assets/v2/alarm-classic.m4a`: the first 4 seconds of the app's `alarm_classic.caf`, which is synthesized from a 440 Hz tone expression (see the app's Sounds/README.md). It plays only when the visitor taps "Hear it".
- `assets/v2/app-store-badge.svg`: Apple's official "Download on the App Store" badge, from developer.apple.com, unmodified.
- `assets/og/risen-loop.mp4`, `risen-og.jpg`: one 5.8 s cycle of the app's dithered book loop, recorded from the Debug screen harness in the Morning look.
