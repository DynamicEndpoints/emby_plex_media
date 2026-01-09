import { NextResponse } from "next/server";
import { EmbyClient, EMBY_FEATURES } from "@/lib/emby";
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
    const libraries = await client.getLibraries();
    
    // Check if LiveTV is available
    const hasLiveTv = await client.hasLiveTv();

    // Map libraries to a consistent format
    const mappedLibraries = libraries.map(lib => ({
      id: lib.Id || lib.ItemId || (lib as any).Guid,
      name: lib.Name,
      type: lib.CollectionType || (lib as any).Type || "unknown",
    }));
    
    // Add LiveTV as a special option if available
    const features = hasLiveTv ? EMBY_FEATURES : [];

    return NextResponse.json({ 
      success: true, 
      libraries: mappedLibraries,
      features,
      hasLiveTv,
    });
  } catch (error) {
    console.error("Failed to fetch Emby libraries:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch libraries" },
      { status: 500 }
    );
  }
}
