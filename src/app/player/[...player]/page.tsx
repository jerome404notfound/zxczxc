"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HslPlayer from "./hsl";
import { MediaData } from "./hsl";
import logo from "@/assets/zxzx.png";

export default function PlayerPage() {
  const params = useParams();
  const media_type = params?.player?.[0];
  const id = params?.player?.[1];
  const season = params?.player?.[2];
  const episode = params?.player?.[3];

  const [show, setShow] = useState<MediaData | null>(null);
  const [m3u8Url, setM3u8Url] = useState("");
  const [useIframe, setUseIframe] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  const apiKey = "47a1a7df542d3d483227f758a7317dff";
  const allowedDomain = "http://localhost:3002";

useEffect(() => {
  try {
    const isFramed = window.top !== window.self;
    const referrer = document.referrer;

    // Strictly require matching domain in all cases
    if (
      (isFramed && referrer.startsWith(allowedDomain)) ||
      (!isFramed && window.location.origin === allowedDomain)
    ) {
      setIsAllowed(true);
    } else {
      setIsAllowed(false);
    }
  } catch (e) {
    setIsAllowed(false);
  }
}, []);


  useEffect(() => {
    const fetchStream = async () => {
      if (!media_type || !id) return;

      try {
        const imdbRes = await fetch(
          `https://api.themoviedb.org/3/${media_type}/${id}/external_ids?api_key=${apiKey}`
        );
        const endpointRes = await fetch(
          `https://api.themoviedb.org/3/${media_type}/${id}?api_key=${apiKey}`
        );
        const imdbData = await imdbRes.json();
        const endpointData = await endpointRes.json();

        setShow(endpointData);

        if (imdbData?.imdb_id) {
          const rawPath = [
            media_type === "tv" ? "serial" : "movie",
            imdbData.imdb_id,
            season,
            episode,
          ]
            .filter(Boolean)
            .join("/");

          const encoded = btoa(rawPath);
          const playlistUrl = `/api/${encoded}/playlist.m3u8`;

          const headCheck = await fetch(playlistUrl, { method: "HEAD" });
          if (headCheck.ok) {
            setM3u8Url(playlistUrl);
          } else {
            setUseIframe(true);
          }
        } else {
          setUseIframe(true);
        }
      } catch (error) {
        console.error("Stream fetch failed", error);
        setUseIframe(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStream();
  }, [media_type, id, season, episode]);

  const iframeSrc =
    media_type === "movie"
      ? `https://vidsrc.cc/v2/embed/movie/${id}`
      : `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;

  if (!isAllowed) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-white">
      
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-sm text-muted-foreground">
          <img
            className="h-16 w-16 object-contain animate-pulse"
            src={logo.src}
            alt="Logo"
          />
          <div className="w-5 h-5 border-3 border-gray-300 border-t-black rounded-full animate-spin" />
          <p className="text-xs">Fetching data...</p>
        </div>
      ) : m3u8Url && show && !useIframe ? (
        <HslPlayer m3u8link={m3u8Url} data={show} />
      ) : useIframe ? (
        <iframe
          src={iframeSrc}
          width="100%"
          height="100%"
          allowFullScreen
          frameBorder="0"
        />
      ) : null}
    </div>
  );
}
