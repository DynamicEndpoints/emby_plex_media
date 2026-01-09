import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ role: null, isAuthenticated: false });
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;
    
    // Check if user is an admin (by database OR email domain)
    const isAdmin = await convex.query(api.admins.isAdmin, { clerkId: userId, email });
    const admin = await convex.query(api.admins.getByClerkId, { clerkId: userId, email });
    
    // Check if there are any admins at all (for first-time setup)
    const adminList = await convex.query(api.admins.list);
    const hasAnyAdmins = adminList.length > 0;

    if (isAdmin && admin) {
      return NextResponse.json({
        role: admin.role, // 'owner' or 'admin'
        isAuthenticated: true,
        isAdmin: true,
        isDomainAdmin: (admin as any).isDomainAdmin === true,
        hasAnyAdmins: true,
        user: {
          id: userId,
          email,
          name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : email,
        },
      });
    }

    // Not an admin - check if they're a regular user (invited)
    return NextResponse.json({
      role: 'user',
      isAuthenticated: true,
      isAdmin: false,
      hasAnyAdmins,
      user: {
        id: userId,
        email,
        name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : email,
      },
    });
  } catch (error) {
    console.error('Error checking role:', error);
    return NextResponse.json({ error: 'Failed to check role' }, { status: 500 });
  }
}
