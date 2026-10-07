export type FamilyTreasuryCategory = 'fuel' | 'clothing' | 'weapons' | 'shops' | 'other';

export type FamilyTreasuryEntryRecord = {
  id: string;
  category: FamilyTreasuryCategory;
  title: string;
  locationNumber: string | null;
  locationReference: string | null;
  description: string;
  price: string | null;
  priceAmount: number | null;
  priceNote: string | null;
  note: string | null;
  isActive: boolean;
  version: number;
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
  priceAmount?: number | null;
  priceNote?: string | null;
  note?: string | null;
  expectedVersion?: number;
};

export type FamilyTreasuryListQuery = {
  includeInactive?: boolean;
};
