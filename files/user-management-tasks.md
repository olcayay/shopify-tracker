# User Management Tasks (2026-03-29)

Label: `user-management` (ID: `91e0968c-dd8b-40f0-a279-3ab1614ad8d0`)

## Mevcut Durum Analizi

### Var Olanlar (Zaten Implement Edilmiş)
- Registration (account + owner user oluşturma)
- Login (email/password + JWT + refresh token)
- Password change (settings'ten, mevcut şifre gerekli)
- Logout + session revocation (tümünü iptal)
- 3-level RBAC (owner, editor, viewer)
- Team invitations (7 gün süreli token, DB kaydı — ama email gönderilmiyor!)
- Direct member creation (owner, şifre ile)
- Member removal (owner only)
- Role change (owner only)
- Profile editing (name, email, timezone, digest toggle)
- Account editing (name, company — owner only)
- System admin impersonation (audit log ile)
- Account suspension (admin only)
- Platform enable/disable per account

### Eksik Olanlar
1. Email service (hiç yok — invitation, reset, verification hiçbiri gönderilemiyor)
2. Forgot password / password reset
3. Email verification
4. Invitation email gönderimi
5. User self-deletion + account deletion
6. Activity / audit log
7. Session management UI
8. Security notification emails
9. Granular permissions
10. 2FA (TOTP)
11. OAuth / social login

---

## Task 1: Phase 0 — Email Service Integration (Resend)
**PLA-283** | Priority: Urgent | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-283)

Tüm email-dependent feature'ların prerequisite'i. Resend SDK, domain verification, 5 email template.

---

## Task 2: Phase 1 — Forgot Password & Password Reset
**PLA-284** | Priority: Urgent | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-284)

### Database
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256
  expires_at TIMESTAMPTZ NOT NULL,  -- 1 hour
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints
1. `POST /api/auth/forgot-password` (public, rate-limited: 3/email/hour, 10/IP/hour)
   - Generate 64-char hex token → SHA-256 hash → DB
   - Send reset email: `https://appranks.io/reset-password?token=xxx`
   - Always return 200 (don't reveal email existence)
   - Invalidate previous unused tokens

2. `POST /api/auth/reset-password` (public)
   - Validate token (exists, not expired, not used)
   - Update password, mark token used
   - Revoke all refresh tokens
   - Send "password changed" email

3. `GET /api/auth/reset-password/validate?token=xxx` (public)
   - Check token validity before showing form

### Dashboard Pages
- `/forgot-password` — email input, success message
- `/reset-password?token=xxx` — new password form, validation on mount
- Login page: "Forgot Password?" link

---

## Task 3: Phase 1 — Email Verification
**PLA-285** | Priority: High | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-285)

### Database
```sql
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN pending_email TEXT;

CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('registration', 'email_change')),
  expires_at TIMESTAMPTZ NOT NULL,  -- 24 hours
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints
1. `POST /api/auth/verify-email` (public) — validate token, mark verified
2. `POST /api/auth/resend-verification` (auth, rate-limited: 3/hour)

### Flows
- Registration → send verification email, `emailVerifiedAt = NULL`
- Soft enforcement: dashboard usable without verification, banner shown
- 7-day grace → read-only restriction
- Email change → store in `pending_email`, verify new email first
- Invited users → auto-verified

### Dashboard
- `/verify-email?token=xxx` page
- Banner in layout when unverified
- Settings: verification status, pending email, resend button

---

## Task 4: Phase 1 — Send Invitation Emails
**PLA-286** | Priority: Urgent | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-286)

Currently `POST /api/account/members/invite` creates DB record but sends NO email.

### Changes
- Add email sending to invite endpoint (use Phase 0 email service)
- Add `POST /api/account/invitations/:id/resend` (owner only, rate limit: 3/invitation)
  - If expired: generate new token, extend 7 days
- Dashboard: "Resend" button, invitation status (Pending/Expired/Accepted)

---

## Task 5: Phase 2 — User Self-Removal & Account Deletion
**PLA-287** | Priority: High | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-287)

### Database
```sql
ALTER TABLE accounts ADD COLUMN deletion_scheduled_at TIMESTAMPTZ;
```

### API Endpoints
1. `DELETE /api/auth/me` — User self-removal (non-owners only)
   - Requires password confirmation
   - Deletes user, tokens, invitations they sent
   - Sends confirmation email
   - Owners must transfer ownership first

2. `DELETE /api/account` — Account deletion (owner only)
   - Soft delete: 30-day grace period
   - Sets `deletionScheduledAt`, suspends account
   - Emails all members

3. `POST /api/account/cancel-deletion` — Cancel scheduled deletion (owner only)
   - Clears schedule, unsuspends, emails all members

4. `POST /api/account/transfer-ownership` — Transfer ownership (owner only)
   - Input: `{ newOwnerId, password }`
   - Current owner → editor, target → owner
   - Emails both users

### Dashboard
- Settings → Profile: "Leave Account" button (non-owners)
- Settings → Account: "Delete Account" (owners), countdown + cancel
- Settings → Team: "Transfer Ownership" option
- All with confirmation modals + password input

### Cron Job
- Daily: permanently delete accounts where `deletion_scheduled_at < NOW()`

---

## Task 6: Phase 2 — Activity Log & Audit Trail
**PLA-288** | Priority: High | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-288)

### Database
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_account ON audit_logs(account_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
```

### Events (20+)
user.login, user.login_failed, user.logout, user.registered, user.password_changed,
user.password_reset, user.email_changed, user.email_verified, user.deleted,
member.invited, member.invitation_accepted, member.removed, member.role_changed,
account.updated, account.deletion_scheduled, account.deletion_canceled,
account.ownership_transferred, session.revoked_all, admin.impersonation_start/end

### API
- `GET /api/account/audit-log` (owner only, paginated, filterable, 90-day max)
- `GET /api/auth/me/login-history` (any user, last 30 entries)

### Dashboard
- Settings → Activity Log (owner): filterable table, CSV export
- Settings → Profile → Login History: recent sessions with IP/device

### Implementation
- `logAuditEvent()` async utility
- 1-year auto-cleanup cron

---

## Task 7: Phase 2 — Active Session Management
**PLA-289** | Priority: Medium | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-289)

### Database
```sql
ALTER TABLE refresh_tokens
  ADD COLUMN ip_address TEXT,
  ADD COLUMN user_agent TEXT,
  ADD COLUMN device_name TEXT,
  ADD COLUMN last_used_at TIMESTAMPTZ DEFAULT NOW();
```

### API
1. `GET /api/auth/sessions` — list active sessions (id, ip, device, lastUsed, isCurrent)
2. `DELETE /api/auth/sessions/:id` — revoke specific session (not current)
3. Modify login/refresh: capture IP, user agent, device name

### Dashboard
- Settings → Profile → Active Sessions
- Device icon + name, IP, "Last active: 2h ago"
- Current session highlighted
- "Revoke" per session, "Revoke All Others" button

### Device Parsing
- `ua-parser-js`: "Chrome on macOS", "Safari on iPhone"

---

## Task 8: Phase 3 — Security Notification Emails
**PLA-290** | Priority: Medium | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-290)

### Emails
| Trigger | Subject | Key Info |
|---------|---------|----------|
| Password changed | "Your password was changed" | Time, IP, "Reset your password" link |
| Password reset | "Your password was reset" | Time, IP |
| New device login | "New login to your account" | Device, IP, "Revoke sessions" link |
| Role changed | "Your role was updated" | old → new role, who changed |
| Removed from account | "You were removed" | Account name, who |
| Account deletion scheduled | "Account scheduled for deletion" | Date, how to cancel |
| Ownership transferred | "Ownership transferred" | From/to details |

### Database
```sql
ALTER TABLE users ADD COLUMN security_emails_enabled BOOLEAN DEFAULT true;
```

### Dashboard
- Settings: toggle "Email me about security events"

---

## Task 9: Phase 3 — Granular Role Permissions
**PLA-291** | Priority: Medium | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-291)

### Permission Matrix
| Permission | Owner | Editor | Viewer |
|-----------|-------|--------|--------|
| View dashboard & data | ✅ | ✅ | ✅ |
| Add/remove tracked apps | ✅ | ✅ | ❌ |
| Manage keywords/competitors | ✅ | ✅ | ❌ |
| Create research projects | ✅ | ✅ | ❌ |
| Export data | ✅ | ✅ | ✅ |
| Manage members/invitations | ✅ | ❌ | ❌ |
| Account settings | ✅ | ❌ | ❌ |
| Delete account | ✅ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ |
| Update own profile | ✅ | ✅ | ✅ |

### Implementation
- `packages/shared/src/permissions.ts`: constants + `hasPermission(role, perm)`
- `requirePermission()` middleware (replaces ad-hoc `requireRole()`)
- `usePermission()` dashboard hook
- Consistent viewer enforcement across all write endpoints

---

## Task 10: Phase 4 — Two-Factor Authentication (TOTP)
**PLA-292** | Priority: Low | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-292)

### Database
```sql
ALTER TABLE users
  ADD COLUMN totp_secret TEXT,
  ADD COLUMN totp_enabled_at TIMESTAMPTZ,
  ADD COLUMN backup_codes JSONB;
```

### API
1. `POST /api/auth/2fa/setup` — generate secret + QR code
2. `POST /api/auth/2fa/enable` — verify code, generate 10 backup codes
3. `POST /api/auth/2fa/disable` — requires password + TOTP
4. `POST /api/auth/2fa/verify` — 2FA step during login
5. `POST /api/auth/2fa/regenerate-backup-codes`

### Login Flow
email+password → if 2FA: `{ requires2FA: true, tempToken }` → TOTP verify → full tokens

### Dashboard
- Settings → Security → 2FA setup wizard (QR + manual + verify)
- Login page: 2FA step after password
- Backup codes with Download/Copy

### Libraries: `otpauth`, `qrcode`

---

## Task 11: Phase 4 — OAuth Social Login (Google, GitHub)
**PLA-293** | Priority: Low | [Linear](https://linear.app/plan-b-side-projects/issue/PLA-293)

### Database
```sql
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);
-- Make password_hash nullable for OAuth-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

### API
1. `GET /api/auth/oauth/:provider` — redirect to OAuth provider (state token for CSRF)
2. `GET /api/auth/oauth/:provider/callback` — handle callback, create/link user
3. `DELETE /api/auth/oauth/:provider` — unlink provider (must keep at least 1 auth method)
4. `GET /api/auth/oauth/providers` — list linked providers

### Account Linking
- Same email → auto-link
- OAuth users → auto-verify email
- Must have ≥1 auth method (can't remove all OAuth without password)

### Dashboard
- Login/Register: "Sign in with Google/GitHub" buttons
- Settings → Connected Accounts: link/unlink

### Library: `arctic` (lightweight OAuth 2.0)
