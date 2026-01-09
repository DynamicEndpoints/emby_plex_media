import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize Stripe lazily for webhooks
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  return new Stripe(secretKey, { typescript: true });
}

// Stripe webhook secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const clerkId = session.metadata?.clerkId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!clerkId || !customerId) {
    console.error("Missing metadata in checkout session");
    return;
  }

  // First, set the Stripe customer ID on the user
  await convex.mutation(api.payments.setStripeCustomerId, {
    clerkId,
    stripeCustomerId: customerId,
  });

  // Get subscription details
  if (subscriptionId) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdate(subscription, clerkId);
  }
}

async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  clerkIdOverride?: string
) {
  const customerId = subscription.customer as string;
  const clerkId = clerkIdOverride || (subscription.metadata?.clerkId as string);

  // Map Stripe status to our payment status
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    trialing: "trialing",
    incomplete: "pending",
    incomplete_expired: "canceled",
    paused: "pending",
  };

  const paymentStatus = statusMap[subscription.status] || "pending";

  // Update user's payment status
  await convex.mutation(api.payments.updatePaymentStatus, {
    clerkId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    paymentStatus: paymentStatus as any,
    paymentExpiresAt: subscription.current_period_end * 1000,
  });

  // Find user to get their ID for subscription record
  // We'll need to handle this in the Convex function
  const priceId = subscription.items.data[0]?.price.id || "";
  const productId =
    (subscription.items.data[0]?.price.product as string) || "";

  // Note: We can't easily get the userId here, so we'll handle it in Convex
  // by looking up the user from stripeCustomerId
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Update user's payment status to canceled
  await convex.mutation(api.payments.updatePaymentStatus, {
    stripeCustomerId: customerId,
    paymentStatus: "canceled",
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const paymentIntentId = invoice.payment_intent as string;

  if (!paymentIntentId) return;

  // Record the payment
  await convex.mutation(api.payments.recordPayment, {
    stripePaymentId: paymentIntentId,
    stripeCustomerId: customerId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: "succeeded",
    description: invoice.description || "Subscription payment",
    invoiceId: invoice.id,
  });

  // Update payment status to active if subscription
  if (invoice.subscription) {
    await convex.mutation(api.payments.updatePaymentStatus, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: invoice.subscription as string,
      paymentStatus: "active",
      paymentExpiresAt: (invoice.lines.data[0]?.period?.end || 0) * 1000,
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Update payment status to past_due
  await convex.mutation(api.payments.updatePaymentStatus, {
    stripeCustomerId: customerId,
    paymentStatus: "past_due",
  });
}
