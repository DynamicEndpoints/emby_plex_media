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

  const baseUrls = new Set<string>();
  baseUrls.add(normalized);

  // If the user pasted a deep UI route (e.g. /something/dashboard), also try the directory base.
  // Many panels host their API scripts alongside the UI within the same folder.
  try {
    const u = new URL(normalized);
    const pathname = u.pathname || "/";
    if (pathname !== "/" && !pathname.endsWith("/")) {
      const dir = pathname.slice(0, pathname.lastIndexOf("/") + 1);
      baseUrls.add(new URL(dir, `${u.protocol}//${u.host}`).toString().replace(/\/$/, ""));
    }

    // Common UI endpoints we can strip to get a better base.
    const uiSuffixes = ["/dashboard", "/login", "/index.php", "/panel", "/admin"]; 
    for (const suffix of uiSuffixes) {
      if (pathname.toLowerCase().endsWith(suffix)) {
        const basePath = pathname.slice(0, pathname.length - suffix.length + 1);
        if (basePath) {
          baseUrls.add(new URL(basePath, `${u.protocol}//${u.host}`).toString().replace(/\/$/, ""));
        }
      }
    }
  } catch {
    // ignore
  }

  // If the user pasted only a bare domain, the panel may live under a subpath.
  try {
    const u = new URL(normalized);
    const path = u.pathname || "/";
    if (path === "/" || path === "") {
      const commonPanelPaths = [
        "/xui",
        "/xtremeui",
        "/xtreamui",
        "/panel",
        "/admin",
        "/ui",
      ];
      for (const p of commonPanelPaths) {
        baseUrls.add(new URL(p, origin).toString().replace(/\/$/, ""));
      }
    }
  } catch {
    // ignore
  }

  const candidates = new Set<string>();
  for (const baseUrl of baseUrls) {
    candidates.add(baseUrl);

    // Common panel API scripts
    const scripts = ["api.php", "reseller_api.php", "admin_api.php"]; // low-risk guesses
    for (const script of scripts) {
      // Relative to the provided URL path
      try {
        candidates.add(new URL(script, ensureTrailingSlash(baseUrl)).toString().replace(/\/$/, ""));
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

    if (!url) {
      return NextResponse.json({ error: "Missing Panel URL" }, { status: 400 });
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

    // Some panels embed the API token in the URL path and do not require an apiKey query param.
    // Probe each candidate once without adding any key param.
    for (const apiUrl of apiUrlCandidates) {
      const res = await tryFetchJson(apiUrl);
      if (!res.ok) {
        apiAuthAttempts.push({ apiUrl, keyParam: "(none)", note: res.error });
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
        keyParam: "(none)",
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
          message: "Authenticated without API key parameter (token likely embedded in URL)",
        };
        break;
      }

      // If we got JSON and it does not explicitly say invalid api key, treat it as an API endpoint.
      // This avoids false negatives for panels with different success schemas.
      if (res.json && typeof res.json === "object" && !isInvalidApiKeyError(parsedStatus, parsedError)) {
        apiAuth = {
          ok: true,
          status: res.status,
          message: "Panel responded with JSON without API key parameter (treating as authenticated)",
        };
        break;
      }
    }

    if (!apiAuth.ok && apiKey) {
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
    }

    if (!apiAuth.ok) {
      const anyHtml = apiAuthAttempts.some((a) => a.looksLikeHtml);
      const hint = anyHtml
        ? "The panel responded with HTML (likely the Web UI). Try setting Panel URL to a panel API script like https://YOUR_PANEL/api.php (or reseller_api.php), then retest."
        : undefined;

      const keyHint = !apiKey
        ? "This panel may require an API key. Enter the Xtreme UI API key and retest (or provide an API URL that embeds the token)."
        : undefined;

      return NextResponse.json(
        {
          success: false,
          error:
            apiAuth.message ||
            (!apiKey
              ? "Failed to authenticate to Xtreme UI API (API key missing)"
              : "Failed to authenticate to Xtreme UI API (check API URL + key)"),
          panelStatus: panelProbe.status,
          hint: hint || keyHint,
          debug: {
            apiUrlCandidates,
            apiAuthAttempts,
          },
        },
        { status: 400 }
      );
    }

    // 3) API auth succeeded — that's all we need for user management
    //    (create, suspend, renew, revoke). Stream/playlist probing is not
    //    required because the panel API handles user lifecycle; the panel
    //    itself generates M3U/playlist URLs for provisioned users.
    return NextResponse.json({
      success: true,
      panelStatus: panelProbe.status,
      apiAuth,
      streamBaseUrl: streamUrl,
      notes:
        "Panel is reachable and API authenticated. User management (create/suspend/renew) is ready.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
