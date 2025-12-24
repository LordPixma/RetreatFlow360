/**
 * Role-Based Access Control (RBAC) system
 * Defines roles, permissions, and access control utilities
 */

/**
 * Global roles (platform-wide)
 */
export const GlobalRoles = {
  GLOBAL_ADMIN: 'global_admin',
} as const;

/**
 * Tenant-level roles
 */
export const TenantRoles = {
  TENANT_OWNER: 'tenant_owner',
  TENANT_ADMIN: 'tenant_admin',
  STAFF: 'staff',
} as const;

/**
 * User roles (for attendees)
 */
export const UserRoles = {
  ATTENDEE: 'attendee',
} as const;

/**
 * All roles combined
 */
export const Roles = {
  ...GlobalRoles,
  ...TenantRoles,
  ...UserRoles,
} as const;

export type GlobalRole = (typeof GlobalRoles)[keyof typeof GlobalRoles];
export type TenantRole = (typeof TenantRoles)[keyof typeof TenantRoles];
export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];
export type Role = GlobalRole | TenantRole | UserRole;

/**
 * Permission definitions
 */
export const Permissions = {
  // Tenant management
  TENANT_READ: 'tenant:read',
  TENANT_UPDATE: 'tenant:update',
  TENANT_DELETE: 'tenant:delete',
  TENANT_MANAGE_BILLING: 'tenant:manage_billing',
  TENANT_MANAGE_MEMBERS: 'tenant:manage_members',

  // Event management
  EVENT_CREATE: 'event:create',
  EVENT_READ: 'event:read',
  EVENT_UPDATE: 'event:update',
  EVENT_DELETE: 'event:delete',
  EVENT_PUBLISH: 'event:publish',

  // Venue management
  VENUE_CREATE: 'venue:create',
  VENUE_READ: 'venue:read',
  VENUE_UPDATE: 'venue:update',
  VENUE_DELETE: 'venue:delete',

  // Booking management
  BOOKING_CREATE: 'booking:create',
  BOOKING_READ: 'booking:read',
  BOOKING_READ_ALL: 'booking:read_all',
  BOOKING_UPDATE: 'booking:update',
  BOOKING_CANCEL: 'booking:cancel',
  BOOKING_APPROVE: 'booking:approve',

  // Payment management
  PAYMENT_READ: 'payment:read',
  PAYMENT_PROCESS: 'payment:process',
  PAYMENT_REFUND: 'payment:refund',

  // User management
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // Reports
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',

  // Global admin only
  ADMIN_ACCESS: 'admin:access',
  ADMIN_MANAGE_TENANTS: 'admin:manage_tenants',
  ADMIN_IMPERSONATE: 'admin:impersonate',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/**
 * Role to permissions mapping
 */
export const RolePermissions: Record<Role, Permission[]> = {
  // Global admin has all permissions
  [Roles.GLOBAL_ADMIN]: Object.values(Permissions),

  // Tenant owner has full tenant access
  [Roles.TENANT_OWNER]: [
    Permissions.TENANT_READ,
    Permissions.TENANT_UPDATE,
    Permissions.TENANT_DELETE,
    Permissions.TENANT_MANAGE_BILLING,
    Permissions.TENANT_MANAGE_MEMBERS,
    Permissions.EVENT_CREATE,
    Permissions.EVENT_READ,
    Permissions.EVENT_UPDATE,
    Permissions.EVENT_DELETE,
    Permissions.EVENT_PUBLISH,
    Permissions.VENUE_CREATE,
    Permissions.VENUE_READ,
    Permissions.VENUE_UPDATE,
    Permissions.VENUE_DELETE,
    Permissions.BOOKING_READ,
    Permissions.BOOKING_READ_ALL,
    Permissions.BOOKING_UPDATE,
    Permissions.BOOKING_CANCEL,
    Permissions.BOOKING_APPROVE,
    Permissions.PAYMENT_READ,
    Permissions.PAYMENT_PROCESS,
    Permissions.PAYMENT_REFUND,
    Permissions.USER_READ,
    Permissions.REPORTS_VIEW,
    Permissions.REPORTS_EXPORT,
  ],

  // Tenant admin has most tenant access except billing and deletion
  [Roles.TENANT_ADMIN]: [
    Permissions.TENANT_READ,
    Permissions.TENANT_UPDATE,
    Permissions.TENANT_MANAGE_MEMBERS,
    Permissions.EVENT_CREATE,
    Permissions.EVENT_READ,
    Permissions.EVENT_UPDATE,
    Permissions.EVENT_DELETE,
    Permissions.EVENT_PUBLISH,
    Permissions.VENUE_CREATE,
    Permissions.VENUE_READ,
    Permissions.VENUE_UPDATE,
    Permissions.VENUE_DELETE,
    Permissions.BOOKING_READ,
    Permissions.BOOKING_READ_ALL,
    Permissions.BOOKING_UPDATE,
    Permissions.BOOKING_CANCEL,
    Permissions.BOOKING_APPROVE,
    Permissions.PAYMENT_READ,
    Permissions.PAYMENT_PROCESS,
    Permissions.PAYMENT_REFUND,
    Permissions.USER_READ,
    Permissions.REPORTS_VIEW,
    Permissions.REPORTS_EXPORT,
  ],

  // Staff has limited operational access
  [Roles.STAFF]: [
    Permissions.TENANT_READ,
    Permissions.EVENT_CREATE,
    Permissions.EVENT_READ,
    Permissions.EVENT_UPDATE,
    Permissions.VENUE_READ,
    Permissions.BOOKING_READ,
    Permissions.BOOKING_READ_ALL,
    Permissions.BOOKING_UPDATE,
    Permissions.BOOKING_APPROVE,
    Permissions.PAYMENT_READ,
    Permissions.USER_READ,
    Permissions.REPORTS_VIEW,
  ],

  // Attendees have minimal access
  [Roles.ATTENDEE]: [
    Permissions.EVENT_READ,
    Permissions.VENUE_READ,
    Permissions.BOOKING_CREATE,
    Permissions.BOOKING_READ,
    Permissions.BOOKING_CANCEL,
    Permissions.PAYMENT_READ,
    Permissions.USER_READ,
    Permissions.USER_UPDATE,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = RolePermissions[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Permission[] {
  return RolePermissions[role] ?? [];
}

/**
 * Role hierarchy (higher index = more permissions)
 */
export const RoleHierarchy: Role[] = [
  Roles.ATTENDEE,
  Roles.STAFF,
  Roles.TENANT_ADMIN,
  Roles.TENANT_OWNER,
  Roles.GLOBAL_ADMIN,
];

/**
 * Check if a role is at least as powerful as another role
 */
export function isRoleAtLeast(userRole: Role, requiredRole: Role): boolean {
  const userIndex = RoleHierarchy.indexOf(userRole);
  const requiredIndex = RoleHierarchy.indexOf(requiredRole);

  if (userIndex === -1 || requiredIndex === -1) {
    return false;
  }

  return userIndex >= requiredIndex;
}

/**
 * Check if a user can perform an action based on role and custom permissions
 */
export function canPerform(
  userRole: Role,
  permission: Permission,
  customPermissions?: Record<string, boolean>
): boolean {
  // Check custom permissions first (overrides)
  if (customPermissions) {
    const customValue = customPermissions[permission];
    if (customValue !== undefined) {
      return customValue;
    }
  }

  // Fall back to role-based permissions
  return hasPermission(userRole, permission);
}

/**
 * Check if a user can manage another user (based on role hierarchy)
 */
export function canManageUser(managerRole: Role, targetRole: Role): boolean {
  // Global admin can manage everyone
  if (managerRole === Roles.GLOBAL_ADMIN) {
    return true;
  }

  const managerIndex = RoleHierarchy.indexOf(managerRole);
  const targetIndex = RoleHierarchy.indexOf(targetRole);

  // Can only manage users with lower roles
  return managerIndex > targetIndex;
}

/**
 * Get assignable roles for a given role (roles that can be assigned to others)
 */
export function getAssignableRoles(assignerRole: Role): Role[] {
  const assignerIndex = RoleHierarchy.indexOf(assignerRole);

  if (assignerIndex === -1) {
    return [];
  }

  // Can assign roles lower than own role
  return RoleHierarchy.slice(0, assignerIndex);
}

/**
 * Validate that a role is a valid tenant role
 */
export function isTenantRole(role: string): role is TenantRole {
  return Object.values(TenantRoles).includes(role as TenantRole);
}

/**
 * Validate that a role is a valid global role
 */
export function isGlobalRole(role: string): role is GlobalRole {
  return Object.values(GlobalRoles).includes(role as GlobalRole);
}

/**
 * Validate that a role is valid
 */
export function isValidRole(role: string): role is Role {
  return Object.values(Roles).includes(role as Role);
}
