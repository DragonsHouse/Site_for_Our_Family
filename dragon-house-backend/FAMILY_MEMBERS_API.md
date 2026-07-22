# Family Members API

Family member identity is `family_members.id`, an immutable internal ID. Nickname, login, Static ID and Discord ID are editable/external identifiers and must not be used as primary or foreign keys.

## Model separation

- Member profile data: nickname, static ID, role, rank, status, avatar asset reference, joined date, notes, profile metadata, permissions metadata.
- Auth data: login, password hash, sessions and `mustChangePassword` live in `family_auth_users` / `family_sessions`.
- Discord link data: account link rows live in `discord_account_links`; member API only exposes a safe summary.
- Computed/statistical data: quests, accounting, notifications, rank progress and monthly earnings are not migrated in this stage.

## Endpoints

- `GET /api/family/members`
- `GET /api/family/members/:memberId`
- `POST /api/family/members`
- `PATCH /api/family/members/:memberId`
- `DELETE /api/family/members/:memberId`
- `POST /api/family/members/:memberId/restore`

All endpoints require `Authorization: Bearer <Family Hub session token>`.

## Permissions

Owner bypasses member permissions. Other roles need explicit permissions:

- `view_members`
- `manage_members`
- `manage_member_roles`
- `manage_member_auth`
- `delete_members`
- `restore_members`
- `view_member_private_fields`

The backend enforces permissions; frontend visibility is only convenience UI.

## Mutation policy

- `id` is generated once and never updated.
- Nickname can change without changing `id`.
- `DELETE` is soft delete: `deleted_at` is set and status becomes `inactive`.
- Last active owner cannot be deleted, deactivated or demoted.
- Deactivation/deletion revokes active sessions for that member.
- `PATCH` requires current `version`; conflicts return `MEMBER_VERSION_CONFLICT`.
- Member mutation writes `family_audit_log` with sanitized data.

## Frontend source flag

`chrome_app` uses `FamilyMemberDataSource`.

- Default: `local`
- Optional dev mode: set `FAMILY_MEMBERS_DATA_SOURCE=api` or localStorage key `dragon_house_family_members_data_source=api`

No silent dual-write is performed. In API mode, member reads/writes go through REST API only.

## Bootstrap

`npm run family:bootstrap-owner -- --nickname "Name" --login "login" --static-id "123" --password "temporary-password1"`

This is development-only, refuses to run outside `NODE_ENV=development`, refuses to create a second active owner, and does not print the password.

Do not run it for production data.

## Migration dry-run

`npm run data:migrate:dry-run -- --file "C:\path\backup.json"`

The dry-run validates backup format/checksum and creates `memberPlan` for `family_members`. It does not insert, update or delete data. Full import remains disabled until quests/accounting/notifications schemas are ready.

Real local Family Hub members have not been migrated yet.
