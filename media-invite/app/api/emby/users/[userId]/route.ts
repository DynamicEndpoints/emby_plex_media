import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { EmbyClient } from "@/lib/emby";
import { getEmbyConfig } from "@/lib/config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET - Get single user details with policy and libraries
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
    const config = await getEmbyConfig();

    if (!config.url || !config.apiKey) {
      return NextResponse.json({ error: "Emby not configured" }, { status: 400 });
    }

    const client = new EmbyClient({ url: config.url, apiKey: config.apiKey });
    const user = await client.getUser(userId);
    const libraries = await client.getLibraries();
    const hasLiveTv = await client.hasLiveTv();

    return NextResponse.json({
      success: true,
      user: {
        id: user.Id,
        name: user.Name,
        isAdmin: user.Policy?.IsAdministrator || false,
        isDisabled: user.Policy?.IsDisabled || false,
        enableAllFolders: user.Policy?.EnableAllFolders || false,
        enabledFolders: user.Policy?.EnabledFolders || [],
        enableLiveTvAccess: user.Policy?.EnableLiveTvAccess || false,
        enableLiveTvManagement: user.Policy?.EnableLiveTvManagement || false,
        enableRemoteAccess: user.Policy?.EnableRemoteAccess || false,
        lastLoginDate: user.LastLoginDate,
        lastActivityDate: user.LastActivityDate,
        hasPassword: user.HasPassword,
      },
      libraries: libraries.map((lib) => ({
        id: lib.ItemId || lib.Id || lib.Guid,
        name: lib.Name,
        type: lib.CollectionType || lib.Type || "unknown",
      })),
      hasLiveTv,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get user" },
      { status: 500 }
    );
  }
}

// PATCH - Update user (enable/disable, libraries, etc.)
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
    const { action, libraries, enableAllFolders, enableLiveTv, enableRemoteAccess } = body;

    const config = await getEmbyConfig();
    if (!config.url || !config.apiKey) {
      return NextResponse.json({ error: "Emby not configured" }, { status: 400 });
    }

    const client = new EmbyClient({ url: config.url, apiKey: config.apiKey });
    let result: { success: boolean; message: string };

    switch (action) {
      case "enable":
        result = await client.enableUser(userId);
        break;

      case "disable":
        result = await client.disableUser(userId);
        break;

      case "updateLibraries":
        result = await client.setUserLibraries(
          userId,
          libraries || [],
          enableAllFolders || false
        );
        break;

      case "updatePolicy":
        result = await client.updateUserPolicy(userId, {
          EnableLiveTvAccess: enableLiveTv,
          EnableRemoteAccess: enableRemoteAccess,
        });
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Log the action
    await convex.mutation(api.notifications.createAuditLog, {
      action: `emby_user_${action}`,
      actorId: clerkId,
      targetType: "emby_user",
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

// DELETE - Delete Emby user
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
    const config = await getEmbyConfig();

    if (!config.url || !config.apiKey) {
      return NextResponse.json({ error: "Emby not configured" }, { status: 400 });
    }

    const client = new EmbyClient({ url: config.url, apiKey: config.apiKey });
    
    // Get user info before deleting for audit log
    const user = await client.getUser(userId);
    const result = await client.deleteUser(userId);

    if (result.success) {
      // Log the action
      await convex.mutation(api.notifications.createAuditLog, {
        action: "emby_user_deleted",
        actorId: clerkId,
        targetType: "emby_user",
        targetId: userId,
        details: JSON.stringify({ username: user.Name }),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
