export const MAX_MESSAGES_TOTAL = 3000;
export const MAX_MESSAGES_PER_ROOM = 600;

export function getRetentionSummaryLabel() {
  return `Retention: ${MAX_MESSAGES_PER_ROOM}/room, ${MAX_MESSAGES_TOTAL} total`;
}