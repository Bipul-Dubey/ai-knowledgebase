import {
  ALLOWED_EXTENSIONS,
  LEGACY_REPLACEMENTS,
  MAX_DOCUMENTS_PER_ORG,
  MAX_FILE_SIZE_BYTES,
  MAX_ORG_STORAGE_BYTES,
} from "@/constants/uploads";
import { formatFileSize } from "@/lib/utils";

export type RejectedFile = { file: File; reason: string };

export type ValidationResult = {
  accepted: File[];
  rejected: RejectedFile[];
};

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};

/**
 * Validate a selection against the organization's remaining quota.
 *
 * Mirrors the checks in the upload endpoint so the user sees the problem
 * before the bytes go over the wire. The backend still enforces all of it.
 *
 * @param incoming   files just picked or dropped
 * @param queued     files already staged in the dialog but not yet uploaded
 * @param usedCount  documents the org already holds
 * @param usedBytes  bytes the org already holds
 */
export const validateSelection = (
  incoming: File[],
  queued: File[],
  usedCount: number,
  usedBytes: number,
): ValidationResult => {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];

  // Count what is already staged, so limits apply to the whole picture
  // rather than to each drop in isolation.
  let count = usedCount + queued.length;
  let bytes = usedBytes + queued.reduce((sum, f) => sum + f.size, 0);

  const queuedNames = new Set(queued.map((f) => f.name));

  for (const file of incoming) {
    const ext = extensionOf(file.name);

    if (queuedNames.has(file.name)) {
      rejected.push({ file, reason: "Already added" });
      continue;
    }

    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      const replacement = LEGACY_REPLACEMENTS[ext];
      rejected.push({
        file,
        reason: replacement
          ? `${ext} can't be read - convert it to ${replacement}`
          : `${ext || "This file type"} is not supported`,
      });
      continue;
    }

    if (file.size === 0) {
      rejected.push({ file, reason: "File is empty" });
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejected.push({
        file,
        reason: `Over the ${formatFileSize(MAX_FILE_SIZE_BYTES)} per-file limit`,
      });
      continue;
    }

    if (count + 1 > MAX_DOCUMENTS_PER_ORG) {
      rejected.push({
        file,
        reason: `Would exceed the ${MAX_DOCUMENTS_PER_ORG}-document limit`,
      });
      continue;
    }

    if (bytes + file.size > MAX_ORG_STORAGE_BYTES) {
      rejected.push({
        file,
        reason: `Would exceed the ${formatFileSize(MAX_ORG_STORAGE_BYTES)} storage limit`,
      });
      continue;
    }

    accepted.push(file);
    queuedNames.add(file.name);
    count += 1;
    bytes += file.size;
  }

  return { accepted, rejected };
};
