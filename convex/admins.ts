import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Admin email domains - users with these domains are automatically admins
const ADMIN_EMAIL_DOMAINS = ["playhousehosting.com"];

// Helper to check if email is from an admin domain
function isAdminEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ADMIN_EMAIL_DOMAINS.includes(domain);
}

// Check if a user is an admin (by database record OR email domain)
export const isAdmin = query({
  args: { clerkId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // First check database
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (admin) return true;

    // Check email domain if provided
    if (args.email && isAdminEmailDomain(args.email)) {
      return true;
    }

    return false;
  },
});

// Check if email domain is an admin domain (for client-side checks)
export const isAdminEmail = query({
  args: { email: v.string() },
  handler: async (_ctx, args) => {
    return isAdminEmailDomain(args.email);
  },
});

// Get admin by Clerk ID (returns virtual admin for domain-based admins)
export const getByClerkId = query({
  args: { clerkId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (admin) return admin;

    // If email is from admin domain, return virtual admin record
    if (args.email && isAdminEmailDomain(args.email)) {
      return {
        _id: "domain-admin" as any,
        clerkId: args.clerkId,
        email: args.email,
        role: "admin" as const,
        name: undefined,
        createdAt: Date.now(),
        isDomainAdmin: true, // Flag to indicate this is a domain-based admin
      };
    }

    return null;
  },
});

// List all admins
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("admins").collect();
  },
});

// Add an admin (only owners can do this)
export const add = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("admin")),
    addedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if the person adding is an owner
    const adder = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.addedBy))
      .first();

    if (!adder || adder.role !== "owner") {
      throw new Error("Only owners can add admins");
    }

    // Check if admin already exists
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      throw new Error("User is already an admin");
    }

    await ctx.db.insert("admins", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      role: args.role,
      createdAt: Date.now(),
      createdBy: args.addedBy,
    });

    await ctx.db.insert("auditLog", {
      action: "admin_added",
      actorId: args.addedBy,
      targetType: "admin",
      details: JSON.stringify({ email: args.email, role: args.role }),
      timestamp: Date.now(),
    });
  },
});

// Remove an admin (only owners can do this)
export const remove = mutation({
  args: {
    adminId: v.id("admins"),
    removedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if the person removing is an owner
    const remover = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.removedBy))
      .first();

    if (!remover || remover.role !== "owner") {
      throw new Error("Only owners can remove admins");
    }

    const admin = await ctx.db.get(args.adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    // Can't remove the last owner
    if (admin.role === "owner") {
      const ownerCount = (await ctx.db.query("admins").collect()).filter(
        (a) => a.role === "owner"
      ).length;
      if (ownerCount <= 1) {
        throw new Error("Cannot remove the last owner");
      }
    }

    await ctx.db.delete(args.adminId);

    await ctx.db.insert("auditLog", {
      action: "admin_removed",
      actorId: args.removedBy,
      targetType: "admin",
      details: JSON.stringify({ email: admin.email }),
      timestamp: Date.now(),
    });
  },
});

// Initialize first admin (only works if no admins exist)
export const initializeOwner = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if any admins exist
    const existingAdmins = await ctx.db.query("admins").collect();
    if (existingAdmins.length > 0) {
      throw new Error("Admins already initialized");
    }

    await ctx.db.insert("admins", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      role: "owner",
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      action: "owner_initialized",
      actorId: args.clerkId,
      targetType: "admin",
      details: JSON.stringify({ email: args.email }),
      timestamp: Date.now(),
    });

    return { success: true };
  },
});
