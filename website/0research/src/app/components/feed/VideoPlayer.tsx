// ============================================
// COMPONENT: VideoPlayer
// PURPOSE: HTML5 video element with viewport-aware autoplay, hover overlay
//          for play/pause, and persistent scale animation on pause/play.
//          NO timeline controls — those are rendered externally by VideoTimeline
//          (below the carousel in MainFeedItem).
//
// FEATURES:
//   - Autoplay ONLY when the parent feed item is the active viewport item
//   - Pauses automatically when the feed item scrolls out of view
//   - Muted + loop for seamless feed experience
//   - Hover overlay with centered pause/play icon
//   - Click anywhere on video to toggle play/pause
//   - Scale is controlled by PARENT (MainFeedItem on the media-container level)
//     so the entire container + border-radius scales uniformly — no corner artifacts.
//   - data-video-player attribute on <video> for DOM queries from MainFeedItem
//   - Calls onPauseChange(isPaused) so parent can show/hide VideoTimeline
//   - Uses 0research design tokens — neutral dark palette, no colors
//
// USED IN: MainFeedItem (carousel slides with media_type === "video")
// ============================================

import { useState, useRef, useEffect, useCallback } from "react";
import { Pause, Play } from "lucide-react";

interface VideoPlayerProps {
  /** Video source URL */
  src: string;
  /** Alt/caption text */
  caption?: string;
  /** Whether the parent feed item is the active (in-viewport) item */
  isActive: boolean;
  /** Called when play/pause state changes — parent uses this to show/hide VideoTimeline */
  onPauseChange?: (isPaused: boolean) => void;
}

export function VideoPlayer({ src, caption, isActive, onPauseChange }: VideoPlayerProps) {
  // --- STATE ---
  const videoRef = useRef<HTMLVideoElement>(null);

  // Whether the video is currently playing (true) or paused (false)
  const [isPlaying, setIsPlaying] = useState(false);

  // Whether the user is hovering over the video area
  const [isHovering, setIsHovering] = useState(false);

  // Whether the user has MANUALLY paused the video (click-to-pause).
  // When true, becoming active again will NOT auto-resume — respects user intent.
  // Reset when the item becomes inactive (user scrolled away).
  const userPausedRef = useRef(false);

  // --- EFFECT: Auto-play/pause based on isActive ---
  // When the feed item becomes active → play (unless user manually paused)
  // When the feed item becomes inactive → pause, reset userPaused
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Only auto-play if the user hasn't manually paused
      if (!userPausedRef.current) {
        video.play().catch(() => {
          // Autoplay may be blocked by browser policy — silently handle
        });
        setIsPlaying(true);
        onPauseChange?.(false);
      }
    } else {
      // Pause when scrolling away from this item
      video.pause();
      setIsPlaying(false);
      onPauseChange?.(true);
      // Reset user-paused flag — next time this item becomes active, auto-play resumes
      userPausedRef.current = false;
    }
  }, [isActive, onPauseChange]);

  // --- PLAY / PAUSE TOGGLE (user click) ---
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // Resume playing
      video.play().catch(() => {});
      setIsPlaying(true);
      userPausedRef.current = false;
      onPauseChange?.(false);
    } else {
      // Pause — mark as user-initiated so isActive won't auto-resume
      video.pause();
      setIsPlaying(false);
      userPausedRef.current = true;
      onPauseChange?.(true);
    }
  }, [onPauseChange]);

  // --- RENDER ---
  return (
    <div
      className="w-full h-full relative cursor-pointer overflow-hidden"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={togglePlayPause}
      style={{ borderRadius: "inherit" }}
    >
      {/* Video element — muted (required for autoplay), loop, NO autoPlay attribute
          (playback is controlled via isActive effect above).
          NO transform here — scale is applied on the parent media-container. */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        playsInline
        muted
        loop
        preload="metadata"
        data-video-player
        style={{
          borderRadius: "inherit",
        }}
      />

      {/* Hover overlay — semi-transparent dark with centered icon */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: "var(--video-overlay-bg)",
          opacity: isHovering ? 1 : 0,
          transition: "opacity var(--dur-base) var(--ease-standard)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      >
        {/* Play/Pause icon */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 52,
            height: 52,
            background: "var(--video-control-bg)",
            backdropFilter: "blur(8px)",
          }}
        >
          {isPlaying ? (
            <Pause size={24} style={{ color: "var(--text-primary)" }} fill="var(--text-primary)" />
          ) : (
            <Play size={24} style={{ color: "var(--text-primary)", marginLeft: "var(--space-hair)" }} fill="var(--text-primary)" />
          )}
        </div>
      </div>
    </div>
  );
}
