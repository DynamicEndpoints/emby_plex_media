import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

// Get Stripe instance using Convex environment variable
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY not set. Run: npx convex env set STRIPE_SECRET_KEY=sk_xxx"
    );
  }
  return new Stripe(secretKey, { typescript: true });
}

// Stripe configuration
export const STRIPE_CONFIG = {
  productId: "prod_TkUnen4Dh6GpAN",
  productName: "Remote Computer Support",
  priceAmount: 3000, // $30 in cents
  currency: "usd",
  interval: "month" as const,
};

// Create checkout session
export const createCheckout = httpAction(async (ctx, request) => {
  try {
    const stripe = getStripe();
    const body = await request.json();
    const { userId, userEmail, successUrl, cancelUrl } = body;

    if (!userId || !userEmail) {
      return new Response(JSON.stringify({ error: "Missing userId or userEmail" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or create price
    const prices = await stripe.prices.list({
      product: STRIPE_CONFIG.productId,
      active: true,
      type: "recurring",
      limit: 1,
    });

    let priceId = prices.data[0]?.id;

    if (!priceId) {
      // Create the recurring price
      const price = await stripe.prices.create({
        product: STRIPE_CONFIG.productId,
        unit_amount: STRIPE_CONFIG.priceAmount,
        currency: STRIPE_CONFIG.currency,
        recurring: { interval: STRIPE_CONFIG.interval },
        metadata: { app: "media-invite" },
      });
      priceId = price.id;
    }

    // Get or create customer
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    let customerId = customers.data[0]?.id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { clerkId: userId },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${request.headers.get("origin")}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.headers.get("origin")}/payment/canceled`,
      metadata: { clerkId: userId },
    });

    // Store customer ID in Convex
    await ctx.runMutation(internal.payments.internal_setStripeCustomerId, {
      clerkId: userId,
      stripeCustomerId: customerId,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Checkout failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Create billing portal session
export const createPortal = httpAction(async (ctx, request) => {
  try {
    const stripe = getStripe();
    const body = await request.json();
    const { customerId, returnUrl } = body;

    if (!customerId) {
      return new Response(JSON.stringify({ error: "Missing customerId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || request.headers.get("origin") || "/my-account",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Portal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Portal failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Handle Stripe webhooks
export const webhook = httpAction(async (ctx, request) => {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          
          await ctx.runMutation(internal.payments.internal_updatePaymentStatus, {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            paymentStatus: "active",
            clerkId: session.metadata?.clerkId,
            paymentExpiresAt: subscription.current_period_end * 1000,
          });

          await ctx.runMutation(internal.payments.internal_upsertSubscription, {
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: session.customer as string,
            status: subscription.status,
            priceId: subscription.items.data[0]?.price?.id || "",
            productId: (subscription.items.data[0]?.price?.product as string) || "",
            currentPeriodStart: subscription.current_period_start * 1000,
            currentPeriodEnd: subscription.current_period_end * 1000,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        let status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "pending" = "pending";
        if (subscription.status === "active") status = "active";
        else if (subscription.status === "canceled") status = "canceled";
        else if (subscription.status === "past_due") status = "past_due";
        else if (subscription.status === "unpaid") status = "unpaid";
        else if (subscription.status === "trialing") status = "trialing";

        await ctx.runMutation(internal.payments.internal_updatePaymentStatus, {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          paymentStatus: status,
          paymentExpiresAt: subscription.current_period_end * 1000,
        });

        await ctx.runMutation(internal.payments.internal_upsertSubscription, {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          status: subscription.status,
          priceId: subscription.items.data[0]?.price?.id || "",
          productId: (subscription.items.data[0]?.price?.product as string) || "",
          currentPeriodStart: subscription.current_period_start * 1000,
          currentPeriodEnd: subscription.current_period_end * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at ? subscription.canceled_at * 1000 : undefined,
        });

        // If subscription is canceled or unpaid, revoke access
        if (status === "canceled" || status === "unpaid") {
          await ctx.runMutation(internal.payments.internal_scheduleAccessRevocation, {
            stripeCustomerId: subscription.customer as string,
            reason: status === "canceled" ? "Subscription canceled" : "Payment failed",
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await ctx.runMutation(internal.payments.internal_recordPayment, {
            stripeCustomerId: invoice.customer as string,
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: invoice.subscription as string,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
          });

          // Cancel any scheduled revocations since payment succeeded
          await ctx.runMutation(internal.payments.internal_cancelScheduledRevocation, {
            stripeCustomerId: invoice.customer as string,
          });

          // Also update payment status to active
          await ctx.runMutation(internal.payments.internal_updatePaymentStatus, {
            stripeCustomerId: invoice.customer as string,
            stripeSubscriptionId: invoice.subscription as string,
            paymentStatus: "active",
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await ctx.runMutation(internal.payments.internal_updatePaymentStatus, {
          stripeCustomerId: invoice.customer as string,
          paymentStatus: "past_due",
        });
        
        // Schedule access revocation after grace period
        await ctx.runMutation(internal.payments.internal_scheduleAccessRevocation, {
          stripeCustomerId: invoice.customer as string,
          reason: "Payment failed",
          gracePeriodDays: 3, // Give 3 days before revoking
        });
        break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response("Webhook handler failed", { status: 500 });
  }
});

// Sync subscriptions from Stripe
export const syncSubscriptions = httpAction(async (ctx, request) => {
  try {
    const stripe = getStripe();
    
    const subscriptions = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      expand: ["data.customer"],
    });

    const results: Array<{ email: string; status: string; synced: boolean; error?: string }> = [];

    for (const subscription of subscriptions.data) {
      const customer = subscription.customer as Stripe.Customer;
      
      if (!customer.email) {
        results.push({ email: "unknown", status: subscription.status, synced: false, error: "No email" });
        continue;
      }

      try {
        await ctx.runMutation(internal.payments.internal_syncStripeSubscription, {
          userEmail: customer.email,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: subscription.current_period_end * 1000,
          priceId: subscription.items.data[0]?.price?.id,
          productId: subscription.items.data[0]?.price?.product as string,
        });
        results.push({ email: customer.email, status: subscription.status, synced: true });
      } catch (error) {
        results.push({
          email: customer.email,
          status: subscription.status,
          synced: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: results.filter((r) => r.synced).length,
        failed: results.filter((r) => !r.synced).length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Sync failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
