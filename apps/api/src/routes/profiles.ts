/**
 * User Profiles API Routes
 *
 * Handles dietary requirements and accessibility needs management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { createDb } from '@retreatflow360/database';
import { users, bookings, rooms, events, roomAllocations } from '@retreatflow360/database/schema';
import {
  dietaryRequirementsSchema,
  accessibilityNeedsSchema,
  updateUserProfileSchema,
} from '@retreatflow360/validation';
import type { Env, Variables } from '@retreatflow360/shared-types';

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

/**
 * Get current user's profile
 */
app.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const database = createDb(c.env.DB);
  const [userRecord] = await database
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      profileData: users.profileData,
      dietaryRequirements: users.dietaryRequirements,
      accessibilityNeeds: users.accessibilityNeeds,
      emailVerified: users.emailVerified,
      mfaEnabled: users.mfaEnabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, user.sub));

  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user: userRecord });
});

/**
 * Update current user's profile
 */
app.patch('/me', zValidator('json', updateUserProfileSchema), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const updates = c.req.valid('json');
  const database = createDb(c.env.DB);

  // Get current profile data
  const [currentUser] = await database
    .select({ profileData: users.profileData })
    .from(users)
    .where(eq(users.id, user.sub));

  if (!currentUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Merge profile data
  const newProfileData = {
    ...(currentUser.profileData || {}),
    ...updates,
  };

  await database
    .update(users)
    .set({
      profileData: newProfileData,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.sub));

  return c.json({ success: true, profileData: newProfileData });
});

/**
 * Get current user's dietary requirements
 */
app.get('/me/dietary', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const database = createDb(c.env.DB);
  const [userRecord] = await database
    .select({ dietaryRequirements: users.dietaryRequirements })
    .from(users)
    .where(eq(users.id, user.sub));

  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ dietary: userRecord.dietaryRequirements || {} });
});

/**
 * Update current user's dietary requirements
 */
app.put('/me/dietary', zValidator('json', dietaryRequirementsSchema), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const dietary = c.req.valid('json');
  const database = createDb(c.env.DB);

  // Transform validation schema to database format
  const dbDietary = {
    allergies: dietary.allergies || [],
    intolerances: dietary.intolerances || [],
    preferences: [
      ...(dietary.vegetarian ? ['vegetarian'] : []),
      ...(dietary.vegan ? ['vegan'] : []),
      ...(dietary.glutenFree ? ['gluten-free'] : []),
      ...(dietary.dairyFree ? ['dairy-free'] : []),
      ...(dietary.nutFree ? ['nut-free'] : []),
      ...(dietary.halal ? ['halal'] : []),
      ...(dietary.kosher ? ['kosher'] : []),
    ],
    notes: [dietary.otherRestrictions, dietary.notes].filter(Boolean).join('\n'),
  };

  await database
    .update(users)
    .set({
      dietaryRequirements: dbDietary,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.sub));

  return c.json({ success: true, dietary: dbDietary });
});

/**
 * Get current user's accessibility needs
 */
app.get('/me/accessibility', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const database = createDb(c.env.DB);
  const [userRecord] = await database
    .select({ accessibilityNeeds: users.accessibilityNeeds })
    .from(users)
    .where(eq(users.id, user.sub));

  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ accessibility: userRecord.accessibilityNeeds || {} });
});

/**
 * Update current user's accessibility needs
 */
app.put('/me/accessibility', zValidator('json', accessibilityNeedsSchema), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const accessibility = c.req.valid('json');
  const database = createDb(c.env.DB);

  // Transform validation schema to database format
  const mobilityNeeds: string[] = [];
  const visualNeeds: string[] = [];
  const auditoryNeeds: string[] = [];
  const otherNeeds: string[] = [];
  const notes: string[] = [];

  if (accessibility.mobilityRequirements) {
    if (accessibility.mobilityRequirements.wheelchairAccess) mobilityNeeds.push('wheelchair-access');
    if (accessibility.mobilityRequirements.groundFloorOnly) mobilityNeeds.push('ground-floor-only');
    if (accessibility.mobilityRequirements.mobilityAids) {
      mobilityNeeds.push(...accessibility.mobilityRequirements.mobilityAids);
    }
    if (accessibility.mobilityRequirements.notes) notes.push(accessibility.mobilityRequirements.notes);
  }

  if (accessibility.visualRequirements) {
    if (accessibility.visualRequirements.largeText) visualNeeds.push('large-text');
    if (accessibility.visualRequirements.screenReaderFriendly) visualNeeds.push('screen-reader');
    if (accessibility.visualRequirements.highContrast) visualNeeds.push('high-contrast');
    if (accessibility.visualRequirements.notes) notes.push(accessibility.visualRequirements.notes);
  }

  if (accessibility.auditoryRequirements) {
    if (accessibility.auditoryRequirements.signLanguageInterpreter) auditoryNeeds.push('sign-language');
    if (accessibility.auditoryRequirements.hearingLoop) auditoryNeeds.push('hearing-loop');
    if (accessibility.auditoryRequirements.captioning) auditoryNeeds.push('captioning');
    if (accessibility.auditoryRequirements.notes) notes.push(accessibility.auditoryRequirements.notes);
  }

  if (accessibility.otherNeeds) {
    otherNeeds.push(accessibility.otherNeeds);
  }

  const dbAccessibility = {
    mobility: mobilityNeeds,
    visual: visualNeeds,
    auditory: auditoryNeeds,
    other: otherNeeds,
    notes: notes.join('\n'),
  };

  await database
    .update(users)
    .set({
      accessibilityNeeds: dbAccessibility,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.sub));

  return c.json({ success: true, accessibility: dbAccessibility });
});

/**
 * Get dietary summary for an event (staff only)
 * Aggregates dietary requirements for all confirmed attendees
 */
app.get('/events/:eventId/dietary-summary', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff
  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get all confirmed bookings for this event
  const confirmedBookings = await database
    .select({
      userId: bookings.userId,
      dietaryNotes: bookings.dietaryNotes,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, eventId),
        eq(bookings.tenantId, tenant.id),
        eq(bookings.status, 'confirmed')
      )
    );

  if (confirmedBookings.length === 0) {
    return c.json({
      eventId,
      totalAttendees: 0,
      dietary: {
        allergies: {},
        intolerances: {},
        preferences: {},
        notes: [],
      },
    });
  }

  // Get user dietary requirements
  const userIds = confirmedBookings.map((b) => b.userId);
  const attendees = await database
    .select({
      id: users.id,
      dietaryRequirements: users.dietaryRequirements,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  // Aggregate dietary data
  const allergyCounts: Record<string, number> = {};
  const intoleranceCounts: Record<string, number> = {};
  const preferenceCounts: Record<string, number> = {};
  const allNotes: string[] = [];

  for (const attendee of attendees) {
    const dietary = attendee.dietaryRequirements as {
      allergies?: string[];
      intolerances?: string[];
      preferences?: string[];
      notes?: string;
    } | null;

    if (dietary) {
      for (const allergy of dietary.allergies || []) {
        allergyCounts[allergy] = (allergyCounts[allergy] || 0) + 1;
      }
      for (const intolerance of dietary.intolerances || []) {
        intoleranceCounts[intolerance] = (intoleranceCounts[intolerance] || 0) + 1;
      }
      for (const pref of dietary.preferences || []) {
        preferenceCounts[pref] = (preferenceCounts[pref] || 0) + 1;
      }
      if (dietary.notes) {
        allNotes.push(dietary.notes);
      }
    }
  }

  // Also include booking-specific dietary notes
  for (const booking of confirmedBookings) {
    if (booking.dietaryNotes) {
      allNotes.push(booking.dietaryNotes);
    }
  }

  return c.json({
    eventId,
    totalAttendees: confirmedBookings.length,
    dietary: {
      allergies: allergyCounts,
      intolerances: intoleranceCounts,
      preferences: preferenceCounts,
      notes: allNotes,
    },
  });
});

/**
 * Get accessibility summary for an event (staff only)
 * Aggregates accessibility needs for all confirmed attendees
 */
app.get('/events/:eventId/accessibility-summary', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff
  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get all confirmed bookings for this event
  const confirmedBookings = await database
    .select({
      userId: bookings.userId,
      accessibilityNotes: bookings.accessibilityNotes,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, eventId),
        eq(bookings.tenantId, tenant.id),
        eq(bookings.status, 'confirmed')
      )
    );

  if (confirmedBookings.length === 0) {
    return c.json({
      eventId,
      totalAttendees: 0,
      accessibility: {
        mobility: {},
        visual: {},
        auditory: {},
        other: {},
        notes: [],
      },
    });
  }

  // Get user accessibility needs
  const userIds = confirmedBookings.map((b) => b.userId);
  const attendees = await database
    .select({
      id: users.id,
      accessibilityNeeds: users.accessibilityNeeds,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  // Aggregate accessibility data
  const mobilityCounts: Record<string, number> = {};
  const visualCounts: Record<string, number> = {};
  const auditoryCounts: Record<string, number> = {};
  const otherCounts: Record<string, number> = {};
  const allNotes: string[] = [];

  for (const attendee of attendees) {
    const needs = attendee.accessibilityNeeds as {
      mobility?: string[];
      visual?: string[];
      auditory?: string[];
      other?: string[];
      notes?: string;
    } | null;

    if (needs) {
      for (const need of needs.mobility || []) {
        mobilityCounts[need] = (mobilityCounts[need] || 0) + 1;
      }
      for (const need of needs.visual || []) {
        visualCounts[need] = (visualCounts[need] || 0) + 1;
      }
      for (const need of needs.auditory || []) {
        auditoryCounts[need] = (auditoryCounts[need] || 0) + 1;
      }
      for (const need of needs.other || []) {
        otherCounts[need] = (otherCounts[need] || 0) + 1;
      }
      if (needs.notes) {
        allNotes.push(needs.notes);
      }
    }
  }

  // Also include booking-specific accessibility notes
  for (const booking of confirmedBookings) {
    if (booking.accessibilityNotes) {
      allNotes.push(booking.accessibilityNotes);
    }
  }

  // Count attendees needing accessible rooms
  const needsAccessibleRoom = attendees.filter((a) => {
    const needs = a.accessibilityNeeds as { mobility?: string[] } | null;
    return needs?.mobility?.some((m) =>
      ['wheelchair-access', 'ground-floor-only'].includes(m)
    );
  }).length;

  return c.json({
    eventId,
    totalAttendees: confirmedBookings.length,
    needsAccessibleRoom,
    accessibility: {
      mobility: mobilityCounts,
      visual: visualCounts,
      auditory: auditoryCounts,
      other: otherCounts,
      notes: allNotes,
    },
  });
});

/**
 * Get detailed attendee list with dietary/accessibility for an event (staff only)
 */
app.get('/events/:eventId/attendee-requirements', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff
  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get all confirmed bookings with user data
  const confirmedBookings = await database
    .select({
      bookingId: bookings.id,
      userId: bookings.userId,
      dietaryNotes: bookings.dietaryNotes,
      accessibilityNotes: bookings.accessibilityNotes,
      userEmail: users.email,
      userProfile: users.profileData,
      userDietary: users.dietaryRequirements,
      userAccessibility: users.accessibilityNeeds,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        eq(bookings.eventId, eventId),
        eq(bookings.tenantId, tenant.id),
        eq(bookings.status, 'confirmed')
      )
    );

  const attendees = confirmedBookings.map((b) => {
    const profile = b.userProfile as { firstName?: string; lastName?: string } | null;
    return {
      bookingId: b.bookingId,
      userId: b.userId,
      email: b.userEmail,
      name: profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : undefined,
      dietary: {
        profile: b.userDietary || {},
        bookingNotes: b.dietaryNotes,
      },
      accessibility: {
        profile: b.userAccessibility || {},
        bookingNotes: b.accessibilityNotes,
      },
    };
  });

  return c.json({
    eventId,
    totalAttendees: attendees.length,
    attendees,
  });
});

/**
 * Accessibility feature mapping from user needs to room features
 */
const accessibilityFeatureMap: Record<string, string[]> = {
  'wheelchair-access': ['wheelchair-accessible', 'accessible-bathroom', 'roll-in-shower'],
  'ground-floor-only': ['ground-floor', 'elevator-access'],
  'walker': ['wide-doorways', 'grab-bars'],
  'cane': ['non-slip-floors'],
  'large-text': ['braille-signage'],
  'screen-reader': ['braille-signage'],
  'high-contrast': ['good-lighting'],
  'sign-language': [],
  'hearing-loop': ['hearing-loop', 'visual-alerts'],
  'captioning': ['tv-with-captions'],
};

/**
 * Calculate accessibility match score for a room
 */
function calculateAccessibilityScore(
  userNeeds: { mobility?: string[]; visual?: string[]; auditory?: string[] } | null,
  roomFeatures: string[]
): { score: number; matchedFeatures: string[]; missingNeeds: string[] } {
  if (!userNeeds) {
    return { score: 100, matchedFeatures: [], missingNeeds: [] };
  }

  const allNeeds = [
    ...(userNeeds.mobility || []),
    ...(userNeeds.visual || []),
    ...(userNeeds.auditory || []),
  ];

  if (allNeeds.length === 0) {
    return { score: 100, matchedFeatures: [], missingNeeds: [] };
  }

  const matchedFeatures: string[] = [];
  const missingNeeds: string[] = [];
  const roomFeaturesLower = roomFeatures.map(f => f.toLowerCase());

  for (const need of allNeeds) {
    const requiredFeatures = accessibilityFeatureMap[need] || [];

    // Check if room has any matching features for this need
    const hasMatch = requiredFeatures.length === 0 || requiredFeatures.some(feature =>
      roomFeaturesLower.includes(feature.toLowerCase())
    );

    if (hasMatch) {
      for (const feature of requiredFeatures) {
        if (roomFeaturesLower.includes(feature.toLowerCase()) && !matchedFeatures.includes(feature)) {
          matchedFeatures.push(feature);
        }
      }
    } else if (requiredFeatures.length > 0) {
      missingNeeds.push(need);
    }
  }

  // Calculate score: percentage of needs met
  const needsWithFeatures = allNeeds.filter(need =>
    (accessibilityFeatureMap[need] || []).length > 0
  );

  if (needsWithFeatures.length === 0) {
    return { score: 100, matchedFeatures, missingNeeds };
  }

  const metNeeds = needsWithFeatures.length - missingNeeds.length;
  const score = Math.round((metNeeds / needsWithFeatures.length) * 100);

  return { score, matchedFeatures, missingNeeds };
}

/**
 * Get suitable rooms for an event based on user's accessibility needs
 */
app.get('/events/:eventId/suitable-rooms', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get user's accessibility needs
  const [userRecord] = await database
    .select({ accessibilityNeeds: users.accessibilityNeeds })
    .from(users)
    .where(eq(users.id, user.sub));

  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get the event to find its venue
  const [event] = await database
    .select({ venueId: events.venueId })
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, tenant.id),
        isNull(events.deletedAt)
      )
    );

  if (!event || !event.venueId) {
    return c.json({ error: 'Event or venue not found' }, 404);
  }

  // Get all available rooms for the venue
  const venueRooms = await database
    .select({
      id: rooms.id,
      name: rooms.name,
      type: rooms.type,
      capacity: rooms.capacity,
      pricePerNight: rooms.pricePerNight,
      currency: rooms.currency,
      accessibilityFeatures: rooms.accessibilityFeatures,
      floorNumber: rooms.floorNumber,
    })
    .from(rooms)
    .where(
      and(
        eq(rooms.venueId, event.venueId),
        eq(rooms.tenantId, tenant.id),
        isNull(rooms.deletedAt)
      )
    );

  // Get already allocated rooms for this event
  const allocatedRooms = await database
    .select({ roomId: roomAllocations.roomId })
    .from(roomAllocations)
    .where(
      and(
        eq(roomAllocations.eventId, eventId),
        eq(roomAllocations.tenantId, tenant.id),
        inArray(roomAllocations.status, ['reserved', 'confirmed'])
      )
    );

  const allocatedRoomIds = new Set(allocatedRooms.map(a => a.roomId));

  // Score and sort rooms based on accessibility match
  const userNeeds = userRecord.accessibilityNeeds as {
    mobility?: string[];
    visual?: string[];
    auditory?: string[];
  } | null;

  const scoredRooms = venueRooms
    .filter(room => !allocatedRoomIds.has(room.id))
    .map(room => {
      const features = (room.accessibilityFeatures || []) as string[];
      const { score, matchedFeatures, missingNeeds } = calculateAccessibilityScore(userNeeds, features);

      return {
        ...room,
        accessibilityScore: score,
        matchedFeatures,
        missingNeeds,
        isFullyAccessible: score === 100,
      };
    })
    .sort((a, b) => b.accessibilityScore - a.accessibilityScore);

  return c.json({
    eventId,
    userAccessibilityNeeds: userNeeds || {},
    rooms: scoredRooms,
    totalAvailable: scoredRooms.length,
    fullyAccessibleCount: scoredRooms.filter(r => r.isFullyAccessible).length,
  });
});

/**
 * Get room assignment recommendations for an event (staff only)
 * Matches attendees to rooms based on accessibility requirements
 */
app.get('/events/:eventId/room-recommendations', async (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');
  if (!user || !tenant) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Check if user is staff
  if (!['global_admin', 'tenant_owner', 'tenant_admin', 'staff'].includes(user.role)) {
    return c.json({ error: 'Staff access required' }, 403);
  }

  const eventId = c.req.param('eventId');
  const database = createDb(c.env.DB);

  // Get the event to find its venue
  const [event] = await database
    .select({ venueId: events.venueId, title: events.title })
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.tenantId, tenant.id),
        isNull(events.deletedAt)
      )
    );

  if (!event || !event.venueId) {
    return c.json({ error: 'Event or venue not found' }, 404);
  }

  // Get all confirmed bookings without room allocations
  const unassignedBookings = await database
    .select({
      bookingId: bookings.id,
      userId: bookings.userId,
      userEmail: users.email,
      userProfile: users.profileData,
      userAccessibility: users.accessibilityNeeds,
      accessibilityNotes: bookings.accessibilityNotes,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        eq(bookings.eventId, eventId),
        eq(bookings.tenantId, tenant.id),
        eq(bookings.status, 'confirmed'),
        isNull(bookings.roomAllocationId)
      )
    );

  // Get all available rooms for the venue
  const venueRooms = await database
    .select({
      id: rooms.id,
      name: rooms.name,
      type: rooms.type,
      capacity: rooms.capacity,
      accessibilityFeatures: rooms.accessibilityFeatures,
      floorNumber: rooms.floorNumber,
    })
    .from(rooms)
    .where(
      and(
        eq(rooms.venueId, event.venueId),
        eq(rooms.tenantId, tenant.id),
        isNull(rooms.deletedAt)
      )
    );

  // Get already allocated rooms
  const allocatedRooms = await database
    .select({ roomId: roomAllocations.roomId })
    .from(roomAllocations)
    .where(
      and(
        eq(roomAllocations.eventId, eventId),
        eq(roomAllocations.tenantId, tenant.id),
        inArray(roomAllocations.status, ['reserved', 'confirmed'])
      )
    );

  const allocatedRoomIds = new Set(allocatedRooms.map(a => a.roomId));
  const availableRooms = venueRooms.filter(room => !allocatedRoomIds.has(room.id));

  // Generate recommendations for each unassigned attendee
  const recommendations = unassignedBookings.map(booking => {
    const userNeeds = booking.userAccessibility as {
      mobility?: string[];
      visual?: string[];
      auditory?: string[];
    } | null;

    const profile = booking.userProfile as { firstName?: string; lastName?: string } | null;
    const attendeeName = profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : booking.userEmail;

    const hasAccessibilityNeeds = userNeeds && (
      (userNeeds.mobility?.length || 0) > 0 ||
      (userNeeds.visual?.length || 0) > 0 ||
      (userNeeds.auditory?.length || 0) > 0
    );

    // Score all available rooms for this attendee
    const roomScores = availableRooms.map(room => {
      const features = (room.accessibilityFeatures || []) as string[];
      const { score, matchedFeatures, missingNeeds } = calculateAccessibilityScore(userNeeds, features);

      return {
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        floorNumber: room.floorNumber,
        accessibilityScore: score,
        matchedFeatures,
        missingNeeds,
      };
    }).sort((a, b) => b.accessibilityScore - a.accessibilityScore);

    const topRecommendation = roomScores[0] || null;

    return {
      bookingId: booking.bookingId,
      userId: booking.userId,
      attendeeName,
      email: booking.userEmail,
      hasAccessibilityNeeds,
      accessibilityNeeds: userNeeds || {},
      accessibilityNotes: booking.accessibilityNotes,
      topRecommendation,
      alternativeRooms: roomScores.slice(1, 4), // Top 3 alternatives
      totalMatchingRooms: roomScores.filter(r => r.accessibilityScore === 100).length,
    };
  });

  // Sort: prioritize attendees with accessibility needs and lower match scores
  const sortedRecommendations = recommendations.sort((a, b) => {
    // Attendees with accessibility needs come first
    if (a.hasAccessibilityNeeds && !b.hasAccessibilityNeeds) return -1;
    if (!a.hasAccessibilityNeeds && b.hasAccessibilityNeeds) return 1;

    // Then sort by lowest score (hardest to accommodate first)
    const scoreA = a.topRecommendation?.accessibilityScore ?? 100;
    const scoreB = b.topRecommendation?.accessibilityScore ?? 100;
    return scoreA - scoreB;
  });

  return c.json({
    eventId,
    eventTitle: event.title,
    totalUnassigned: unassignedBookings.length,
    totalAvailableRooms: availableRooms.length,
    attendeesWithAccessibilityNeeds: recommendations.filter(r => r.hasAccessibilityNeeds).length,
    recommendations: sortedRecommendations,
  });
});

export default app;
