import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { EmbyClient } from "@/lib/emby";
import { PlexClient } from "@/lib/plex";
import { getEmbyConfig, getPlexConfig } from "@/lib/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Internal API key for webhook calls (set in environment)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/**
 * Revoke a user's access to Plex and/or Emby servers
 * Can be called:
 * 1. By admin manually
 * 2. By Stripe webhook when payment fails
 * 3. By scheduled job checking expired subscriptions
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication - either admin user or internal API key
    const internalKey = request.headers.get("x-internal-api-key");
    const isInternalCall = INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY;

    if (!isInternalCall) {
      // Verify admin user
      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      
      const isAdmin = await convex.query(api.admins.isAdmin, { clerkId, email });
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { 
      userId,        // Convex user ID
      clerkId,       // Clerk user ID (alternative lookup)
      plexUserId,    // Direct Plex user ID to remove
      embyUserId,    // Direct Emby user ID to disable
      action = "disable", // "disable" (can be re-enabled) or "delete" (permanent)
      reason,        // Why access is being revoked
    } = body;

    // Find the user in our database
    let user;
    if (userId) {
      user = await convex.query(api.users.getById, { id: userId });
    } else if (clerkId) {
      user = await convex.query(api.users.getByClerkId, { clerkId });
    }

    const results = {
      plex: { success: false, message: "", removed: false },
      emby: { success: false, message: "", disabled: false },
    };

    // Get the Plex user ID to revoke
    const storedPlexUserId = user?.plexUserId;
    const storedPlexEmail = user?.plexEmail;
    const storedPlexUsername = user?.plexUsername;
    const targetPlexUserId = plexUserId || storedPlexUserId;
    
    // Get the Emby user ID to revoke
    const targetEmbyUserId = embyUserId || user?.embyUserId;

    // Revoke Plex access
    if (targetPlexUserId || storedPlexEmail || storedPlexUsername) {
      const plexConfig = await getPlexConfig();
      
      if (plexConfig.url && plexConfig.token) {
        try {
          const plexClient = new PlexClient({ url: plexConfig.url, token: plexConfig.token });

          // If we don't have a numeric Plex user id stored, try to resolve it.
          let resolvedPlexUserId = targetPlexUserId;
          if (!resolvedPlexUserId) {
            const plexUser = storedPlexEmail
              ? await plexClient.findUserByEmail(storedPlexEmail)
              : storedPlexUsername
                ? await plexClient.findUserByUsername(storedPlexUsername)
                : null;
            resolvedPlexUserId = plexUser?.id;
          }

          if (!resolvedPlexUserId) {
            results.plex.message = "Plex user not found on server";
          } else {
            // For Plex, we can only remove the user (no disable option)
            const removeResult = await plexClient.removeUser(resolvedPlexUserId);
            results.plex = {
              success: removeResult.success,
              message: removeResult.message,
              removed: removeResult.success,
            };
          }
        } catch (error) {
          results.plex.message = error instanceof Error ? error.message : "Failed to remove Plex access";
        }
      } else {
        results.plex.message = "Plex not configured";
      }
    }

    // Revoke Emby access
    if (targetEmbyUserId) {
      const embyConfig = await getEmbyConfig();
      
      if (embyConfig.url && embyConfig.apiKey) {
        try {
          const embyClient = new EmbyClient({ url: embyConfig.url, apiKey: embyConfig.apiKey });
          
          if (action === "delete") {
            // Permanently delete the user
            const deleteResult = await embyClient.deleteUser(targetEmbyUserId);
            results.emby = {
              success: deleteResult.success,
              message: deleteResult.message,
              disabled: deleteResult.success,
            };
          } else {
            // Just disable - can be re-enabled later
            const disableResult = await embyClient.disableUser(targetEmbyUserId);
            results.emby = {
              success: disableResult.success,
              message: disableResult.message,
              disabled: disableResult.success,
            };
          }
        } catch (error) {
          results.emby.message = error instanceof Error ? error.message : "Failed to revoke Emby access";
        }
      } else {
        results.emby.message = "Emby not configured";
      }
    }

    // Update user record in database
    if (user && (results.plex.removed || results.emby.disabled)) {
      await convex.mutation(api.users.updateAccessStatus, {
        id: user._id,
        isActive: false,
        accessRevokedAt: Date.now(),
        accessRevokedReason: reason || "Payment failed",
      });
    }

    const anySuccess = results.plex.removed || results.emby.disabled;

    return NextResponse.json({
      success: anySuccess,
      results,
      message: anySuccess 
        ? "Access revoked successfully" 
        : "No access was revoked",
    });
  } catch (error) {
    console.error("Error revoking access:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to revoke access" },
      { status: 500 }
    );
  }
}

/**
 * Bulk revoke access for users with expired/failed payments
 * Called by scheduled job or admin action
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const internalKey = request.headers.get("x-internal-api-key");
    const isInternalCall = INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY;

    if (!isInternalCall) {
      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      
      const isAdmin = await convex.query(api.admins.isAdmin, { clerkId, email });
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get all users with expired payments
    const expiredUsers = await convex.query(api.users.getExpiredPaymentUsers, {});
    
    const results = {
      processed: 0,
      revoked: 0,
      failed: 0,
      details: [] as Array<{ clerkId: string; success: boolean; message: string }>,
    };

    for (const user of expiredUsers) {
      results.processed++;
      
      try {
        // Call our own POST endpoint for each user
        const response = await fetch(new URL("/api/revoke-access", request.url).toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": INTERNAL_API_KEY || "",
          },
          body: JSON.stringify({
            clerkId: user.clerkId,
            action: "disable", // Disable, don't delete - in case they re-subscribe
            reason: "Payment expired",
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          results.revoked++;
          results.details.push({ clerkId: user.clerkId, success: true, message: "Access revoked" });
        } else {
          results.failed++;
          results.details.push({ clerkId: user.clerkId, success: false, message: data.error || "Failed" });
        }
      } catch (error) {
        results.failed++;
        results.details.push({ 
          clerkId: user.clerkId, 
          success: false, 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error in bulk revoke:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to process" },
      { status: 500 }
    );
  }
}
