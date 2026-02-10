import { NextRequest, NextResponse } from "next/server";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function deriveOriginUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return normalizeBaseUrl(url);
  }
}

async function tryFetch(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });
    return { ok: true as const, status: res.status };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function tryFetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return { ok: true as const, status: res.status, json: JSON.parse(text) as any };
    } catch {
      return { ok: true as const, status: res.status, json: null as any, text };
    }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, apiKey, streamBaseUrl } = body as {
      url?: string;
      apiKey?: string;
      streamBaseUrl?: string;
    };

    if (!url || !apiKey) {
      return NextResponse.json({ error: "Missing Panel URL or API key" }, { status: 400 });
    }

    const panelUrl = normalizeBaseUrl(url);
    const streamUrl = normalizeBaseUrl(streamBaseUrl || deriveOriginUrl(url));

    // 1) Basic reachability
    const panelProbe = await tryFetch(panelUrl, { method: "GET" });
    if (!panelProbe.ok) {
      return NextResponse.json(
        { success: false, error: `Panel URL unreachable: ${panelProbe.error}` },
        { status: 400 }
      );
    }

    // 2) Validate API key against the panel API.
    // Many Xtreme UI panels return STATUS_FAILURE/STATUS_SUCCESS.
    const keyParamCandidates = ["api_key", "key", "apikey"]; // try a few common variants
    let apiAuth: { ok: boolean; status?: number; message?: string } = { ok: false };

    for (const keyParam of keyParamCandidates) {
      const pingUrl = `${panelUrl}${panelUrl.includes("?") ? "&" : "?"}${keyParam}=${encodeURIComponent(
        apiKey
      )}`;
      const res = await tryFetchJson(pingUrl);
      if (!res.ok) continue;

      const status = (res.json && typeof res.json === "object" ? res.json.status : undefined) as
        | string
        | undefined;
      const error = (res.json && typeof res.json === "object" ? res.json.error : undefined) as
        | string
        | undefined;

      if (status === "STATUS_SUCCESS") {
        apiAuth = { ok: true, status: res.status, message: `Authenticated via ${keyParam}` };
        break;
      }

      if (status === "STATUS_FAILURE" && error && /invalid api key/i.test(error)) {
        apiAuth = { ok: false, status: res.status, message: "Invalid API key" };
        // Keep trying other param names just in case.
        continue;
      }

      // If we got JSON but not a recognized status, keep probing.
    }

    if (!apiAuth.ok) {
      return NextResponse.json(
        {
          success: false,
          error: apiAuth.message || "Failed to authenticate to Xtreme UI API (check API URL + key)",
          panelStatus: panelProbe.status,
        },
        { status: 400 }
      );
    }

    // 3) Probe typical Xtream-style endpoint used for playlists.
    // We don't validate credentials here; we just ensure the endpoint exists.
    const m3uProbeUrl = `${streamUrl}/get.php?username=test&password=test&type=m3u_plus&output=ts`;
    const m3uProbe = await tryFetch(m3uProbeUrl, { method: "GET" });

    // Treat 404 as definitive failure; other statuses (200/401/403/500) can vary by panel.
    if (!m3uProbe.ok) {
      return NextResponse.json(
        { success: false, error: `Stream URL probe failed: ${m3uProbe.error}` },
        { status: 400 }
      );
    }

    if (m3uProbe.status === 404) {
      return NextResponse.json(
        {
          success: false,
          error: "Stream URL does not look like an Xtream playlist endpoint (get.php returned 404)",
        },
        { status: 400 }
      );
    }

    // If we got here, we can reach the panel + authenticate + reach playlist endpoint.
    return NextResponse.json({
      success: true,
      panelStatus: panelProbe.status,
      streamStatus: m3uProbe.status,
      apiAuth,
      notes:
        "Connectivity looks good. Provisioning will generate M3U URLs using the Stream Base URL.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
