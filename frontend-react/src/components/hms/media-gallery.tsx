import { ChevronLeft, ChevronRight, FileWarning, ImageIcon, Play, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export interface MediaItem {
  id?: string;
  type?: "image" | "video";
  url: string;
  name?: string;
  size?: number;
}

function normalizeMediaItems(media?: any[], image?: string, attachments?: any[]): MediaItem[] {
  if (attachments && attachments.length > 0) {
    return attachments.map((a, i) => ({
      id: a.id || `att-${i}`,
      type: a.type || (a.url?.match(/\.(mp4|webm|mov)$/i) ? "video" : "image"),
      url: getMediaUrl(a.url),
      name: a.name || `attachment-${i + 1}`,
      size: a.size,
    }));
  }
  if (media && media.length > 0) {
    return media.map((m, i) => ({
      id: m._id || m.id || `med-${i}`,
      type: m.type || (m.url?.match(/\.(mp4|webm|mov)$/i) ? "video" : "image"),
      url: getMediaUrl(m.url),
      name: m.name || `attachment-${i + 1}`,
      size: m.size,
    }));
  }
  if (image) {
    return [
      {
        id: "img-legacy",
        type: image.match(/\.(mp4|webm|mov)$/i) ? "video" : "image",
        url: getMediaUrl(image),
        name: "attachment-1",
      },
    ];
  }
  return [];
}

export function MediaGallery({
  media,
  image,
  attachments,
  className,
}: {
  media?: any[];
  image?: string;
  attachments?: any[];
  className?: string;
}) {
  const items = normalizeMediaItems(media, image, attachments);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const current = selectedIndex !== null ? items[selectedIndex] : null;

  const handlePrev = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % items.length);
  };

  return (
    <>
      <div className={cn("flex flex-wrap gap-2.5", className)}>
        {items.map((item, idx) => (
          <button
            key={item.id || idx}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            className="group relative size-20 overflow-hidden rounded-lg border border-border bg-muted/60 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-24"
          >
            {item.type === "video" ? (
              <>
                <video
                  src={item.url}
                  className="size-full object-cover pointer-events-none"
                  preload="metadata"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  <Play className="size-5 fill-white" />
                </span>
              </>
            ) : (
              <img
                src={item.url}
                alt={item.name || `evidence-${idx}`}
                className="size-full object-cover"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="max-w-3xl overflow-hidden border-border bg-background p-0">
          <DialogTitle className="sr-only">Attachment Viewer</DialogTitle>
          <DialogDescription className="sr-only">Viewing evidence photo or video</DialogDescription>

          <div className="relative flex aspect-video max-h-[75vh] w-full items-center justify-center bg-black/90">
            {current?.type === "video" ? (
              <video
                key={current.url}
                src={current.url}
                controls
                autoPlay
                className="max-h-full max-w-full"
              />
            ) : (
              <img
                key={current?.url}
                src={current?.url}
                alt={current?.name || "Evidence"}
                className="max-h-full max-w-full object-contain"
              />
            )}

            {/* Navigation buttons */}
            {items.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75"
                  onClick={handleNext}
                >
                  <ChevronRight className="size-6" />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              {selectedIndex !== null ? selectedIndex + 1 : 0} of {items.length}
            </span>
            <span className="truncate">{current?.name}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default MediaGallery;
