# Security Policy

## Supported code

Security fixes target the current `main` branch. Until Rafiq publishes and documents a versioned support policy, older commits, forks, and unmaintained deployments should not be assumed to receive security fixes.

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability or include exploit details, credentials, private chat data, or session cookies in a public thread.

Use GitHub's private vulnerability reporting or Security Advisory flow for this repository when it is available. If that flow is unavailable, contact the maintainer privately through the GitHub profile linked from the repository and provide only the minimum information needed to establish a private channel.

Include the affected commit or branch, impact, reproduction steps, required configuration, and a minimal proof of concept. Redact all real secrets and personal data.

## Scope and expectations

Reports about secret exposure, authentication bypass, SSRF, unsafe file handling, credential leakage to the browser, cross-chat data isolation, and vulnerable dependencies are in scope. Findings that require a third-party provider to violate its own documented trust boundary should clearly state that assumption.

The maintainer will validate the report before deciding on remediation and disclosure. Do not rotate, revoke, or delete repository or provider credentials on the maintainer's behalf unless explicitly authorized.
