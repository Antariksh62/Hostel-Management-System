import { ImagePlus, Play, Trash2, Video } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MEDIA_ACCEPT,
  MEDIA_LIMITS,
  formatBytes,
  pickAttachments,
  releaseAttachment,
  type ComplaintAttachment,
  type MediaRejection,
} from "@/lib/media";

export function MediaUploader({
  attachments,
  onChange,
}: {
  attachments: ComplaintAttachment[];
  onChange: (next: ComplaintAttachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<MediaRejection[]>([]);
  const full = attachments.length >= MEDIA_LIMITS.maxAttachments;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { accepted, rejected } = pickAttachments(Array.from(files), attachments.length);
    if (accepted.length) onChange([...attachments, ...accepted]);
    setErrors(rejected);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(a: ComplaintAttachment) {
    releaseAttachment(a);
    onChange(attachments.filter((x) => x.id !== a.id));
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id="complaint-media"
        type="file"
        multiple
        accept={MEDIA_ACCEPT}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        type="button"
        disabled={full}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
          <ImagePlus className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Add photos or video</span>
          <span className="block text-xs text-muted-foreground">
            {full
              ? `Maximum ${MEDIA_LIMITS.maxAttachments} attachments added`
              : "Show us what needs attention · up to 5 files"}
          </span>
        </span>
      </button>

      {errors.length > 0 ? (
        <ul className="space-y-1" role="alert">
          {errors.map((e, i) => (
            <li key={i} className="text-xs break-words text-[var(--hms-critical)]">
              <span className="font-medium">{e.name}</span> — {e.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {a.type === "image" ? (
                  <img src={a.url} alt={`Selected photo: ${a.name}`} className="size-full object-cover" />
                ) : (
                  <>
                    <video src={a.url} muted playsInline preload="metadata" className="size-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/25 text-background">
                      <Play className="size-4" aria-hidden />
                    </span>
                  </>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{a.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {a.type === "video" ? <Video className="size-3" aria-hidden /> : null}
                  {a.type === "image" ? "Photo" : "Video"} · {formatBytes(a.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${a.name}`}
                className="min-h-11 min-w-11 shrink-0"
                onClick={() => remove(a)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
