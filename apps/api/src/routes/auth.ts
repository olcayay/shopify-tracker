import type { FastifyPluginAsync } from "fastify";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  createDb,
  accounts,
  users,
  refreshTokens,
  accountTrackedApps,
  accountTrackedKeywords,
  accountCompetitorApps,
  accountTrackedFeatures,
} from "@shopify-tracking/db";
import { getJwtSecret, type JwtPayload } from "../middleware/auth.js";

type Db = ReturnType<typeof createDb>;

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // POST /api/auth/register — create account + owner user
  app.post("/register", async (request, reply) => {
    const { email, password, name, accountName } = request.body as {
      email?: string;
      password?: string;
      name?: string;
      accountName?: string;
    };

    if (!email || !password || !name || !accountName) {
      return reply.code(400).send({
        error: "email, password, name, and accountName are required",
      });
    }

    if (password.length < 8) {
      return reply.code(400).send({
        error: "Password must be at least 8 characters",
      });
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

    // Create account
    const [account] = await db
      .insert(accounts)
      .values({ name: accountName })
      .returning();

    // Create owner user
    const [user] = await db
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
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
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

  // POST /api/auth/login — email + password login
  app.post("/login", async (request, reply) => {
    const { email, password } = request.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return reply.code(400).send({ error: "email and password are required" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

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

  // POST /api/auth/refresh — exchange refresh token for new access token
  app.post("/refresh", async (request, reply) => {
    const { refreshToken: token } = request.body as {
      refreshToken?: string;
    };

    if (!token) {
      return reply.code(400).send({ error: "refreshToken is required" });
    }

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

  // POST /api/auth/logout — revoke refresh token
  app.post("/logout", async (request, reply) => {
    const { refreshToken: token } = request.body as {
      refreshToken?: string;
    };

    if (token) {
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(token)));
    }

    return { message: "Logged out" };
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
        timezone: users.timezone,
        accountId: users.accountId,
      })
      .from(users)
      .where(eq(users.id, request.user.userId));

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, user.accountId));

    // Get usage counts
    const [trackedAppsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTrackedApps)
      .where(eq(accountTrackedApps.accountId, user.accountId));

    const [trackedKeywordsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTrackedKeywords)
      .where(eq(accountTrackedKeywords.accountId, user.accountId));

    const [competitorAppsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountCompetitorApps)
      .where(eq(accountCompetitorApps.accountId, user.accountId));

    const [trackedFeaturesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTrackedFeatures)
      .where(eq(accountTrackedFeatures.accountId, user.accountId));

    const [usersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.accountId, user.accountId));

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSystemAdmin: user.isSystemAdmin,
        emailDigestEnabled: user.emailDigestEnabled,
        timezone: user.timezone,
      },
      account: {
        id: account.id,
        name: account.name,
        isSuspended: account.isSuspended,
        limits: {
          maxTrackedApps: account.maxTrackedApps,
          maxTrackedKeywords: account.maxTrackedKeywords,
          maxCompetitorApps: account.maxCompetitorApps,
          maxTrackedFeatures: account.maxTrackedFeatures,
          maxUsers: account.maxUsers,
        },
        usage: {
          trackedApps: trackedAppsCount.count,
          trackedKeywords: trackedKeywordsCount.count,
          competitorApps: competitorAppsCount.count,
          trackedFeatures: trackedFeaturesCount.count,
          users: usersCount.count,
        },
      },
    };
  });

  // PATCH /api/auth/me — update user preferences
  app.patch("/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { emailDigestEnabled, timezone } = request.body as {
      emailDigestEnabled?: boolean;
      timezone?: string;
    };

    const updates: Record<string, unknown> = {};
    if (typeof emailDigestEnabled === "boolean") {
      updates.emailDigestEnabled = emailDigestEnabled;
    }
    if (typeof timezone === "string" && timezone.length > 0) {
      updates.timezone = timezone;
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: "No valid fields to update" });
    }

    updates.updatedAt = new Date();

    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, request.user.userId));

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

    return updated;
  });
};
