import { NextResponse } from "next/server";
import { PlexClient } from "@/lib/plex";
import { getPlexConfig } from "@/lib/config";

export async function GET() {
  try {
    const config = await getPlexConfig();
    
    if (!config.url || !config.token) {
      return NextResponse.json(
        { error: "Plex not configured. Please configure in Settings." },
        { status: 400 }
      );
    }

    const client = new PlexClient({ url: config.url, token: config.token });
    const users = await client.getSharedUsers();

    return NextResponse.json({ 
      success: true, 
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        thumb: user.thumb,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}
