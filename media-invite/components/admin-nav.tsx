"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Tv,
  Film,
  HelpCircle,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Invites",
    href: "/invites",
    icon: Ticket,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Emby Users",
    href: "/emby-users",
    icon: Tv,
  },
  {
    title: "Plex Users",
    href: "/plex-users",
    icon: Film,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Help Center",
    href: "/help",
    icon: HelpCircle,
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🎬</span>
          <span>Media Invite</span>
        </Link>
      </div>

      <div className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </div>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <span className="text-sm text-muted-foreground">Admin</span>
        </div>
      </div>
    </nav>
  );
}
