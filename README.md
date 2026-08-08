# Skilldex

Skilldex is a local-first dashboard for developers to discover, organize, and favourite their agent skills across global environments, projects, and Git repositories.

## Current foundation

- React, TypeScript, Vite, Tailwind CSS, and shadcn/ui
- Interactive overview dashboard with search and favourites
- Normalized sample catalog showing global, project, and repository skill sources
- A UI seam ready for a future `SkillWorkspace` module that discovers local skill directories and Git metadata

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run build
npm run lint
```

## Next implementation slice

Introduce a native filesystem adapter (Tauri is the intended shell) and a `SkillWorkspace` module. Its callers should only request a normalized workspace snapshot and send skill-change intents; directory walking, manifest parsing, Git inspection, and settings persistence remain inside the module.
