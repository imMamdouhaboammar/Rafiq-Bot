# Credential Rotation and Repository Cleanup Runbook

Use this runbook when any `.env*`, service-account file, private key, access token, cookie secret, database URL, or provider credential was committed or shared outside its intended secret store.

## Non-negotiable rule

Deleting a file or rewriting Git history does not revoke a credential. Rotate first in the provider console, verify the old value is rejected, then clean repository history.

## Incident sequence

1. Freeze deployments that could continue using the exposed value.
2. Inventory the affected provider, credential name, scopes, environments, and last known use.
3. Revoke or disable the old credential in the provider console.
4. Create a replacement with the minimum required scope.
5. Store the replacement only in the intended local or deployment secret store.
6. Deploy or restart the consumer only when the provider requires it.
7. Verify a real request succeeds with the new credential.
8. Verify the old credential fails.
9. Search the current worktree and all reachable Git history.
10. Rewrite history only after rotation, then force-update the private remote if necessary.
11. Invalidate old clones and ask collaborators to re-clone from the cleaned snapshot.
12. Record the incident without recording the secret value.

## Provider checklist

For each affected secret, record:

- provider and project/account
- credential identifier, not the secret value
- previous scopes
- replacement scopes
- revoked timestamp
- replacement verified timestamp
- old value rejection verified
- deployment environments updated
- owner who performed the rotation

## Git cleanup

Preferred approach for this repository:

1. Rotate credentials first.
2. Build a clean private snapshot from a verified worktree.
3. Run `npm run security:tracked` and `npm run security:secrets`.
4. Confirm no sensitive files are tracked.
5. Confirm the snapshot contains no generated caches, local browser data, model artifacts, or binary media.
6. Update `main` only after the final scan.

When preserving history is required, use a trusted history-rewrite tool such as `git filter-repo`, then scan every reachable ref again. Do not assume a file is gone because it is absent from the current branch.

## Required evidence before release

- output from the tracked-sensitive-file check
- output from the worktree and reachable-history secret scan
- provider-side confirmation that old credentials are revoked
- a real health check using replacement credentials
- confirmation that no secret value appears in issue text, commit messages, logs, or documentation

## Rollback

Repository cleanup can be rolled back by restoring the pre-cleanup ref in a quarantined local clone. Credential rotation must not be rolled back to the exposed value. If the replacement fails, create another replacement rather than re-enabling the compromised credential.
