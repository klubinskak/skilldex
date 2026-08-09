# Favourite skills — build plan

## Goal

Let a user mark any skill as a favourite with a heart toggle and browse a
dedicated **Favourites** tab. Favourites are personal, global (not per-project),
and persist **entirely in local files** — no external service, no cloud, no
server.

## Scope

- A heart toggle on the skill card and in the skill detail pane.
- A global set of favourited skills persisted to local disk.
- A **Favourites** tab in the sidebar showing only favourited skills.
- The favourite state survives enabling/disabling a skill.

## Out of scope (v1)

- Manual reordering of favourites (favourites list is alphabetical for now).
- Per-project favourite sets.
- Syncing favourites across machines.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Storage | Add `favourites: string[]` to the existing `WorkspaceConfig` / `config.json` in `app.getPath('userData')`, written through `createConfigStore`. | Reuses the one local-persistence seam; `normalize()` migrates old files for free (default `[]`); lives in `userData`, so it survives app updates. No new dependency. |
| Write safety | Harden `ConfigStore.save()` to write a temp file then `fs.rename` over the target (atomic). | Favourites are written on every heart click — far more often than config today — so a crash mid-write must not corrupt `config.json`. The current `save()` does a direct `fs.writeFile` (`electron/main/workspace/config.ts:26`). |
| Key | Store a **`.disabled/`-normalized realPath** as the favourite key. | A skill's id is its `realPath`, which changes when it is disabled (dir moves into `.disabled/`). Normalizing the key keeps one identity across enable/disable so the heart never silently empties. |
| Uninstall | Removing a skill from disk also removes it from favourites. | A deleted skill can't be a favourite; prune it so the set doesn't accumulate dead keys. |
| Disabled skills | The Favourites tab shows disabled favourites too, with their normal disabled styling. | The tab means "my starred skills," independent of enabled state. |
| Order | Alphabetical (reuse the existing snapshot sort). | Simple and stable for v1; manual reorder is a fast-follow. |
| Renderer contract | Add `isFavourite: boolean` to each `SkillRecord` in the snapshot; add one IPC `toggleFavourite(id)` that persists and returns the fresh snapshot. | Mirrors the existing `enableSkill` / `disableSkill` shape; cards get heart state directly off the snapshot. |
| Scope & UI | Global set; heart toggle on card + detail; separate **Favourites** tab in the sidebar. | Matches the "reach-for-these" mental model and the existing `FilterKey` nav pattern. |

## Technical shape

Main process (`electron/main/workspace/`):

- `types.ts` — add `favourites: string[]` to `WorkspaceConfig` (default `[]`);
  add `isFavourite: boolean` to `SkillRecord`.
- `config.ts` — extend `normalize()` to carry `favourites`; make `save()` atomic
  (write `*.tmp`, then `fs.rename`).
- A small `favourite-key.ts` helper: `favouriteKeyFor(realPath)` that strips a
  `.disabled/` segment, plus `isDisabledPath` reuse from `skill-manager.ts`.
- `skill-workspace.ts` — in `buildSnapshot`, stamp `isFavourite` on each record
  from the persisted set (compared by normalized key). Add
  `toggleFavourite(id)`: resolve the known skill, flip its normalized key in the
  config's `favourites`, save, rebuild the snapshot. In `removeSkill`, also drop
  the removed skill's key from `favourites`.

Seam:

- `electron/preload/index.ts` — expose `toggleFavourite(id)`.
- `electron/main/index.ts` — `ipcMain.handle('skilldex:toggle-favourite', …)`.

Renderer (`src/features/`):

- `skills/model/skills.ts` — mirror `isFavourite` on the renderer `SkillRecord`.
- `skills/model/use-workspace.ts` — add `toggleFavourite(id)` via the `mutate`
  helper.
- `skills/ui/skill-card.tsx` + `skills/ui/skill-detail.tsx` — heart button
  (`lucide-react` `Heart`, filled when `isFavourite`) calling `toggleFavourite`.
- `navigation/ui/sidebar.tsx` — add `'favourites'` to `FilterKey`, a `Heart` nav
  item, and its count.
- `dashboard/dashboard.tsx` — handle the `favourites` filter (show only
  `isFavourite` skills); empty state when none are favourited.

## Delivery order

1. Domain + persistence: `favourites` on config, atomic `save()`, the key helper
   (with unit tests in `config`/`favourite-key`).
2. Workspace: `isFavourite` stamping, `toggleFavourite`, prune-on-remove (tests
   in `skill-workspace.test.ts`).
3. Seam: preload + IPC wiring.
4. Renderer: model + `use-workspace`.
5. UI: heart toggle on card/detail, sidebar tab, dashboard filter + empty state.

## Acceptance target

A user can click the heart on any skill to favourite it, see it in a Favourites
tab, still see it there (and still hearted) after disabling and re-enabling it,
have it drop from favourites when the skill is uninstalled, and find all of this
preserved after quitting and reopening the app — with the data living only in a
local file.

## Testing notes

- Persistence: favourite → reload snapshot → still favourited; old `config.json`
  without the field loads with `favourites: []`.
- Key stability: favourite an enabled skill, disable it, assert `isFavourite`
  stays true and the tab still lists it.
- Prune: favourite then `removeSkill`, assert the key is gone from config.
- Atomic write: `save()` leaves no `*.tmp` behind and rewrites in place.
