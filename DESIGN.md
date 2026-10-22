---
name: Góc Học Của Bé
description: A love-note study notebook. Ruled paper, washi tape and sticky notes in candy pastels.
colors:
  bubblegum: "#ff7aa2"
  raspberry: "#e84d7d"
  blush: "#ffe3ec"
  petal: "#fff4f7"
  page: "#fff7fa"
  lilac: "#c8b6ff"
  lilac-mist: "#efe9ff"
  lilac-ink: "#6a4cc2"
  plum-ink: "#5b3a55"
  dusty-plum: "#9a7a93"
  rose-rule: "#ffd0de"
  margin-pink: "#ffb3c8"
  ruled-blue: "#d9ecff"
  sticky-cream: "#fffbe6"
  sticky-edge: "#ffeaa0"
  break-mint: "#6dd3a8"
  break-mint-deep: "#4cc493"
  rest-violet: "#9b84f5"
  rest-violet-deep: "#8a6ff0"
  read-mint: "#eafaf2"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Patrick Hand, Quicksand, cursive"
    fontSize: "clamp(28px, 4vw, 40px)"
    fontWeight: 400
    lineHeight: 1.25
  timer:
    fontFamily: "Patrick Hand, Quicksand, cursive"
    fontSize: "clamp(54px, 13vw, 70px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "1px"
  headline:
    fontFamily: "Patrick Hand, Quicksand, cursive"
    fontSize: "28px"
    fontWeight: 400
  handnote:
    fontFamily: "Patrick Hand, Quicksand, cursive"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Quicksand, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Quicksand, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  note: "6px"
  field: "14px"
  tile: "16px"
  card: "22px"
  modal: "28px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
  button-primary-big:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "14px 30px"
  button-ghost:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.raspberry}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
  button-tiny:
    backgroundColor: "{colors.lilac-mist}"
    textColor: "{colors.lilac-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip:
    backgroundColor: "{colors.bubblegum}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-soft:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.raspberry}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.card}"
    padding: "22px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.plum-ink}"
    rounded: "{rounded.field}"
    padding: "10px 14px"
  letter-card:
    backgroundColor: "{colors.sticky-cream}"
    textColor: "{colors.plum-ink}"
    rounded: "{rounded.tile}"
    padding: "12px 14px"
  letter-card-unread:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.plum-ink}"
    rounded: "{rounded.tile}"
    padding: "12px 14px"
  preset:
    backgroundColor: "{colors.white}"
    textColor: "{colors.plum-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  preset-active:
    backgroundColor: "{colors.bubblegum}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: Góc Học Của Bé

## Overview

**Creative North Star: "The Love-Note Notebook"**

The whole interface is a student's notebook that someone who loves her has decorated. Pages are ruled school paper with a pink margin line. Notes are cream sticky paper tilted a degree or two. A strip of lilac washi tape holds the hero card down. Emoji act as stickers. Headings, the timer and anything "said" by him are in a handwritten face (Patrick Hand), and the working UI stays in a round, legible sans (Quicksand). The page should feel like his handwriting is in the margins of her studies.

Density is relaxed and card-based. Generous rounded white cards float on a pale pink page washed with soft radial blooms of blush, lilac and baby blue. Interaction is soft and bouncy like candy: buttons squish on press, cards lift and tilt slightly on hover, popups pop in with an overshoot. Hearts float up the background, and the brand heart beats. Every animation stops under `prefers-reduced-motion`.

The look is cute but grown-up: a university student's notebook, not a children's app. It must never read as a cold office tool, with grey, square, dense dashboard chrome.

**Key Characteristics:**
- Ruled-paper, washi-tape and sticky-note materials taken from real stationery
- Handwritten display type over a round, friendly sans for the working UI
- Pink-led candy pastels, with lilac and mint reserved for meaning
- Pill and very round shapes everywhere, softened further by dashed "stitched" borders
- Squishy, bouncy micro-interactions that all switch off under reduced motion

## Colors

A pink-led candy-pastel palette on warm near-white paper. Text is a soft plum ink, never black.

### Primary
- **Bubblegum Pink** (bubblegum): the main accent. Progress ring, filled chips, active presets, the toast edge, range and checkbox accents, and the start of the primary gradient.
- **Raspberry** (raspberry): the deep pink. Card headings, the brand wordmark, the end of the primary button gradient, the unread dot, and error text. This is the pink that carries text, so use it where pink has to be readable.

### Secondary
- **Lilac** (lilac): the washi-tape strip and the second stop of the "studying" banner gradient.
- **Lilac Mist** (lilac-mist) / **Lilac Ink** (lilac-ink): the quieter secondary voice. Tiny buttons, badges, PIN hints, and locked-letter text.

### Tertiary (state colors for the timer)
- **Break Mint** (break-mint, break-mint-deep): the short-break phase ring and chip. A read letter's row in admin uses **Read Mint** (read-mint).
- **Rest Violet** (rest-violet, rest-violet-deep): the long-break phase ring and chip.

### Neutral
- **Page Blush** (page): the body background under radial blooms of blush, lilac-mist and pale blue.
- **Blush** (blush) / **Petal** (petal): soft pink fills for ghost buttons, tab tracks, stat tiles and reminder rows.
- **Plum Ink** (plum-ink): primary text. **Dusty Plum** (dusty-plum): secondary text, hints and footers.
- **Rose Rule** (rose-rule): every border, dashed divider and field stroke.
- **Ruled Blue** (ruled-blue) and **Margin Pink** (margin-pink): the lines of the notebook paper.
- **Sticky Cream** (sticky-cream) and **Sticky Edge** (sticky-edge): sticky notes, letters and the love-jar note.

### Named Rules
**The Plum Ink Rule.** Text is never pure black or grey. Body text is plum-ink, secondary text is dusty-plum, and emphasis is raspberry.

**The Phase Color Rule.** Mint and violet mean break time and nothing else. Don't use them as decoration elsewhere, or they stop telling her where she is in the cycle.

## Typography

**Display Font:** Patrick Hand (with Quicksand, cursive)
**Body Font:** Quicksand 400–700 (with system-ui, sans-serif)

**Character:** Patrick Hand is his handwriting: warm, a little imperfect, personal. Quicksand is the clean, round print that keeps controls and numbers easy to read. Both load with the `vietnamese` subset.

### Hierarchy
- **Display** (400, clamp(28px, 4vw, 40px), 1.25): the hero greeting title.
- **Timer** (400, clamp(54px, 13vw, 70px), 1, 1px tracking): the Pomodoro countdown. Also the hand style for stat numbers (38px).
- **Headline** (400, 28px): card headings in raspberry. Modal titles go to 32px, game titles to 22px.
- **Handnote** (400, 20–24px, 1.5): letters, sticky notes, the hero sub-note, the footer, "next reminder" times. Anything written *by him* uses this.
- **Body** (400, 16px, 1.55): paragraphs and modal copy.
- **Label** (600–700, 12.5–14px): nav, chips, stat labels, form labels, hints (13px dusty-plum, 1.5).

### Named Rules
**The Handwriting Is His Rule.** Patrick Hand is for headings and personal or affectionate words. Controls, form fields, data labels and settings stay in Quicksand. The admin content editor deliberately switches the lined textarea back to Quicksand 14px.

## Layout

There's a single centered column (max 1120px, padding 24px 20px 40px; the admin page narrows to 760px). Below a sticky, translucent, blurred top bar with a dashed bottom border sits a hero card, then a two-column grid (1.05fr / 1fr, 20px gap) pairing timer with music and today-stats with reminders. Below that come the full-width mailbox and entertainment sections. Cards are separated by 20px. Internal rhythm is 6, 10, 14 and 20px.

Responsive behavior: at ≤860px the grid collapses to one column. At ≤600px the nav links hide (except on admin), container and card padding tighten to 16px, the hero sticker hides, and toasts stretch full width. Auto-fill grids handle games (min 200px) and letters (min 260px).

## Elevation & Depth

Depth is soft and pink-tinted. Shadows are diffuse glows tinted raspberry or plum, never neutral grey. Cards sit just above the page on one ambient shadow, with a 2px white border that reads as a paper edge. Sticky notes and letters get a small dark drop shadow so they look physically stuck on. Modals lift highest, with a heavy pink glow over a blurred plum scrim.

### Shadow Vocabulary
- **Card glow** (`0 10px 30px -12px rgba(232, 77, 125, .35)`): every card, banner, admin tab track, and toast.
- **Button lift** (`0 6px 16px -6px #e84d7d`, hover `0 8px 22px -6px`): primary buttons only.
- **Tab pill** (`0 3px 10px -4px rgba(232, 77, 125, .5)`): the active segment in phase and admin tabs.
- **Paper drop** (`0 6px 14px -8px rgba(0, 0, 0, .25–.3)`): sticky notes and opened letters.
- **Modal bloom** (`0 30px 60px -20px rgba(232, 77, 125, .5)`): dialogs.
- **Pulse glow** (`0 0 0 6px rgba(255, 122, 162, .15)`): animated attention on the studying banner and unread letters.

### Named Rules
**The Pink Shadow Rule.** UI shadows are tinted raspberry. Only paper objects (notes, letters) cast neutral shadows, because they are "real" paper stuck onto the page.

## Shapes

Everything is round. Buttons, chips, tabs, presets and nav links are full pills (999px). Cards use 22px, modals 28px, tiles and letter cards 16px, fields 12–14px, and sticky notes stay crisp at 6–8px so they read as cut paper. Stitched dashed borders (2px dashed rose-rule) mark the top bar, fieldsets, game cards and the hero sticker ring. Paper objects tilt slightly: the love note −1.5°, an opened letter −0.6°, the washi tape −3°.

### Named Rules
**The Stationery Tilt Rule.** Only paper objects (notes, letters, tape) rotate at rest, and only by 3° or less. Controls never rotate at rest. They may tilt on hover as a playful response.

## Components

Soft, bouncy and candy-like. Everything should feel nice to press.

### Buttons
- **Shape:** full pill (999px), Quicksand 700.
- **Primary:** 135° gradient bubblegum → raspberry, white text, button-lift shadow. Hover raises 1px and deepens the shadow. Active squishes to scale(.95). `big` is 14px 30px, 18px, min-width 190px.
- **Ghost:** blush fill with raspberry text, hover #ffd3e1. Used for secondary actions and square icon buttons (42–48px).
- **Tiny:** lilac-mist with lilac-ink, 13px. Used for small utility actions.
- **Icon button:** a 38px blush circle that rotates 60° on hover (the settings gear).

### Chips
- **Style:** a filled bubblegum pill with white 700 13px text. `soft` is blush with raspberry text. The chip follows the timer phase color (mint or violet).
- **Badges:** a lilac-mist pill with lilac-ink 11px text ("coming soon").

### Cards / Containers
- **Corner Style:** 22px.
- **Background:** translucent white (#ffffffee) with a 2px white edge.
- **Shadow Strategy:** card glow (see Elevation).
- **Paper variant:** ruled lines of ruled-blue every 32px with a 2px margin-pink line at 54px, used for the hero.
- **Internal Padding:** 22px (16–18px on phones).

### Inputs / Fields
- **Style:** white fill, 2px rose-rule stroke, 14px radius, 10px 14px padding, no outline.
- **Focus:** the border shifts to bubblegum.
- **PIN input:** centered, 24px, 6px letter-spacing.
- **Letter textarea:** lined like the notebook (30px rule) and written in Patrick Hand 20px.

### Navigation
- **Top bar:** sticky, rgba(255, 247, 250, .8) with a 10px backdrop blur and a 2px dashed rose-rule bottom border. The brand is a beating heart plus a 26px Patrick Hand wordmark in raspberry. Nav links are 14px 600 plum pills that fill blush on hover, and they hide below 600px.
- **Segmented tabs:** a petal track with white raised active pills in raspberry (phase tabs). The admin version uses a white track with the card glow.

### Pomodoro Ring (signature)
A 270px SVG ring (14px stroke, round cap) over a blush track. The stroke color is the phase signal: bubblegum for focus, break mint, rest violet. The countdown uses Timer type in the center and gently pulses (scale 1.03) while running. Cycle progress shows as emoji dots that go from greyscale to full color.

### Letter Card & Sticky Note (signature)
Letters are sticky-cream tiles with a sticky-edge border. Unread letters switch to blush with a bubblegum border, a raspberry dot and a pulse glow. Locked letters show their preview in lilac-ink. Opened, a letter is a tilted cream note in Patrick Hand 22px with a paper-drop shadow.

### Water Glasses (signature)
These are little drawn glasses: a 30×38px open-top outline in #a8d4f5. Each one fills with a blue gradient on a springy cubic-bezier(.3, 1.6, .5, 1).

### Modal & Toast
- **Modal:** a 28px-radius white box with a 4px blush border and modal bloom over a plum blur scrim. It enters with `pop` (scale .6 → 1, overshoot), and its emoji wobbles.
- **Toast:** a white card with a 6px bubblegum left edge. It slides in from the right and stacks bottom-right.

## Do's and Don'ts

### Do:
- **Do** write anything personal (letters, greetings, reminders, sweet notes) in Patrick Hand, and keep controls in Quicksand.
- **Do** build new surfaces from stationery: ruled paper, sticky-cream notes, washi tape, dashed stitched borders, emoji stickers.
- **Do** keep every interactive element a pill or a very round shape, with the squish (scale .95) on press and a lift or tilt on hover.
- **Do** tint shadows raspberry, and keep neutral drop shadows for paper objects only.
- **Do** dim and lock playful areas while she studies (`body.is-studying`), as the games corner does now.
- **Do** keep the `prefers-reduced-motion` kill-switch covering every new animation.

### Don't:
- **Don't** let it look like an office or SaaS dashboard: no grey palettes, square corners, dense tables or cold neutral chrome.
- **Don't** make it childish. It's a university student's notebook, so keep type sizes, density and copy grown-up rather than toy-like.
- **Don't** use pure black or grey text. Use plum-ink and dusty-plum.
- **Don't** use break mint or rest violet for decoration. They mean break phases.
- **Don't** add competing motion near the timer while she studies. One gentle pulse is the ceiling.
