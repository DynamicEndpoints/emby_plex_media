import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { PlexClient } from "@/lib/plex";
import { getPlexConfig } from "@/lib/config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET - Get single user details with libraries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user email from Clerk
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress;

    // Verify admin
    const isAdmin = await convex.query(api.admins.isAdmin, { clerkId, email });
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const config = await getPlexConfig();

    if (!config.url || !config.token) {
      return NextResponse.json({ error: "Plex not configured" }, { status: 400 });
    }

    const client = new PlexClient({ url: config.url, token: config.token });
    
    // Get all shared users and find the specific one
    const users = await client.getSharedUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get libraries
    const libraries = await client.getLibraries();
    
    // Get user's current library access via shared server info
    const userLibraries = await client.getUserLibraryAccess(userId);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        thumb: user.thumb,
        libraryIds: userLibraries,
      },
      libraries: libraries.map((lib) => ({
        id: lib.key,
        name: lib.title,
        type: lib.type,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get user" },
      { status: 500 }
    );
  }
}

// PATCH - Update user libraries
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user email from Clerk
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress;

    // Verify admin
    const isAdmin = await convex.query(api.admins.isAdmin, { clerkId, email });
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { action, libraries } = body;

    const config = await getPlexConfig();
    if (!config.url || !config.token) {
      return NextResponse.json({ error: "Plex not configured" }, { status: 400 });
    }

    const client = new PlexClient({ url: config.url, token: config.token });
    let result: { success: boolean; message: string };

    switch (action) {
      case "updateLibraries":
        result = await client.updateUserLibraries(userId, libraries || []);
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Log the action
    await convex.mutation(api.notifications.createAuditLog, {
      action: `plex_user_${action}`,
      actorId: clerkId,
      targetType: "plex_user",
      targetId: userId,
      details: JSON.stringify({ action, ...body }),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE - Remove Plex user's access
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user email from Clerk
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress;

    // Verify admin
    const isAdmin = await convex.query(api.admins.isAdmin, { clerkId, email });
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const config = await getPlexConfig();

    if (!config.url || !config.token) {
      return NextResponse.json({ error: "Plex not configured" }, { status: 400 });
    }

    const client = new PlexClient({ url: config.url, token: config.token });
    
    // Get user info before removing for audit log
    const users = await client.getSharedUsers();
    const user = users.find(u => u.id === userId);
    
    const result = await client.removeUser(userId);

    if (result.success) {
      // Log the action
      await convex.mutation(api.notifications.createAuditLog, {
        action: "plex_user_removed",
        actorId: clerkId,
        targetType: "plex_user",
        targetId: userId,
        details: JSON.stringify({ username: user?.username, email: user?.email }),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to remove user" },
      { status: 500 }
    );
  }
}
