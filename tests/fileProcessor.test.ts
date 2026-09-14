import assert from "node:assert/strict";
import {
  MAX_ATTACHMENT_COUNT,
  MAX_FILE_SIZE_BYTES,
  buildFileContextInstruction,
  categorizeFile,
  formatFileSize,
  validateAttachmentCount,
  validateFileUpload,
} from "../services/fileProcessor.js";

assert.equal(categorizeFile("application/pdf", "brief.pdf"), "document");
assert.equal(categorizeFile("", "notes.md"), "code");
assert.equal(categorizeFile("text/csv", "budget.csv"), "spreadsheet");
assert.equal(categorizeFile("application/zip", "archive.zip"), "archive");
assert.equal(categorizeFile("video/mp4", "clip.mp4"), "video");

assert.equal(formatFileSize(512), "512 B");
assert.equal(formatFileSize(1536), "1.5 KB");
assert.equal(formatFileSize(2 * 1024 * 1024), "2 MB");

assert.deepEqual(validateAttachmentCount(MAX_ATTACHMENT_COUNT - 1, 1), { valid: true });
assert.equal(validateAttachmentCount(MAX_ATTACHMENT_COUNT, 1).valid, false);
assert.match(validateAttachmentCount(MAX_ATTACHMENT_COUNT, 1).error || "", /5/);

assert.equal(validateFileUpload({ name: "ok.pdf", size: MAX_FILE_SIZE_BYTES, type: "application/pdf" }).valid, true);
assert.equal(validateFileUpload({ name: "huge.pdf", size: MAX_FILE_SIZE_BYTES + 1, type: "application/pdf" }).valid, false);
assert.match(validateFileUpload({ name: "huge.pdf", size: MAX_FILE_SIZE_BYTES + 1, type: "application/pdf" }).error || "", /20 MB/);

const context = buildFileContextInstruction([
  {
    fileName: "report.pdf",
    fileSize: 2048,
    mimeType: "application/pdf",
    category: "document",
  },
  {
    fileName: "app.ts",
    fileSize: 512,
    mimeType: "text/typescript",
    category: "code",
  },
]);

assert.match(context || "", /report\.pdf/);
assert.match(context || "", /document/);
assert.match(context || "", /app\.ts/);
assert.match(context || "", /review/i);

console.log("file processor tests passed");

