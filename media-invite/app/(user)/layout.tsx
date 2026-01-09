"use client";

import { useUserCheck } from "@/hooks/use-role-check";
import { UserNav } from "@/components/user-nav";
import { Loader2 } from "lucide-react";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isUser, isLoading } = useUserCheck();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isUser) {
    return null; // Will redirect via hook
  }

  return (
    <div className="flex h-screen">
      <UserNav />
      <main className="flex-1 overflow-auto">
        <div className="container py-8">{children}</div>
      </main>
    </div>
  );
}
