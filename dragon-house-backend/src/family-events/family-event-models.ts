export type FamilyEventType =
  | 'family_meeting'
  | 'training'
  | 'rp_event'
  | 'family_activity'
  | 'celebration'
  | 'announcement'
  | 'custom';

export type FamilyEventCategory = 'meeting' | 'training' | 'rp' | 'family' | 'celebration' | 'announcement' | 'custom';

export type FamilyEventStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';

export type FamilyEventPriority = 'low' | 'normal' | 'high' | 'critical';

export type FamilyEventVisibility = 'public' | 'members' | 'leadership' | 'private' | 'hidden';

export type FamilyEventResponseState = 'invited' | 'interested' | 'joining' | 'confirmed' | 'declined';

export type FamilyEventAttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export type FamilyEventPerson = {
  id: string;
  displayName: string;
};

export type FamilyEventResponseRecord = {
  id: string;
  eventId: string;
  familyMemberId: string;
  displayName: string;
  response: FamilyEventResponseState;
  respondedAt: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FamilyEventAttendanceRecord = {
  id: string;
  eventId: string;
  familyMemberId: string;
  displayName: string;
  status: FamilyEventAttendanceStatus;
  confirmedByFamilyMemberId: string;
  confirmedAt: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FamilyEventRecord = {
  id: string;
  title: string;
  description: string;
  eventType: FamilyEventType;
  category: FamilyEventCategory;
  status: FamilyEventStatus;
  priority: FamilyEventPriority;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  allDay: boolean;
  locationLabel: string | null;
  createdByFamilyMemberId: string;
  createdByDisplayName: string | null;
  organizerFamilyMemberId: string;
  organizerDisplayName: string | null;
  maxParticipants: number | null;
  visibility: FamilyEventVisibility;
  notes: string | null;
  completedByFamilyMemberId: string | null;
  completedAt: string | null;
  cancelledByFamilyMemberId: string | null;
  cancelledAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  responses: FamilyEventResponseRecord[];
  attendance: FamilyEventAttendanceRecord[];
};

export type FamilyEventListQuery = {
  status?: FamilyEventStatus | 'all' | null;
  category?: FamilyEventCategory | 'all' | null;
  type?: FamilyEventType | 'all' | null;
  from?: string | null;
  to?: string | null;
  organizer?: string | null;
  participant?: string | null;
  search?: string | null;
};

export type CreateFamilyEventInput = {
  title: string;
  description?: string;
  eventType: FamilyEventType;
  category?: FamilyEventCategory;
  status?: Exclude<FamilyEventStatus, 'completed' | 'cancelled'>;
  priority?: FamilyEventPriority;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string;
  allDay?: boolean;
  locationLabel?: string | null;
  organizerFamilyMemberId?: string;
  maxParticipants?: number | null;
  visibility?: FamilyEventVisibility;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateFamilyEventInput = Partial<Omit<CreateFamilyEventInput, 'status'>> & {
  status?: FamilyEventStatus;
};

export type FamilyEventCompletionOutput = {
  eventId: string;
  participantIds: string[];
  organizerFamilyMemberId: string;
  attendance: FamilyEventAttendanceRecord[];
  status: 'completed';
  source: {
    sourceType: 'family_events';
    sourceId: string;
    sourceKey: string;
  };
};
