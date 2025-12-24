/**
 * Payments API Routes
 *
 * Handles payment processing across multiple providers (Stripe, PayPal, GoCardless)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, asc, gte, lte, sql } from 'drizzle-orm';
import { createDb } from '@retreatflow360/database';
import { payments, refunds, paymentPlans, paymentInstallments, bookings } from '@retreatflow360/database/schema';
import {
  createPaymentIntentSchema,
  confirmPaymentSchema,
  createRefundSchema,
  listPaymentsSchema,
  createPaymentPlanSchema,
} from '@retreatflow360/validation';
import {
  PaymentService,
  createPaymentProvider,
  type PaymentProviderName,
  type PaymentProviderConfig,
} from '@retreatflow360/payments';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

/**
 * Helper to get tenant ID and user ID from context
 */
function getTenantAndUser(c: { get: <K extends keyof Variables>(key: K) => Variables[K] }) {
  const tenant = c.get('tenant');
  const user = c.get('user');
  return {
    tenantId: tenant?.id,
    userId: user?.sub,
    userRole: user?.role,
    tenant,
    user,
  };
}

/**
 * Get payment service for tenant
 */
function getPaymentService(env: AppEnv['Bindings'], tenantId: string): PaymentService {
  const providers: PaymentProviderConfig[] = [];

  // Stripe
  if (env.STRIPE_SECRET_KEY) {
    providers.push({
      provider: 'stripe',
      config: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
      },
    });
  }

  // PayPal
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
    providers.push({
      provider: 'paypal',
      config: {
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        environment: env.PAYPAL_ENVIRONMENT || 'sandbox',
      },
    });
  }

  // GoCardless
  if (env.GOCARDLESS_ACCESS_TOKEN && env.GOCARDLESS_WEBHOOK_SECRET) {
    providers.push({
      provider: 'gocardless',
      config: {
        accessToken: env.GOCARDLESS_ACCESS_TOKEN,
        webhookSecret: env.GOCARDLESS_WEBHOOK_SECRET,
        environment: env.GOCARDLESS_ENVIRONMENT || 'sandbox',
      },
    });
  }

  if (providers.length === 0) {
    throw new Error('No payment providers configured');
  }

  const firstProvider = providers[0]!;
  return new PaymentService({
    tenantId,
    providers,
    defaultProvider: env.DEFAULT_PAYMENT_PROVIDER || firstProvider.provider,
  });
}

/**
 * List payments for tenant with pagination and filters
 */
app.get('/', zValidator('query', listPaymentsSchema), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.json({ error: 'Tenant required' }, 400);
  }
  const tenantId = tenant.id;
  const { page, limit, bookingId, status, provider, startDate, endDate, sortBy, sortOrder } =
    c.req.valid('query');

  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(payments.tenantId, tenantId)];

  if (bookingId) {
    conditions.push(eq(payments.bookingId, bookingId));
  }

  if (status) {
    // Map validation status to database status
    const dbStatus = status === 'completed' ? 'succeeded' : status;
    conditions.push(eq(payments.status, dbStatus as typeof payments.status.enumValues[number]));
  }

  if (provider) {
    conditions.push(eq(payments.provider, provider));
  }

  if (startDate) {
    conditions.push(gte(payments.createdAt, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(payments.createdAt, new Date(endDate)));
  }

  // Build order by
  const orderColumnMap = {
    createdAt: payments.createdAt,
    amount: payments.amount,
    status: payments.status,
  } as const;
  const orderColumn = orderColumnMap[sortBy];

  const orderFn = sortOrder === 'asc' ? asc : desc;

  const database = createDb(c.env.DB);

  const [paymentList, countResult] = await Promise.all([
    database
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset),
    database
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(and(...conditions)),
  ]);

  const total = countResult[0]?.count || 0;

  return c.json({
    payments: paymentList,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * Get single payment by ID
 */
app.get('/:id', async (c) => {
  const { tenantId } = getTenantAndUser(c);
  if (!tenantId) {
    return c.json({ error: 'Tenant required' }, 400);
  }
  const paymentId = c.req.param('id');

  const database = createDb(c.env.DB);
  const [payment] = await database
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)));

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  // Get associated refunds
  const paymentRefunds = await database
    .select()
    .from(refunds)
    .where(eq(refunds.paymentId, paymentId));

  return c.json({
    payment,
    refunds: paymentRefunds,
  });
});

/**
 * Create payment intent
 */
app.post('/intent', zValidator('json', createPaymentIntentSchema), async (c) => {
  const { tenantId, userId, userRole } = getTenantAndUser(c);
  if (!tenantId || !userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const { bookingId, provider, amount, currency, paymentMethod, metadata } = c.req.valid('json');

  const database = createDb(c.env.DB);

  // Verify booking exists and belongs to tenant
  const [booking] = await database
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenantId)));

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Check user owns the booking or is staff
  if (booking.userId !== userId && !['admin', 'owner', 'staff'].includes(userRole || '')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const paymentService = getPaymentService(c.env, tenantId);

    // Get return URLs from environment or use defaults
    const baseUrl = c.env.APP_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/bookings/${bookingId}/payment/complete`;
    const cancelUrl = `${baseUrl}/bookings/${bookingId}/payment/cancel`;

    // Get user email from context
    const userContext = c.get('user');
    const userEmail = userContext?.email || '';

    const intent = await paymentService.createPaymentIntent(
      {
        bookingId,
        amount: { amount, currency },
        customer: {
          id: userId,
          email: userEmail,
        },
        description: `Payment for booking ${bookingId}`,
        returnUrl,
        cancelUrl,
        paymentMethod,
        metadata,
      },
      provider
    );

    // Create payment record
    const paymentId = crypto.randomUUID();
    const now = new Date();

    await database.insert(payments).values({
      id: paymentId,
      bookingId,
      tenantId,
      amount,
      currency,
      status: 'pending',
      provider,
      providerPaymentIntentId: intent.providerIntentId,
      paymentMethod,
      metadata: {
        ...metadata,
        intentId: intent.id,
      },
      createdAt: now,
      updatedAt: now,
    });

    return c.json({
      paymentId,
      intentId: intent.id,
      providerIntentId: intent.providerIntentId,
      clientSecret: intent.clientSecret,
      redirectUrl: intent.redirectUrl,
      status: intent.status,
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    return c.json(
      {
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Confirm payment
 */
app.post('/:id/confirm', zValidator('json', confirmPaymentSchema), async (c) => {
  const { tenantId } = getTenantAndUser(c);
  if (!tenantId) {
    return c.json({ error: 'Tenant required' }, 400);
  }
  const paymentId = c.req.param('id');
  const { paymentMethodId } = c.req.valid('json');

  const database = createDb(c.env.DB);

  // Get payment
  const [payment] = await database
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)));

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment.status !== 'pending') {
    return c.json({ error: 'Payment is not in pending status' }, 400);
  }

  try {
    const paymentService = getPaymentService(c.env, tenantId);

    const result = await paymentService.confirmPayment(
      {
        paymentIntentId: payment.providerPaymentIntentId!,
        paymentMethodId,
      },
      payment.provider as PaymentProviderName
    );

    // Update payment status
    const now = new Date();
    await database
      .update(payments)
      .set({
        status: result.status === 'succeeded' ? 'succeeded' : 'processing',
        providerChargeId: result.providerChargeId,
        updatedAt: now,
        completedAt: result.status === 'succeeded' ? now : undefined,
      })
      .where(eq(payments.id, paymentId));

    // If successful, update booking status
    if (result.success) {
      await database
        .update(bookings)
        .set({
          status: 'confirmed',
          updatedAt: now,
        })
        .where(eq(bookings.id, payment.bookingId));

      // Queue confirmation email
      if (c.env.EMAIL_QUEUE) {
        await c.env.EMAIL_QUEUE.send({
          type: 'payment_confirmation',
          paymentId,
          bookingId: payment.bookingId,
          tenantId,
        });
      }
    }

    return c.json({
      success: result.success,
      paymentId,
      status: result.status,
      error: result.error,
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return c.json(
      {
        error: 'Failed to confirm payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Cancel payment
 */
app.post('/:id/cancel', async (c) => {
  const { tenantId } = getTenantAndUser(c);
  if (!tenantId) {
    return c.json({ error: 'Tenant required' }, 400);
  }
  const paymentId = c.req.param('id');

  const database = createDb(c.env.DB);

  // Get payment
  const [payment] = await database
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)));

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (!['pending', 'processing'].includes(payment.status)) {
    return c.json({ error: 'Payment cannot be cancelled' }, 400);
  }

  try {
    const paymentService = getPaymentService(c.env, tenantId);

    const result = await paymentService.cancelPayment(
      payment.providerPaymentIntentId!,
      payment.provider as PaymentProviderName
    );

    if (result.success) {
      await database
        .update(payments)
        .set({
          status: 'failed',
          updatedAt: new Date(),
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            cancelledAt: Date.now(),
          },
        })
        .where(eq(payments.id, paymentId));
    }

    return c.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    console.error('Payment cancellation error:', error);
    return c.json(
      {
        error: 'Failed to cancel payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Create refund
 */
app.post('/:id/refund', zValidator('json', createRefundSchema), async (c) => {
  const { tenantId, userRole } = getTenantAndUser(c);
  if (!tenantId) {
    return c.json({ error: 'Tenant required' }, 400);
  }
  const paymentId = c.req.param('id');
  const { amount, reason } = c.req.valid('json');

  // Only staff can process refunds
  if (!['admin', 'owner', 'staff'].includes(userRole || '')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const database = createDb(c.env.DB);

  // Get payment
  const [payment] = await database
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)));

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment.status !== 'succeeded') {
    return c.json({ error: 'Only succeeded payments can be refunded' }, 400);
  }

  // Check refund amount doesn't exceed payment
  const existingRefunds = await database
    .select()
    .from(refunds)
    .where(and(eq(refunds.paymentId, paymentId), eq(refunds.status, 'succeeded')));

  const totalRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
  const maxRefundable = payment.amount - totalRefunded;

  if (amount > maxRefundable) {
    return c.json(
      {
        error: 'Refund amount exceeds available amount',
        maxRefundable,
      },
      400
    );
  }

  try {
    const paymentService = getPaymentService(c.env, tenantId);

    const result = await paymentService.refund(
      {
        paymentId: payment.providerPaymentIntentId!,
        providerChargeId: payment.providerChargeId!,
        amount: { amount, currency: payment.currency },
        reason,
      },
      payment.provider as PaymentProviderName
    );

    // Create refund record
    const refundId = crypto.randomUUID();
    const now = new Date();

    await database.insert(refunds).values({
      id: refundId,
      paymentId,
      tenantId,
      amount,
      reason,
      status: result.success ? 'succeeded' : 'pending',
      providerRefundId: result.providerRefundId,
      createdAt: now,
      completedAt: result.success ? now : undefined,
    });

    // Update payment status if fully refunded
    if (result.success) {
      const newTotalRefunded = totalRefunded + amount;
      const newStatus = newTotalRefunded >= payment.amount ? 'refunded' : 'partially_refunded';

      await database
        .update(payments)
        .set({
          status: newStatus,
          updatedAt: now,
        })
        .where(eq(payments.id, paymentId));
    }

    return c.json({
      success: result.success,
      refundId,
      status: result.status,
      error: result.error,
    });
  } catch (error) {
    console.error('Refund error:', error);
    return c.json(
      {
        error: 'Failed to process refund',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Get available payment providers for tenant
 */
app.get('/providers', async (c) => {
  const { tenantId } = getTenantAndUser(c);
  if (!tenantId) {
    return c.json({ error: 'Tenant required' }, 400);
  }

  try {
    const paymentService = getPaymentService(c.env, tenantId);
    const providers = paymentService.getAvailableProviders();

    return c.json({ providers });
  } catch (error) {
    return c.json({ providers: [] });
  }
});

/**
 * Create payment plan (installments)
 */
app.post('/plans', zValidator('json', createPaymentPlanSchema), async (c) => {
  const { tenantId, userId, userRole } = getTenantAndUser(c);
  if (!tenantId || !userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const { bookingId, totalAmount, currency, installmentCount, installmentDates } =
    c.req.valid('json');

  const database = createDb(c.env.DB);

  // Verify booking
  const [booking] = await database
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenantId)));

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  // Check authorization
  if (booking.userId !== userId && !['admin', 'owner', 'staff'].includes(userRole || '')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // Create payment plan
  const planId = crypto.randomUUID();
  const now = new Date();

  await database.insert(paymentPlans).values({
    id: planId,
    bookingId,
    tenantId,
    totalAmount,
    currency,
    installmentCount,
    status: 'active',
    createdAt: now,
  });

  // Calculate installment amounts and dates
  const installmentAmount = Math.floor(totalAmount / installmentCount);
  const remainder = totalAmount - installmentAmount * installmentCount;

  const installments: Array<{
    id: string;
    paymentPlanId: string;
    amount: number;
    dueDate: Date;
    status: 'pending';
    createdAt: Date;
  }> = [];

  for (let i = 0; i < installmentCount; i++) {
    const amount = i === 0 ? installmentAmount + remainder : installmentAmount;

    // Use provided dates or calculate monthly intervals
    const providedDate = installmentDates?.[i];
    const dueDate = providedDate !== undefined
      ? new Date(providedDate)
      : new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000);

    installments.push({
      id: crypto.randomUUID(),
      paymentPlanId: planId,
      amount,
      dueDate,
      status: 'pending',
      createdAt: now,
    });
  }

  await database.insert(paymentInstallments).values(installments);

  return c.json({
    planId,
    installments: installments.map((i) => ({
      id: i.id,
      amount: i.amount,
      dueDate: i.dueDate.getTime(),
      status: i.status,
    })),
  });
});

/**
 * Get payment plan
 */
app.get('/plans/:id', async (c) => {
  const { tenantId } = getTenantAndUser(c);
  if (!tenantId) {
    return c.json({ error: 'Tenant required' }, 400);
  }
  const planId = c.req.param('id');

  const database = createDb(c.env.DB);

  const [plan] = await database
    .select()
    .from(paymentPlans)
    .where(and(eq(paymentPlans.id, planId), eq(paymentPlans.tenantId, tenantId)));

  if (!plan) {
    return c.json({ error: 'Payment plan not found' }, 404);
  }

  const installments = await database
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.paymentPlanId, planId))
    .orderBy(asc(paymentInstallments.dueDate));

  return c.json({
    plan,
    installments,
  });
});

/**
 * Webhook handler for payment providers
 * Note: This should be in the queue processor, but we include a basic handler here
 */
app.post('/webhooks/:provider', async (c) => {
  const provider = c.req.param('provider') as PaymentProviderName;
  const signature = c.req.header('stripe-signature') ||
    c.req.header('paypal-transmission-sig') ||
    c.req.header('webhook-signature') ||
    '';

  if (!['stripe', 'paypal', 'gocardless'].includes(provider)) {
    return c.json({ error: 'Unknown provider' }, 400);
  }

  try {
    const payload = await c.req.text();

    // Create provider to verify webhook
    const providerConfig = getProviderConfig(c.env, provider);
    if (!providerConfig) {
      return c.json({ error: 'Provider not configured' }, 400);
    }

    const paymentProvider = createPaymentProvider(providerConfig);

    const result = await paymentProvider.verifyWebhook(payload, signature);

    if (!result.valid) {
      return c.json({ error: 'Invalid webhook signature' }, 400);
    }

    // Queue webhook for processing
    if (c.env.PAYMENT_QUEUE) {
      await c.env.PAYMENT_QUEUE.send({
        type: 'payment_webhook',
        provider,
        event: result.event,
      });
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

function getProviderConfig(
  env: AppEnv['Bindings'],
  provider: PaymentProviderName
): PaymentProviderConfig | null {
  switch (provider) {
    case 'stripe':
      if (!env.STRIPE_SECRET_KEY) return null;
      return {
        provider: 'stripe',
        config: {
          secretKey: env.STRIPE_SECRET_KEY,
          webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
        },
      };
    case 'paypal':
      if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return null;
      return {
        provider: 'paypal',
        config: {
          clientId: env.PAYPAL_CLIENT_ID,
          clientSecret: env.PAYPAL_CLIENT_SECRET,
          environment: env.PAYPAL_ENVIRONMENT || 'sandbox',
        },
      };
    case 'gocardless':
      if (!env.GOCARDLESS_ACCESS_TOKEN || !env.GOCARDLESS_WEBHOOK_SECRET) return null;
      return {
        provider: 'gocardless',
        config: {
          accessToken: env.GOCARDLESS_ACCESS_TOKEN,
          webhookSecret: env.GOCARDLESS_WEBHOOK_SECRET,
          environment: env.GOCARDLESS_ENVIRONMENT || 'sandbox',
        },
      };
    default:
      return null;
  }
}

export default app;
