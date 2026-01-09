# Deploying Media Invite to Vercel

This guide covers deploying the Media Invite application to Vercel with Convex as the backend.

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. A [Convex](https://convex.dev) account with a deployed project
3. A [Clerk](https://clerk.dev) account for authentication
4. Your Plex/Emby server credentials (configured in the app's Settings page after deployment)

## Step 1: Prepare Convex

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project (or create a new one)
3. Go to **Settings** → **Deploy Keys**
4. Click **Generate Deploy Key** (choose "Production" environment)
5. Copy the deploy key - you'll need this for Vercel

## Step 2: Configure Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.dev)
2. Select your application (or create a new one)
3. Go to **API Keys** and copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. Go to **Webhooks** and create a new webhook:
   - Endpoint URL: `https://your-vercel-domain.vercel.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the **Signing Secret** for `CLERK_WEBHOOK_SECRET`

## Step 3: Deploy to Vercel

### Option A: One-Click Deploy (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click **Add New** → **Project**
4. Import your repository
5. Configure the project:
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `media-invite` (if in a subdirectory)
6. Add Environment Variables (see below)
7. Click **Deploy**

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from the media-invite directory)
cd media-invite
vercel

# For production deployment
vercel --prod
```

## Step 4: Environment Variables

Add these environment variables in Vercel Dashboard → Project → Settings → Environment Variables:

### Required Variables

| Variable | Description |
|----------|-------------|
| `CONVEX_DEPLOY_KEY` | Your Convex production deploy key |
| `NEXT_PUBLIC_CONVEX_URL` | Your Convex deployment URL (e.g., `https://xxx.convex.cloud`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |

### Optional Variables

These are optional since Plex, Emby, and SMTP settings can be configured through the app's Settings page:

| Variable | Description |
|----------|-------------|
| `PLEX_URL` | Plex server URL (fallback) |
| `PLEX_TOKEN` | Plex authentication token (fallback) |
| `EMBY_URL` | Emby server URL (fallback) |
| `EMBY_API_KEY` | Emby API key (fallback) |

## Step 5: Configure Webhook URL in Clerk

After deployment, update your Clerk webhook endpoint:

1. Go to Clerk Dashboard → Webhooks
2. Edit your webhook
3. Update the endpoint URL to: `https://your-app.vercel.app/api/webhooks/clerk`

## Step 6: First-Time Setup

1. Visit your deployed app
2. Sign in with an email from `@playhousehosting.com` domain to get admin access
3. Go to **Settings** page
4. Configure your Plex and/or Emby server credentials
5. Configure SMTP settings for email invitations
6. Start creating invites!

## Troubleshooting

### Build Fails

1. Check that all environment variables are set correctly
2. Ensure `CONVEX_DEPLOY_KEY` is a valid production key
3. Check Vercel build logs for specific errors

### Convex Connection Issues

1. Verify `NEXT_PUBLIC_CONVEX_URL` matches your Convex deployment
2. Make sure your Convex functions are deployed
3. Check Convex dashboard for any function errors

### Clerk Authentication Issues

1. Verify Clerk keys are for the correct environment (production vs development)
2. Check that webhook secret matches
3. Ensure webhook endpoint URL is correct

### Plex/Emby Connection Issues

1. Ensure your media server is accessible from the internet
2. Verify credentials in the Settings page
3. Check that your server allows API access

## Build Configuration

The project uses the following build configuration (in `vercel.json`):

```json
{
  "buildCommand": "npx convex deploy --cmd 'npm run build:next'",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "CONVEX_DEPLOY_KEY": "@convex_deploy_key"
  }
}
```

This ensures:
- Convex functions are deployed before the Next.js build
- The Next.js build has access to the latest Convex function definitions
- The app is deployed to the IAD1 (US East) region

## Updating the Deployment

When you push changes to your connected repository, Vercel will automatically:

1. Run `npm install`
2. Deploy Convex functions
3. Build the Next.js app
4. Deploy to production

## Environment Variable Reference

Create a `.env.local` file for local development (never commit this!):

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Convex
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```
