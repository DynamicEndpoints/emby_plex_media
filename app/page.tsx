import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function HomePage() {
  const { userId } = await auth();

  // If logged in, check role and redirect appropriately
  if (userId) {
    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;
    
    // Check if there are any admins
    const adminList = await convex.query(api.admins.list);
    const hasAnyAdmins = adminList.length > 0;

    // Check if user is an admin (by database record OR email domain)
    const isAdmin = await convex.query(api.admins.isAdmin, { clerkId: userId, email });

    // If no admins exist, always redirect to admin setup for first-run initialization.
    if (!hasAnyAdmins) {
      redirect("/admin-setup");
    }

    if (isAdmin) {
      // User is an admin, redirect to admin dashboard
      redirect("/dashboard");
    } else {
      // User is a regular user, redirect to user area
      redirect("/my-account");
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <div className="text-6xl mb-4">🎬</div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Media Invite
        </h1>
        <p className="text-xl text-muted-foreground">
          Manage invitations to your Plex and Emby media servers with ease.
          Create invite codes, track redemptions, and control user access.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-up">Create Account</Link>
          </Button>
        </div>
      </div>

      <footer className="absolute bottom-4 text-sm text-muted-foreground">
        Have an invite code?{" "}
        <Link href="/invite" className="text-primary hover:underline">
          Redeem it here
        </Link>
      </footer>
    </div>
  );
}
