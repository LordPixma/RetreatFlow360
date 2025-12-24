import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import { eq, and, isNull } from 'drizzle-orm';
import type { Env, Variables } from '@retreatflow360/shared-types';
import { events, venues, rooms } from '@retreatflow360/database';
import { requireTenantMembership, requireRole } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { NotFoundError, ValidationError } from '../middleware/error';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply tenant requirement to all routes
app.use('*', requireTenant);

// Validation schemas
const requestUploadSchema = z.object({
  resourceType: z.enum(['event', 'venue', 'room']),
  resourceId: z.string().min(1, 'Resource ID is required'),
  filename: z.string().min(1, 'Filename is required').max(255),
  contentType: z.string().regex(/^image\/(jpeg|png|gif|webp)$/, 'Only image files are allowed'),
  contentLength: z.number().positive().max(10 * 1024 * 1024, 'File size must be under 10MB'),
});

const confirmUploadSchema = z.object({
  resourceType: z.enum(['event', 'venue', 'room']),
  resourceId: z.string().min(1, 'Resource ID is required'),
  key: z.string().min(1, 'Upload key is required'),
});

const deleteImageSchema = z.object({
  resourceType: z.enum(['event', 'venue', 'room']),
  resourceId: z.string().min(1, 'Resource ID is required'),
  imageUrl: z.string().url('Invalid image URL'),
});

/**
 * Verify resource exists and user has permission
 */
async function verifyResourceAccess(
  db: ReturnType<typeof import('@retreatflow360/database').createDb>,
  resourceType: 'event' | 'venue' | 'room',
  resourceId: string,
  tenantId: string
): Promise<{ id: string; images: string[] }> {
  let resource: { id: string; images: unknown } | undefined;

  switch (resourceType) {
    case 'event':
      resource = await db
        .select({ id: events.id, images: events.images })
        .from(events)
        .where(and(eq(events.id, resourceId), eq(events.tenantId, tenantId), isNull(events.deletedAt)))
        .limit(1)
        .then((r) => r[0]);
      break;
    case 'venue':
      resource = await db
        .select({ id: venues.id, images: venues.images })
        .from(venues)
        .where(and(eq(venues.id, resourceId), eq(venues.tenantId, tenantId), isNull(venues.deletedAt)))
        .limit(1)
        .then((r) => r[0]);
      break;
    case 'room':
      resource = await db
        .select({ id: rooms.id, images: rooms.images })
        .from(rooms)
        .where(and(eq(rooms.id, resourceId), eq(rooms.tenantId, tenantId), isNull(rooms.deletedAt)))
        .limit(1)
        .then((r) => r[0]);
      break;
  }

  if (!resource) {
    throw new NotFoundError(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found`);
  }

  return {
    id: resource.id,
    images: (resource.images as string[]) || [],
  };
}

/**
 * Generate a presigned URL for direct upload to R2
 * Note: R2 doesn't support native presigned URLs like S3
 * We'll use a signed token approach instead
 */
function generateUploadKey(tenantId: string, resourceType: string, resourceId: string, filename: string): string {
  const ext = filename.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const uniqueId = ulid();
  return `tenants/${tenantId}/${resourceType}s/${resourceId}/${timestamp}-${uniqueId}.${ext}`;
}

/**
 * Request a presigned upload URL
 * Client will upload directly to our endpoint with the returned key
 */
app.post(
  '/request-upload',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin', 'staff'),
  zValidator('json', requestUploadSchema),
  async (c) => {
    const data = c.req.valid('json');
    const tenant = c.get('tenant')!;
    const db = c.get('db');

    // Verify resource exists
    const resource = await verifyResourceAccess(db, data.resourceType, data.resourceId, tenant.id);

    // Check image limit (max 10 images per resource)
    if (resource.images.length >= 10) {
      throw new ValidationError('Maximum of 10 images per resource');
    }

    // Generate upload key
    const key = generateUploadKey(tenant.id, data.resourceType, data.resourceId, data.filename);

    // Store pending upload in KV with expiry
    const uploadToken = ulid();
    await c.env.KV.put(
      `upload:${uploadToken}`,
      JSON.stringify({
        key,
        tenantId: tenant.id,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        contentType: data.contentType,
        contentLength: data.contentLength,
        createdAt: Date.now(),
      }),
      { expirationTtl: 3600 } // 1 hour expiry
    );

    return c.json({
      success: true,
      data: {
        uploadToken,
        key,
        maxSize: 10 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      },
    });
  }
);

/**
 * Upload image data
 * Client sends the image binary with the upload token
 */
app.post(
  '/upload/:token',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin', 'staff'),
  async (c) => {
    const { token } = c.req.param();
    const tenant = c.get('tenant')!;

    // Retrieve pending upload info
    const uploadInfoStr = await c.env.KV.get(`upload:${token}`);
    if (!uploadInfoStr) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Upload token is invalid or expired',
          },
        },
        400
      );
    }

    const uploadInfo = JSON.parse(uploadInfoStr) as {
      key: string;
      tenantId: string;
      resourceType: 'event' | 'venue' | 'room';
      resourceId: string;
      contentType: string;
      contentLength: number;
    };

    // Verify tenant matches
    if (uploadInfo.tenantId !== tenant.id) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Upload token does not belong to this tenant',
          },
        },
        403
      );
    }

    // Get the file from request body
    const contentType = c.req.header('Content-Type');
    if (contentType !== uploadInfo.contentType) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: `Expected content type ${uploadInfo.contentType}`,
          },
        },
        400
      );
    }

    const body = await c.req.arrayBuffer();
    if (body.byteLength > uploadInfo.contentLength) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File exceeds declared size',
          },
        },
        400
      );
    }

    // Upload to R2
    await c.env.STORAGE.put(uploadInfo.key, body, {
      httpMetadata: {
        contentType: uploadInfo.contentType,
      },
      customMetadata: {
        tenantId: uploadInfo.tenantId,
        resourceType: uploadInfo.resourceType,
        resourceId: uploadInfo.resourceId,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Delete the upload token
    await c.env.KV.delete(`upload:${token}`);

    // Generate public URL
    const publicUrl = `${c.env.API_BASE_URL}/uploads/files/${uploadInfo.key}`;

    // Update resource with new image URL
    const db = c.get('db');
    const resource = await verifyResourceAccess(db, uploadInfo.resourceType, uploadInfo.resourceId, tenant.id);
    const newImages = [...resource.images, publicUrl];

    switch (uploadInfo.resourceType) {
      case 'event':
        await db.update(events).set({ images: newImages }).where(eq(events.id, uploadInfo.resourceId));
        break;
      case 'venue':
        await db.update(venues).set({ images: newImages }).where(eq(venues.id, uploadInfo.resourceId));
        break;
      case 'room':
        await db.update(rooms).set({ images: newImages }).where(eq(rooms.id, uploadInfo.resourceId));
        break;
    }

    return c.json({
      success: true,
      data: {
        url: publicUrl,
        key: uploadInfo.key,
      },
    });
  }
);

/**
 * Serve uploaded files from R2
 * Public endpoint (no auth required for viewing images)
 */
app.get('/files/*', async (c) => {
  const key = c.req.path.replace('/files/', '');

  const object = await c.env.STORAGE.get(key);
  if (!object) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'File not found',
        },
      },
      404
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.etag);

  // Check if client has cached version
  const ifNoneMatch = c.req.header('If-None-Match');
  if (ifNoneMatch === object.etag) {
    return c.body(null, 304);
  }

  return c.body(object.body, 200, Object.fromEntries(headers));
});

/**
 * Delete an image
 */
app.delete(
  '/image',
  requireTenantMembership,
  requireRole('tenant_owner', 'tenant_admin'),
  zValidator('json', deleteImageSchema),
  async (c) => {
    const data = c.req.valid('json');
    const tenant = c.get('tenant')!;
    const db = c.get('db');

    // Verify resource exists
    const resource = await verifyResourceAccess(db, data.resourceType, data.resourceId, tenant.id);

    // Verify image belongs to resource
    if (!resource.images.includes(data.imageUrl)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: 'Image not found on this resource',
          },
        },
        404
      );
    }

    // Extract key from URL
    const keyMatch = data.imageUrl.match(/\/files\/(.+)$/);
    if (keyMatch && keyMatch[1]) {
      // Delete from R2
      await c.env.STORAGE.delete(keyMatch[1]);
    }

    // Update resource to remove image
    const newImages = resource.images.filter((img: string) => img !== data.imageUrl);

    switch (data.resourceType) {
      case 'event':
        await db.update(events).set({ images: newImages }).where(eq(events.id, data.resourceId));
        break;
      case 'venue':
        await db.update(venues).set({ images: newImages }).where(eq(venues.id, data.resourceId));
        break;
      case 'room':
        await db.update(rooms).set({ images: newImages }).where(eq(rooms.id, data.resourceId));
        break;
    }

    return c.json({ success: true });
  }
);

/**
 * List images for a resource
 */
app.get('/:resourceType/:resourceId', async (c) => {
  const { resourceType, resourceId } = c.req.param();
  const tenant = c.get('tenant')!;
  const db = c.get('db');

  if (!['event', 'venue', 'room'].includes(resourceType)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_RESOURCE_TYPE',
          message: 'Resource type must be event, venue, or room',
        },
      },
      400
    );
  }

  const resource = await verifyResourceAccess(
    db,
    resourceType as 'event' | 'venue' | 'room',
    resourceId,
    tenant.id
  );

  return c.json({
    success: true,
    data: {
      images: resource.images,
    },
  });
});

export default app;
