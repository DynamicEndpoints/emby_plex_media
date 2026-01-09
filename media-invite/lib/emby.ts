/**
 * Emby API Client
 * Handles user management operations for Emby Media Server
 */

interface EmbyUser {
  Id: string;
  Name: string;
  ServerId?: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  HasConfiguredEasyPassword: boolean;
  EnableAutoLogin?: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Policy?: EmbyUserPolicy;
}

interface EmbyUserPolicy {
  IsAdministrator: boolean;
  IsHidden: boolean;
  IsDisabled: boolean;
  EnableAllFolders: boolean;
  EnabledFolders: string[];
  EnableAllChannels: boolean;
  EnableAllDevices: boolean;
  EnableRemoteAccess: boolean;
  EnableLiveTvAccess: boolean;
  EnableLiveTvManagement: boolean;
}

interface EmbyLibrary {
  Id?: string;
  ItemId?: string;
  Guid?: string;
  Name: string;
  CollectionType?: string;
  Type?: string;
  LibraryOptions?: object;
  Locations?: string[];
}

// Special feature flags for Emby (not actual libraries)
export interface EmbyFeature {
  id: string;
  name: string;
  type: 'feature';
  description: string;
}

export const EMBY_FEATURES: EmbyFeature[] = [
  {
    id: '__livetv__',
    name: 'Live TV',
    type: 'feature',
    description: 'Access to Live TV channels and DVR',
  },
];

interface EmbyConfig {
  url: string;
  apiKey: string;
}

export class EmbyClient {
  private url: string;
  private apiKey: string;

  constructor(config: EmbyConfig) {
    this.url = config.url.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.url}${endpoint}`;
    const separator = endpoint.includes("?") ? "&" : "?";
    const fullUrl = `${url}${separator}api_key=${this.apiKey}`;

    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Emby API Error: ${response.status} - ${error}`);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text);
  }

  /**
   * Test connection to Emby server
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request("/System/Info/Public");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<{
    ServerName: string;
    Version: string;
    Id: string;
  }> {
    return this.request("/System/Info");
  }

  /**
   * Get all libraries (media folders)
   */
  async getLibraries(): Promise<EmbyLibrary[]> {
    // Try VirtualFolders first (Emby)
    try {
      const response = await this.request<EmbyLibrary[]>("/Library/VirtualFolders");
      if (Array.isArray(response)) {
        return response;
      }
      // Handle wrapped response
      if (response && (response as any).Items) {
        return (response as any).Items;
      }
    } catch {
      // If that fails, try MediaFolders endpoint
    }
    
    // Fallback: try to get media folders from user's view
    try {
      const response = await this.request<{ Items: EmbyLibrary[] }>("/Library/MediaFolders");
      return response.Items || [];
    } catch {
      return [];
    }
  }

  /**
   * Check if Live TV is available on the server
   */
  async hasLiveTv(): Promise<boolean> {
    try {
      const response = await this.request<{ Items?: any[]; TotalRecordCount?: number }>("/LiveTv/Channels?Limit=1");
      return (response.TotalRecordCount ?? 0) > 0 || (response.Items?.length ?? 0) > 0;
    } catch {
      // LiveTV might not be configured or available
      return false;
    }
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<EmbyUser[]> {
    return this.request<EmbyUser[]>("/Users");
  }

  /**
   * Get a specific user by ID
   */
  async getUser(userId: string): Promise<EmbyUser> {
    return this.request<EmbyUser>(`/Users/${userId}`);
  }

  /**
   * Create a new user
   */
  async createUser(
    username: string,
    password?: string
  ): Promise<{ success: boolean; userId?: string; message: string }> {
    try {
      // Create the user
      const user = await this.request<EmbyUser>("/Users/New", {
        method: "POST",
        body: JSON.stringify({
          Name: username,
        }),
      });

      // Set password if provided
      if (password && user.Id) {
        await this.request(`/Users/${user.Id}/Password`, {
          method: "POST",
          body: JSON.stringify({
            NewPw: password,
            ResetPassword: false,
          }),
        });
      }

      return {
        success: true,
        userId: user.Id,
        message: "User created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create user",
      };
    }
  }

  /**
   * Update user policy (permissions)
   */
  async updateUserPolicy(
    userId: string,
    policy: Partial<EmbyUserPolicy>
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get current user to merge policies
      const user = await this.getUser(userId);
      const currentPolicy = user.Policy || {};

      await this.request(`/Users/${userId}/Policy`, {
        method: "POST",
        body: JSON.stringify({
          ...currentPolicy,
          ...policy,
        }),
      });

      return { success: true, message: "User policy updated successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update user policy",
      };
    }
  }

  /**
   * Set user's library access (including LiveTV feature)
   */
  async setUserLibraries(
    userId: string,
    libraryIds: string[],
    enableAllFolders: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    // Check if LiveTV is in the list and separate it
    const hasLiveTv = libraryIds.includes('__livetv__');
    const actualLibraryIds = libraryIds.filter(id => id !== '__livetv__');
    
    return this.updateUserPolicy(userId, {
      EnableAllFolders: enableAllFolders,
      EnabledFolders: actualLibraryIds,
      EnableLiveTvAccess: hasLiveTv,
    });
  }

  /**
   * Set user's Live TV access
   */
  async setUserLiveTvAccess(
    userId: string,
    enabled: boolean,
    enableManagement: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    return this.updateUserPolicy(userId, {
      EnableLiveTvAccess: enabled,
      EnableLiveTvManagement: enableManagement,
    });
  }

  /**
   * Disable a user
   */
  async disableUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.updateUserPolicy(userId, {
      IsDisabled: true,
    });
  }

  /**
   * Enable a user
   */
  async enableUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.updateUserPolicy(userId, {
      IsDisabled: false,
    });
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.request(`/Users/${userId}`, {
        method: "DELETE",
      });

      return { success: true, message: "User deleted successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete user",
      };
    }
  }

  /**
   * Reset user password
   */
  async resetPassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.request(`/Users/${userId}/Password`, {
        method: "POST",
        body: JSON.stringify({
          NewPw: newPassword,
          ResetPassword: true,
        }),
      });

      return { success: true, message: "Password reset successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to reset password",
      };
    }
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const users = await this.getUsers();
      return !users.some(
        (user) => user.Name.toLowerCase() === username.toLowerCase()
      );
    } catch {
      return false;
    }
  }

  /**
   * Find a user by username (case-insensitive)
   */
  async findUserByUsername(username: string): Promise<EmbyUser | null> {
    try {
      const users = await this.getUsers();
      return users.find(
        (user) => user.Name.toLowerCase() === username.toLowerCase()
      ) || null;
    } catch {
      return null;
    }
  }

  /**
   * Find a user by email-like username (checks if username matches email prefix)
   * Emby doesn't store emails, so we check if username matches email prefix
   */
  async findUserByEmail(email: string): Promise<EmbyUser | null> {
    try {
      const users = await this.getUsers();
      const emailLower = email.toLowerCase();
      const emailPrefix = emailLower.split('@')[0];
      
      // First try exact username match with email
      let found = users.find(
        (user) => user.Name.toLowerCase() === emailLower
      );
      
      // Then try matching email prefix (common pattern)
      if (!found) {
        found = users.find(
          (user) => user.Name.toLowerCase() === emailPrefix
        );
      }
      
      return found || null;
    } catch {
      return null;
    }
  }

  /**
   * Get pending Emby Connect invitations
   */
  async getConnectPendingInvites(): Promise<Array<{ Id: string; Email: string; Username?: string }>> {
    try {
      const response = await this.request<Array<{ Id: string; Email: string; Username?: string }>>(
        "/emby/Connect/Pending"
      );
      return response || [];
    } catch {
      return [];
    }
  }

  /**
   * Invite a user via Emby Connect
   * This sends an invitation to the user's Emby Connect email
   * Once accepted, they can access the server through any Emby app by signing into Emby Connect
   */
  async inviteViaConnect(
    connectUsernameOrEmail: string,
    sendEmail: boolean = true
  ): Promise<{ success: boolean; message: string; inviteId?: string }> {
    try {
      // First, check if user already has access
      const existingUsers = await this.getUsers();
      const existingByEmail = existingUsers.find(
        u => u.Name.toLowerCase() === connectUsernameOrEmail.toLowerCase()
      );
      if (existingByEmail) {
        return { success: true, message: "User already has access" };
      }

      // Send Emby Connect invitation
      const response = await this.request<{ Id?: string }>("/emby/Connect/Invite", {
        method: "POST",
        body: JSON.stringify({
          ConnectUsername: connectUsernameOrEmail,
          SendingUserId: "", // Admin user, leave empty for API key auth
          EnableLiveTv: false,
          EnabledLibraries: null, // All libraries
          EnabledChannels: null,
          EnableAllLibraries: true,
          EnableAllChannels: true,
          SendEmail: sendEmail,
        }),
      });

      return { 
        success: true, 
        message: `Invitation sent to ${connectUsernameOrEmail}. They need to accept it in their Emby Connect account.`,
        inviteId: response?.Id
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation";
      
      // Check for common errors
      if (message.includes("404") || message.includes("not found")) {
        return { success: false, message: "Emby Connect user not found. Make sure they have an Emby Connect account." };
      }
      if (message.includes("already")) {
        return { success: true, message: "User already has a pending invitation or access" };
      }
      
      return { success: false, message };
    }
  }

  /**
   * Cancel a pending Emby Connect invitation
   */
  async cancelConnectInvite(inviteId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.request(`/emby/Connect/Pending/${inviteId}`, {
        method: "DELETE",
      });
      return { success: true, message: "Invitation cancelled" };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to cancel invitation" 
      };
    }
  }

  /**
   * Link an existing local user to an Emby Connect account
   */
  async linkUserToConnect(
    localUserId: string, 
    connectUsernameOrEmail: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.request(`/emby/Users/${localUserId}/Connect/Link`, {
        method: "POST",
        body: JSON.stringify({
          ConnectUsername: connectUsernameOrEmail,
        }),
      });
      return { success: true, message: "User linked to Emby Connect" };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to link to Emby Connect" 
      };
    }
  }

  /**
   * Unlink a user from Emby Connect (keeps local account)
   */
  async unlinkUserFromConnect(localUserId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.request(`/emby/Users/${localUserId}/Connect/Unlink`, {
        method: "DELETE",
      });
      return { success: true, message: "User unlinked from Emby Connect" };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to unlink from Emby Connect" 
      };
    }
  }

  /**
   * Check if Emby Connect is configured on the server
   */
  async isConnectEnabled(): Promise<boolean> {
    try {
      const serverInfo = await this.getServerInfo();
      // If we can access connect endpoints, it's enabled
      await this.request("/emby/Connect/Pending");
      return true;
    } catch {
      return false;
    }
  }
}

// Factory function for creating Emby client
export function createEmbyClient(url: string, apiKey: string): EmbyClient {
  return new EmbyClient({ url, apiKey });
}
