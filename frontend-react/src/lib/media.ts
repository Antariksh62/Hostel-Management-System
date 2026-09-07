/**
 * MEDIA RULES & VALIDATION
 * Handles file validation, size limits, format conversion, and cleanup.
 */

export interface ComplaintAttachment {
  id: string;
  type: "image" | "video";
  name: string;
  url: string;
  size: number;
  mimeType?: string;
  local?: boolean;
  file?: File;
}

export const MEDIA_LIMITS = {
  maxAttachments: 5,
  maxImageBytes: 10 * 1024 * 1024, // 10 MB
  maxVideoBytes: 50 * 1024 * 1024, // 50 MB
  imageTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  videoTypes: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

export const MEDIA_ACCEPT = [...MEDIA_LIMITS.imageTypes, ...MEDIA_LIMITS.videoTypes].join(",");

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface MediaRejection {
  name: string;
  reason: string;
}

export interface MediaPickResult {
  accepted: ComplaintAttachment[];
  rejected: MediaRejection[];
}

/** Validates picked files and turns valid ones into attachments with local preview and raw File reference */
export function pickAttachments(files: File[], existingCount: number): MediaPickResult {
  const accepted: ComplaintAttachment[] = [];
  const rejected: MediaRejection[] = [];
  let slots = MEDIA_LIMITS.maxAttachments - existingCount;

  for (const file of files) {
    const isImage = (MEDIA_LIMITS.imageTypes as readonly string[]).includes(file.type);
    const isVideo = (MEDIA_LIMITS.videoTypes as readonly string[]).includes(file.type);

    if (!isImage && !isVideo) {
      rejected.push({ name: file.name, reason: "Unsupported file type." });
      continue;
    }
    if (isImage && file.size > MEDIA_LIMITS.maxImageBytes) {
      rejected.push({ name: file.name, reason: "Image is too large. Maximum size is 10 MB." });
      continue;
    }
    if (isVideo && file.size > MEDIA_LIMITS.maxVideoBytes) {
      rejected.push({ name: file.name, reason: "Video is too large. Maximum size is 50 MB." });
      continue;
    }
    if (slots <= 0) {
      rejected.push({
        name: file.name,
        reason: `Only ${MEDIA_LIMITS.maxAttachments} attachments are allowed per complaint.`,
      });
      continue;
    }

    slots -= 1;
    accepted.push({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: isImage ? "image" : "video",
      name: file.name,
      size: file.size,
      mimeType: file.type,
      url: URL.createObjectURL(file),
      local: true,
      file,
    });
  }

  return { accepted, rejected };
}

export function releaseAttachment(attachment: ComplaintAttachment) {
  if (attachment.local && attachment.url.startsWith("blob:")) {
    URL.revokeObjectURL(attachment.url);
  }
}

/** Resolves media URLs (either local blob URLs or backend /uploads path) */
export function getMediaUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `http://localhost:5000${url.startsWith("/") ? "" : "/"}${url}`;
}
