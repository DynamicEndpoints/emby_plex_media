# Media Invite

A modern web application to manage invite codes for Plex and Emby media servers. Built with Next.js, Convex, and Clerk.

## Features

- 🎟️ **Invite Code Management** - Create, track, and manage invite codes
- 👥 **User Management** - View, revoke, and restore user access
- 🔗 **Multi-Server Support** - Works with both Plex and Emby
- 📧 **Email Notifications** - Send invite emails via Resend
- 🔔 **Webhooks** - Notify external services of events
- 📊 **Dashboard** - Overview stats and recent activity
- 🔐 **Secure Authentication** - Powered by Clerk

## Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Convex (real-time database)
- **Auth**: Clerk
- **Email**: Resend
- **UI Components**: Radix UI, Lucide Icons

## Getting Started

### Prerequisites

- Node.js 18+
- A [Convex](https://convex.dev) account
- A [Clerk](https://clerk.com) account
- (Optional) [Resend](https://resend.com) account for emails

### Installation

1. **Clone and install dependencies**
   ```bash
   cd media-invite
   npm install
   ```

2. **Set up Convex**
   ```bash
   npx convex dev
   ```
   This will prompt you to create a new project and set up your `.env.local` file.

3. **Configure Clerk**
   - Create a new application at [clerk.com](https://clerk.com)
   - Copy your API keys to `.env.local`
   - Set up the webhook endpoint at `https://yourdomain.com/api/webhooks/clerk`

4. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   Then fill in your values:
   ```env
   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
   CLERK_SECRET_KEY=sk_test_xxx
   CLERK_WEBHOOK_SECRET=whsec_xxx

   # Convex
   CONVEX_DEPLOYMENT=dev:xxx
   NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud

   # Internal API key (recommended)
   INTERNAL_API_KEY=change-me

   # Stripe (optional)
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx

   # NOTE: Plex/Emby/SMTP/IPTV panel settings are stored in Convex and configured
   # from the app's Admin Settings UI after you sign in.
   ```

5. **Configure Convex environment variables (Stripe / internal automation)**

   Some server-side workflows run inside Convex (HTTP actions + scheduled jobs). Those require Convex env vars.
   Set them via the Convex CLI (do not paste secrets into chat):

   ```bash
   npx convex env set STRIPE_SECRET_KEY=sk_...
   npx convex env set STRIPE_WEBHOOK_SECRET=whsec_...
   npx convex env set INTERNAL_API_KEY=change-me
   # Optional but recommended in production so Convex can call your app:
   npx convex env set SITE_URL=https://your-domain.com
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
media-invite/
├── app/
│   ├── (public)/           # Public pages
│   │   ├── invite/[code]/  # Invite redemption
│   │   └── success/        # Post-signup confirmation
│   ├── (admin)/            # Protected admin pages
│   │   ├── dashboard/      # Overview stats
│   │   ├── invites/        # Manage invite codes
│   │   ├── users/          # View/revoke users
│   │   └── settings/       # API keys, webhooks
│   ├── api/webhooks/       # Webhook handlers
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # Reusable UI components
│   └── ...                 # Feature components
├── convex/
│   ├── schema.ts           # Database schema
│   ├── invites.ts          # Invite CRUD
│   ├── users.ts            # User management
│   ├── settings.ts         # App settings
│   └── notifications.ts    # Logs & notifications
├── lib/
│   ├── plex.ts             # Plex API client
│   ├── emby.ts             # Emby API client
│   └── notifications.ts    # Email/webhook helpers
```

## Usage

### Creating Invites

1. Navigate to **Invites** page
2. Click **Create Invite**
3. Configure options:
   - **Email restriction** (optional): Limit to specific email
   - **Max uses**: How many times the code can be used
   - **Server type**: Plex, Emby, or both
   - **Expiration**: When the invite expires
4. Share the generated link

### Managing Users

- View all users who redeemed invites
- Search by email, username, or invite code
- Revoke or restore access
- Delete users permanently

### Settings

Configure your media servers:
- **Plex**: Server URL and token
- **Emby**: Server URL and API key
- **Webhooks**: Endpoint URL and secret
- **Email**: From address for notifications

## Plex Token

To find your Plex token:
1. Sign in to [app.plex.tv](https://app.plex.tv)
2. Open any media item
3. Click (...) → Get Info → View XML
4. Find `X-Plex-Token` in the URL

## Emby API Key

To create an Emby API key:
1. Open Emby Dashboard
2. Go to **Advanced** → **API Keys**
3. Create a new key

## Webhook Events

The following events can trigger webhooks:
- `invite.created` - New invite created
- `invite.redeemed` - Invite was used
- `invite.deactivated` - Invite was deactivated
- `user.created` - New user signed up
- `user.revoked` - User access revoked
- `user.restored` - User access restored
- `user.deleted` - User was deleted

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## License

MIT
