/**
 * Notification helpers for email and webhooks
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Create SMTP transporter
 */
function createTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

/**
 * Send email notification using SMTP
 */
export async function sendEmail(
  config: SmtpConfig,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createTransporter(config);

    const fromAddress = config.fromName
      ? `"${config.fromName}" <${config.from}>`
      : config.from;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

/**
 * Verify SMTP connection
 */
export async function verifySmtpConnection(
  config: SmtpConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "SMTP connection failed",
    };
  }
}

/**
 * Send invite email to user
 */
export async function sendInviteEmail(
  config: SmtpConfig,
  to: string,
  inviteCode: string,
  appUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const inviteUrl = `${appUrl}/invite/${inviteCode}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; background-color: #f4f4f5;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="margin: 0 0 24px; font-size: 24px; color: #18181b;">You're Invited! 🎉</h1>
        
        <p style="margin: 0 0 16px; color: #3f3f46; line-height: 1.6;">
          You've been invited to join our media server. Click the button below to create your account and get access.
        </p>
        
        <div style="margin: 32px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background-color: #18181b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            Accept Invitation
          </a>
        </div>
        
        <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">
          Or copy this link:
        </p>
        <p style="margin: 0 0 24px; color: #3f3f46; font-size: 14px; word-break: break-all;">
          ${inviteUrl}
        </p>
        
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
        
        <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
          Your invite code: <strong>${inviteCode}</strong>
        </p>
      </div>
    </body>
    </html>
  `;

  return sendEmail(config, to, "You're Invited to Our Media Server!", html);
}

/**
 * Send welcome email after successful signup
 */
export async function sendWelcomeEmail(
  config: SmtpConfig,
  to: string,
  username: string,
  serverType: "plex" | "emby" | "both"
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const serverName = serverType === "both" 
    ? "Plex and Emby" 
    : serverType.charAt(0).toUpperCase() + serverType.slice(1);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; background-color: #f4f4f5;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="margin: 0 0 24px; font-size: 24px; color: #18181b;">Welcome, ${username}! 🎬</h1>
        
        <p style="margin: 0 0 16px; color: #3f3f46; line-height: 1.6;">
          Your account has been created and you now have access to ${serverName}.
        </p>
        
        <h2 style="margin: 24px 0 16px; font-size: 18px; color: #18181b;">Getting Started</h2>
        
        <ul style="margin: 0 0 24px; padding-left: 24px; color: #3f3f46; line-height: 1.8;">
          ${serverType === "plex" || serverType === "both" ? `
          <li>Download the <a href="https://www.plex.tv/apps/" style="color: #2563eb;">Plex app</a> for your device</li>
          <li>Sign in with your Plex account</li>
          ` : ""}
          ${serverType === "emby" || serverType === "both" ? `
          <li>Download the <a href="https://emby.media/download.html" style="color: #2563eb;">Emby app</a> for your device</li>
          <li>Connect to the server using your credentials</li>
          ` : ""}
        </ul>
        
        <p style="margin: 0; color: #71717a; font-size: 14px;">
          If you have any questions, please contact the server administrator.
        </p>
      </div>
    </body>
    </html>
  `;

  return sendEmail(config, to, `Welcome to ${serverName}!`, html);
}

/**
 * Send webhook notification
 */
export async function sendWebhook(
  webhookUrl: string,
  webhookSecret: string | null,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const body = JSON.stringify(payload);
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add signature if secret is provided
    if (webhookSecret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      const signatureHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      headers["X-Webhook-Signature"] = `sha256=${signatureHex}`;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
    });

    return {
      success: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send webhook",
    };
  }
}

/**
 * Webhook event types
 */
export const WebhookEvents = {
  INVITE_CREATED: "invite.created",
  INVITE_REDEEMED: "invite.redeemed",
  INVITE_DEACTIVATED: "invite.deactivated",
  USER_CREATED: "user.created",
  USER_REVOKED: "user.revoked",
  USER_RESTORED: "user.restored",
  USER_DELETED: "user.deleted",
} as const;

/**
 * Create webhook payload
 */
export function createWebhookPayload(
  event: string,
  data: Record<string, any>
): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
}
