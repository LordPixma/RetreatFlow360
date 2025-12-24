import { z } from 'zod';

/**
 * User profile validation
 */
export const userProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;

/**
 * Update user profile validation
 */
export const updateUserProfileSchema = userProfileSchema.partial();

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

/**
 * Dietary requirements validation
 */
export const dietaryRequirementsSchema = z.object({
  vegetarian: z.boolean().optional(),
  vegan: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  dairyFree: z.boolean().optional(),
  nutFree: z.boolean().optional(),
  halal: z.boolean().optional(),
  kosher: z.boolean().optional(),
  allergies: z.array(z.string().max(100)).optional(),
  intolerances: z.array(z.string().max(100)).optional(),
  otherRestrictions: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export type DietaryRequirementsInput = z.infer<typeof dietaryRequirementsSchema>;

/**
 * Accessibility needs validation
 */
export const accessibilityNeedsSchema = z.object({
  mobilityRequirements: z
    .object({
      wheelchairAccess: z.boolean().optional(),
      groundFloorOnly: z.boolean().optional(),
      mobilityAids: z.array(z.string()).optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  visualRequirements: z
    .object({
      largeText: z.boolean().optional(),
      screenReaderFriendly: z.boolean().optional(),
      highContrast: z.boolean().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  auditoryRequirements: z
    .object({
      signLanguageInterpreter: z.boolean().optional(),
      hearingLoop: z.boolean().optional(),
      captioning: z.boolean().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  otherNeeds: z.string().max(1000).optional(),
});

export type AccessibilityNeedsInput = z.infer<typeof accessibilityNeedsSchema>;

/**
 * Create user validation (admin)
 */
export const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['global_admin', 'tenant_owner', 'tenant_admin', 'staff', 'attendee']),
  profile: userProfileSchema.optional(),
  tenantId: z.string().optional(),
  sendInvite: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Update user validation (admin)
 */
export const updateUserSchema = z.object({
  email: z.string().email('Valid email is required').optional(),
  role: z.enum(['global_admin', 'tenant_owner', 'tenant_admin', 'staff', 'attendee']).optional(),
  profile: userProfileSchema.partial().optional(),
  emailVerified: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * List users query validation
 */
export const listUsersSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  role: z.enum(['global_admin', 'tenant_owner', 'tenant_admin', 'staff', 'attendee']).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['createdAt', 'email', 'role']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;

/**
 * Tenant membership validation
 */
export const createTenantMembershipSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  role: z.enum(['tenant_owner', 'tenant_admin', 'staff', 'attendee']),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export type CreateTenantMembershipInput = z.infer<typeof createTenantMembershipSchema>;

/**
 * Update tenant membership validation
 */
export const updateTenantMembershipSchema = z.object({
  role: z.enum(['tenant_owner', 'tenant_admin', 'staff', 'attendee']).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export type UpdateTenantMembershipInput = z.infer<typeof updateTenantMembershipSchema>;

/**
 * MFA setup validation
 */
export const mfaSetupSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

export type MfaSetupInput = z.infer<typeof mfaSetupSchema>;

/**
 * MFA verification validation
 */
export const mfaVerifySchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
