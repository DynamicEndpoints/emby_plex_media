import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { EmbyClient } from "@/lib/emby";
import { PlexClient } from "@/lib/plex";
import { getEmbyConfig, getPlexConfig } from "@/lib/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;
    const username = user?.username || user?.firstName || email?.split("@")[0] || "User";

    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

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
        
        if (embyUser) {
          results.emby = {
            found: true,
            userId: embyUser.Id,
            username: embyUser.Name,
          };
        }
      }
    } catch (error) {
      console.error("Error checking Emby:", error);
    }

    // Check Plex
    try {
      const plexConfig = await getPlexConfig();
      if (plexConfig.url && plexConfig.token) {
        const plexClient = new PlexClient({ url: plexConfig.url, token: plexConfig.token });
        
        // Find by email first (more reliable)
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
      console.error("Error checking Plex:", error);
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

      // Create or update user in Convex
      await convex.mutation(api.users.linkExistingAccount, {
        clerkId: userId,
        email,
        username,
        serverAccess,
        embyUserId: results.emby.userId || undefined,
        embyUsername: results.emby.username || undefined,
        plexUserId: results.plex.userId || undefined,
        plexUsername: results.plex.username || undefined,
        plexEmail: results.plex.email || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      linked: results.emby.found || results.plex.found,
      results,
    });
  } catch (error) {
    console.error("Error linking accounts:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to link accounts" },
      { status: 500 }
    );
  }
}

// GET to check current account status without linking
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;
    const username = user?.username || user?.firstName || email?.split("@")[0] || "User";

    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    const results = {
      emby: { found: false, userId: null as string | null, username: null as string | null },
      plex: { found: false, userId: null as string | null, username: null as string | null, email: null as string | null },
    };

    // Check Emby
    try {
      const embyConfig = await getEmbyConfig();
      if (embyConfig.url && embyConfig.apiKey) {
        const embyClient = new EmbyClient({ url: embyConfig.url, apiKey: embyConfig.apiKey });
        
        let embyUser = await embyClient.findUserByEmail(email);
        if (!embyUser) {
          embyUser = await embyClient.findUserByUsername(username);
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
      console.error("Error checking Emby:", error);
    }

    // Check Plex
    try {
      const plexConfig = await getPlexConfig();
      if (plexConfig.url && plexConfig.token) {
        const plexClient = new PlexClient({ url: plexConfig.url, token: plexConfig.token });
        
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
      console.error("Error checking Plex:", error);
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error checking accounts:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to check accounts" },
      { status: 500 }
    );
  }
}
