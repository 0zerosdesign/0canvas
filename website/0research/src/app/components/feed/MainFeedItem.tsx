// ============================================
// COMPONENT: MainFeedItem
// PURPOSE: Displays a single feed item in the main feed area with a single
//          primary media (image or video). No carousel — one media per feed.
//
// SCROLL-SNAP: Uses .zeros-feed-card class for CSS scroll-snap-stop: always
// OBSERVER: Uses id="feed-{id}" for IntersectionObserver detection
//
// USED IN: FeedExperience (main feed area, CSS scroll-snap vertical)
// ============================================

import { useRef, useEffect, useState } from "react";
import { ImageWithFallback } from "../shared/ImageWithFallback";
import { VideoPlayer } from "./VideoPlayer";
import { VideoTimeline } from "./VideoTimeline";
import type { MainFeedItemProps } from "../../types";

export function MainFeedItem({
  id,
  title,
  mediaUrl,
  mediaType,
  isActive,
}: MainFeedItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeVideoElement, setActiveVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isVideoPaused, setIsVideoPaused] = useState(false);

  const isVideo = mediaType === "video";

  // Find video element when active and media is video
  useEffect(() => {
    if (!isVideo || !isActive || !containerRef.current) {
      setActiveVideoElement(null);
      return;
    }
    const video = containerRef.current.querySelector<HTMLVideoElement>("video[data-video-player]");
    setActiveVideoElement(video);
  }, [isVideo, isActive]);

  const shouldScaleDown = isVideo && isVideoPaused;

  return (
    <div className="zeros-feed-card" id={`feed-${id}`}>
      <zeros-media-wrapper>
        <zeros-media-stage>
          <zeros-media-container
            ref={containerRef}
            is-scaled={shouldScaleDown ? "" : undefined}
          >
            {mediaUrl ? (
              isVideo ? (
                <VideoPlayer
                  src={mediaUrl}
                  autoPlay={isActive}
                  onPause={() => setIsVideoPaused(true)}
                  onPlay={() => setIsVideoPaused(false)}
                />
              ) : (
                <ImageWithFallback
                  src={mediaUrl}
                  alt={title}
                  className="zeros-media-image"
                />
              )
            ) : (
              <div className="zeros-media-placeholder">
                <span>No media</span>
              </div>
            )}
          </zeros-media-container>

          {isVideo && isVideoPaused && activeVideoElement && (
            <VideoTimeline videoElement={activeVideoElement} />
          )}
        </zeros-media-stage>
      </zeros-media-wrapper>
    </div>
  );
}
