const detectors = [
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[0-9A-Za-z]{30,}\b/g },
  { name: 'OpenAI-style secret', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'Stripe live secret', pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: 'assigned long secret',
    pattern: /(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|secret)\s*[:=]\s*["']([A-Za-z0-9_./+=-]{20,})["']/gi,
    valueCaptureGroup: 1,
  },
];

export const findSecretMatches = (source, text, allowedValues = new Set()) => {
  const findings = [];

  for (const detector of detectors) {
    detector.pattern.lastIndex = 0;
    for (const match of text.matchAll(detector.pattern)) {
      const candidateValue = detector.valueCaptureGroup
        ? match[detector.valueCaptureGroup]
        : undefined;

      if (candidateValue && allowedValues.has(candidateValue)) continue;

      const line = text.slice(0, match.index).split('\n').length;
      findings.push({ source, line, detector: detector.name });
    }
  }

  return findings;
};
