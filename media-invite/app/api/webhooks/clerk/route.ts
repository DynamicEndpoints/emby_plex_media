import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { EmbyClient } from "@/lib/emby";
import { PlexClient } from "@/lib/plex";
import { getEmbyConfig, getPlexConfig } from "@/lib/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function tryLinkExistingAccounts(clerkId: string, email: string, username: string) {
  const results = {
    emby: { found: false, userId: null as string | null, username: null as string | null },
    plex: { found: false, userId: null as string | null, username: null as string | null, email: null as string | null },
  };

  // Check Emby
  try {
    const embyConfig = await getEmbyConfig();
    if (embyConfig.url && embyConfig.apiKey) {
      const embyClient = new EmbyClient({ url: embyConfig.url, apiKey: embyConfig.apiKey });
      
      // Try to find by email or username
      let embyUser = await embyClient.findUserByEmail(email);
      if (!embyUser) {
        embyUser = await embyClient.findUserByUsername(username);
      }
      // Also try email prefix as username (common pattern)
      if (!embyUser) {
        const emailPrefix = email.split("@")[0];
        embyUser = await embyClient.findUserByUsername(emailPrefix);
      }
      
      if (embyUser) {
        results.emby = {
          found: true,
          userId: embyUser.Id,
          username: embyUser.Name,
        };
      }
    }
  } catch (error) {
    console.error("Error checking Emby during signup:", error);
  }

  // Check Plex
  try {
    const plexConfig = await getPlexConfig();
    if (plexConfig.url && plexConfig.token) {
      const plexClient = new PlexClient({ url: plexConfig.url, token: plexConfig.token });
      
      // Find by email first (more reliable for Plex)
      let plexUser = await plexClient.findUserByEmail(email);
      if (!plexUser) {
        plexUser = await plexClient.findUserByUsername(username);
      }
      
      if (plexUser) {
        results.plex = {
          found: true,
          userId: plexUser.id,
          username: plexUser.username,
          email: plexUser.email,
        };
      }
    }
  } catch (error) {
    console.error("Error checking Plex during signup:", error);
  }

  // If we found matches, create/update the user record
  if (results.emby.found || results.plex.found) {
    let serverAccess: "plex" | "emby" | "both" | "none" = "none";
    if (results.emby.found && results.plex.found) {
      serverAccess = "both";
    } else if (results.emby.found) {
      serverAccess = "emby";
    } else if (results.plex.found) {
      serverAccess = "plex";
    }

    await convex.mutation(api.users.linkExistingAccount, {
      clerkId,
      email,
      username,
      serverAccess,
      embyUserId: results.emby.userId || undefined,
      embyUsername: results.emby.username || undefined,
      plexUserId: results.plex.userId || undefined,
      plexUsername: results.plex.username || undefined,
      plexEmail: results.plex.email || undefined,
    });

    console.log(`Auto-linked accounts for ${email}:`, results);
    return true;
  }

  return false;
}

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  let evt: WebhookEvent;

  // Verify the payload
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error verifying webhook", { status: 400 });
  }

  // Handle the event
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, username, first_name, last_name } = evt.data;

    const email = email_addresses?.[0]?.email_address;
    const displayName =
      username || `${first_name || ""} ${last_name || ""}`.trim() || "User";

    if (email) {
      try {
        // First try to auto-link existing Emby/Plex accounts
        const linked = await tryLinkExistingAccounts(id, email, displayName);
        
        if (!linked) {
          // If not auto-linked, create a basic webhook record (optional)
          await convex.mutation(api.users.createFromWebhook, {
            clerkId: id,
            email,
            username: displayName,
          });
        }
      } catch (error) {
        console.error("Error processing user.created webhook:", error);
      }
    }
  }

  if (eventType === "user.deleted") {
    // Optionally handle user deletion
    // You might want to revoke their access to media servers
    console.log("User deleted:", evt.data.id);
  }

  return new Response("Webhook processed", { status: 200 });
}
