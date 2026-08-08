# Skilldex v1 build plan

## Goal

Deliver a local-first React + shadcn/ui dashboard that inventories agent skills found in global folders, project folders, and local Git repository clones.

## Scope

- Discover directories containing `SKILL.md`.
- Normalize a skill's name, description, source location, source kind, projects, and repository metadata.
- Show a searchable dashboard of discovered skills, projects, and repositories.
- Let people configure which global folders and project/repository roots are scanned.

## Out of scope

- Installing, copying, removing, or updating skills.
- GitHub authentication, remote repository browsing, cloud sync, teams, and marketplace publishing.

## Technical shape

- React, TypeScript, Tailwind, and shadcn/ui render the dashboard.
- Electron hosts the app. The React + shadcn/ui renderer never receives Node.js access.
- A context-isolated preload bridge exposes the `SkillWorkspace` module's two operations: read a normalized workspace snapshot and save configuration changes. Discovery, parsing, Git inspection, deduplication, and errors stay in the Electron main process behind that seam.
- Local filesystem and Git access are internal main-process adapters. Tests use fixture directories and a deterministic Git adapter rather than the host machine.

## Delivery order

1. Establish the desktop runtime and a clean feature-scoped shell.
2. Define the normalized domain model and fixture corpus.
3. Add native filesystem/Git capabilities and source configuration.
4. Implement global, project, and repository discovery adapters.
5. Aggregate discovery into a workspace snapshot.
6. Replace dashboard sample data with the snapshot and expose skills, projects, and repositories.
7. Test the workspace interface through fixtures and package a local build.

## Acceptance target

A developer can configure local source roots, scan them, and accurately answer: what skills exist, what each one does, where it lives, which project uses it, and which repository it came from.
