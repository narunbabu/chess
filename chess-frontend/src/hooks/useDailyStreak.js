import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Single source for the activity streak UI.
 *
 * The canonical value lives on the authenticated user
 * (`current_streak_days` / `longest_streak_days`, advanced server-side by
 * `User::updateDailyStreak()` for games, puzzles, lessons, drills and daily
 * challenges alike). It is refreshed when the tab becomes visible or focused
 * so a streak earned elsewhere (e.g. a game finished in another tab or on the
 * phone) shows up without a full reload.
 *
 * On refresh failure the last known value is kept and a warning is logged;
 * guests (user === null) simply report 0/0 and render no streak UI.
 */
const useDailyStreak = () => {
  const { user, fetchUser } = useAuth();

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;

    const refresh = async () => {
      try {
        await fetchUser();
      } catch (error) {
        if (!cancelled) {
          console.warn('[useDailyStreak] refresh failed', error?.message || error);
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refresh);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, [user, fetchUser]);

  return {
    streak: user?.current_streak_days ?? 0,
    longest: user?.longest_streak_days ?? 0,
  };
};

export default useDailyStreak;
