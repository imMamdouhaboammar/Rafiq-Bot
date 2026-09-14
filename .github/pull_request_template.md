## Summary

Describe the user-visible or contributor-visible change and why it is needed.

## Scope

- What changed:
- What intentionally did not change:

## Verification

List the exact commands or browser flows you ran. Do not paste secrets or private user data.

## Risk review

- Security or credential boundary impact:
- Localization / RTL / LTR impact:
- Data migration or persistence impact:
- Provider or deployment impact:

## Evidence

Add screenshots only when they use synthetic or non-sensitive data. Link the issue or design evidence when applicable.

## Checklist

- [ ] Focused tests cover changed behavior or a deliberate no-test reason is documented
- [ ] `bun run typecheck` passes
- [ ] `bun run test:p0` passes
- [ ] `bun run security:scan` passes
- [ ] Docs and `.env.example` are updated when public contracts changed
- [ ] No real secrets, private chat data, or machine-specific paths were added
