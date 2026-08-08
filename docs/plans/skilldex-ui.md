# Skilldex UI — implementation plan (from mockup)

## Context

The maintainer designed a target UI in Claude Design:
**"Skilldex UI mockups"** → `Skilldex.dc.html`
(source: https://claude.ai/design/p/94084067-8d96-4195-90f8-de5ec1fdc2fd?file=Skilldex.dc.html).

It is a **complete visual redesign** of the current light-theme dashboard into a dark,
editorial developer-tool look. This plan captures the design language and a phased path to
implement it in the existing React 19 + Tailwind v4 + shadcn/ui renderer, consuming the
`SkillWorkspace` seam already built in Phase 1. `support.js` in the mockup is only the
Claude Design (`x-dc`) React runtime — reference for behaviour, nothing to port.

## Design language (extracted tokens)

- **Theme:** dark. Page `#050506` with a radial orange glow (`1200px 700px at 20% -10%,#1a130b → #050506`). App surface `#09090b`.
- **Surfaces:** sidebar `#0b0b0d`; cards `#101013`; inputs/dialog `#111114`; code panels `#0c0c0e`.
- **Borders:** `#27272a` (default), `#232328` (cards), `#1c1c20` / `#17171a` (dividers).
- **Text:** `#fafafa` headings · `#e4e4e7`/`#d4d4d8` primary · `#a1a1aa` body · `#71717a` muted · `#52525b` faint.
- **Accent (orange):** `#f97316` primary, `#ea580c` hover, `#fb923c` light; tint bg `#1a1109`/`#2a1709`, tint border `#4a2a10`.
- **Status:** success `#22c55e`; danger `#f87171` on `#3f2020`/`#1e1010`.
- **Icon badges (per skill):** deterministic pairs, e.g. `#2a1c0e/#fb923c`, `#0e1f2a/#38bdf8`, `#131f12/#4ade80`, `#1e0e2a/#c084fc`, `#2a0e17/#fb7185`, `#0e2a24/#2dd4bf`.
- **Radii:** buttons/inputs 9px, badges 6–7px, cards 11–13px, dialog 16px.
- **Type:** UI = **Space Grotesk** (400–700); mono (paths, counts, code, ⌘K) = **JetBrains Mono** (400–600).

### Fonts — bundle, don't CDN
The mockup pulls Google Fonts over the network. A desktop app should ship fonts offline:
add `@fontsource-variable/space-grotesk` and `@fontsource-variable/jetbrains-mono` (the repo
already uses `@fontsource-variable/geist`) and import them in `src/main.tsx`.

### Theming approach
Drive everything through Tailwind v4 CSS variables in `src/index.css` (the shadcn token set):
set the dark palette + `--primary` to orange, add `--font-sans`/`--font-mono`. Force dark
(`<html class="dark">`) — this app is dark-only. Replace the current hardcoded slate/`#f8f8fa`
utility classes in the components accordingly.

## shadcn components to add

Present: button, input, badge, separator, tooltip. Add via the shadcn CLI:
`dialog`, `tabs`, `switch`, `textarea`, `avatar`, `scroll-area`, `dropdown-menu`.

## Screen & component inventory

Feature-folder layout (matches existing `src/features/*`):

- **Window chrome** (`src/features/navigation/ui/titlebar.tsx`) — traffic-light bar + centered
  "Skilldex". Make the Electron window frameless to match: `titleBarStyle: 'hiddenInset'` (mac)
  in `electron/main/index.ts`, with a `-webkit-app-region: drag` strip. (Optional; can keep the
  native frame for v1 and skip the fake lights.)
- **Sidebar** (`navigation/ui/sidebar.tsx`, rework) — orange gradient logo; search field with
  `⌘K`; **Library** nav (All / Global / Plugins / Projects / Favourites) with counts + active
  orange left-border state; **Projects** list (colour dot + name + skill count from snapshot);
  user footer (avatar, "Local machine", settings).
- **Library view** (`features/library/ui/library-view.tsx`) — header (heading + scope pill +
  subheading + **New Skill** button), filter tabs with counts + sort control, and a **2-col
  responsive card grid**.
- **SkillCard** (`features/skills/ui/skill-card.tsx`, replaces `skill-list.tsx`) — mono icon
  badge, name + scope pill, mono path, **enable toggle**, description, tags, file count.
- **Skill detail** (`features/skills/ui/skill-detail.tsx`, NEW) — back link; header (big badge,
  name, scope pill, description, Edit); tabs (Instructions / Files / Activity); **SKILL.md
  preview**; right meta panel (Status switch, Details k/v, Installed-at path, **Reveal in
  Finder**, **Uninstall**).
- **CreateSkillDialog** (`features/skills/ui/create-skill-dialog.tsx`, NEW) — name, description,
  Global/Project scope selector, Cancel / Create.

## Data mapping to the `SkillWorkspace` seam

The redesign is renderer-side; it reads the same snapshot. A few fields the mockup shows need
small, additive extensions (kept behind the existing seam):

| Mockup field | Source today | Action |
| --- | --- | --- |
| name, description, scope, path, enabled, projects | `SkillRecord` (Phase 1) | reuse |
| mono initials, icon colours | derive in renderer from `name`/`id` | extend `accentFor` |
| file count, size | scan skill dir | add `fileCount`/`sizeBytes` to `SkillRecord` |
| SKILL.md body (Instructions tab) | full `SKILL.md` | add `workspace.getSkillReadme(id)` seam op (lazy) |
| Files tab list | skill dir listing | add `workspace.listSkillFiles(id)` (lazy) |
| Reveal in Finder | — | add `workspace.revealSkill(id)` → `shell.showItemInFolder` |
| tags, version, "Used Xd ago" | not on disk | Supabase metadata / omit for v1 (Phase 3) |

### Scope model reconciliation (open question)
The mockup uses **two** scopes (Global / Project); our model has **three** source kinds
(Personal / Plugin / Project). Proposed mapping: **Global = Personal**, add a distinct
**Plugins** filter (plugin skills are read-only/managed differently), keep **Project**. Confirm
with the maintainer before finalizing filter labels.

## Phased delivery

1. **UI-1 Foundations** — bundle fonts; dark + orange token set in `index.css`; force dark;
   add the shadcn components above. No behaviour change.
2. **UI-2 Shell** — titlebar (optional frameless) + redesigned sidebar wired to snapshot
   counts/projects and nav filtering.
3. **UI-3 Library** — library header, filter tabs, SkillCard grid on real data; search moves
   into the sidebar. (Read-only; toggle is visual until UI-5.)
4. **UI-4 Detail** — detail view + `getSkillReadme` / `listSkillFiles` / `revealSkill` seam
   ops; Instructions/Files tabs on real content.
5. **UI-5 Actions** — wire enable toggle, New Skill dialog, Uninstall to Phase 2 `SkillManager`
   (confirm dialogs for destructive writes). Tags/version/used come with Phase 3 (Supabase).

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` stay green.
- `npm run dev`: dark UI renders; real skills appear as cards; nav/filter/search work; opening
  a card shows the SKILL.md detail; New Skill dialog opens.
- Visual diff against the mockup for the library and detail screens.
- `npm run build` + `npm run package` succeed with bundled fonts (no network font fetch).
