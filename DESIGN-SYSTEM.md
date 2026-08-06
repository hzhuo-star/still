# Still Design System

Still is a reading-first social product. It should feel finite, quiet, and intentional: closer to a thoughtful daily edition than an attention-maximizing feed.

This system is distilled from the approved **Still** design direction and is the implementation source of truth.

## 1. Product principles

### Attention is the scarce resource

- Show a finite feed and clearly communicate its size.
- Prefer direct labels such as **Like** over euphemistic or gamified language.
- Keep metrics visually secondary. The post itself should always carry more contrast than its engagement count.
- Avoid auto-playing media, pulsing indicators, streaks, and urgency colors.

### Reading comes before reacting

- Give the feed a narrow `610px` reading measure.
- Use serif type for authored thoughts and discussion prompts.
- Separate posts with rules and whitespace instead of containers and shadows.
- Keep primary actions available but visually quiet until hover or focus.

### Calm does not mean vague

- Maintain strong text contrast and obvious keyboard focus.
- Use the sage accent for selected, focused, and affirmative states.
- Use direct, human language. Short labels are preferable to icons with unclear meaning.

## 2. Foundations

### Color

| Token | Value | Tailwind utility | Use |
| --- | --- | --- | --- |
| Canvas | `#F7F8F5` | `bg-canvas` | App background |
| Surface | `#FFFFFF` | `bg-surface` | Composer, menus, elevated controls |
| Ink | `#202522` | `text-ink` | Primary text and high-emphasis controls |
| Muted | `#6B726C` | `text-muted` | Metadata and tertiary actions |
| Line | `#DDE1DC` | `border-line` | Dividers, control boundaries |
| Sage | `#567362` | `bg-sage`, `text-sage` | Focus, selection, affirmative actions |
| Sage soft | `#E5ECE7` | `bg-sage-soft` | Avatars, selected backgrounds, system cards |
| Danger | `#9B3B3B` | `text-danger`, `bg-danger` | Destructive actions and error text |
| Danger soft | `#F5E9E7` | `bg-danger-soft` | Restrained error backgrounds |

Use color semantically. Do not introduce a bright brand color for routine engagement. Danger is reserved for destructive actions and errors; Sage remains the product accent and affirmative color.

### Typography

The system uses OS-native fonts so it stays fast and unstyled by external brand assets.

- **Interface:** system sans (`font-sans`) for navigation, metadata, controls, and labels.
- **Reading:** Georgia (`font-reading`) for posts, prompts, quotes, and editorial headings.
- **Title:** `text-title` — 32/38px, regular reading face.
- **Post:** `text-reading` — 18/30px, regular reading face.
- **Body:** `text-body` — 15/25px.
- **Meta:** `text-meta` — 11/15px.
- **Label:** `text-label` — 12/16px, uppercase only for short section labels.

Avoid bold post text and oversized display typography. The quiet contrast between sans interface text and serif authored text is the main typographic signature.

### Spacing

Use Tailwind's default 4px spacing grid. The most common values are:

| Role | Value | Utility examples |
| --- | --- | --- |
| Tight inline gap | 8px | `gap-2` |
| Avatar/content gap | 10–12px | `gap-2.5`, `gap-3` |
| Control inset | 12–16px | `px-3`, `p-4` |
| Card inset | 16–18px | `p-4`, `px-[18px]` |
| Post vertical rhythm | 27–28px | `py-7` |
| Section separation | 32–40px | `mb-8`, `gap-10` |
| Desktop column gap | 40–70px | `gap-10`, `gap-layout` |

When the exact proposal value is not available in the default scale, choose the nearest 4px step before using an arbitrary value.

### Shape and depth

- Standard card radius: `12px` / `rounded-card`.
- Buttons and chips: fully rounded / `rounded-pill`.
- Avatars: fully rounded.
- Posts: no card background and no radius; use a top divider.
- Shadows are exceptional. If an overlay needs separation, use `shadow-float`, never a heavy or colored shadow.

### Motion

- Default duration: `150ms`.
- Larger reveal duration: `200ms`.
- Use the `ease-still` curve.
- Animate opacity, color, and small translations only.
- Respect `prefers-reduced-motion` and never animate the feed merely to create activity.

## 3. Layout

### Desktop

The application shell is three columns:

| Region | Width | Behavior |
| --- | --- | --- |
| Primary navigation | `190px` | Sticky |
| Feed | `610px` | Reading column |
| Context rail | `220px` | Sticky, secondary |
| Column gap | `70px` | Open whitespace |
| Maximum shell | `1160px` | Centered |

### Responsive behavior

- **Below 1000px:** remove the context rail; keep navigation and feed.
- **Below 800px:** collapse to one column and turn navigation into a sticky, compact top bar.
- **Below 640px:** use 16–18px page gutters and preserve at least 44px touch targets.
- Do not widen post text to fill available space on large screens.

## 4. Components

### Navigation item

- Default: muted text, transparent background.
- Hover: Ink text.
- Active: Ink text plus a short Sage rule or dot.
- Do not use a filled pill for every item; the layout should remain visually open.

### Primary button

- Sage background, white text, pill shape.
- Compact rather than oversized: typically `32–40px` high.
- Hover should darken the Sage slightly; focus uses a visible Sage ring with Canvas offset.

### Secondary button

- Surface background, Line border, Ink text.
- Use for optional or navigational actions, never as a competing primary action.

### Composer

- Surface background, Line border, `12px` radius.
- Minimal placeholder language: “Leave a thought here…”
- Privacy or audience information belongs in muted footer text.
- The publish action is compact and aligned to the trailing edge.

### Post

- No enclosing card. Separate posts with a single Line divider and `28px` vertical padding.
- Author avatar: `34px` circular Sage-soft field.
- Author name: small sans, medium weight.
- Metadata: Meta size and Muted color.
- Post content: Reading font at `18/30px`.
- Actions: small sans labels in Muted; transition to Sage on hover, focus, or selection.

### Quote

- Reading italic at `16/25px`.
- `2px` Sage left rule and `18px` left padding.
- Use for real quoted material or author-selected emphasis—not decoration.

### Context card

- Sage-soft background with standard radius.
- Suitable for system notes, onboarding, or gentle contextual help.
- Keep it informational; do not place the page's primary call to action inside it.
- In the desktop context rail, use one “About Still” card explaining that the Feed is finite and updates live. Do not add trends, recommendations, or engagement rankings.

## 5. Interaction and accessibility

- All interactive controls need a visible `focus-visible` ring.
- Maintain a minimum 44×44px target on touch layouts, even when the visual control is smaller.
- Do not communicate selected state by color alone; update the label or add a persistent marker.
- Engagement counts should be announced with descriptive accessible names, such as “64 likes.”
- Preserve authored line breaks and support 200% text zoom without horizontal scrolling.
- User preferences for reduced motion and increased contrast take priority over brand motion and muted styling.

## 6. Voice

Still's writing is plain, warm, and specific.

| Prefer | Avoid |
| --- | --- |
| “Write a thought” | “Create content” |
| “Like” | “Smash like” |
| “Keep” | “Bookmark item” |
| “You’re caught up” | “Nothing else to show” |
| “18 notes today” | “Keep scrolling” |

No engagement bait, artificial urgency, or corporate cheerfulness.

## 7. Tailwind assets

- [`tailwind-theme.css`](./tailwind-theme.css) is the primary Tailwind v4 theme. Import it once as the application's Tailwind entry CSS.
- [`tailwind.preset.cjs`](./tailwind.preset.cjs) provides the same system for Tailwind v3 projects.

Example:

```html
<article class="border-t border-line py-7">
  <p class="font-reading text-reading text-ink">
    A thoughtful post belongs here.
  </p>
  <button class="mt-4 min-h-touch text-meta text-muted transition-colors ease-still hover:text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
    Like · 64
  </button>
</article>
```

## 8. Design review checklist

- Is reading the strongest visual action on the screen?
- Is every metric quieter than the content it describes?
- Does the page have a clear end or stopping point?
- Can any card, border, label, or icon be removed without losing meaning?
- Are Sage and Sage-soft reserved for meaningful state and context?
- Does the interface remain clear without animation?
- Does mobile preserve the calm reading measure and adequate touch targets?
