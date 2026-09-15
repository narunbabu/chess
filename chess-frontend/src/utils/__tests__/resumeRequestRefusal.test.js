import { ownPendingResumeSeconds } from '../resumeRequestRefusal';

describe('ownPendingResumeSeconds', () => {
  it('reads the WebSocket endpoint same-user refusal (10-30 s window)', () => {
    const body = {
      success: false,
      message: 'Your resume request is still pending. Please wait for opponent response.',
      expires_in_seconds: 17,
      requested_by: 7,
      is_same_user: true,
    };
    expect(ownPendingResumeSeconds(body, 7)).toBe(17);
  });

  it('ignores a refusal for the opponent pending request', () => {
    const body = {
      success: false,
      message: 'Resume request already pending (sent by Opponent).',
      expires_in_seconds: 17,
      requested_by: 8,
      is_same_user: false,
    };
    expect(ownPendingResumeSeconds(body, 7)).toBe(0);
  });

  it('reads the HTTP fallback 409 by comparing requested_by_id', () => {
    const own = { pending: true, requested_by_id: 7, can_request_again_in_seconds: 12 };
    expect(ownPendingResumeSeconds(own, 7)).toBe(12);
    expect(ownPendingResumeSeconds(own, '7')).toBe(12);
    expect(ownPendingResumeSeconds({ ...own, requested_by_id: 8 }, 7)).toBe(0);
  });

  it('falls back to expires_at and floors fractional seconds', () => {
    const now = Date.parse('2026-09-15T10:00:00Z');
    expect(ownPendingResumeSeconds({ is_same_user: true, expires_at: '2026-09-15T10:00:20.900Z' }, 7, now)).toBe(20);
    expect(ownPendingResumeSeconds({ is_same_user: true, expires_in_seconds: 9.7 }, 7)).toBe(9);
  });

  it('returns 0 for expired or unrelated refusals', () => {
    expect(ownPendingResumeSeconds({ is_same_user: true, expires_in_seconds: 0 }, 7)).toBe(0);
    expect(ownPendingResumeSeconds({ success: false, message: 'Game is not paused' }, 7)).toBe(0);
    expect(ownPendingResumeSeconds(undefined, 7)).toBe(0);
  });
});
