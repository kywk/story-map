---
name: Geo Story Map Website
description: Editorial travel journal for Markdown geographic stories.
colors:
  pine: "#244e3f"
  pine-deep: "#183d30"
  route: "#b6472b"
  paper: "#f5f2ea"
  surface: "#fffdf8"
  ink: "#203d35"
  ink-2: "#3f5148"
  muted: "#5b685e"
  line: "#cbd0c3"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Noto Sans TC, sans-serif"
    fontSize: "clamp(3.5rem, 6.8vw, 6rem)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, Noto Sans TC, sans-serif"
    fontSize: "clamp(2.1rem, 3.8vw, 3.5rem)"
    fontWeight: 550
    lineHeight: 1.12
  body:
    fontFamily: "Newsreader, Georgia, Noto Serif TC, Songti TC, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.8rem"
    lineHeight: 1.8
rounded:
  button: "5px"
  segment: "6px"
  code: "10px"
  frame: "12px"
spacing:
  compact: "8px"
  inline: "16px"
  control: "20px"
  group: "24px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.pine-deep}"
  frame:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.frame}"
---

# Design System: Geo Story Map Website

## Overview

**Creative North Star: "Editorial Travel Journal"**

Warm paper, pine ink, and a terracotta route accent frame geographic stories with an editorial reading rhythm. Sans-serif headings and controls sit beside serif prose; live maps provide the visual subject.

This record describes the introduction website in `site/`, extracted from `site/src/styles.css` and `site/src/App.tsx`. Embedded StoryMap renderer themes have their own implementation and are not website tokens.

**Key Characteristics:**

- Warm paper and restrained pine surfaces.
- Sans-serif navigation with serif reading text.
- Flat, bordered frames around real interactive maps.

## Colors

### Primary

Pine carries the main action and selected story; deep pine anchors the installation band and button hover.

### Secondary

Route terracotta marks the hero emphasis, link hover, and keyboard focus.

### Neutral

Paper is the page ground; surface is the brighter code and map-frame ground. Ink, secondary ink, and muted text establish reading hierarchy; line separates sections and controls. The installation band locally overrides secondary text, muted text, and divider colors for a dark background.

## Typography

The frontmatter records the main hierarchy. Bricolage Grotesque, Newsreader, and JetBrains Mono are requested through Google Fonts in `site/index.html`; they are not self-hosted. Chinese font families are local fallback stacks.

Hero emphasis uses italic body type in English. Traditional Chinese removes that italic and uses a smaller display clamp (`2.7rem` to `4.6rem`) with `1.3` line height; Chinese section headings use `1.35`. Code disables ligatures. The hero lede is limited to `42ch` on desktop and `60ch` at narrower widths.

## Layout

The centered shell caps at `1360px`, with fluid inline padding (`20px` to `64px`). Desktop hero, source examples, and installation instructions use asymmetric two-column grids. Sections use generous block spacing, reducing to `64px` at `800px`.

At `1100px`, navigation and column gaps tighten and feature items become one column. At `800px`, the navigation wraps, major grids stack, and feature items use two columns. At `500px`, features and story selectors stack, controls wrap, and the configuration table scrolls horizontally. Map frames retain explicit heights to support the embedded renderer.

Smooth anchor scrolling respects reduced-motion preferences by reverting to automatic scrolling.

## Elevation & Depth

Website chrome uses no box shadows. Paper, tinted bands, deep pine, one-pixel borders, and whitespace establish depth. This does not prescribe the embedded renderer's map controls or themes.

## Shapes

Small rounded buttons and segmented language controls contrast with larger clipped map frames and code panels. Thin borders supply structure; feature and FAQ rows use dividers instead of floating cards.

## Components

- **Buttons:** pine fill and light text, deep-pine hover, minimum `48px` height. Copy buttons use a paper fill, border, and inline success/error feedback.
- **Frames:** light surfaces and thin borders; a compact caption bar, live map, and supporting hint form the hero specimen.
- **Fields:** native theme/layout selects use a light fill, border, modest rounding, and minimum `40px` height.
- **Navigation:** sticky paper header; sans-serif links turn terracotta on hover. Language selection uses an ink-filled pressed state.
- **Story selector:** three desktop choices, a pine selected state, and stacked compact choices on phones.
- **Focus and disclosure:** visible terracotta outlines (`3px`, `4px` offset), a skip link, and native FAQ disclosures.

## Do's and Don'ts

### Do:

- Do retain the paper, pine, and route hierarchy across website sections.
- Do preserve bilingual line-height adjustments and visible keyboard focus.
- Do use live StoryMap rendering as the map demonstration.

### Don't:

- Don't treat embedded renderer themes as website palette variants.
- Don't describe Google Fonts requests as self-hosted assets.
- Don't replace the flat section structure with shadowed website cards.
