import { getVerificationSummary, type VerificationSessionStatus } from '../matrix/matrixCryptoService';
import type { MatrixConfig, RoomMember } from '../matrix/types';

export function getDmVerificationTargetUserId(
  selectedRoomId: string,
  membersByRoom: Record<string, RoomMember[]>,
  selfUserId: string,
): string {
  if (!selectedRoomId) {
    return '';
  }

  const roomMembers = membersByRoom[selectedRoomId] ?? [];
  const targetMember = roomMembers.find((member) => member.userId !== selfUserId);
  return targetMember?.userId ?? '';
}

export async function loadIncomingDmVerificationRequest(
  config: MatrixConfig,
  targetUserId: string,
  roomId: string,
): Promise<VerificationSessionStatus | null> {
  const summary = await getVerificationSummary(config, targetUserId, roomId);
  const request = summary.dmRequestInProgress;

  if (!request || request.initiatedByMe || request.phase === 'done' || request.phase === 'cancelled') {
    return null;
  }

  return request;
}
