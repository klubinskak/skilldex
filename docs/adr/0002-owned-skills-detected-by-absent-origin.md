# "Owned" skills are detected by absent upstream origin, not authorship

The "My Skills" feature surfaces the skills a user owns. Skills carry **no
author metadata** — the skill spec has no `author` field and none of the skills
on disk use one — so provable authorship is impossible to read. We therefore
define an **owned skill** as a *Personal skill with no recorded upstream
`origin`* (`~/.agents/.skill-lock.json` has no entry, and it is neither a plugin
nor a project skill). This reuses the `origin` the app already resolves and
works retroactively on existing skills.

## Considered options

- **A frontmatter `author` field.** Rejected for detection: it does not exist in
  the spec or on disk, so it would identify nothing today. (Stamping authorship
  on skills the app *creates* is a possible future sharpening, additive to this.)
- **Git-blame / commit-email matching.** Rejected: only applies to skills under
  a git repo (project skills), needs the user's email plumbed through, and
  "authored a commit" ≠ "owns the skill."
- **Absence of upstream origin (chosen).** Zero new I/O, retroactive, matches
  the user's mental model of "skills that are mine, not installed."

## Consequences

The signal means "locally owned," not "provably written by this user" — a skill
copied in by hand with no provenance also counts. That is an acceptable, honest
approximation; the UI language avoids the word "author" accordingly.
