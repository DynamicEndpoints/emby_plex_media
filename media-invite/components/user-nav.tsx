"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Home, FolderOpen, Settings, User, HelpCircle } from "lucide-react";

const navItems = [
  { href: "/my-account", label: "My Account", icon: Home },
  { href: "/my-libraries", label: "My Libraries", icon: FolderOpen },
  { href: "/my-settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: HelpCircle },
];

export function UserNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-gray-50/40 p-6">
      <div className="flex items-center gap-2 mb-8">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg">My Media</span>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-6 left-6">
        <UserButton afterSignOutUrl="/" />
      </div>
    </aside>
  );
}
