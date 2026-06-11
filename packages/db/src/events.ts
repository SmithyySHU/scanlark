import { ensureConnected } from "./client";
import type { AppNotification } from "./appNotifications";

export const SCAN_EVENT_CHANNEL = "scan_events";

type ScanStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";
type ScheduleFrequency = "manual" | "daily" | "weekly" | "monthly";

export type ScanEventPayload = {
  type: "scan_started" | "scan_progress" | "scan_completed" | "scan_failed";
  user_id: string;
  site_id: string;
  scan_run_id: string;
  status: ScanStatus;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
  start_url?: string | null;
  total_links: number;
  checked_links: number;
  broken_links: number;
  error_message: string | null;
};

export type ScheduleEventPayload = {
  type: "schedule_updated";
  user_id: string;
  site_id: string;
  schedule_enabled: boolean;
  schedule_frequency: ScheduleFrequency;
  schedule_time_utc: string;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  next_scheduled_at: string | null;
  last_scheduled_at: string | null;
};

export type NotificationCreatedEventPayload = {
  type: "notification_created";
  user_id: string;
  notification: AppNotification;
  unread_count: number;
};

export type NotificationCountUpdatedEventPayload = {
  type: "notification_count_updated";
  user_id: string;
  unread_count: number;
};

export type ScanEvent =
  | ScanEventPayload
  | ScheduleEventPayload
  | NotificationCreatedEventPayload
  | NotificationCountUpdatedEventPayload;

export async function emitScanEvent(event: ScanEvent): Promise<void> {
  const client = await ensureConnected();
  await client.query("SELECT pg_notify($1, $2)", [
    SCAN_EVENT_CHANNEL,
    JSON.stringify(event),
  ]);
}
