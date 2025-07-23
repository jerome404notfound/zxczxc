"use client";
import { useEffect, useRef, useCallback } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";

export type MediaData = {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
};

type SelectorItem = {
  html: string;
  value: number;
  default?: boolean;
};

export default function ArtHlsPlayer({
  m3u8link,
  data,
}: {
  m3u8link: string;
  data: MediaData;
}) {
  const artRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 Starting cleanup...");

    // Stop HLS first to prevent any loading
    if (hlsRef.current) {
      console.log("🛑 Stopping HLS instance");
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch (error) {
        console.warn("Error destroying HLS:", error);
      }
      hlsRef.current = null;
    }

    // Pause and cleanup video element
    if (videoRef.current) {
      console.log("📹 Cleaning up video element");
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      } catch (error) {
        console.warn("Error cleaning video:", error);
      }
      videoRef.current = null;
    }

    // Destroy ArtPlayer instance last
    if (instanceRef.current) {
      console.log("🎮 Destroying ArtPlayer instance");
      try {
        instanceRef.current.destroy();
      } catch (error) {
        console.warn("Error destroying ArtPlayer:", error);
      }
      instanceRef.current = null;
    }

    isInitializedRef.current = false;
    console.log("✅ Cleanup completed");
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (!artRef.current || !m3u8link || isInitializedRef.current) {
      return;
    }

    console.log("🚀 Initializing new player instance");
    isInitializedRef.current = true;

    // Cleanup any existing instances first
    cleanup();

    const art = new Artplayer({
      container: artRef.current,
      autoplay: true,
      theme: "#23ade5",
      isLive: false,
      poster: data.backdrop_path
        ? `https://image.tmdb.org/t/p/original/${data.backdrop_path}`
        : undefined,
      autoSize: true,
      autoMini: true,
      setting: true,
      fullscreen: true,
      fullscreenWeb: true,
      hotkey: true,
      airplay: true,
      playsInline: true,
      playbackRate: true,
      aspectRatio: true,
      moreVideoAttr: {
        crossOrigin: "anonymous",
      },
      customType: {
        m3u8: (video: HTMLVideoElement, url: string) => {
          console.log("🔧 Setting up HLS for:", url);

          // Store video reference
          videoRef.current = video;

          if (Hls.isSupported()) {
            // Make sure no existing HLS instance
            if (hlsRef.current) {
              hlsRef.current.destroy();
            }

            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              debug: false,
              autoStartLoad: false,
            });

            hlsRef.current = hls;

            hls.loadSource(url);
            hls.attachMedia(video);

            // Event handlers
            const handlePause = () => {
              console.log("⏸️ Video paused");
              if (hlsRef.current) {
                hlsRef.current.stopLoad();
              }
            };

            const handlePlay = () => {
              console.log("▶️ Video playing");
              if (hlsRef.current) {
                hlsRef.current.startLoad();
              }
            };

            const handleEnded = () => {
              console.log("🔚 Video ended");
              if (hlsRef.current) {
                hlsRef.current.stopLoad();
              }
            };

            // Add event listeners
            video.addEventListener("pause", handlePause);
            video.addEventListener("play", handlePlay);
            video.addEventListener("ended", handleEnded);

            // Store cleanup for these specific listeners
            const cleanupVideoListeners = () => {
              video.removeEventListener("pause", handlePause);
              video.removeEventListener("play", handlePlay);
              video.removeEventListener("ended", handleEnded);
            };

            // Store cleanup function on the video element for later use
            (video as any)._cleanupListeners = cleanupVideoListeners;

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.log("📜 HLS manifest parsed");
              if (hlsRef.current === hls) {
                // Make sure this is still the current instance
                hls.startLoad();
              }

              const levels = hls?.levels || [];
              if (levels.length > 1) {
                // Remove existing quality setting
                const existingQuality = art.setting.option.find(
                  (item: any) => item.html === "Quality"
                );
                if (existingQuality) {
                  const qualityIndex =
                    art.setting.option.indexOf(existingQuality);
                  if (qualityIndex !== -1) {
                    art.setting.option.splice(qualityIndex, 1);
                  }
                }

                // Add quality setting
                art.setting.add({
                  html: "Quality",
                  selector: [
                    { html: "Auto", value: -1, default: true },
                    ...levels.map((level, index) => ({
                      html: `${level.height}p (${Math.round(
                        level.bitrate / 1000
                      )}k)`,
                      value: index,
                    })),
                  ],
                  onSelect(item: any) {
                    if (hlsRef.current) {
                      hlsRef.current.currentLevel = item.value;
                    }
                    return item.html;
                  },
                });
              }
            });

            // Audio tracks
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_: any, data: any) => {
              const audioTracks = data.audioTracks || [];
           

              if (audioTracks.length > 1) {
                // Remove existing "Audio" setting if present
                const existingAudio = art.setting.option.find(
                  (item: any) => item.html === "Audio"
                );
                if (existingAudio) {
                  const audioIndex = art.setting.option.indexOf(existingAudio);
                  if (audioIndex !== -1) {
                    art.setting.option.splice(audioIndex, 1);
                  }
                }

                // Step 1: Prioritize Filipino
                let preferredTrackIndex = audioTracks.findIndex(
                  (track: any) =>
                    track.lang?.toLowerCase() === "fil" ||
                    track.name?.toLowerCase().includes("fil")
                );

                // Step 2: Fallback to English with "en_2" in the URL
                if (preferredTrackIndex === -1) {
                  preferredTrackIndex = audioTracks.findIndex(
                    (track: any) =>
                      track.lang?.toLowerCase() === "en" &&
                      track.url?.toLowerCase().includes("en_2")
                  );
                }

                // Step 3: Fallback to first available English
                if (preferredTrackIndex === -1) {
                  preferredTrackIndex = audioTracks.findIndex(
                    (track: any) => track.lang?.toLowerCase() === "en"
                  );
                }

                // Set the default audio track
                if (preferredTrackIndex !== -1) {
                  hls.audioTrack = preferredTrackIndex;
                  console.log(
                    "✅ Selected audio track index:",
                    preferredTrackIndex
                  );
                } else {
                  console.warn("⚠️ No suitable audio track found");
                }

                // Add audio selector to ArtPlayer settings
                art.setting.add({
                  html: "Audio",
                  selector: audioTracks.map((track: any, index: number) => ({
                    html: track.name || track.lang || `Audio ${index + 1}`,
                    value: index,
                    default: index === preferredTrackIndex,
                  })),
                  onSelect(item: SelectorItem) {
                    if (hlsRef.current) {
                      hlsRef.current.audioTrack = item.value;
                    }
                    return item.html;
                  },
                });
              }
            });

            // Subtitles
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_: any, data: any) => {
              const subtitleTracks = data.subtitleTracks || [];
                 console.log("🎧 Audio Tracks", subtitleTracks);
              if (subtitleTracks.length > 0) {
                const existingSubtitle = art.setting.option.find(
                  (item: any) => item.html === "Subtitle"
                );
                if (existingSubtitle) {
                  const subtitleIndex =
                    art.setting.option.indexOf(existingSubtitle);
                  if (subtitleIndex !== -1) {
                    art.setting.option.splice(subtitleIndex, 1);
                  }
                }

                art.setting.add({
                  html: "Subtitle",
                  selector: [
                    { html: "Off", value: -1, default: true },
                    ...subtitleTracks.map((track: any, index: number) => ({
                      html: track.name || track.lang || `Subtitle ${index + 1}`,
                      value: index,
                    })),
                  ],
                  onSelect(item: SelectorItem) {
                    if (hlsRef.current) {
                      hlsRef.current.subtitleTrack = item.value;
                    }
                    return item.html;
                  },
                });
              }
            });

            // Error handling
            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
              console.error("❌ HLS Error:", data);
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log("🌐 Network error - attempting recovery");
                    if (hlsRef.current === hls) {
                      hls.startLoad();
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log("🎬 Media error - attempting recovery");
                    if (hlsRef.current === hls) {
                      hls.recoverMediaError();
                    }
                    break;
                  default:
                    console.log("💀 Fatal error - cleaning up");
                    cleanup();
                    break;
                }
              }
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            console.log("🍎 Using native HLS support");
            video.src = url;
          }
        },
      },
      url: m3u8link,
      type: "m3u8",
    });

    // ArtPlayer event listeners
    art.on("pause", () => {
      console.log("⏸️ ArtPlayer paused");
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
      }
    });

    art.on("play", () => {
      console.log("▶️ ArtPlayer playing");
      if (hlsRef.current) {
        hlsRef.current.startLoad();
      }
    });

    art.on("destroy", () => {
      console.log("💥 ArtPlayer destroy event");
    });

    instanceRef.current = art;

    // Cleanup function for this specific effect
    return () => {
      console.log("🔄 Effect cleanup");
      // Clean up video event listeners if they exist
      if (videoRef.current && (videoRef.current as any)._cleanupListeners) {
        (videoRef.current as any)._cleanupListeners();
      }
      cleanup();
    };
  }, [m3u8link]); // Only depend on m3u8link

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      console.log("🏁 Component unmounting");
      cleanup();
    };
  }, [cleanup]);

  return (
    <div
      ref={artRef}
      className="h-full w-full flex justify-between items-center"
    />
  );
}
