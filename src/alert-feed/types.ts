import type { SessionKey } from "@/arbiter/types";

export const ALERT_FEED_SUBSCRIBE_MESSAGE_TYPE = "__maru_alert_feed_subscribe__";
export const ALERT_FEED_UNSUBSCRIBE_MESSAGE_TYPE = "__maru_alert_feed_unsubscribe__";
export const ALERT_FEED_CHANGE_MESSAGE_TYPE = "__maru_alert_feed_change__";

export type AlertTokenView = {
  sym: string;
  color: string;
  icon: string;
};

export type AlertSwapMode = "swap" | "bridge";

export type AlertCardViewModel = {
  sessionKey: SessionKey;
  sequence: number;
  candidateId: string;
  mode: AlertSwapMode;
  route: string;
  source: {
    token: AlertTokenView;
    amount: string;
  };
  destination: {
    token: AlertTokenView;
    amount: string;
  };
  confidence: number;
  sourceCount: number;
  savingsPercent?: string;
};

export type AlertViewModel =
  | {
      state: "scanning";
      sourceCount: number;
    }
  | {
      state: "all-good";
      sourceCount: number;
    }
  | {
      state: "better" | "bridge";
      card: AlertCardViewModel;
    };

export type AlertFeedChangeType = "added" | "updated" | "evicted";

export type AlertFeedChange = {
  type: AlertFeedChangeType;
  sessionKey: SessionKey;
  view: AlertViewModel | null;
};

export type AlertFeedSubscribeMessage = {
  type: typeof ALERT_FEED_SUBSCRIBE_MESSAGE_TYPE;
  subscriptionId: string;
};

export type AlertFeedUnsubscribeMessage = {
  type: typeof ALERT_FEED_UNSUBSCRIBE_MESSAGE_TYPE;
  subscriptionId: string;
};

export type AlertFeedSubscribeResponse = {
  view: AlertViewModel | null;
};

export type AlertFeedChangeMessage = {
  type: typeof ALERT_FEED_CHANGE_MESSAGE_TYPE;
  subscriptionId: string;
  change: AlertFeedChange;
};

export function createAlertFeedSubscribeMessage(
  subscriptionId: string,
): AlertFeedSubscribeMessage {
  return { type: ALERT_FEED_SUBSCRIBE_MESSAGE_TYPE, subscriptionId };
}

export function createAlertFeedUnsubscribeMessage(
  subscriptionId: string,
): AlertFeedUnsubscribeMessage {
  return { type: ALERT_FEED_UNSUBSCRIBE_MESSAGE_TYPE, subscriptionId };
}

export function createAlertFeedChangeMessage(
  subscriptionId: string,
  change: AlertFeedChange,
): AlertFeedChangeMessage {
  return { type: ALERT_FEED_CHANGE_MESSAGE_TYPE, subscriptionId, change };
}

export function isAlertFeedSubscribeMessage(
  value: unknown,
): value is AlertFeedSubscribeMessage {
  return (
    isRecord(value) &&
    value.type === ALERT_FEED_SUBSCRIBE_MESSAGE_TYPE &&
    typeof value.subscriptionId === "string"
  );
}

export function isAlertFeedUnsubscribeMessage(
  value: unknown,
): value is AlertFeedUnsubscribeMessage {
  return (
    isRecord(value) &&
    value.type === ALERT_FEED_UNSUBSCRIBE_MESSAGE_TYPE &&
    typeof value.subscriptionId === "string"
  );
}

export function isAlertFeedChangeMessage(
  value: unknown,
): value is AlertFeedChangeMessage {
  return (
    isRecord(value) &&
    value.type === ALERT_FEED_CHANGE_MESSAGE_TYPE &&
    typeof value.subscriptionId === "string" &&
    isAlertFeedChange(value.change)
  );
}

export function isAlertFeedSubscribeResponse(
  value: unknown,
): value is AlertFeedSubscribeResponse {
  return isRecord(value) && (value.view === null || isAlertViewModel(value.view));
}

function isAlertFeedChange(value: unknown): value is AlertFeedChange {
  return (
    isRecord(value) &&
    (value.type === "added" || value.type === "updated" || value.type === "evicted") &&
    typeof value.sessionKey === "string" &&
    (value.view === null || isAlertViewModel(value.view))
  );
}

function isAlertViewModel(value: unknown): value is AlertViewModel {
  if (!isRecord(value)) return false;
  if (value.state === "scanning" || value.state === "all-good") {
    return Number.isSafeInteger(value.sourceCount);
  }
  return (value.state === "better" || value.state === "bridge") && isAlertCard(value.card);
}

function isAlertCard(value: unknown): value is AlertCardViewModel {
  return (
    isRecord(value) &&
    typeof value.sessionKey === "string" &&
    Number.isSafeInteger(value.sequence) &&
    typeof value.candidateId === "string" &&
    (value.mode === "swap" || value.mode === "bridge") &&
    typeof value.route === "string" &&
    isTokenAmount(value.source) &&
    isTokenAmount(value.destination) &&
    typeof value.confidence === "number" &&
    Number.isSafeInteger(value.sourceCount) &&
    (value.savingsPercent === undefined || typeof value.savingsPercent === "string")
  );
}

function isTokenAmount(value: unknown): value is AlertCardViewModel["source"] {
  return (
    isRecord(value) &&
    isAlertToken(value.token) &&
    typeof value.amount === "string"
  );
}

function isAlertToken(value: unknown): value is AlertTokenView {
  return (
    isRecord(value) &&
    typeof value.sym === "string" &&
    typeof value.color === "string" &&
    typeof value.icon === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
