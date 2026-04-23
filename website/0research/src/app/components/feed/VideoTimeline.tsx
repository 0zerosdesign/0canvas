// ============================================
// COMPONENT: VideoTimeline
// PURPOSE: iOS-inspired minimal video scrubber timeline.
//          Ultra-thin track with a floating time tooltip that only appears
//          when hovering or dragging the knob — no start/end duration labels.
//
// DESIGN:
//   - Thin rounded track (2px → 3px on hover) with progress fill
//   - Circular knob (8px → 12px on hover/drag) with soft glow
//   - Floating pill tooltip above knob shows current time on hover/drag
//   - Tooltip has backdrop-blur glass effect (iOS Control Center style)
//   - All transitions use iOS-style spring curves
//   - No start/end time labels — clean and minimal
//
// VISIBILITY:
//   - Only rendered when the active video is PAUSED (parent controls mount/unmount)
//
// INTERACTIONS:
//   - Click anywhere on track to seek
//   - Drag knob to scrub
//   - Hover on track area reveals enlarged knob
//   - Hover/drag on knob reveals floating time tooltip
//
// POSITIONED: Absolutely below the carousel in MainFeedItem (outside overflow:hidden)
// ============================================

import { useState, useRef, useEffect, useCallback } from "react";

interface VideoTimelineProps {
  /** The <video> DOM element to read time from and seek on */
  videoElement: HTMLVideoElement;
}

export function VideoTimeline({ videoElement }: VideoTimelineProps) {
  // --- STATE ---
  const trackRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(videoElement.currentTime);
  const [duration, setDuration] = useState(videoElement.duration || 0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isKnobHovered, setIsKnobHovered] = useState(false);

  // --- FORMAT TIME ---
  // Clean format: "0:06" not "00:06" — iOS style
  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }, []);

  // --- PROGRESS FRACTION ---
  const progress = duration > 0 ? currentTime / duration : 0;

  // --- VIDEO EVENT LISTENERS ---
  useEffect(() => {
    const video = videoElement;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setCurrentTime(video.currentTime);
    };
    const onDurationChange = () => {
      if (isFinite(video.duration)) setDuration(video.duration);
    };

    // Set initial values (video may already have metadata loaded)
    if (isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    setCurrentTime(video.currentTime);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, [videoElement]);

  // --- SEEK TO POSITION ---
  const seekToPosition = useCallback(
    (clientX: number) => {
      const bar = trackRef.current;
      if (!bar || !duration) return;

      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newTime = fraction * duration;
      videoElement.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration, videoElement]
  );

  // --- MOUSE DOWN on track ---
  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent carousel from receiving this
      setIsDragging(true);
      seekToPosition(e.clientX);
    },
    [seekToPosition]
  );

  // --- TOUCH START on track ---
  const handleTrackTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      setIsDragging(true);
      seekToPosition(touch.clientX);
    },
    [seekToPosition]
  );

  // --- GLOBAL MOUSE/TOUCH MOVE/UP for drag scrubbing ---
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      seekToPosition(e.clientX);
    };
    const handleMouseUp = () => setIsDragging(false);
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) seekToPosition(touch.clientX);
    };
    const handleTouchEnd = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isDragging, seekToPosition]);

  // --- DERIVED STATE ---
  // Show enlarged knob when hovering the track area or dragging
  const isActive = isHovering || isDragging;
  // Show time tooltip only when knob is hovered OR actively dragging
  const showTooltip = isKnobHovered || isDragging;

  // --- TRACK HEIGHT ---
  // 2px default, 3px on hover/drag — subtle expansion
  const trackHeight = isActive ? 3 : 2;

  // --- KNOB SIZE ---
  // 8px default (barely visible), 14px on hover/drag
  const knobSize = isActive ? 14 : 8;

  // --- RENDER ---
  return (
    <div
      style={{
        width: "100%",
        paddingTop: 14,
        paddingBottom: 4,
        position: "relative",
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setIsKnobHovered(false);
      }}
    >
      {/* --- FLOATING TIME TOOLTIP ---
          Glass pill that appears above the knob on hover/drag.
          Positioned absolutely, follows the knob's left% position.
          Uses backdrop-blur for iOS Control Center glass effect. */}
      <div
        style={{
          position: "absolute",
          left: `${progress * 100}%`,
          bottom: "100%",
          transform: "translateX(-50%)",
          marginBottom: 4,
          opacity: showTooltip ? 1 : 0,
          scale: showTooltip ? "1" : "0.85",
          pointerEvents: "none",
          transition:
            "opacity var(--zeros-duration) var(--zeros-ease-emphasized), scale var(--zeros-duration) var(--zeros-ease-emphasized)",
          willChange: "opacity, scale",
        }}
      >
        <div
          style={{
            background: "var(--zeros-video-timeline-glass-bg)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderRadius: "var(--zeros-radius-control)",
            padding: "3px 8px",
            border: "1px solid var(--zeros-video-timeline-glass-border)",
            boxShadow: "var(--zeros-video-timeline-glass-shadow)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--zeros-font-mono)",
              fontSize: "10px",
              letterSpacing: "0.03em",
              color: "var(--zeros-video-timeline-text)",
              whiteSpace: "nowrap",
            }}
          >
            {formatTime(currentTime)}
          </span>
        </div>
      </div>

      {/* --- TRACK AREA ---
          Wider hit area (20px tall) for easy clicking, track renders inside.
          The visual track is thin but the clickable area is generous. */}
      <div
        ref={trackRef}
        style={{
          position: "relative",
          width: "100%",
          height: 20,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
        onMouseDown={handleTrackMouseDown}
        onTouchStart={handleTrackTouchStart}
      >
        {/* Track background — ultra-thin rounded pill */}
        <div
          style={{
            width: "100%",
            height: trackHeight,
            borderRadius: trackHeight,
            background: "var(--zeros-video-timeline-track)",
            position: "relative",
            overflow: "hidden",
            transition: "height 250ms var(--zeros-ease-emphasized)",
          }}
        >
          {/* Progress fill — left portion with subtle brightness */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${progress * 100}%`,
              borderRadius: trackHeight,
              background: "var(--zeros-video-timeline-progress)",
              transition: isDragging ? "none" : "width 80ms linear",
            }}
          />
        </div>

        {/* --- KNOB ---
            Circular thumb that grows on hover/drag.
            Has a soft glow effect when active.
            Positioned at the current progress %. */}
        <div
          style={{
            position: "absolute",
            left: `${progress * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: knobSize,
            height: knobSize,
            borderRadius: "50%",
            background: "var(--zeros-video-timeline-knob)",
            boxShadow: isActive
              ? "var(--zeros-video-timeline-knob-shadow-active)"
              : "var(--zeros-video-timeline-knob-shadow)",
            transition: isDragging
              ? "width var(--zeros-duration) var(--zeros-ease-emphasized), height var(--zeros-duration) var(--zeros-ease-emphasized), box-shadow var(--zeros-duration) var(--zeros-ease)"
              : "left 80ms linear, width var(--zeros-duration) var(--zeros-ease-emphasized), height var(--zeros-duration) var(--zeros-ease-emphasized), box-shadow var(--zeros-duration) var(--zeros-ease)",
            pointerEvents: "auto",
            cursor: "grab",
            zIndex: 2,
          }}
          onMouseEnter={() => setIsKnobHovered(true)}
          onMouseLeave={() => {
            if (!isDragging) setIsKnobHovered(false);
          }}
        />
      </div>
    </div>
  );
}
