"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Ensures a Convex `users` record exists for the signed-in Clerk user.
 * This avoids relying on the Clerk webhook for core app flows (Stripe, invites).
 */
export function EnsureUser() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    const controller = new AbortController();

    fetch("/api/users/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    }).catch(() => {
      // Best-effort; UI should still work for public pages.
    });

    return () => controller.abort();
  }, [isLoaded, user]);

  return null;
}
