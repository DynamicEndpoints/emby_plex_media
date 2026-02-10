import { NextRequest, NextResponse } from "next/server";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
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
    const contentType = res.headers.get("content-type") || undefined;
    const text = await res.text();
    try {
      return { ok: true as const, status: res.status, json: JSON.parse(text) as any, contentType };
    } catch {
      return { ok: true as const, status: res.status, json: null as any, text, contentType };
    }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function looksLikeHtml(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trimStart().slice(0, 200).toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html") || trimmed.includes("<head");
}

function truncate(text: string | undefined, maxLen: number): string | undefined {
  if (!text) return undefined;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function buildCandidateApiUrls(inputUrl: string): string[] {
  const normalized = normalizeBaseUrl(inputUrl);
  const origin = deriveOriginUrl(normalized);

  const candidates = new Set<string>();
  candidates.add(normalized);

  // Common panel API scripts
  const scripts = ["api.php", "reseller_api.php", "admin_api.php"]; // low-risk guesses
  for (const script of scripts) {
    // Relative to the provided URL path
    try {
      candidates.add(new URL(script, ensureTrailingSlash(normalized)).toString().replace(/\/$/, ""));
    } catch {
      // ignore
    }

    // From origin root
    try {
      candidates.add(new URL(`/${script}`, origin).toString().replace(/\/$/, ""));
    } catch {
      // ignore
    }
  }

  return Array.from(candidates);
}

function isInvalidApiKeyError(status: unknown, error: unknown): boolean {
  if (status !== "STATUS_FAILURE") return false;
  if (typeof error !== "string") return false;
  return /invalid api key/i.test(error);
}

function isAuthSuccessShape(json: any): boolean {
  if (!json || typeof json !== "object") return false;
  if (json.status === "STATUS_SUCCESS") return true;
  if (json.success === true) return true;
  return false;
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
    const keyParamCandidates = [
      "api_key",
      "apikey",
      "apiKey",
      "key",
      "token",
      "api_token",
      "api-token",
    ];

    const apiUrlCandidates = buildCandidateApiUrls(panelUrl);

    const apiAuthAttempts: Array<{
      apiUrl: string;
      keyParam: string;
      httpStatus?: number;
      contentType?: string;
      parsedStatus?: string;
      parsedError?: string;
      isJson?: boolean;
      looksLikeHtml?: boolean;
      textSample?: string;
      note?: string;
    }> = [];

    let apiAuth: { ok: boolean; status?: number; message?: string; keyParam?: string } = {
      ok: false,
    };

    for (const apiUrl of apiUrlCandidates) {
      for (const keyParam of keyParamCandidates) {
        const pingUrl = `${apiUrl}${apiUrl.includes("?") ? "&" : "?"}${keyParam}=${encodeURIComponent(
          apiKey
        )}`;
        const res = await tryFetchJson(pingUrl);
        if (!res.ok) {
          apiAuthAttempts.push({ apiUrl, keyParam, note: res.error });
          continue;
        }

        const parsedStatus =
          res.json && typeof res.json === "object" && typeof (res.json as any).status === "string"
            ? ((res.json as any).status as string)
            : undefined;
        const parsedError =
          res.json && typeof res.json === "object" && typeof (res.json as any).error === "string"
            ? ((res.json as any).error as string)
            : undefined;

        const textSample = "text" in res ? truncate((res as any).text, 200) : undefined;
        const htmlish = "text" in res ? looksLikeHtml((res as any).text) : false;

        apiAuthAttempts.push({
          apiUrl,
          keyParam,
          httpStatus: res.status,
          contentType: (res as any).contentType,
          parsedStatus,
          parsedError,
          isJson: !!res.json,
          looksLikeHtml: htmlish,
          textSample,
        });

        if (isAuthSuccessShape(res.json)) {
          apiAuth = {
            ok: true,
            status: res.status,
            message: `Authenticated via ${keyParam}`,
            keyParam,
          };
          break;
        }

        if (isInvalidApiKeyError(parsedStatus, parsedError)) {
          // Keep trying other param names just in case.
          continue;
        }

        // If we got a JSON response and it *didn't* say invalid api key, it's very likely
        // the key parameter name is correct (panel-specific schemas vary).
        if (res.json && typeof res.json === "object") {
          apiAuth = {
            ok: true,
            status: res.status,
            message: `Panel responded with JSON via ${keyParam} (treating as authenticated)`,
            keyParam,
          };
          break;
        }
      }

      if (apiAuth.ok) break;
    }

    if (!apiAuth.ok) {
      const anyHtml = apiAuthAttempts.some((a) => a.looksLikeHtml);
      const hint = anyHtml
        ? "The panel responded with HTML (likely the Web UI). Try setting Panel URL to a panel API script like https://YOUR_PANEL/api.php (or reseller_api.php), then retest."
        : undefined;

      return NextResponse.json(
        {
          success: false,
          error: apiAuth.message || "Failed to authenticate to Xtreme UI API (check API URL + key)",
          panelStatus: panelProbe.status,
          hint,
          debug: {
            apiUrlCandidates,
            apiAuthAttempts,
          },
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
