/**
 * Server-side utility to fetch settings from Convex
 * Used by API routes to get configuration
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { SETTINGS_KEYS } from "@/lib/constants";

// Create a Convex HTTP client for server-side use
function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(convexUrl);
}

export interface AppConfig {
  plex: {
    url: string;
    token: string;
  };
  emby: {
    url: string;
    apiKey: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    fromName: string;
  };
  webhook: {
    url: string;
    secret: string;
  };
}

/**
 * Fetch all settings from Convex database
 */
export async function getAppConfig(): Promise<AppConfig> {
  const client = getConvexClient();
  const settings = await client.query(api.settings.getAll);

  return {
    plex: {
      url: settings[SETTINGS_KEYS.PLEX_URL] || "",
      token: settings[SETTINGS_KEYS.PLEX_TOKEN] || "",
    },
    emby: {
      url: settings[SETTINGS_KEYS.EMBY_URL] || "",
      apiKey: settings[SETTINGS_KEYS.EMBY_API_KEY] || "",
    },
    smtp: {
      host: settings[SETTINGS_KEYS.SMTP_HOST] || "",
      port: parseInt(settings[SETTINGS_KEYS.SMTP_PORT] || "587", 10),
      secure: settings[SETTINGS_KEYS.SMTP_SECURE] === "true",
      user: settings[SETTINGS_KEYS.SMTP_USER] || "",
      pass: settings[SETTINGS_KEYS.SMTP_PASS] || "",
      from: settings[SETTINGS_KEYS.EMAIL_FROM] || "",
      fromName: settings[SETTINGS_KEYS.EMAIL_FROM_NAME] || "",
    },
    webhook: {
      url: settings[SETTINGS_KEYS.WEBHOOK_URL] || "",
      secret: settings[SETTINGS_KEYS.WEBHOOK_SECRET] || "",
    },
  };
}

/**
 * Get Plex configuration
 */
export async function getPlexConfig() {
  const config = await getAppConfig();
  return config.plex;
}

/**
 * Get Emby configuration
 */
export async function getEmbyConfig() {
  const config = await getAppConfig();
  return config.emby;
}

/**
 * Get SMTP configuration
 */
export async function getSmtpConfig() {
  const config = await getAppConfig();
  return config.smtp;
}

/**
 * Get webhook configuration
 */
export async function getWebhookConfig() {
  const config = await getAppConfig();
  return config.webhook;
}
