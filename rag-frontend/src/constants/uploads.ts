/**
 * Upload limits, per organization.
 *
 * Mirrored in chats-service/app/core/config.py -- change both together.
 * The backend is the one that enforces these; the copies here exist so the
 * user finds out before a 100 MB upload, not after.
 */
export const MAX_DOCUMENTS_PER_ORG = 10;
export const MAX_ORG_STORAGE_BYTES = 100 * 1024 * 1024;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Extensions the extraction pipeline can read. Mirrors
 * `_EXTRACTORS` in chats-service/app/helpers/file_manager.py.
 *
 * .doc and .xls are deliberately absent: nothing can read them, so
 * accepting one only fails later at training time.
 */
export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".xlsm",
  ".txt",
  ".md",
  ".csv",
] as const;

/** For the file picker's native filter. */
export const UPLOAD_ACCEPT = ALLOWED_EXTENSIONS.join(",");

/** Legacy formats worth naming a replacement for. */
export const LEGACY_REPLACEMENTS: Record<string, string> = {
  ".doc": ".docx",
  ".xls": ".xlsx",
};
