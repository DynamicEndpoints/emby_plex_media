import { NextResponse } from "next/server";
import { EmbyClient } from "@/lib/emby";
import { getEmbyConfig } from "@/lib/config";

export async function GET() {
  try {
    const config = await getEmbyConfig();
    
    if (!config.url || !config.apiKey) {
      return NextResponse.json(
        { error: "Emby not configured. Please configure in Settings." },
        { status: 400 }
      );
    }

    const client = new EmbyClient({ url: config.url, apiKey: config.apiKey });
    const users = await client.getUsers();

    return NextResponse.json({ 
      success: true, 
      users: users.map(user => ({
        id: user.Id,
        name: user.Name,
        isAdmin: user.Policy?.IsAdministrator || false,
        isDisabled: user.Policy?.IsDisabled || false,
        lastLoginDate: user.LastLoginDate,
        lastActivityDate: user.LastActivityDate,
        hasPassword: user.HasPassword,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}
