# Kalp Design System

> Visual identity, design decisions, and component architecture for the Kalp landing page and brand.

---

## Design Philosophy

Kalp's visual identity is built on three principles:

1. **Dark by default** — The product runs at the Edge, in the dark. The UI follows. No light mode.
2. **Glass over pigment** — Surfaces are translucent, layered, ethereal. Nothing feels solid. This communicates the "serverless/edge" nature of the product — infrastructure that's there but invisible.
3. **Typography as hierarchy** — No heavy hero images or illustrations. The story is told through code, terminal output, and carefully weighted text. The developer should feel like they're looking at their own IDE.

---

## Color System

### Mode

Dark-only. The root element MUST have `class="dark"` forced globally. No toggle.

### Token Reference

All tokens use the OKLCH color space (perceptual uniformity, wider gamut).

| Token | Dark Value | Usage |
|-------|-----------|-------|
| `--background` | `oklch(0.145 0 0)` | Page bedrock |
| `--foreground` | `oklch(0.985 0 0)` | Primary text |
| `--card` | `oklch(0.205 0 0)` | Elevated surfaces |
| `--card-foreground` | `oklch(0.985 0 0)` | Card text |
| `--muted` | `oklch(0.269 0 0)` | Secondary backgrounds |
| `--muted-foreground` | `oklch(0.708 0 0)` | Secondary text |
| `--border` | `oklch(1 0 0 / 10%)` | Subtle borders |
| `--primary` | `oklch(0.922 0 0)` | Interactive elements |
| `--accent-blue` | `oklch(0.488 0.243 264.376)` | Brand accent, glows |
| `--radius` | `0.35rem` | Base radius (~5px) |

### Why OKLCH?

HSL is broken — equal lightness values produce vastly different perceived brightness across hues. OKLCH fixes this. The `c` (chroma) and `h` (hue) channels let us tint surfaces predictably without muddying luminance.

### Background Composition

The page background is a **three-layer composite**, not a flat color:

```
Layer 1: Radial gradient (1200px) at 20% -10%
         rgba(82, 95, 127, 0.16) → transparent
Layer 2: Radial gradient (900px) at 80% 10%
         rgba(77, 90, 136, 0.1) → transparent
Layer 3: Linear gradient 180deg
         #060708 → #050608 → #030405
```

This creates two subtle blue-tinted glows on a near-black gradient foundation. The glows suggest depth and atmosphere without distracting.

---

## Glassmorphism System

### The `studio-glass` Utility

```css
border: 1px solid rgba(255, 255, 255, 0.1);
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(24px);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.06),
  0 20px 60px -34px rgba(17, 24, 39, 0.95);
```

**Why this works:**
- `rgba(255,255,255,0.03)` is barely there — the card inherits the background beneath
- `blur(24px)` is heavy enough to blur anything layered behind it *while maintaining legibility of content on top*
- The `inset` shadow creates a subtle top rim light (simulating light from above)
- The outer shadow is deep and dark (`rgba(17,24,39, 0.95)`) — this gives the card "weight" so it floats above the background instead of looking like a transparent ghost

### Hover State

```css
border-color: rgba(255, 255, 255, 0.2);
background: rgba(255, 255, 255, 0.06);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.1),
  0 26px 80px -40px rgba(56, 72, 110, 0.75);
transition: all 300ms;
```

On hover, the card becomes slightly more opaque, the border brightens, and the shadow shifts from dark/neutral to blue-tinted (the accent color bleeding in). This signals interactivity while staying true to the glass metaphor.

### Halo Effect

```css
background: radial-gradient(
  circle at center,
  rgba(30, 64, 175, 0.22),
  rgba(15, 23, 42, 0.04) 45%,
  transparent 75%
);
filter: blur(22px);
```

Used as decorative background elements. The blue (hue ~220) matches the accent blue's hue family (264°). Placed behind hero text or section headers to create atmospheric depth.

---

## Typography

### Font Stack

| Role | Font | Source |
|------|------|--------|
| Sans (`--font-sans`) | **Geist Variable** | `@fontsource-variable/geist` |
| Mono (`--font-mono`) | **Geist Mono Variable** | `@fontsource-variable/geist-mono` |

Geist is Vercel's typeface — designed specifically for screen reading at small sizes. It has tight vertical metrics and crisp terminals that work well at 11px labels and 24px headlines alike.

### Size Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| Label | 11px | 400 | Section labels, uppercase, 0.18em tracking |
| Secondary | 12px | 400 | Metadata, timestamps, secondary info |
| Body | 14px | 400 | Paragraphs, descriptions |
| Card title | 16px | 600 | Feature card titles |
| Section H2 | 28-36px | 600 | Section headings |
| Hero H1 | 48-64px | 600 | Main headline |

### Metal Text Effect

```css
background: linear-gradient(
  120deg,
  #e5e7eb 0%,
  #a1a1aa 35%,
  #f4f4f5 55%,
  #a1a1aa 78%,
  #d4d4d8 100%
);
-webkit-background-clip: text;
background-clip: text;
color: transparent;
```

**Why:** Pure white text on dark backgrounds creates uncomfortable contrast. A metallic gradient adds visual interest while keeping the overall luminance high. The gradient mimics brushed metal — suggesting precision, engineering, and quality. Applied to H1s, H2s, and important labels.

---

## Spacing & Layout

- **Container max-width**: 1280px, centered
- **Section spacing**: `py-24 md:py-32` (96px-128px vertical padding)
- **Card padding**: `p-5` (20px)
- **Grid gap**: `gap-4` (16px) — matches the Studio app
- **Border radius**: **5px (`0.35rem`) dominant** — buttons, cards, badges, inputs, code blocks, tiles

**Radius rationale:** 5px is small enough to feel technical and precise (developer tools should not look "cute"), but large enough to soften the edges. Compare to macOS (~8px), iOS (~14px), or material (~12px). The smaller radius communicates "this is a tool, not a toy."

---

## Component Architecture

### Navigation

Fixed position, backdrop blur, transparent until scroll. Uses `rgba(0,0,0,0.45)` background so content bleeds through slightly. Bottom border `white/10` anchors it without a solid edge.

### Glass Cards

The fundamental building block. Used for features, code blocks, terminal windows, stat pills, CTA buttons. Everything is a card.

### Code Blocks

Styled as dark code windows (`#1e1e1e` or `black/35` background) with:
- Subtle top bar (macOS-style traffic light dots or a simple thin accent line)
- Monospace font (Geist Mono)
- Syntax highlighting (blue for keywords, green for strings, orange for functions, yellow for variables)
- Optional line numbers in `text-zinc-600`

### Buttons

Two tiers:
1. **Primary**: Glass style, border-white/10, bg-white/5, hover bg-white/10, 14px, 12px 24px padding
2. **Secondary / Ghost**: text-muted-foreground, hover:text-foreground, subtle transition

### Badges / Labels

`text-[11px] uppercase tracking-[0.18em] text-zinc-500`. The default label style for section headers. The extreme tracking and small size make them read as "metadata" — they frame content without competing with it.

---

## Iconography

Use **Lucide React** throughout. Standard sizes:
- Inline / button icons: `h-4 w-4` (16px)
- Feature card icons: `h-5 w-5` (20px)
- Section decorative icons: `h-6 w-6` (24px)

Consistent stroke width (Lucide's default 2px). Icons are always secondary to text — they support, never lead.

---

## Animation Philosophy

Minimal and purposeful:

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Cards hover | translateY(-1px) + border/shadow | 300ms | ease-out |
| Hero glows | Slow pulse (opacity) | 5-8s cycle | ease-in-out |
| Sections on scroll | fade-in + translateY(20px) | 600ms | ease-out |
| Nav on scroll | Background opacity 0 → 0.45 | 200ms | ease-out |

**Rule:** If the animation doesn't communicate something (interactivity, hierarchy, or state), remove it.

---

## Responsive Strategy

| Breakpoint | Layout Changes |
|------------|----------------|
| < 640px | Single column, stacked, hamburger nav |
| 640px+ | 2-column grids, visible nav links |
| 1024px+ | Full layout, 3-column grids, side-by-side hero |
| 1280px+ | Container max-width caps at 1280px |

The glass card system is naturally responsive — cards stack vertically at small sizes, grid at larger ones.

---

## Implementation Notes

### Tailwind CSS v4 Setup

Use `@tailwindcss/vite` plugin. Declare utilities with `@utility` directive (Tailwind v4 syntax).

### Font Loading

Import via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`. These packages self-host the font files — no external requests at runtime.

### Dark Mode

```html
<html class="dark">
```

No media query. No toggle. Kalp is dark.

### Deployment

Static site output. Can be served from:
- Cloudflare Pages
- Vercel (with `@vercel/static-build`)
- Netlify
- The existing Kalp Cloudflare Worker (as static assets)

---

## References

- Design tokens extracted from `apps/studio/src/styles.css`
- Component patterns from `apps/studio/src/routes/_studio.index.tsx`
- CLI UX from `packages/cli/src/index.ts`
- SDK API from `packages/sdk/src/index.ts`
- Brand copy from `README.md` and `packages/cli/package.json`
