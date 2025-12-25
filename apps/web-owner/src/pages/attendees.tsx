import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Download,
  Mail,
  Users,
  AlertCircle,
  Utensils,
  Accessibility,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  Skeleton,
  Avatar,
  AvatarFallback,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface Attendee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  bookingsCount: number;
  totalSpent: number;
  currency: string;
  dietaryProfile?: {
    allergies: string[];
    preferences: string[];
    notes?: string;
  };
  accessibilityProfile?: {
    mobilityNeeds: string[];
    visualNeeds: string[];
    auditoryNeeds: string[];
    notes?: string;
  };
}

export default function AttendeesPage() {
  const [search, setSearch] = useState('');

  const { data: attendees, isLoading } = useQuery({
    queryKey: ['attendees'],
    queryFn: async () => {
      const response = await api.get('/attendees');
      if (!response.ok) throw new Error('Failed to fetch attendees');
      const data = await response.json();
      return data.attendees as Attendee[];
    },
  });

  const filteredAttendees = attendees?.filter(
    (attendee) =>
      `${attendee.firstName} ${attendee.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      attendee.email.toLowerCase().includes(search.toLowerCase())
  );

  const attendeesWithDietary = attendees?.filter((a) => a.dietaryProfile) || [];
  const attendeesWithAccessibility = attendees?.filter((a) => a.accessibilityProfile) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendees</h1>
          <p className="text-muted-foreground">View and manage your event attendees</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export All
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-100 p-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Attendees</p>
              <p className="text-2xl font-bold">{attendees?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-orange-100 p-3">
              <Utensils className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dietary Requirements</p>
              <p className="text-2xl font-bold">{attendeesWithDietary.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-purple-100 p-3">
              <Accessibility className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Accessibility Needs</p>
              <p className="text-2xl font-bold">{attendeesWithAccessibility.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Attendees</TabsTrigger>
          <TabsTrigger value="dietary">Dietary Requirements</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility Needs</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search attendees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredAttendees?.length ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredAttendees.map((attendee, index) => (
                    <motion.div
                      key={attendee.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>
                            {attendee.firstName[0]}
                            {attendee.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {attendee.firstName} {attendee.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{attendee.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                          {attendee.dietaryProfile && (
                            <Badge variant="outline" className="gap-1">
                              <Utensils className="h-3 w-3" />
                              Dietary
                            </Badge>
                          )}
                          {attendee.accessibilityProfile && (
                            <Badge variant="outline" className="gap-1">
                              <Accessibility className="h-3 w-3" />
                              Accessibility
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{attendee.bookingsCount} bookings</p>
                        </div>
                        <Button variant="ghost" size="icon">
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No attendees found</h3>
              <p className="mt-2 text-muted-foreground">
                {search ? 'Try adjusting your search' : 'Attendees will appear here when they book events'}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dietary" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Dietary Requirements Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {attendeesWithDietary.length > 0 ? (
                <div className="space-y-4">
                  {attendeesWithDietary.map((attendee) => (
                    <div key={attendee.id} className="rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {attendee.firstName[0]}
                            {attendee.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {attendee.firstName} {attendee.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{attendee.email}</p>
                        </div>
                      </div>
                      {attendee.dietaryProfile && (
                        <div className="mt-3 space-y-2">
                          {attendee.dietaryProfile.allergies.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-sm text-destructive">Allergies:</span>
                              {attendee.dietaryProfile.allergies.map((allergy) => (
                                <Badge key={allergy} variant="destructive" className="text-xs">
                                  {allergy}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {attendee.dietaryProfile.preferences.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-sm text-muted-foreground">Preferences:</span>
                              {attendee.dietaryProfile.preferences.map((pref) => (
                                <Badge key={pref} variant="secondary" className="text-xs">
                                  {pref}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {attendee.dietaryProfile.notes && (
                            <p className="text-sm text-muted-foreground">
                              Notes: {attendee.dietaryProfile.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No attendees with dietary requirements
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accessibility" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Accessibility Needs Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {attendeesWithAccessibility.length > 0 ? (
                <div className="space-y-4">
                  {attendeesWithAccessibility.map((attendee) => (
                    <div key={attendee.id} className="rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {attendee.firstName[0]}
                            {attendee.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {attendee.firstName} {attendee.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{attendee.email}</p>
                        </div>
                      </div>
                      {attendee.accessibilityProfile && (
                        <div className="mt-3 space-y-2">
                          {attendee.accessibilityProfile.mobilityNeeds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-sm text-muted-foreground">Mobility:</span>
                              {attendee.accessibilityProfile.mobilityNeeds.map((need) => (
                                <Badge key={need} variant="outline" className="text-xs">
                                  {need}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {attendee.accessibilityProfile.visualNeeds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-sm text-muted-foreground">Visual:</span>
                              {attendee.accessibilityProfile.visualNeeds.map((need) => (
                                <Badge key={need} variant="outline" className="text-xs">
                                  {need}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {attendee.accessibilityProfile.auditoryNeeds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-sm text-muted-foreground">Auditory:</span>
                              {attendee.accessibilityProfile.auditoryNeeds.map((need) => (
                                <Badge key={need} variant="outline" className="text-xs">
                                  {need}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {attendee.accessibilityProfile.notes && (
                            <p className="text-sm text-muted-foreground">
                              Notes: {attendee.accessibilityProfile.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No attendees with accessibility needs
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
