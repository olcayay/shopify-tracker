import type { FastifyPluginAsync } from "fastify";
import { accountInfoRoutes } from "./account-info.js";
import { accountMemberRoutes } from "./account-members.js";
import { accountTrackingRoutes } from "./account-tracking.js";
import { accountExtrasRoutes } from "./account-extras.js";
import { accountActivityLogRoutes } from "./account-activity-log.js";

export const accountRoutes: FastifyPluginAsync = async (app) => {
  await app.register(accountInfoRoutes);
  await app.register(accountMemberRoutes);
  await app.register(accountTrackingRoutes);
  await app.register(accountExtrasRoutes);
  await app.register(accountActivityLogRoutes);
};
