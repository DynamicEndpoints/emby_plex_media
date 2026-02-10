import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Fetches available packages/bouquets from the IPTV panel API.
 * Uses the saved Xtreme UI settings from Convex.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch IPTV settings from Convex
    const settings = await convex.query(api.settings.getAll);
    const apiUrl = settings?.xtreme_ui_url;
    const apiKey = settings?.xtreme_ui_api_key;

    if (!apiUrl) {
      return NextResponse.json(
        { error: "IPTV panel URL not configured. Go to Settings → Xtreme UI to set it up." },
        { status: 400 }
      );
    }

    // Try fetching packages from the panel with multiple action/endpoint variants
    const packages = await fetchPackagesFromPanel(apiUrl, apiKey || "");
    return NextResponse.json({ success: true, packages });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

type PanelPackage = {
  id: string;
  name: string;
  bouquetIds?: string[];
  raw?: Record<string, unknown>;
};

async function fetchJsonFromPanel(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return { ok: true, status: res.status, json: JSON.parse(text) };
    } catch {
      return { ok: true, status: res.status, json: null, text };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPackagesFromPanel(apiUrl: string, apiKey: string): Promise<PanelPackage[]> {
  const baseUrl = apiUrl.replace(/\/$/, "");

  // Build the param string for auth
  const authParams = apiKey
    ? buildAuthParams(apiKey)
    : "";

  // Try multiple common Xtream/XUI endpoints for listing packages/bouquets
  const actionCandidates = [
    // XUI style
    { action: "packages", sub: undefined },
    { action: "package", sub: "list" },
    { action: "packages", sub: "list" },
    { action: "bouquet", sub: "list" },
    { action: "bouquets", sub: undefined },
    { action: "bouquet", sub: undefined },
    // Xtream Codes style
    { action: "get_packages", sub: undefined },
    { action: "get_bouquets", sub: undefined },
    { action: "user", sub: "packages" },
  ];

  for (const { action, sub } of actionCandidates) {
    const params = new URLSearchParams();
    if (authParams) {
      // Try each key param style
      for (const [k, v] of new URLSearchParams(authParams)) {
        params.set(k, v);
      }
    }
    params.set("action", action);
    if (sub) params.set("sub", sub);

    const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${params.toString()}`;
    const res = await fetchJsonFromPanel(url);

    if (!res.ok || !res.json) continue;

    const parsed = tryParsePackages(res.json);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  // If the API URL itself already returns package data (some token-in-URL panels
  // return the full config including packages at the base URL), check the base response
  const baseRes = await fetchJsonFromPanel(baseUrl);
  if (baseRes.ok && baseRes.json) {
    // Check if the base response has packages/bouquets embedded
    const embedded = tryExtractEmbeddedPackages(baseRes.json);
    if (embedded.length > 0) return embedded;
  }

  return [];
}

function buildAuthParams(apiKey: string): string {
  // Use api_key as the default; the panel test already validated which param works
  return `api_key=${encodeURIComponent(apiKey)}`;
}

/**
 * Try to parse a JSON response into a list of packages.
 * Handles multiple shapes:
 *  - Array of objects with id/name
 *  - Object keyed by id: { "1": { name: "Basic" }, ... }
 *  - Wrapped: { packages: [...] } or { bouquets: [...] } or { data: [...] }
 */
function tryParsePackages(json: any): PanelPackage[] {
  if (!json || typeof json !== "object") return [];

  // Unwrap common wrappers
  const candidates = [
    json,
    json.packages,
    json.bouquets,
    json.data,
    json.result,
    json.items,
    json.list,
  ];

  for (const data of candidates) {
    if (!data) continue;

    // Array of objects
    if (Array.isArray(data)) {
      const items = data
        .filter((item: any) => item && typeof item === "object")
        .map((item: any) => normalizePackage(item))
        .filter((p): p is PanelPackage => !!p);
      if (items.length > 0) return items;
    }

    // Object keyed by id: { "1": { name: "Basic" }, "2": { name: "Premium" } }
    if (typeof data === "object" && !Array.isArray(data)) {
      const keys = Object.keys(data);
      // Heuristic: if most keys look like numeric IDs and values are objects, treat as id-keyed map
      const numericKeys = keys.filter((k) => /^\d+$/.test(k));
      if (numericKeys.length >= 1 && numericKeys.length >= keys.length * 0.5) {
        const items = numericKeys
          .map((k) => normalizePackage({ ...data[k], id: k }))
          .filter((p): p is PanelPackage => !!p);
        if (items.length > 0) return items;
      }
    }
  }

  return [];
}

function normalizePackage(item: any): PanelPackage | null {
  if (!item || typeof item !== "object") return null;

  const id = String(
    item.id ?? item.package_id ?? item.bouquet_id ?? item.pid ?? item.num ?? ""
  );
  const name = String(
    item.name ?? item.package_name ?? item.bouquet_name ?? item.title ?? item.label ?? ""
  );

  if (!id && !name) return null;

  // Some panels include bouquet IDs inside the package
  let bouquetIds: string[] | undefined;
  if (Array.isArray(item.bouquet)) {
    bouquetIds = item.bouquet.map(String);
  } else if (Array.isArray(item.bouquets)) {
    bouquetIds = item.bouquets.map(String);
  } else if (Array.isArray(item.bouquet_ids)) {
    bouquetIds = item.bouquet_ids.map(String);
  } else if (typeof item.bouquet === "string" && item.bouquet) {
    bouquetIds = item.bouquet.split(",").map((s: string) => s.trim()).filter(Boolean);
  }

  return {
    id: id || name,
    name: name || `Package ${id}`,
    bouquetIds,
    raw: item,
  };
}

/**
 * Some token-in-URL APIs return all data at the base URL, including packages.
 */
function tryExtractEmbeddedPackages(json: any): PanelPackage[] {
  if (!json || typeof json !== "object") return [];

  // Look for a packages/bouquets key anywhere in the response
  const keysToCheck = ["packages", "bouquets", "available_packages", "available_bouquets", "user_packages"];
  for (const key of keysToCheck) {
    if (json[key]) {
      const parsed = tryParsePackages({ data: json[key] });
      if (parsed.length > 0) return parsed;
    }
  }

  // If the response itself is a big array, try parsing directly
  if (Array.isArray(json)) {
    return tryParsePackages(json);
  }

  return [];
}
