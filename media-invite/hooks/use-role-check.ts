"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

interface UseAdminCheckOptions {
  redirectTo?: string;
}

export function useAdminCheck(options: UseAdminCheckOptions = {}) {
  const { redirectTo = "/my-account" } = options;
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();

  const email = user?.emailAddresses[0]?.emailAddress;

  const isAdmin = useQuery(
    api.admins.isAdmin,
    user?.id ? { clerkId: user.id, email } : "skip"
  );

  const adminRecord = useQuery(
    api.admins.getByClerkId,
    user?.id ? { clerkId: user.id, email } : "skip"
  );

  const isLoading = !userLoaded || isAdmin === undefined;

  // Redirect non-admins
  useEffect(() => {
    if (userLoaded && user && isAdmin === false) {
      router.push(redirectTo);
    }
  }, [userLoaded, user, isAdmin, router, redirectTo]);

  return {
    isAdmin: isAdmin ?? false,
    isOwner: adminRecord?.role === "owner",
    isDomainAdmin: (adminRecord as any)?.isDomainAdmin === true,
    adminRecord,
    isLoading,
    user,
  };
}

export function useUserCheck(options: { redirectTo?: string } = {}) {
  const { redirectTo = "/" } = options;
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();

  const email = user?.emailAddresses[0]?.emailAddress;

  const isAdmin = useQuery(
    api.admins.isAdmin,
    user?.id ? { clerkId: user.id, email } : "skip"
  );

  const isLoading = !userLoaded || isAdmin === undefined;

  // Redirect admins to admin area
  useEffect(() => {
    if (userLoaded && user && isAdmin === true) {
      router.push("/dashboard");
    }
  }, [userLoaded, user, isAdmin, router]);

  return {
    isUser: isAdmin === false,
    isLoading,
    user,
  };
}
