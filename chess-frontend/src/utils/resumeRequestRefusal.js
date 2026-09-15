/**
 * Refused resume requests.
 *
 * The backend blocks a same-user retry while that user's own request is still
 * live (GameRoomService::requestResume: from 10 s until the 30 s expiry). The
 * WebSocket endpoint answers `200 { success: false, is_same_user: true,
 * expires_in_seconds }`; the HTTP fallback answers `409 { pending: true,
 * requested_by_id, can_request_again_in_seconds }`. Neither is a failure for
 * the requester: their request is out there and the panel should keep waiting.
 */

const toWholeSeconds = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
};

/**
 * Seconds left on the current user's own pending resume request, or 0 when the
 * refusal is anything else (opponent's request, expired, not paused, ...).
 *
 * @param {object|undefined} data   Backend body attached to the error (`error.fullData`)
 * @param {number|string} currentUserId
 * @param {number} [nowMs]
 * @returns {number}
 */
export const ownPendingResumeSeconds = (data, currentUserId, nowMs = Date.now()) => {
  if (!data || typeof data !== 'object') return 0;

  let isOwn = data.is_same_user === true;
  if (data.is_same_user === undefined && data.pending === true) {
    const requestedBy = data.requested_by_id ?? data.requested_by;
    isOwn = requestedBy != null && currentUserId != null && Number(requestedBy) === Number(currentUserId);
  }
  if (!isOwn) return 0;

  const direct = toWholeSeconds(data.expires_in_seconds ?? data.can_request_again_in_seconds);
  if (direct !== null) return direct;

  if (data.expires_at) {
    const ms = new Date(data.expires_at).getTime() - nowMs;
    if (Number.isFinite(ms)) return Math.max(0, Math.floor(ms / 1000));
  }
  return 0;
};

/**
 * Seconds left on the current user's own pending request as reported by
 * `GET resume-status` (`{ pending: true, type: 'sent', expires_at }`), or 0
 * when there is none or it has already expired. Used on a fresh load, where
 * the client holds no local record of the request it sent before reloading.
 *
 * @param {object|undefined} status  resume-status response body
 * @param {number} [nowMs]
 * @returns {number}
 */
export const sentResumeStatusSeconds = (status, nowMs = Date.now()) => {
  if (!status || status.pending !== true || status.type !== 'sent' || !status.expires_at) return 0;
  const ms = new Date(status.expires_at).getTime() - nowMs;
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
};
