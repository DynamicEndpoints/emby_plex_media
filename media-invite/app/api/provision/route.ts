import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { EmbyClient } from "@/lib/emby";
import { PlexClient } from "@/lib/plex";
import { getEmbyConfig, getPlexConfig } from "@/lib/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Generate a secure random password
function generatePassword(length = 16): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    
    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    const body = await req.json();
    const { 
      code, 
      username, 
      // Plex
      plexEmail,           // Their plex.tv email to invite
      // Emby - Local Account
      embyUsername,        // Desired username on your server
      embyPassword,        // Desired password (optional)
      // Emby - Connect
      useEmbyConnect,      // Whether to use Emby Connect instead of local account
      embyConnectEmail,    // Their Emby Connect email/username
    } = body;

    if (!code) {
      return NextResponse.json({ error: "Invite code required" }, { status: 400 });
    }

    // Get the invite details
    const invite = await convex.query(api.invites.getByCode, { code });
    if (!invite || !invite.isValid) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    const results = {
      plex: { success: false, message: "", invited: false },
      emby: { 
        success: false, 
        message: "", 
        userId: null as string | null, 
        password: null as string | null,
        useConnect: false,
        connectInviteSent: false,
      },
    };

    // Handle Plex provisioning
    if (invite.serverType === "plex" || invite.serverType === "both") {
      const plexConfig = await getPlexConfig();
      
      if (!plexConfig.url || !plexConfig.token) {
        results.plex.message = "Plex not configured";
      } else if (!plexEmail) {
        results.plex.message = "Plex email required";
      } else {
        try {
          const plexClient = new PlexClient({ url: plexConfig.url, token: plexConfig.token });
          
          // Check if user is already shared with
          const existingUsers = await plexClient.getSharedUsers();
          const alreadyShared = existingUsers.some(
            u => u.email?.toLowerCase() === plexEmail.toLowerCase()
          );

          if (alreadyShared) {
            results.plex = { success: true, message: "Already has access", invited: false };
          } else {
            // Invite the user to Plex
            const inviteResult = await plexClient.inviteUser(plexEmail, invite.libraries);
            results.plex = { 
              success: inviteResult.success, 
              message: inviteResult.message,
              invited: inviteResult.success 
            };
          }
        } catch (error) {
          results.plex.message = error instanceof Error ? error.message : "Failed to invite to Plex";
        }
      }
    }

    // Handle Emby provisioning
    if (invite.serverType === "emby" || invite.serverType === "both") {
      const embyConfig = await getEmbyConfig();
      
      if (!embyConfig.url || !embyConfig.apiKey) {
        results.emby.message = "Emby not configured";
      } else {
        const embyClient = new EmbyClient({ url: embyConfig.url, apiKey: embyConfig.apiKey });

        // Option 1: Emby Connect
        if (useEmbyConnect && embyConnectEmail) {
          try {
            results.emby.useConnect = true;
            
            // Send Emby Connect invitation
            const connectResult = await embyClient.inviteViaConnect(embyConnectEmail, true);
            
            if (connectResult.success) {
              results.emby = {
                success: true,
                message: connectResult.message,
                userId: null,
                password: null,
                useConnect: true,
                connectInviteSent: true,
              };
            } else {
              results.emby.message = connectResult.message;
            }
          } catch (error) {
            results.emby.message = error instanceof Error ? error.message : "Failed to send Emby Connect invitation";
          }
        }
        // Option 2: Local Account
        else if (embyUsername) {
          try {
            // Check if username already exists
            const isAvailable = await embyClient.isUsernameAvailable(embyUsername);
            
            if (!isAvailable) {
              // Try to find the existing user
              const existingUser = await embyClient.findUserByUsername(embyUsername);
              if (existingUser) {
                results.emby = { 
                  success: true, 
                  message: "Username already exists - using existing account", 
                  userId: existingUser.Id,
                  password: null,
                  useConnect: false,
                  connectInviteSent: false,
                };
              } else {
                results.emby.message = "Username already taken";
              }
            } else {
              // Create the user with a password
              const password = embyPassword || generatePassword();
              const createResult = await embyClient.createUser(embyUsername, password);
              
              if (createResult.success && createResult.userId) {
                // Set library access based on invite
                if (invite.libraries && invite.libraries.length > 0) {
                  await embyClient.setUserLibraries(createResult.userId, invite.libraries, false);
                } else {
                  // Grant access to all libraries by default
                  await embyClient.setUserLibraries(createResult.userId, [], true);
                }

                results.emby = { 
                  success: true, 
                  message: "Account created successfully", 
                  userId: createResult.userId,
                  password: embyPassword ? null : password, // Only return generated password
                  useConnect: false,
                  connectInviteSent: false,
                };
              } else {
                results.emby.message = createResult.message;
              }
            }
          } catch (error) {
            results.emby.message = error instanceof Error ? error.message : "Failed to create Emby account";
          }
        } else {
          results.emby.message = "Either Emby Connect email or local username is required";
        }
      }
    }

    // If at least one server was successfully provisioned, redeem the invite
    const anySuccess = 
      (invite.serverType === "plex" && results.plex.success) ||
      (invite.serverType === "emby" && results.emby.success) ||
      (invite.serverType === "both" && (results.plex.success || results.emby.success));

    if (anySuccess) {
      // Redeem the invite in Convex
      await convex.mutation(api.invites.redeem, {
        code,
        clerkId,
        email,
        username,
        plexUsername: plexEmail,
        embyUserId: results.emby.userId || embyUsername || embyConnectEmail,
      });
    }

    const embyConfig = await getEmbyConfig();

    return NextResponse.json({
      success: anySuccess,
      results,
      serverType: invite.serverType,
      // Include connection info for user
      connectionInfo: {
        plex: invite.serverType !== "emby" ? {
          instructions: results.plex.invited 
            ? "Check your email for a Plex invite. Accept it to get access."
            : results.plex.success 
              ? "You already have access. Open the Plex app and look for the shared server."
              : null,
        } : null,
        emby: invite.serverType !== "plex" && results.emby.success ? {
          useConnect: results.emby.useConnect,
          // For Emby Connect users
          connectInstructions: results.emby.useConnect 
            ? "Check your email for an Emby Connect invitation. Accept it, then sign into any Emby app with your Emby Connect account to see the server."
            : null,
          // For local account users
          serverUrl: !results.emby.useConnect ? embyConfig.url : null,
          username: !results.emby.useConnect ? embyUsername : null,
          password: !results.emby.useConnect ? results.emby.password : null,
          localInstructions: !results.emby.useConnect 
            ? (results.emby.password 
                ? "Use these credentials to log in to Emby. Please change your password after first login."
                : "Use your existing Emby credentials to log in.")
            : null,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error provisioning access:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to provision access" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if Emby Connect is available
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const embyConfig = await getEmbyConfig();
    
    if (!embyConfig.url || !embyConfig.apiKey) {
      return NextResponse.json({ 
        embyConnectAvailable: false,
        reason: "Emby not configured" 
      });
    }

    const embyClient = new EmbyClient({ url: embyConfig.url, apiKey: embyConfig.apiKey });
    const isConnectEnabled = await embyClient.isConnectEnabled();

    return NextResponse.json({ 
      embyConnectAvailable: isConnectEnabled,
      reason: isConnectEnabled ? null : "Emby Connect not enabled on server"
    });
  } catch (error) {
    return NextResponse.json({ 
      embyConnectAvailable: false,
      reason: error instanceof Error ? error.message : "Failed to check"
    });
  }
}
