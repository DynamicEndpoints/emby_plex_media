// Stripe public configuration (no secrets here!)
// Server-side Stripe operations now happen in Convex HTTP actions
// See convex/stripe.ts for the actual Stripe SDK usage

export const STRIPE_CONFIG = {
  productId: "prod_TkUnen4Dh6GpAN",
  productName: "Remote Computer Support",
  priceAmount: 3000, // $30 in cents
  currency: "usd",
  interval: "month" as const,
};

// Get the Convex HTTP URL for Stripe endpoints
export function getConvexHttpUrl(): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
  // Convert .cloud to .site for HTTP endpoints
  return convexUrl.replace(".cloud", ".site");
}

// Helper to create checkout session via Convex
export async function createCheckoutSession(params: {
  userId: string;
  userEmail: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string | null; sessionId: string } | { error: string }> {
  const baseUrl = getConvexHttpUrl();
  
  try {
    const response = await fetch(`${baseUrl}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    
    return await response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Checkout failed" };
  }
}

// Helper to create billing portal session via Convex  
export async function createPortalSession(params: {
  customerId: string;
  returnUrl?: string;
}): Promise<{ url: string } | { error: string }> {
  const baseUrl = getConvexHttpUrl();
  
  try {
    const response = await fetch(`${baseUrl}/stripe/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    
    return await response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Portal failed" };
  }
}

// Sync Stripe subscriptions to Convex
export async function syncStripeSubscriptions(): Promise<{
  success: boolean;
  synced?: number;
  failed?: number;
  error?: string;
}> {
  const baseUrl = getConvexHttpUrl();
  
  try {
    const response = await fetch(`${baseUrl}/stripe/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    return await response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Sync failed" };
  }
}
