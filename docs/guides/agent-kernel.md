# Agent Kernel maintainer workflow

Agent Kernel is optional local maintainer tooling. Rafiq must remain buildable and reviewable without committing Agent Kernel's machine-specific state.

## Project connection

The repository includes `.agent-kernel/project.toml` as portable connection metadata for the public `imMamdouhaboammar/Rafiq-Bot` identity. It contains repository identity and safe Agent Kernel behavior flags only; local state, credentials, and vault paths remain outside Git.

Use `agent-kernel project status --json` and `agent-kernel project doctor` to verify the current checkout. Treat repository identity as part of the connection: `Rafiq-July` is a separate personal project and must not be used as the OSS vault or publication identity.

## Environment Vault

Use the Project Environment Vault for continuity of local `.env.local` and other eligible secret files. If an OSS checkout has no eligible environment files yet, `agent-kernel env link --allow-empty` can establish the repository-scoped vault identity without inventing or copying values. The repository should contain only variable names and safe placeholders in `.env.example` and `docs/configuration/env-reference.md`.

Never copy vault values into README files, issues, pull requests, terminal transcripts, screenshots, deployment URLs, or generated examples. Do not work around a vault or filesystem protection that refuses a secret transfer; record the blocked continuity step instead.

## Verification

Before release review, verify the project connection is healthy and inspect vault status without printing values. Run `bun run security:scan` after any environment or documentation work. Agent Kernel backups, global rules, and local paths are not repository artifacts and are ignored by the project.
