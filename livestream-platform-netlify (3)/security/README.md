# Secure Supabase Auth migration

The dashboard remains backward-compatible with the existing anon-key sync model. For production authorization, switch to Supabase Auth + authenticated-only RLS.

## Migration order

1. In Supabase Authentication, create/invite the team users.
2. Copy each user's Auth UUID.
3. Add/map the UUID to the matching dashboard account:
   `UPDATE public.sub_accounts SET auth_user_id = '<AUTH_UUID>' WHERE id = 'acc_afiq';`
4. Deploy the Phase 3 frontend.
5. In **Admin → Cloud & Storage → Secure Supabase Auth**, sign in with one mapped account and confirm cloud reads work.
6. Run `security/supabase-auth-rls.sql`.
7. Confirm anonymous requests now fail and authenticated requests follow dashboard permissions.

## Behavior after secure RLS

- The database request bearer automatically uses the Supabase user JWT.
- The local dashboard identity is bound to the matching `auth_user_id`.
- Local account switching is locked while authenticated.
- PIN values are cleared from the cloud because Supabase Auth replaces PIN-based cloud identity.
- Account management requires `canManageAccounts`.
- Assessment writes require `canGrade`.
- Rate-card writes require `canManageRates`.

Do not run the secure RLS migration before at least one Admin Auth user is mapped, or you can lock the frontend out of database writes.
