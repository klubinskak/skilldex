# My Skills — build plan

## Goal

Give the user a dedicated **My Skills** tab that shows the skills they own —
Personal skills that were made/kept locally rather than installed from a repo —
so their own work is easy to find among dozens of installed skills. Detection is
a pure derivation from data the app already has; no new persistence, no backend
change.

## Scope

- A **My Skills** tab in the sidebar (new `FilterKey`), with its own count.
- The tab lists **owned** skills: `scope === 'global'` (Personal) **and** no
  upstream `origin`.
- Owned skills are shown regardless of enabled/disabled state.
- An empty state when the user owns no local skills yet.

## Out of scope (v1)

- Detecting authorship of **Project** skills (would need git-blame / commit
  email matching — heavier and less reliable). Plugin skills are never owned.
- Stamping an `author` marker on skills the app creates (a future sharpening;
  see [ADR-0002](../adr/0002-owned-skills-detected-by-absent-origin.md)).
- Any change to the main process, the seam, or persisted config.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Definition | An **owned skill** is a Personal skill with no recorded upstream `origin`. | Skills carry no author metadata (spec has no `author`; 0/43 on disk use one), so absence-of-provenance is the only honest, retroactive signal. The app already resolves `origin`. See ADR-0002. |
| Detection site | Derive in the renderer via an `isOwned(skill)` helper in `skills.ts`; filter in the dashboard. | Ownership is pure derivation (unlike persisted `isFavourite`), so it belongs with the other derived view-filters (`disabled`, `all`). No main-process, seam, or config change. |
| Enabled state | The tab shows owned skills regardless of enabled/disabled; disabled ones render dimmed. Count includes all owned. | "My Skills" means "everything I made" — hiding a disabled one you authored would be surprising. Mirrors Favourites. |
| Additive vs exclusive | Additive: an owned skill still appears under **Global** too. Only Disabled is exclusive. | An owned skill genuinely *is* a global skill; removing it from Global would cause "where did my skill go?" confusion. Mirrors Favourites. |
| Label & placement | Sidebar tab labelled **My Skills**, placed after Favourites, icon `User` (lucide). | Fits the existing `Library` nav group and the reach-for-these grouping (All / Favourites / My Skills / …). |

## Technical shape

Renderer only (`src/features/`):

- `skills/model/skills.ts` — add `isOwned(skill: Skill): boolean` returning
  `skill.scope === 'global' && !skill.origin`. Single source of truth for the
  concept.
- `navigation/ui/sidebar.tsx` — add `'mine'` to `FilterKey`; add a `My Skills`
  nav item (`User` icon) after Favourites; it participates in `SidebarCounts`
  automatically (the type is `Record<FilterKey, number>`).
- `dashboard/dashboard.tsx`:
  - Add a `HEADINGS.mine` entry (title/subtitle/pill).
  - Add `{ key: 'mine', label: 'Mine' }` to `FILTERS`.
  - Count: `counts.mine = skills.filter(isOwned).length` (all owned, regardless
    of enabled — like `favourites`).
  - `visibleSkills`: when `filter === 'mine'`, show `skills.filter(isOwned)`
    (regardless of enabled), then apply the search filter as usual.
  - Empty-state copy for `mine` (e.g. "No skills of your own yet. Create one
    with New Skill, and it'll show up here.").

## Delivery order

1. `isOwned` helper + unit test in `skills.test.ts`.
2. Sidebar: `'mine'` FilterKey + nav item.
3. Dashboard: heading, filter tab, count, `visibleSkills` branch, empty state.

## Acceptance target

A user opens **My Skills** and sees exactly their locally-owned Personal skills
(those with no upstream source), including any disabled ones, with a matching
count in the sidebar. Installed skills (from GitHub repos or plugins) never
appear there. The same skills still appear under Global. A user with no local
skills sees a helpful empty state.

## Testing notes

- `skills.test.ts`: `isOwned` is true for a Personal record with no `origin`;
  false for a Personal record *with* an `origin`; false for plugin and project
  scopes.
- Manual: the three no-origin personal skills on the dev machine (`commit`,
  `explain-code`, `review-this`) appear under My Skills; installed ones (e.g.
  `find-skills`, `better-auth-best-practices`) do not.
