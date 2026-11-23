// Simulation clock: the date shown, play/pause, speed and direction.

export const TIME_MIN = Date.UTC(1970, 0, 1, 0, 0, 0);
export const TIME_MAX = Date.UTC(2050, 11, 31, 23, 59, 59);
export const DAY_MS = 86400000;

// Simulated days per real second.
export const SPEEDS = {
  hour: 1 / 24,
  day: 1,
  month: 365.25 / 12,
  year: 365.25,
};

export const clampTime = (t) => Math.min(TIME_MAX, Math.max(TIME_MIN, t));

export function createClock(start) {
  return {
    t: clampTime(start),
    playing: false,
    dir: 1,
    speed: 'day',
    /** Advance by `dt` real seconds. Stops at the ends of the time range. */
    tick(dt) {
      if (!this.playing) return this.t;
      const next = this.t + this.dir * SPEEDS[this.speed] * dt * DAY_MS;
      this.t = clampTime(next);
      if (this.t !== next) this.playing = false;
      return this.t;
    },
    set(t) {
      this.t = clampTime(t);
      return this.t;
    },
  };
}
