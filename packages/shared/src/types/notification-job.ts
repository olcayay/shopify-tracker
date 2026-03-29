/**
 * Job data types for the notifications queue.
 */

export type NotificationJobType =
  | "notification_ranking_change"
  | "notification_new_competitor"
  | "notification_new_review"
  | "notification_milestone"
  | "notification_price_change"
  | "notification_category_change";

export interface NotificationJobData {
  type: NotificationJobType;
  /** Target user ID */
  userId: string;
  /** Account ID */
  accountId: string;
  /** Notification-specific payload */
  payload: Record<string, unknown>;
  /** ISO timestamp when the job was created */
  createdAt: string;
  /** Whether to also send a web push notification */
  sendPush?: boolean;
}
