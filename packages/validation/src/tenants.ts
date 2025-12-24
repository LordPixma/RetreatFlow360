import { z } from 'zod';

/**
 * Slug validation for tenants
 */
export const tenantSlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be less than 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
  .refine((slug) => !slug.startsWith('-') && !slug.endsWith('-'), {
    message: 'Slug cannot start or end with a hyphen',
  });

/**
 * Subscription tier enum
 */
export const subscriptionTierSchema = z.enum(['free', 'starter', 'professional', 'enterprise']);

export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

/**
 * Create tenant validation
 */
export const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: tenantSlugSchema,
  customDomain: z.string().url().optional(),
  subscriptionTier: subscriptionTierSchema.default('free'),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  settings: z
    .object({
      brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      logo: z.string().url().optional(),
      timezone: z.string().optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/**
 * Update tenant validation
 */
export const updateTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  customDomain: z.string().url().nullable().optional(),
  subscriptionTier: subscriptionTierSchema.optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  settings: z
    .object({
      brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      logo: z.string().url().optional(),
      timezone: z.string().optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

/**
 * List tenants query validation
 */
export const listTenantsSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  search: z.string().max(100).optional(),
  subscriptionTier: subscriptionTierSchema.optional(),
  sortBy: z.enum(['createdAt', 'name', 'subscriptionTier']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListTenantsInput = z.infer<typeof listTenantsSchema>;

/**
 * Feature flag update validation
 */
export const updateFeatureFlagsSchema = z.object({
  flags: z.record(z.string(), z.boolean()),
});

export type UpdateFeatureFlagsInput = z.infer<typeof updateFeatureFlagsSchema>;

/**
 * Domain verification validation
 */
export const verifyDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
});

export type VerifyDomainInput = z.infer<typeof verifyDomainSchema>;
