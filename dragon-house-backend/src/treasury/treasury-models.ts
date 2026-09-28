export type FamilyTreasuryCategory = 'fuel' | 'clothing' | 'weapons' | 'shops' | 'other';

export type FamilyTreasuryEntryRecord = {
  id: string;
  category: FamilyTreasuryCategory;
  title: string;
  locationNumber: string | null;
  locationReference: string | null;
  description: string;
  price: string | null;
  note: string | null;
  isActive: boolean;
  createdByFamilyMemberId: string | null;
  updatedByFamilyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyTreasuryEntryInput = {
  category: FamilyTreasuryCategory;
  title: string;
  locationNumber?: string | null;
  locationReference?: string | null;
  description?: string;
  price?: string | null;
  note?: string | null;
};

export type FamilyTreasuryListQuery = {
  includeInactive?: boolean;
};
