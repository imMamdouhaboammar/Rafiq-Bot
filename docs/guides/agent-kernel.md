# Agent Kernel maintainer workflow

Agent Kernel is optional local maintainer tooling. Rafiq must remain buildable and reviewable without committing Agent Kernel's machine-specific state.

## Project connection

Connect the local Rafiq checkout to Agent Kernel using the installed Agent Kernel client on the maintainer machine. Treat the repository identity as part of the connection: a different Git repository or clone lineage may map to a different project identity even when files look similar.

## Environment Vault

Use the Project Environment Vault for continuity of local `.env.local` and other eligible secret files. The repository should contain only variable names and safe placeholders in `.env.example` and `docs/configuration/env-reference.md`.

Never copy vault values into README files, issues, pull requests, terminal transcripts, screenshots, deployment URLs, or generated examples. Do not work around a vault or filesystem protection that refuses a secret transfer; record the blocked continuity step instead.

## Verification

Before release review, verify the project connection is healthy and inspect vault status without printing values. Run `bun run security:scan` after any environment or documentation work. Agent Kernel backups, global rules, and local paths are not repository artifacts and are ignored by the project.
