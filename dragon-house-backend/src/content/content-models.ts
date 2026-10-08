export type FamilyContentScope = 'home' | 'rules' | 'recruitment';

export type FamilyContentBlockRecord = {
  id: string;
  scope: FamilyContentScope;
  title: string;
  body: string;
  contact: string | null;
  sortOrder: number;
  version: number;
  updatedByFamilyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyContentBlockInput = {
  title: string;
  body: string;
  contact?: string | null;
  expectedVersion?: number;
};

export type FamilyRecruitmentSettingsRecord = {
  id: 'dragon-house';
  isOpen: boolean;
  description: string;
  requirements: string[];
  contact: string;
  version: number;
  updatedByFamilyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyRecruitmentSettingsInput = {
  isOpen: boolean;
  description: string;
  requirements: string[];
  contact: string;
  expectedVersion?: number;
};

export type FamilyNewsPostType =
  | 'urgent'
  | 'important'
  | 'family_news'
  | 'announcement'
  | 'recruitment'
  | 'poll'
  | 'family'
  | 'event'
  | 'info';

export type FamilyNewsPostRecord = {
  id: string;
  type: FamilyNewsPostType;
  title: string;
  body: string;
  authorFamilyMemberId: string | null;
  authorName: string;
  pinned: boolean;
  urgent: boolean;
  notificationRequired: boolean;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FamilyNewsPostInput = {
  type: FamilyNewsPostType;
  title: string;
  body: string;
  pinned?: boolean;
  urgent?: boolean;
  notificationRequired?: boolean;
  expectedVersion?: number;
};
