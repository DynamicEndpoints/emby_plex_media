"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { HelpCircle, Home, LayoutDashboard, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { user } = useUser();

  // Check if user is admin
  const isAdmin = useQuery(
    api.admins.isAdmin,
    user?.id
      ? { clerkId: user.id, email: user.primaryEmailAddress?.emailAddress }
      : "skip"
  );

  // Don't show navbar on sign-in/sign-up pages
  if (pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")) {
    return null;
  }

  // Don't show on admin pages (they have their own nav)
  if (
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/invites") ||
    pathname?.startsWith("/users") ||
    pathname?.startsWith("/settings") ||
    pathname?.startsWith("/emby-users") ||
    pathname?.startsWith("/plex-users")
  ) {
    return null;
  }

  // Don't show on user pages (they have their own nav)
  if (pathname?.startsWith("/my-account")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="text-xl">🎬</span>
            <span className="font-bold">Media Invite</span>
          </Link>
        </div>

        <nav className="flex flex-1 items-center space-x-4 text-sm font-medium">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-1.5 transition-colors hover:text-foreground/80",
              pathname === "/" ? "text-foreground" : "text-foreground/60"
            )}
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link
            href="/help"
            className={cn(
              "flex items-center gap-1.5 transition-colors hover:text-foreground/80",
              pathname === "/help" ? "text-foreground" : "text-foreground/60"
            )}
          >
            <HelpCircle className="h-4 w-4" />
            Help
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          <SignedIn>
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-1.5">
                  <LayoutDashboard className="h-4 w-4" />
                  Admin
                </Link>
              </Button>
            )}
            {!isAdmin && isAdmin !== undefined && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/my-account" className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  My Account
                </Link>
              </Button>
            )}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
