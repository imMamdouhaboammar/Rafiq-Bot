# Contributing to Rafiq-Bot

Thank you for considering contributing to **Rafiq-Bot**! We welcome bug fixes, feature proposals, documentation improvements, and new soul engine definitions.

## Development Workflow

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/<your-username>/Rafiq-Bot.git
   cd Rafiq-Bot
   ```

2. **Install Dependencies**:
   ```bash
   bun install
   ```

3. **Configure Local Environment**:
   ```bash
   cp .env.example .env.local
   ```
   Add your `GEMINI_API_KEY`.

4. **Start Development Server**:
   ```bash
   bun run dev
   ```

5. **Run Verification & Tests**:
   ```bash
   npm run typecheck
   npm run test:p0
   npm run security:scan
   ```

## Pull Request Guidelines

- **Atomic & Clear Commits**: Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- **Zero Broken Tests**: Ensure all 110 unit/integration tests pass.
- **No Secrets**: Never commit real credentials, keys, or tokens.
- **Clean Code Standard**: Run `clean-code-guard` principles (small functions, intent-revealing names, specific error handling).

## Code of Conduct

Maintain a respectful, supportive, and inclusive community environment for developers of all backgrounds.
