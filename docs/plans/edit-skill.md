# Edit a skill's SKILL.md — build plan

## Goal

Let a user fully edit a skill's `SKILL.md` from inside Skilldex. The existing
disabled **Edit** button in the skill detail header opens a modal containing the
**entire raw `SKILL.md`** (frontmatter + body) in one editable textarea; saving
writes it back to disk and refreshes the library. No external service, no cloud
— the file on disk is the single source of truth.

## Scope

- Enable the Edit button in `skill-detail.tsx` for manageable skills.
- A modal (mirroring `create-skill-dialog.tsx`) with one monospace textarea
  pre-filled with the raw `SKILL.md`, plus Save / Cancel.
- An atomic write of the edited content back to `realPath/SKILL.md`.
- A fresh snapshot after save, so a changed frontmatter `name`/`description`
  updates the card and detail view immediately.
- A dirty-check guard: closing with unsaved changes asks to confirm the discard.
- `Cmd/Ctrl+S` saves from within the modal.

## Out of scope (v1)

- Editing any file other than `SKILL.md` (scripts, references, etc.).
- Structured per-field editing of frontmatter (name/description as inputs) — the
  frontmatter reader is lossy and cannot re-serialize, so raw editing is the
  only lossless "full" edit. Structured editing is a possible fast-follow built
  on a proper YAML round-trip.
- Renaming/moving the skill's directory. Editing `name:` updates the displayed
  name only; identity stays fixed (see [ADR-0001](../adr/0001-skill-identity-is-its-directory.md)).
- External-change detection / merge (single-user local app; last-write-wins).
- Editing Plugin skills (owned by their plugin; already blocked).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Edit target | The whole raw `SKILL.md` (frontmatter + body) edited as one text blob. | The frontmatter parser (`frontmatter.ts`) is read-only and lossy — it knows only `name`/`description` and would drop other keys (`allowed-tools`, `disable-model-invocation`, `license`, …) on any re-serialize. Raw editing is the only "fully edit" that can't corrupt a skill and needs no new parser. |
| Surface | A modal dialog mirroring `create-skill-dialog.tsx`, opened by the existing Edit button. | The Edit button already sits in the detail header; a modal reuses the established dialog chrome/close/error pattern. |
| Editable set | Reuse `assertManageable` — Personal + Project skills, including disabled ones. Plugin skills keep the disabled Edit button. | Editing is meaningful regardless of enabled state; `getSkillReadme` already reads `realPath`, which resolves under `.disabled/`. Plugin skills are read-only here. |
| Identity | Content-only write; never rename the directory. `id`/`realPath` are stable. | `id` **is** `realPath` (`filesystem-source.ts:118`); renaming would orphan the favourite key, break symlinks, and invalidate project refs. See ADR-0001. |
| Validation | Light — block only an empty save; no frontmatter schema enforcement. | The scanner requires only that `SKILL.md` *exists* and falls back to the directory name when frontmatter has no `name` (`filesystem-source.ts:119`), so malformed frontmatter is recoverable, not destructive. An empty file is never intentional. |
| Write safety | Atomic write (temp file + `fs.rename`) to `realPath/SKILL.md`. | A crash mid-write must not truncate a real skill's `SKILL.md`. Matches the atomic `config.save` hardening. |
| Concurrency | Last-write-wins; no staleness diffing. Re-resolve the id through the `known` allow-list on save and surface a clean error if the skill is gone. | Single-user desktop app; the realistic failure is "uninstalled/moved while the modal was open," handled by the existing `mutate` catch. |
| Discard guard | Dirty-check: backdrop-click / Escape / Cancel confirms before closing only when the content diverged from what was loaded. | A whole-file edit is costlier to lose than the create dialog's few fields. |
| Renderer contract | One IPC `updateSkillReadme(id, content)` that writes and returns the fresh snapshot, wired through `use-workspace.mutate`. | Mirrors the existing `enableSkill` / `createSkill` mutation shape exactly. |

## Technical shape

Main process (`electron/main/workspace/`):

- `skill-manager.ts` — add `writeSkillReadme(skillDir, content)`: atomic write
  (`*.tmp` + `fs.rename`) of `SKILL.md` inside the given directory.
- `skill-workspace.ts` — add `updateSkillReadme(id, content)` to the
  `SkillWorkspace` interface: `resolveKnown(id)` → `assertManageable` → reject
  empty `content` → `writeSkillReadme(skill.realPath, content)` → rebuild and
  return the snapshot.

Seam:

- `electron/preload/index.ts` — expose
  `updateSkillReadme(id, content): Promise<WorkspaceSnapshot>`.
- `electron/main/index.ts` —
  `ipcMain.handle('skilldex:update-skill-readme', (_e, id, content) => workspace.updateSkillReadme(id, content))`.

Renderer (`src/features/`):

- `skills/model/use-workspace.ts` — add
  `updateReadme(id, content) = mutate((w) => w.updateSkillReadme(id, content))`.
- `skills/ui/edit-skill-dialog.tsx` (new) — modal modelled on
  `create-skill-dialog.tsx`: one monospace textarea, Save (disabled while empty
  or unchanged or submitting), Cancel, inline error, `Cmd/Ctrl+S` to save,
  dirty-check discard guard.
- `skills/ui/skill-detail.tsx` — un-disable the Edit button for `manageable`
  skills; on click, open the dialog seeded with the already-loaded `readme`;
  after a successful save, close the dialog and update the shown content.
- `dashboard/dashboard.tsx` (or wherever `SkillDetail` is composed) — pass the
  `updateReadme` handler down.

## Delivery order

1. Main: `writeSkillReadme` (atomic) + `updateSkillReadme` on the workspace,
   with unit tests.
2. Seam: preload + IPC wiring.
3. Renderer model: `updateReadme` via `mutate`.
4. UI: `edit-skill-dialog.tsx`, enable the Edit button, wire the handler.

## Acceptance target

A user can click Edit on any non-plugin skill, see the full `SKILL.md` in a
textarea, change anything (including `name`/`description`), save, and see the
card and detail update immediately — with the change persisted to the file on
disk and surviving an app restart. Editing works on disabled skills too. Closing
with unsaved changes asks first. The Edit button stays disabled for plugin
skills. An empty save is blocked.

## Testing notes

- `skill-workspace.test.ts`: `updateSkillReadme` writes new content and the
  rebuilt snapshot reflects a changed frontmatter `name`/`description`; rejects a
  Plugin skill; rejects an unknown id; rejects empty content; leaves `id`/
  `realPath` unchanged after an edit.
- `skill-manager` (or a focused test): the write is atomic — leaves no `*.tmp`
  behind and replaces in place; preserves unknown frontmatter keys byte-for-byte
  (round-trip a file with `allowed-tools` through the textarea content).
- Disabled skill: edit a skill parked under `.disabled/` and assert the write
  lands at its `realPath`.
