// // app/api/[...stream]/route.ts

// import { NextRequest } from "next/server";
// import axios, { AxiosError } from "axios";

// // Run this code on the Node.js runtime
// export const runtime = "nodejs";

// /**
//  * API handler for GET requests to proxy .m3u8 playlists only
//  */
// export async function GET(
//   req: NextRequest,
//   { params }: { params: Promise<{ stream: string[] }> }
// ) {
//   const resolvedParams = await params;
//   const path = resolvedParams.stream.join("/");

//   if (!path) {
//     return new Response("meow", { status: 400 });
//   }

//   const targetUrl = `https://scrennnifu.click/${path}`;
//   const isM3U8 = targetUrl.endsWith(".m3u8");

//   const origin = req.headers.get("origin") || "";
//   const referer = req.headers.get("referer") || "";

//   const allowedOrigins = [
//     "https://zxcstream-api-production.up.railway.app",
//     "http://localhost:3000/",
//   ];

//   const isValidOrigin = allowedOrigins.includes(origin);
//   const isValidReferer = allowedOrigins.some((url) => referer.startsWith(url));

//   if (!isValidOrigin && !isValidReferer) {
//     console.warn("❌ Blocked request | Origin:", origin, "| Referer:", referer);
//     return new Response("Forbidden: Invalid Origin/Referer", { status: 403 });
//   }

//   try {
//     const response = await axios.get(targetUrl, {
//       responseType: "text", // Only need text for .m3u8
//       headers: {
//         "User-Agent": req.headers.get("user-agent") || "",
//       },
//     });

//     if (isM3U8) {
//       const base =
//         new URL(targetUrl).origin +
//         "/" +
//         path.substring(0, path.lastIndexOf("/"));

//       // Rewrite segment links to absolute paths (not proxied)
//       const rewritten = response.data.replace(
//         /^(?!#)(.*\.(ts|m4s|vtt))$/gm,
//         (match: string) => `${base}/${match}`
//       );

//       return new Response(rewritten, {
//         status: 200,
//         headers: {
//           "Content-Type": "application/vnd.apple.mpegurl",
//           "Access-Control-Allow-Origin": "*",
//         },
//       });
//     }

//     // Not .m3u8 – don't proxy anything else
//     return new Response("moew", {
//       status: 403,
//     });
//   } catch (err: unknown) {
//     const error = err as AxiosError;

//     console.error("❌ Proxy error:", error.message);
//     if (error.response) {
//       console.error("❗ Response status:", error.response.status);
//       console.error("❗ Response data:", error.response.data);
//     }

//     return new Response("Proxy fetch failed", { status: 500 });
//   }
// }
// import type { NextRequest } from "next/server";
// import axios, { type AxiosError } from "axios";

// export const runtime = "nodejs";

// export async function GET(
//   req: NextRequest,
//   { params }: { params: Promise<{ stream: string[] }> }
// ) {
//   const resolvedParams = await params;
//   const path = resolvedParams.stream.join("/");

//   if (!path) {
//     return new Response("Bad Request: No path provided", { status: 400 });
//   }

//   const targetUrl = `https://scrennnifu.click/${path}`;
//   const isM3U8 = targetUrl.endsWith(".m3u8");

//   // Only proxy .m3u8 playlists, not segments
//   if (!isM3U8) {
//     return new Response("Forbidden: Only .m3u8 files allowed", {
//       status: 403,
//     });
//   }

//   const origin = req.headers.get("origin") || "";
//   const referer = req.headers.get("referer") || "";

//   const allowedOrigins = [
//     "https://zxcstream-api-production.up.railway.app",
//     "http://localhost:3000",
//   ];

//   const isValidOrigin = allowedOrigins.includes(origin);
//   const isValidReferer = allowedOrigins.some((url) => referer.startsWith(url));

//   if (!isValidOrigin && !isValidReferer) {
//     console.warn("❌ Blocked request | Origin:", origin, "| Referer:", referer);
//     return new Response("Forbidden: Invalid Origin/Referer", { status: 403 });
//   }

//   try {
//     const response = await axios.get(targetUrl, {
//       responseType: "text",
//       headers: {
//         "User-Agent": req.headers.get("user-agent") || "",
//       },
//       timeout: 10000, // 10 second timeout
//     });

//     const base =
//       new URL(targetUrl).origin +
//       "/" +
//       path.substring(0, path.lastIndexOf("/"));

//     // Rewrite segment links to absolute paths (not proxied)
//     const rewritten = response.data.replace(
//       /^(?!#)(.*\.(ts|m4s|vtt))$/gm,
//       (match: string) => `${base}/${match}`
//     );

//     return new Response(rewritten, {
//       status: response.status,
//       headers: {
//         "Content-Type": "application/vnd.apple.mpegurl",
//         "Access-Control-Allow-Origin": "*",
//         "Cache-Control": "public, max-age=30", // Cache for 30 seconds
//       },
//     });
//   } catch (err: unknown) {
//     const error = err as AxiosError;
//     console.error("❌ Proxy error:", error.message);

//     return new Response("Proxy fetch failed", { status: 500 });
//   }
// }

// export async function OPTIONS() {
//   return new Response(null, {
//     status: 200,
//     headers: {
//       "Access-Control-Allow-Origin": "*",
//       "Access-Control-Allow-Methods": "GET, OPTIONS",
//       "Access-Control-Allow-Headers": "User-Agent",
//     },
//   });
// }
import { NextRequest } from "next/server";
import axios, { AxiosError } from "axios";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { stream: string[] } }
) {
  const streamSegments = params.stream;

  const encoded = streamSegments?.[0];
  const trailing = streamSegments?.slice(1).join("/"); // Rest of the path

  if (!encoded) {
    return new Response("Bad Request: No encoded path", { status: 400 });
  }

  let decodedPath = "";
  try {
    decodedPath = atob(encoded); // Decode Base64
  } catch {
    return new Response("Bad Request: Invalid base64", { status: 400 });
  }

  const fullPath = trailing ? `${decodedPath}/${trailing}` : decodedPath;
  const targetUrl = `https://scrennnifu.click/${fullPath}`;

  if (!targetUrl.includes(".m3u8") && !targetUrl.includes(".ts")) {
    return new Response("Forbidden: Only HLS resources allowed", {
      status: 403,
    });
  }

  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  const allowedOrigins = [
    "https://zxcstream-api-production.up.railway.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  const isValidOrigin = allowedOrigins.includes(origin);
  const isValidReferer = allowedOrigins.some((url) => referer.startsWith(url));

  if (!isValidOrigin && !isValidReferer) {
    console.warn("❌ Blocked request | Origin:", origin, "| Referer:", referer);
    return new Response("Forbidden: Invalid Origin/Referer", { status: 403 });
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: "text",
      headers: {
        "User-Agent": req.headers.get("user-agent") || "",
      },
      timeout: 10000,
    });

    // Only rewrite if it's a .m3u8 playlist
    const contentType = response.headers["content-type"];
    const isM3U8 = contentType?.includes("application/vnd.apple.mpegurl");

    const base =
      new URL(targetUrl).origin +
      "/" +
      fullPath.substring(0, fullPath.lastIndexOf("/"));

    const rewritten = isM3U8
      ? response.data.replace(
          /^(?!#)(.*\.(ts|m4s|vtt))$/gm,
          (match: string) => `${base}/${match}`
        )
      : response.data;

    return new Response(rewritten, {
      status: response.status,
      headers: {
        "Content-Type": contentType || "text/plain",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch (err: unknown) {
    const error = err as AxiosError;
    console.error("❌ Proxy error:", error.message);

    return new Response("Proxy fetch failed", { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "User-Agent",
    },
  });
}
