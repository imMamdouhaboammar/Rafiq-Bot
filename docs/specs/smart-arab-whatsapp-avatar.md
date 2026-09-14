# Smart Arab WhatsApp Avatar Generation

## Goal
Generate AI persona avatars that look like realistic WhatsApp profile photos for believable Arab characters.

## Success Criteria
- The avatar generation path uses the Gemini 3.1 image model family first.
- The generated profile image prompt explicitly asks for authentic Arab / Middle Eastern / North African facial features.
- The output style is a casual square WhatsApp profile photo, not a studio portrait, illustration, or generic stock image.
- Generated avatars remain local to the user's browser by storing the returned data URI in the existing Dexie chat settings.
- If the requested model is unavailable, generation falls back without breaking persona creation.

## Non Goals
- No schema migration.
- No server-side file storage.
- No public upload of generated avatars.
- No change to uploaded avatar behavior.

## Data Contract
- Input: persona name, gender, age, bio, and visual seed.
- Output: `data:<mime>;base64,<image>` stored in `ChatSession.settings.avatarUrl`.

## Edge Cases
- Empty bio falls back to an everyday Arab-person description.
- Gemini model access failures try the next supported image model.
- Generated image may be empty; the UI keeps showing the existing fallback avatar.

## Verification
- Unit test confirms prompt constraints and Gemini 3.1 image model priority.
- Existing human-realism tests continue to pass.
- Production build must pass.
