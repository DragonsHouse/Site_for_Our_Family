alter table family_members
  add column if not exists date_of_birth date;

comment on column family_members.date_of_birth is
  'Private member date of birth stored as DATE for onboarding validation and future self-service. Public projections must expose only day/month when a dedicated calendar contract exists.';
