"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, Film, Tv, Music, Book, Image } from "lucide-react";

interface Library {
  id: string;
  name: string;
  type: string;
}

const libraryIcons: Record<string, React.ElementType> = {
  movies: Film,
  tvshows: Tv,
  music: Music,
  books: Book,
  photos: Image,
};

export default function MyLibrariesPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userData = useQuery(
    api.users.getByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );

  // Fetch libraries the user has access to
  useEffect(() => {
    const fetchLibraries = async () => {
      if (!userData?.isActive) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/emby/libraries");
        const data = await response.json();
        if (data.success) {
          setLibraries(data.libraries);
        } else {
          setError(data.error || "Failed to fetch libraries");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect");
      } finally {
        setLoading(false);
      }
    };

    if (userData !== undefined) {
      fetchLibraries();
    }
  }, [userData]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userData?.isActive) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Libraries</h1>
          <p className="text-muted-foreground">
            View the media libraries you have access to
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Access</h3>
            <p className="text-muted-foreground text-center">
              You don't have an active membership. Please use an invite code to gain access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">My Libraries</h1>
        <p className="text-muted-foreground">
          Media libraries you have access to
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive mb-2">{error}</p>
            <p className="text-muted-foreground text-sm">
              Please contact the administrator if this issue persists.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {libraries.map((library) => {
            const Icon = libraryIcons[library.type?.toLowerCase()] || FolderOpen;
            return (
              <Card key={library.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{library.name}</CardTitle>
                      <CardDescription className="capitalize">
                        {library.type || "Media"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Access</span>
                    <Badge variant="success">Granted</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {libraries.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Libraries Found</h3>
                <p className="text-muted-foreground text-center">
                  No media libraries are currently available.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Access Information</CardTitle>
          <CardDescription>How to access your media</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {(userData.serverAccess === "emby" || userData.serverAccess === "both") && (
              <div className="p-4 rounded-lg border">
                <h4 className="font-semibold mb-2">Emby Access</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Connect using the Emby app on your device
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Download the Emby app for your device</li>
                  <li>Enter the server address provided by admin</li>
                  <li>Sign in with your credentials</li>
                  <li>Enjoy your media!</li>
                </ol>
              </div>
            )}
            {(userData.serverAccess === "plex" || userData.serverAccess === "both") && (
              <div className="p-4 rounded-lg border">
                <h4 className="font-semibold mb-2">Plex Access</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Connect using the Plex app on your device
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Download the Plex app for your device</li>
                  <li>Sign in with your Plex account</li>
                  <li>The server should appear automatically</li>
                  <li>Enjoy your media!</li>
                </ol>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
