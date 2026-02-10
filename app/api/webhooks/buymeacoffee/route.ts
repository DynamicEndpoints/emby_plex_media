import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getEmbyConfig, getPlexConfig } from "@/lib/config";
import { EmbyClient } from "@/lib/emby";
import { PlexClient } from "@/lib/plex";

export const runtime = "nodejs";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function tryResolvePlexUserIdByEmail(email: string): Promise<string | undefined> {
  try {
    const plexConfig = await getPlexConfig();
    if (!plexConfig.url || !plexConfig.token) return undefined;

    const plex = new PlexClient({ url: plexConfig.url, token: plexConfig.token });
    const sharedUsers = await plex.getSharedUsers();
    const match = sharedUsers.find((u) => (u.email || "").toLowerCase() === email);
    return match?.id;
  } catch {
    return undefined;
  }
}

async function tryResolveEmbyUserIdByEmail(email: string): Promise<string | undefined> {
  try {
    const embyConfig = await getEmbyConfig();
    if (!embyConfig.url || !embyConfig.apiKey) return undefined;

    const emby = new EmbyClient({ url: embyConfig.url, apiKey: embyConfig.apiKey });
    const user = await emby.findUserByEmail(email);
    return user?.Id;
  } catch {
    return undefined;
  }
}

function getExpectedToken(): string | null {
  return process.env.BUYMEACOFFEE_WEBHOOK_TOKEN || null;
}

function getProvidedToken(h: Headers, url: URL): string | null {
  // Buy Me a Coffee docs mention a "verification token" included with every request,
  // but the docs page does not clearly expose the exact header name.
  // Accept a small set of common names + optional query param for flexibility.
  const candidates = [
    "x-webhook-token",
    "x-verification-token",
    "x-bmac-webhook-token",
    "x-buymeacoffee-webhook-token",
    "buymeacoffee-webhook-token",
  ];

  for (const key of candidates) {
    const v = h.get(key);
    if (v) return v;
  }

  const qp = url.searchParams.get("token");
  return qp || null;
}

function extractEmail(payload: any): string | null {
  const candidates = [
    payload?.supporter_email,
    payload?.supporterEmail,
    payload?.email,
    payload?.payer_email,
    payload?.payerEmail,
    payload?.data?.supporter_email,
    payload?.data?.supporterEmail,
    payload?.data?.email,
    payload?.data?.payer_email,
    payload?.data?.payerEmail,
    payload?.payload?.supporter_email,
    payload?.payload?.email,
  ];

  const email = candidates.find((v) => typeof v === "string" && v.includes("@"));
  return email ? email.trim().toLowerCase() : null;
}

function extractEventType(payload: any): string | undefined {
  const v = payload?.type || payload?.event || payload?.event_type || payload?.eventType;
  return typeof v === "string" ? v : undefined;
}

function extractExternalId(payload: any): string | undefined {
  const v = payload?.id || payload?.support_id || payload?.supportId || payload?.data?.id;
  return typeof v === "string" || typeof v === "number" ? String(v) : undefined;
}

function extractAmountCents(payload: any): number | undefined {
  const raw =
    payload?.amount_in_cents ??
    payload?.amountInCents ??
    payload?.support_amount_cents ??
    payload?.supportAmountCents ??
    payload?.amount ??
    payload?.support_amount ??
    payload?.data?.amount_in_cents ??
    payload?.data?.amount;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Heuristic: if it's a small float like 5 or 10, assume dollars -> cents.
    if (raw > 0 && raw < 1000 && !Number.isInteger(raw)) return Math.round(raw * 100);
    if (raw > 0 && raw < 1000 && Number.isInteger(raw)) return raw * 100;
    return Math.round(raw);
  }

  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100);
  }

  return undefined;
}

function extractCurrency(payload: any): string | undefined {
  const v = payload?.currency || payload?.data?.currency;
  return typeof v === "string" ? v.toLowerCase() : undefined;
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const headersList = await headers();
  const expected = getExpectedToken();
  if (expected) {
    const provided = getProvidedToken(headersList, req.nextUrl);
    if (!provided || provided !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supporterEmail = extractEmail(payload);
  if (!supporterEmail) {
    return NextResponse.json(
      { error: "No supporter email found in webhook payload" },
      { status: 400 }
    );
  }

  // Best-effort: if the donation email matches an existing Plex/Emby account,
  // pass the server user IDs through so Convex can grant access by ID.
  const [plexUserId, embyUserId] = await Promise.all([
    tryResolvePlexUserIdByEmail(supporterEmail),
    tryResolveEmbyUserIdByEmail(supporterEmail),
  ]);

  const eventType = extractEventType(payload);
  const externalId = extractExternalId(payload);
  const amount = extractAmountCents(payload);
  const currency = extractCurrency(payload);
  const message =
    typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.data?.message === "string"
        ? payload.data.message
        : undefined;

  // Record donation + (if possible) immediately grant access for a matching user.
  await convex.mutation(api.donations.recordBuyMeACoffeeDonation, {
    eventType,
    externalId,
    supporterEmail,
    plexUserId,
    embyUserId,
    amount,
    currency,
    message,
    // Keep raw payload for debugging; trim to reduce stored size.
    raw: bodyText.length > 50_000 ? bodyText.slice(0, 50_000) : bodyText,
  });

  // Must return 2xx quickly for webhook providers.
  return NextResponse.json({ received: true });
}
