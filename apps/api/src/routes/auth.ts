import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  accounts,
  users,
  refreshTokens,
  passwordResetTokens,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountTrackedFeatures,
  researchProjects,
  accountPlatforms,
  platformVisibility,
  emailVerificationTokens,
  featureFlags,
  accountFeatureFlags,
  invitations,
} from "@appranks/db";
import { PLATFORM_IDS } from "@appranks/shared";
import { getJwtSecret, type JwtPayload } from "../middleware/auth.js";
import { blacklistToken, revokeAllTokensForUser } from "../utils/token-blacklist.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import { sendWelcomeEmail, sendPasswordResetEmail, sendLoginAlertEmail, sendVerificationEmail } from "../lib/email-enqueue.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  deleteAccountSchema,
} from "../schemas/auth.js";
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
  RATE_LIMIT_LOGIN_MAX,
  RATE_LIMIT_LOGIN_WINDOW_MS,
  RATE_LIMIT_REGISTER_MAX,
  RATE_LIMIT_REGISTER_WINDOW_MS,
  RATE_LIMIT_PASSWORD_RESET_MAX,
  RATE_LIMIT_PASSWORD_RESET_WINDOW_MS,
  PASSWORD_RESET_TOKEN_EXPIRY_MS,
  DEFAULT_MAX_TRACKED_APPS,
  DEFAULT_MAX_TRACKED_KEYWORDS,
  DEFAULT_MAX_COMPETITOR_APPS,
} from "../constants.js";


// Rate limiters for auth endpoints (exported for test reset)
export const loginLimiter = new RateLimiter({ maxAttempts: RATE_LIMIT_LOGIN_MAX, windowMs: RATE_LIMIT_LOGIN_WINDOW_MS, namespace: "login" });
export const registerLimiter = new RateLimiter({ maxAttempts: RATE_LIMIT_REGISTER_MAX, windowMs: RATE_LIMIT_REGISTER_WINDOW_MS, namespace: "register" });
export const passwordResetLimiter = new RateLimiter({ maxAttempts: RATE_LIMIT_PASSWORD_RESET_MAX, windowMs: RATE_LIMIT_PASSWORD_RESET_WINDOW_MS, namespace: "pwreset" });
// Account lockout: 10 failed login attempts per email → 30 minute lockout
export const accountLockout = new RateLimiter({ maxAttempts: 10, windowMs: 30 * 60 * 1000, namespace: "lockout" });
// Refresh token: 30 attempts per 5 min per IP
export const refreshLimiter = new RateLimiter({ maxAttempts: 30, windowMs: 5 * 60 * 1000, namespace: "refresh" });

export function generateAccessToken(
  payload: JwtPayload,
  expiresIn?: string | number
): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    getJwtSecret(),
    { expiresIn: expiresIn ?? ACCESS_TOKEN_EXPIRY } as jwt.SignOptions,
  );
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashUserAgent(ua: string | undefined): string | null {
  if (!ua) return null;
  return crypto.createHash("sha256").update(ua).digest("hex").slice(0, 16);
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // POST /api/auth/register — create account + owner user
  app.post("/register", async (request, reply) => {
    const ip = request.ip;
    const regLimit = registerLimiter.check(ip);
    if (!regLimit.allowed) {
      reply.header("Retry-After", Math.ceil(regLimit.retryAfterMs / 1000).toString());
      return reply.code(429).send({ error: "Too many registration attempts. Please try again later." });
    }

    const { email, password, name, accountName, company } = registerSchema.parse(request.body);

    // Block disposable email domains
    const { isDisposableEmail } = await import("../utils/disposable-emails.js");
    if (isDisposableEmail(email)) {
      return reply.code(400).send({ error: "Disposable email addresses are not allowed. Please use a permanent email." });
    }

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Wrap all DB writes in a transaction so partial registration
    // (e.g. account created but user insert fails) cannot occur.
    const result = await db.transaction(async (tx) => {
      // Create account
      const [account] = await tx
        .insert(accounts)
        .values({ name: accountName, company: company || null })
        .returning();

      // Enable default platforms for the new account
      await tx.insert(accountPlatforms).values([
        { accountId: account.id, platform: "shopify" },
        { accountId: account.id, platform: "salesforce" },
        { accountId: account.id, platform: "canva" },
      ]);

      // Create owner user
      const [user] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          name,
          accountId: account.id,
          role: "owner",
        })
        .returning();

      // Generate tokens
      const jwtPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        accountId: user.accountId,
        role: user.role,
        isSystemAdmin: user.isSystemAdmin,
      };

      const accessToken = generateAccessToken(jwtPayload);
      const refreshToken = generateRefreshToken();

      // Store refresh token hash
      await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        userAgentHash: hashUserAgent(request.headers["user-agent"]),
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ),
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isSystemAdmin: user.isSystemAdmin,
          account: {
            id: account.id,
            name: account.name,
          },
        },
      };
    });

    // Check for pending invitations for this email (non-expired, non-accepted)
    const pendingInvitations = await db
      .select({
        id: invitations.id,
        accountId: invitations.accountId,
        role: invitations.role,
        token: invitations.token,
        expiresAt: invitations.expiresAt,
        accountName: accounts.name,
      })
      .from(invitations)
      .leftJoin(accounts, eq(invitations.accountId, accounts.id))
      .where(
        and(
          eq(invitations.email, result.user.email),
          sql`${invitations.acceptedAt} IS NULL`,
          sql`${invitations.expiresAt} > NOW()`
        )
      );

    // Enqueue welcome email (fire-and-forget, don't block the response)
    sendWelcomeEmail(result.user.email, result.user.name, {
      userId: result.user.id,
      accountId: result.user.account.id,
    }).catch(() => {});

    // Send verification email (fire-and-forget)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = crypto.createHash("sha256").update(verificationToken).digest("hex");
    db.insert(emailVerificationTokens)
      .values({
        userId: result.user.id,
        tokenHash: verificationTokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .then(() => {
        sendVerificationEmail(result.user.email, verificationToken, result.user.name, {
          userId: result.user.id,
        }).catch(() => {});
      })
      .catch(() => {});

    return {
      ...result,
      pendingInvitations: pendingInvitations.map((inv) => ({
        id: inv.id,
        accountName: inv.accountName || "Unknown",
        role: inv.role,
        token: inv.token,
      })),
    };
  });

  // POST /api/auth/verify-email — verify email with token
  app.post("/verify-email", async (request, reply) => {
    const { token } = verifyEmailSchema.parse(request.body);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [verifyToken] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash));

    if (!verifyToken) {
      return reply.code(400).send({ error: "Invalid or expired verification token" });
    }

    if (verifyToken.usedAt) {
      return reply.code(400).send({ error: "This verification link has already been used" });
    }

    if (verifyToken.expiresAt < new Date()) {
      return reply.code(400).send({ error: "This verification link has expired" });
    }

    // Mark token as used and verify user email
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, verifyToken.id));

    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, verifyToken.userId));

    return { message: "Email verified successfully" };
  });

  // POST /api/auth/resend-verification — send a new verification email
  app.post("/resend-verification", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, request.user.userId));

    if (!user) return reply.code(404).send({ error: "User not found" });
    if (user.emailVerifiedAt) return reply.code(400).send({ error: "Email already verified" });

    // Invalidate old tokens
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.userId, user.id));

    // Generate new token (24h expiry)
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    sendVerificationEmail(user.email, token, user.name, { userId: user.id }).catch(() => {});

    return { message: "Verification email sent" };
  });

  // POST /api/auth/forgot-password — request a password reset email
  app.post("/forgot-password", async (request, reply) => {
    const ip = request.ip;
    const resetLimit = passwordResetLimiter.check(ip);
    if (!resetLimit.allowed) {
      reply.header("Retry-After", Math.ceil(resetLimit.retryAfterMs / 1000).toString());
      return reply.code(429).send({ error: "Too many password reset attempts. Please try again later." });
    }

    const { email } = forgotPasswordSchema.parse(request.body);

    // Always return success to prevent email enumeration
    const successResponse = { message: "If an account exists with that email, a password reset link has been sent." };

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      return successResponse;
    }

    // Invalidate any existing unused reset tokens for this user
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.userId, user.id));

    // Generate new token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Enqueue password reset email (fire-and-forget)
    sendPasswordResetEmail(user.email, token, user.name, { userId: user.id }).catch(() => {});

    return successResponse;
  });

  // POST /api/auth/reset-password — complete password reset with token
  app.post("/reset-password", async (request, reply) => {
    const { token, password } = resetPasswordSchema.parse(request.body);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));

    if (!resetToken) {
      return reply.code(400).send({ error: "Invalid or expired reset token" });
    }

    if (resetToken.usedAt) {
      return reply.code(400).send({ error: "This reset link has already been used" });
    }

    if (resetToken.expiresAt < new Date()) {
      return reply.code(400).send({ error: "This reset link has expired" });
    }

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    // Invalidate all existing sessions for this user
    await revokeAllTokensForUser(resetToken.userId);
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, resetToken.userId));

    import("../utils/activity-log.js").then(m => m.logActivity(db, "", resetToken.userId, "password_reset", "user", resetToken.userId)).catch(() => {});
    return { message: "Password has been reset successfully. Please log in with your new password." };
  });

  // POST /api/auth/login — email + password login
  app.post("/login", async (request, reply) => {
    const ip = request.ip;
    const loginLimit = loginLimiter.check(ip);
    if (!loginLimit.allowed) {
      reply.header("Retry-After", Math.ceil(loginLimit.retryAfterMs / 1000).toString());
      return reply.code(429).send({ error: "Too many login attempts. Please try again later." });
    }

    const { email, password } = loginSchema.parse(request.body);
    const normalizedEmail = email.toLowerCase();

    // Account-level lockout check (per email, not per IP)
    const lockoutCheck = accountLockout.check(normalizedEmail);
    if (!lockoutCheck.allowed) {
      reply.header("Retry-After", Math.ceil(lockoutCheck.retryAfterMs / 1000).toString());
      return reply.code(423).send({ error: "Account temporarily locked due to too many failed login attempts. Please try again later." });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (!user) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    // Get account
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, user.accountId));

    if (account.isSuspended && !user.isSystemAdmin) {
      return reply.code(403).send({ error: "Account is suspended" });
    }

    const jwtPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      accountId: user.accountId,
      role: user.role,
      isSystemAdmin: user.isSystemAdmin,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken();

    // Store refresh token hash
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgentHash: hashUserAgent(request.headers["user-agent"]),
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ),
    });

    // Send login alert email only for new/unknown devices
    const userAgent = request.headers["user-agent"] || "Unknown device";
    const currentUaHash = hashUserAgent(request.headers["user-agent"]);
    if (currentUaHash) {
      const knownSessions = await db
        .select({ id: refreshTokens.id })
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.userId, user.id),
            eq(refreshTokens.userAgentHash, currentUaHash)
          )
        )
        .limit(2); // We just inserted one above, so ≤1 means new device
      const isNewDevice = knownSessions.length <= 1;
      if (isNewDevice) {
        sendLoginAlertEmail(user.email, user.name, userAgent, {
          ip: request.ip,
          userId: user.id,
        }).catch(() => {});
      }
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSystemAdmin: user.isSystemAdmin,
        account: {
          id: account.id,
          name: account.name,
        },
      },
    };
  });

  // POST /api/auth/refresh — exchange refresh token for new access token
  app.post("/refresh", async (request, reply) => {
    // Rate limit: 30 refresh requests per 5 minutes per IP
    const refreshLimit = refreshLimiter.check(request.ip);
    if (!refreshLimit.allowed) {
      reply.header("Retry-After", Math.ceil(refreshLimit.retryAfterMs / 1000).toString());
      return reply.code(429).send({ error: "Too many refresh attempts. Please try again later." });
    }

    const { refreshToken: token } = refreshSchema.parse(request.body);

    const tokenHash = hashToken(token);

    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    if (!storedToken) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    if (storedToken.expiresAt < new Date()) {
      // Clean up expired token
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, storedToken.id));
      return reply.code(401).send({ error: "Refresh token expired" });
    }

    // Verify device fingerprint (User-Agent hash)
    if (storedToken.userAgentHash) {
      const currentHash = hashUserAgent(request.headers["user-agent"]);
      if (currentHash !== storedToken.userAgentHash) {
        // Possible token theft — revoke this token
        await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
        return reply.code(401).send({ error: "Session invalidated due to device mismatch" });
      }
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId));

    if (!user) {
      return reply.code(401).send({ error: "User not found" });
    }

    const jwtPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      accountId: user.accountId,
      role: user.role,
      isSystemAdmin: user.isSystemAdmin,
    };

    const accessToken = generateAccessToken(jwtPayload);

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken();
    await db
      .update(refreshTokens)
      .set({
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ),
      })
      .where(eq(refreshTokens.id, storedToken.id));

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  });

  // POST /api/auth/logout — revoke refresh token + blacklist access token
  app.post("/logout", async (request, reply) => {
    const { refreshToken: token } = logoutSchema.parse(request.body);

    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(token)));

    // Blacklist the current access token if it has a jti
    if (request.user?.jti) {
      const decoded = jwt.decode(request.headers.authorization?.slice(7) || "") as { exp?: number } | null;
      if (decoded?.exp) {
        await blacklistToken(request.user.jti, decoded.exp);
      }
    }

    return { message: "Logged out" };
  });

  // POST /api/auth/revoke-all-sessions — invalidate all access tokens for current user
  app.post("/revoke-all-sessions", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { userId } = request.user;

    // Revoke all access tokens issued before now
    await revokeAllTokensForUser(userId);

    // Delete all refresh tokens for this user
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    return { message: "All sessions revoked" };
  });

  // GET /api/auth/sessions — list active sessions (refresh tokens)
  app.get("/sessions", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const sessions = await db
      .select({
        id: refreshTokens.id,
        userAgentHash: refreshTokens.userAgentHash,
        createdAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, request.user.userId))
      .orderBy(desc(refreshTokens.createdAt));

    return { sessions };
  });

  // DELETE /api/auth/sessions/:id — revoke a specific session
  app.delete("/sessions/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const [deleted] = await db
      .delete(refreshTokens)
      .where(and(
        eq(refreshTokens.id, id),
        eq(refreshTokens.userId, request.user.userId),
      ))
      .returning();

    if (!deleted) {
      return reply.code(404).send({ error: "Session not found" });
    }

    return { message: "Session revoked" };
  });

  // GET /api/auth/me — current user + account info + usage
  app.get("/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isSystemAdmin: users.isSystemAdmin,
        emailDigestEnabled: users.emailDigestEnabled,
        emailVerifiedAt: users.emailVerifiedAt,
        timezone: users.timezone,
        accountId: users.accountId,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(eq(users.id, request.user.userId));

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    // Update lastSeenAt (throttled: only if >5 min since last update)
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    if (!user.lastSeenAt || new Date(user.lastSeenAt) < fiveMinAgo) {
      db.update(users)
        .set({ lastSeenAt: new Date() })
        .where(eq(users.id, user.id))
        .then(() => {})
        .catch(() => {});
    }

    // Consolidated query: account + 6 usage counts in a single round-trip (was 9 parallel queries)
    const [accountWithCounts] = await db.execute<{
      id: string; name: string; company: string | null; is_suspended: boolean;
      max_tracked_apps: number; max_tracked_keywords: number; max_competitor_apps: number;
      max_tracked_features: number; max_users: number; max_research_projects: number; max_platforms: number;
      past_due_since: Date | null;
      tracked_apps_count: number; tracked_keywords_count: number; competitor_apps_count: number;
      tracked_features_count: number; users_count: number; research_projects_count: number;
    }>(sql`
      SELECT a.*,
        (SELECT count(*)::int FROM account_tracked_apps WHERE account_id = ${user.accountId}) AS tracked_apps_count,
        (SELECT count(*)::int FROM account_tracked_keywords WHERE account_id = ${user.accountId}) AS tracked_keywords_count,
        (SELECT count(*)::int FROM account_competitor_apps WHERE account_id = ${user.accountId}) AS competitor_apps_count,
        (SELECT count(*)::int FROM account_tracked_features WHERE account_id = ${user.accountId}) AS tracked_features_count,
        (SELECT count(*)::int FROM users WHERE account_id = ${user.accountId}) AS users_count,
        (SELECT count(*)::int FROM research_projects WHERE account_id = ${user.accountId}) AS research_projects_count
      FROM accounts a WHERE a.id = ${user.accountId}
    `);

    // These are lightweight and independent — 3 parallel queries
    const [enabledPlatformsResult, visibilityRows, enabledFeaturesResult] = await Promise.all([
      db.select({ platform: accountPlatforms.platform, overrideGlobalVisibility: accountPlatforms.overrideGlobalVisibility }).from(accountPlatforms).where(eq(accountPlatforms.accountId, user.accountId)),
      db.select().from(platformVisibility),
      // Feature flags: user-level overrides > account-level > global
      // 1. Start with globally enabled + account-level flags
      // 2. Add user-level enabled flags
      // 3. Subtract user-level disabled flags
      db.execute<{ slug: string }>(sql`
        SELECT DISTINCT slug FROM (
          SELECT ff.slug FROM feature_flags ff
          WHERE ff.is_enabled = true
          UNION
          SELECT ff.slug FROM feature_flags ff
          INNER JOIN account_feature_flags aff ON aff.feature_flag_id = ff.id
          WHERE aff.account_id = ${user.accountId}
          UNION
          SELECT ff.slug FROM feature_flags ff
          INNER JOIN user_feature_flags uff ON uff.feature_flag_id = ff.id
          WHERE uff.user_id = ${user.id} AND uff.enabled = true
        ) AS enabled_flags
        WHERE slug NOT IN (
          SELECT ff.slug FROM feature_flags ff
          INNER JOIN user_feature_flags uff ON uff.feature_flag_id = ff.id
          WHERE uff.user_id = ${user.id} AND uff.enabled = false
        )
      `),
    ]);

    const account = accountWithCounts;
    const globalVisibility: Record<string, boolean> = {};
    for (const row of visibilityRows) {
      globalVisibility[row.platform] = row.isVisible;
    }

    // Determine effective enabled platforms
    let effectivePlatforms: string[];
    if (user.isSystemAdmin) {
      // System admin sees all platforms
      effectivePlatforms = PLATFORM_IDS as unknown as string[];
    } else {
      // Regular user: account platforms filtered by visibility
      effectivePlatforms = enabledPlatformsResult
        .filter((p) => globalVisibility[p.platform] === true || p.overrideGlobalVisibility === true)
        .map((p) => p.platform);
    }

    // Feature flags: system admins get ALL flags, regular users get computed set
    let enabledFeatures: string[];
    if (user.isSystemAdmin) {
      const allFlags = await db.select({ slug: featureFlags.slug }).from(featureFlags);
      enabledFeatures = allFlags.map((f) => f.slug);
    } else {
      enabledFeatures = enabledFeaturesResult.map((r) => r.slug);
    }

    const response: Record<string, unknown> = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSystemAdmin: user.isSystemAdmin,
        emailDigestEnabled: user.emailDigestEnabled,
        emailVerifiedAt: user.emailVerifiedAt,
        timezone: user.timezone,
      },
      account: {
        id: account.id,
        name: account.name,
        company: account.company,
        isSuspended: account.is_suspended,
        limits: {
          maxTrackedApps: account.max_tracked_apps,
          maxTrackedKeywords: account.max_tracked_keywords,
          maxCompetitorApps: account.max_competitor_apps,
          maxTrackedFeatures: account.max_tracked_features,
          maxUsers: account.max_users,
          maxResearchProjects: account.max_research_projects,
          maxPlatforms: account.max_platforms,
        },
        usage: {
          trackedApps: account.tracked_apps_count,
          trackedKeywords: account.tracked_keywords_count,
          competitorApps: account.competitor_apps_count,
          trackedFeatures: account.tracked_features_count,
          users: account.users_count,
          researchProjects: account.research_projects_count,
          platforms: enabledPlatformsResult.length,
        },
      },
      enabledPlatforms: effectivePlatforms,
      enabledFeatures,
    };

    // Include global visibility map for system admin
    if (user.isSystemAdmin) {
      response.globalPlatformVisibility = globalVisibility;
    }

    // Include impersonation metadata if active
    if (request.user.realAdmin) {
      const [adminUser] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, request.user.realAdmin.userId));

      response.impersonation = {
        isImpersonating: true,
        realAdmin: {
          userId: request.user.realAdmin.userId,
          email: request.user.realAdmin.email,
          name: adminUser?.name,
        },
        targetUser: {
          userId: user.id,
          email: user.email,
          name: user.name,
        },
      };
    }

    return response;
  });

  // PATCH /api/auth/me — update user profile & preferences
  app.patch("/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { emailDigestEnabled, timezone, name, email, currentPassword, newPassword } =
      updateProfileSchema.parse(request.body);

    // Block sensitive changes during impersonation
    if (request.isImpersonating && (newPassword || email)) {
      return reply.code(403).send({
        error: "Cannot change password or email while impersonating",
      });
    }

    const updates: Record<string, unknown> = {};

    if (typeof emailDigestEnabled === "boolean") {
      updates.emailDigestEnabled = emailDigestEnabled;
    }
    if (typeof timezone === "string" && timezone.length > 0) {
      updates.timezone = timezone;
    }

    // Name update
    if (typeof name === "string" && name.trim().length > 0) {
      updates.name = name.trim();
    }

    // Email update
    if (typeof email === "string" && email.trim().length > 0) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== request.user.email) {
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail));
        if (existing) {
          return reply.code(409).send({ error: "Email already in use" });
        }
        updates.email = normalizedEmail;
      }
    }

    // Password update (currentPassword required by schema refine)
    if (newPassword) {
      const [currentUser] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, request.user.userId));
      const valid = await bcrypt.compare(currentPassword!, currentUser.passwordHash);
      if (!valid) {
        return reply.code(403).send({ error: "Current password is incorrect" });
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: "No valid fields to update" });
    }

    updates.updatedAt = new Date();

    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, request.user.userId));

    // If password changed, revoke all sessions for security
    if (updates.passwordHash) {
      await revokeAllTokensForUser(request.user.userId);
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, request.user.userId));
    }

    const [updated] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailDigestEnabled: users.emailDigestEnabled,
        timezone: users.timezone,
      })
      .from(users)
      .where(eq(users.id, request.user.userId));

    // Log profile update activity
    const action = updates.passwordHash ? "password_changed" : "profile_updated";
    import("../utils/activity-log.js").then(m => m.logActivity(db, request.user.accountId, request.user.userId, action, "user", request.user.userId)).catch(() => {});

    return updated;
  });

  // GET /api/auth/export — export user's personal data (GDPR)
  app.get("/export", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.id, request.user.userId));
    if (!user) return reply.code(404).send({ error: "User not found" });

    const [account] = await db.select().from(accounts).where(eq(accounts.id, user.accountId));

    const trackedApps = await db
      .select({ appId: accountTrackedApps.appId, createdAt: accountTrackedApps.createdAt })
      .from(accountTrackedApps)
      .where(eq(accountTrackedApps.accountId, user.accountId));

    const trackedKeywords = await db
      .select({ keywordId: accountTrackedKeywords.keywordId, createdAt: accountTrackedKeywords.createdAt })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, user.accountId));

    reply.header("content-type", "application/json");
    reply.header("content-disposition", 'attachment; filename="appranks-data-export.json"');

    return {
      exportedAt: new Date().toISOString(),
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        timezone: user.timezone,
        emailDigestEnabled: user.emailDigestEnabled,
        createdAt: user.createdAt,
      },
      account: {
        name: account.name,
        company: account.company,
      },
      trackedApps,
      trackedKeywords,
    };
  });

  // DELETE /api/auth/me — delete account (soft delete, anonymize PII)
  app.delete("/me", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    if (request.user.role !== "owner") {
      return reply.code(403).send({ error: "Only account owners can delete the account" });
    }

    const { password } = deleteAccountSchema.parse(request.body);

    const [user] = await db.select().from(users).where(eq(users.id, request.user.userId));
    if (!user) return reply.code(404).send({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.code(403).send({ error: "Incorrect password" });

    const deletedId = crypto.randomUUID();

    // Anonymize user PII
    await db
      .update(users)
      .set({
        email: `deleted-${deletedId}@deleted`,
        name: "Deleted User",
        passwordHash: "DELETED",
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Suspend the account
    await db
      .update(accounts)
      .set({ isSuspended: true, updatedAt: new Date() })
      .where(eq(accounts.id, user.accountId));

    // Revoke all sessions
    await revokeAllTokensForUser(user.id);
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

    import("../utils/activity-log.js").then(m => m.logActivity(db, user.accountId, user.id, "account_deleted", "account", user.accountId)).catch(() => {});
    return { message: "Account deleted. Your data has been anonymized." };
  });
};
