/**
 * Plex API Client
 * Handles user management operations for Plex Media Server
 */

interface PlexUser {
  id: string;
  username: string;
  email: string;
  thumb?: string;
}

interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

interface PlexConfig {
  url: string;
  token: string;
}

export class PlexClient {
  private url: string;
  private token: string;

  constructor(config: PlexConfig) {
    this.url = config.url.replace(/\/$/, ""); // Remove trailing slash
    this.token = config.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.url}${endpoint}`;
    const headers: HeadersInit = {
      Accept: "application/json",
      "X-Plex-Token": this.token,
      "X-Plex-Client-Identifier": "media-invite-app",
      "X-Plex-Product": "Media Invite",
      "X-Plex-Version": "1.0.0",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Plex API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Test connection to Plex server
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request("/");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get server identity information
   */
  async getServerInfo(): Promise<{
    name: string;
    machineIdentifier: string;
    version: string;
  }> {
    const response = await this.request<{
      MediaContainer: {
        friendlyName: string;
        machineIdentifier: string;
        version: string;
      };
    }>("/");

    return {
      name: response.MediaContainer.friendlyName,
      machineIdentifier: response.MediaContainer.machineIdentifier,
      version: response.MediaContainer.version,
    };
  }

  /**
   * Get all libraries on the server
   */
  async getLibraries(): Promise<PlexLibrary[]> {
    const response = await this.request<{
      MediaContainer: {
        Directory: Array<{
          key: string;
          title: string;
          type: string;
        }>;
      };
    }>("/library/sections");

    return response.MediaContainer.Directory.map((lib) => ({
      key: lib.key,
      title: lib.title,
      type: lib.type,
    }));
  }

  /**
   * Invite a user to the Plex server via Plex.tv
   * Note: This requires the server to be claimed and connected to Plex.tv
   */
  async inviteUser(
    email: string,
    libraryIds?: string[]
  ): Promise<{ success: boolean; message: string }> {
    try {
      // First, get the machine identifier
      const serverInfo = await this.getServerInfo();

      // Invite user via Plex.tv API
      const inviteUrl = "https://plex.tv/api/v2/shared_servers";
      const response = await fetch(inviteUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Plex-Token": this.token,
          "X-Plex-Client-Identifier": "media-invite-app",
        },
        body: JSON.stringify({
          machineIdentifier: serverInfo.machineIdentifier,
          invitedEmail: email,
          librarySectionIds: libraryIds || [],
          settings: {
            allowSync: false,
            allowCameraUpload: false,
            allowChannels: false,
            filterMovies: "",
            filterTelevision: "",
            filterMusic: "",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return { success: true, message: "User invited successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to invite user",
      };
    }
  }

  /**
   * Get all shared users (friends with server access)
   */
  async getSharedUsers(): Promise<PlexUser[]> {
    try {
      const response = await fetch(
        "https://plex.tv/api/v2/friends",
        {
          headers: {
            Accept: "application/json",
            "X-Plex-Token": this.token,
            "X-Plex-Client-Identifier": "media-invite-app",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get shared users");
      }

      const users = await response.json();
      return users.map((user: any) => ({
        id: user.id.toString(),
        username: user.username || user.title,
        email: user.email,
        thumb: user.thumb,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Remove a user's access to the server
   */
  async removeUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const serverInfo = await this.getServerInfo();

      const response = await fetch(
        `https://plex.tv/api/v2/shared_servers/${serverInfo.machineIdentifier}/shared_servers/${userId}`,
        {
          method: "DELETE",
          headers: {
            "X-Plex-Token": this.token,
            "X-Plex-Client-Identifier": "media-invite-app",
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return { success: true, message: "User removed successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to remove user",
      };
    }
  }

  /**
   * Update a user's library access
   */
  async updateUserLibraries(
    userId: string,
    libraryIds: string[]
  ): Promise<{ success: boolean; message: string }> {
    try {
      const serverInfo = await this.getServerInfo();

      const response = await fetch(
        `https://plex.tv/api/v2/shared_servers/${serverInfo.machineIdentifier}/shared_servers/${userId}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Plex-Token": this.token,
            "X-Plex-Client-Identifier": "media-invite-app",
          },
          body: JSON.stringify({
            librarySectionIds: libraryIds,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return { success: true, message: "User libraries updated successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update user libraries",
      };
    }
  }

  /**
   * Find a shared user by email
   */
  async findUserByEmail(email: string): Promise<PlexUser | null> {
    try {
      const users = await this.getSharedUsers();
      const emailLower = email.toLowerCase();
      return users.find(
        (user) => user.email?.toLowerCase() === emailLower
      ) || null;
    } catch {
      return null;
    }
  }

  /**
   * Find a shared user by username
   */
  async findUserByUsername(username: string): Promise<PlexUser | null> {
    try {
      const users = await this.getSharedUsers();
      const usernameLower = username.toLowerCase();
      return users.find(
        (user) => user.username?.toLowerCase() === usernameLower
      ) || null;
    } catch {
      return null;
    }
  }

  /**
   * Get a user's library access
   */
  async getUserLibraryAccess(userId: string): Promise<string[]> {
    try {
      const serverInfo = await this.getServerInfo();
      
      const response = await fetch(
        `https://plex.tv/api/v2/shared_servers/${serverInfo.machineIdentifier}`,
        {
          headers: {
            Accept: "application/json",
            "X-Plex-Token": this.token,
            "X-Plex-Client-Identifier": "media-invite-app",
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      // Find the specific user's shared server entry
      const userShare = data.find?.((share: any) => share.userID?.toString() === userId);
      
      if (userShare && userShare.libraries) {
        return userShare.libraries.map((lib: any) => lib.id?.toString() || lib.key);
      }
      
      return [];
    } catch {
      return [];
    }
  }
}

// Factory function for creating Plex client
export function createPlexClient(url: string, token: string): PlexClient {
  return new PlexClient({ url, token });
}
