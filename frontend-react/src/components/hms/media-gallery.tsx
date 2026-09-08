import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ImageIcon,
  Maximize2,
  Play,
  RotateCcw,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const isVideoUrl = (u: string) => {
    if (!u) return false;
    return Boolean(u.match(/\.(mp4|webm|ogg|mov|mkv|m4v|avi)(\?.*)?$/i));
  };

  const processItem = (item: any, i: number): MediaItem => {
    const rawUrl = item.url || item.path || item.preview || (typeof item === "string" ? item : "");
    const resolvedUrl = getMediaUrl(rawUrl);
    const isVideo = item.type === "video" || item.mimeType?.startsWith("video/") || isVideoUrl(rawUrl);
    return {
      id: item._id || item.id || `med-${i}`,
      type: isVideo ? "video" : "image",
      url: resolvedUrl,
      name: item.name || (isVideo ? `Video ${i + 1}` : `Photo ${i + 1}`),
      size: item.size,
    };
  };

  if (attachments && attachments.length > 0) {
    return attachments.map(processItem);
  }
  if (media && media.length > 0) {
    return media.map(processItem);
  }
  if (image) {
    return [processItem({ url: image, name: "Photo 1" }, 0)];
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

  // Zoom and pan states for images
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePrev = useCallback(() => {
    if (selectedIndex === null) return;
    resetZoom();
    setSelectedIndex((selectedIndex - 1 + items.length) % items.length);
  }, [selectedIndex, items.length, resetZoom]);

  const handleNext = useCallback(() => {
    if (selectedIndex === null) return;
    resetZoom();
    setSelectedIndex((selectedIndex + 1) % items.length);
  }, [selectedIndex, items.length, resetZoom]);

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") resetZoom();
      if (e.key === "Escape") setSelectedIndex(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, handlePrev, handleNext, handleZoomIn, handleZoomOut, resetZoom]);

  if (items.length === 0) return null;

  const current = selectedIndex !== null ? items[selectedIndex] : null;

  // Mouse pan handlers for zoomed image
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDoubleClick = () => {
    if (zoom > 1) {
      resetZoom();
    } else {
      setZoom(2);
    }
  };

  return (
    <>
      {/* Thumbnail grid in cards / details */}
      <div className={cn("flex flex-wrap gap-2.5", className)}>
        {items.map((item, idx) => (
          <button
            key={item.id || idx}
            type="button"
            onClick={() => {
              resetZoom();
              setSelectedIndex(idx);
            }}
            className="group relative size-20 overflow-hidden rounded-lg border border-border bg-muted/60 transition-all hover:scale-[1.03] hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-24 cursor-pointer"
          >
            {item.type === "video" ? (
              <>
                <video
                  src={item.url}
                  className="size-full object-cover pointer-events-none"
                  preload="metadata"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white group-hover:bg-black/30 transition-colors">
                  <Play className="size-6 fill-white drop-shadow" />
                </span>
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wider">
                  Video
                </span>
              </>
            ) : (
              <>
                <img
                  src={item.url}
                  alt={item.name || `evidence-${idx}`}
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wider">
                  Photo
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Expanded Lightbox Dialog */}
      <Dialog
        open={selectedIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            resetZoom();
            setSelectedIndex(null);
          }
        }}
      >
        <DialogContent
          className="w-[96vw] max-w-6xl h-[88vh] max-h-[92vh] flex flex-col p-0 border border-zinc-800 bg-zinc-950/95 text-white shadow-2xl rounded-xl overflow-hidden backdrop-blur-md"
        >
          <DialogTitle className="sr-only">Evidence Media Viewer</DialogTitle>
          <DialogDescription className="sr-only">
            Viewing evidence photos and videos in full screen with zoom and pan controls.
          </DialogDescription>

          {/* Top Control Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/80 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-200">
                {current?.type === "video" ? (
                  <>
                    <Video className="size-3.5 text-blue-400" />
                    Video
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-3.5 text-emerald-400" />
                    Photo
                  </>
                )}
              </span>
              <span className="text-xs text-zinc-400">
                {selectedIndex !== null ? selectedIndex + 1 : 0} of {items.length}
              </span>
              {current?.name && (
                <span className="hidden sm:inline-block max-w-[200px] truncate text-xs text-zinc-400">
                  • {current.name}
                </span>
              )}
            </div>

            {/* Toolbar Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Zoom controls for photos */}
              {current?.type !== "video" && (
                <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    onClick={handleZoomOut}
                    title="Zoom out (-)"
                  >
                    <ZoomOut className="size-4" />
                  </Button>
                  <span className="min-w-10 text-center text-xs font-mono text-zinc-300">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    onClick={handleZoomIn}
                    title="Zoom in (+)"
                  >
                    <ZoomIn className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    onClick={resetZoom}
                    title="Reset view (0)"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </div>
              )}

              {/* Open in new tab */}
              {current?.url && (
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-8 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  title="Open original in new tab"
                >
                  <ExternalLink className="size-4" />
                </a>
              )}

              {/* Close Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-zinc-300 hover:text-white hover:bg-zinc-800"
                onClick={() => {
                  resetZoom();
                  setSelectedIndex(null);
                }}
                title="Close (Esc)"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Main Media Viewport */}
          <div
            className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black/95 p-2 sm:p-4 select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {current?.type === "video" ? (
              <div className="flex h-full w-full max-h-[75vh] items-center justify-center">
                <video
                  key={current.url}
                  src={current.url}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
                >
                  <source src={current.url} />
                  Your browser does not support playing this video format.
                </video>
              </div>
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center overflow-hidden",
                  zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
                )}
                onDoubleClick={handleDoubleClick}
              >
                <img
                  key={current?.url}
                  src={current?.url}
                  alt={current?.name || "Evidence"}
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                  className="max-h-[74vh] max-w-full object-contain rounded-md shadow-2xl transition-transform duration-100 ease-out"
                />
              </div>
            )}

            {/* Left/Right Floating Navigation */}
            {items.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-zinc-900/80 text-white hover:bg-zinc-800 border border-zinc-700/60 shadow-lg cursor-pointer transition-transform hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  title="Previous (Left arrow)"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-zinc-900/80 text-white hover:bg-zinc-800 border border-zinc-700/60 shadow-lg cursor-pointer transition-transform hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  title="Next (Right arrow)"
                >
                  <ChevronRight className="size-6" />
                </Button>
              </>
            )}
          </div>

          {/* Bottom Thumbnail Strip (if multiple items) */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-zinc-800/80 bg-zinc-900/80 px-4 py-2 overflow-x-auto">
              {items.map((item, idx) => (
                <button
                  key={item.id || idx}
                  type="button"
                  onClick={() => {
                    resetZoom();
                    setSelectedIndex(idx);
                  }}
                  className={cn(
                    "relative size-12 shrink-0 rounded-md overflow-hidden border transition-all cursor-pointer",
                    selectedIndex === idx
                      ? "border-primary ring-2 ring-primary/60 scale-105"
                      : "border-zinc-700 opacity-60 hover:opacity-100"
                  )}
                >
                  {item.type === "video" ? (
                    <div className="size-full bg-zinc-800 flex items-center justify-center text-white">
                      <Play className="size-4 fill-white" />
                    </div>
                  ) : (
                    <img src={item.url} alt="" className="size-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MediaGallery;
