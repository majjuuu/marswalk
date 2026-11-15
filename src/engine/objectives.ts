import type { XY } from '../types';
import { RESERVE_MIN } from './config';

/*
 * EVA mission objectives that tick themselves off as the crew does them.
 * Auto-completing checklist idea from gloriachang's HUD branch, tied here to
 * the real EVA: get to the target, do the science, and come home with the
 * reserve still intact.
 */

export const ARRIVE_RADIUS_M = 30; // "at the target" = lead astronaut within this distance
export const HOME_RADIUS_M = 20; // "back at the rover"

export interface MissionFlags {
  reachedTarget: boolean;
  reviewedScience: boolean;
  collectedSamples: boolean;
  returnedSafely: boolean;
}

export const NO_PROGRESS: MissionFlags = {
  reachedTarget: false,
  reviewedScience: false,
  collectedSamples: false,
  returnedSafely: false,
};

export const OBJECTIVES: { key: keyof MissionFlags; label: string }[] = [
  { key: 'reachedTarget', label: 'Reach Cheyava Falls' },
  { key: 'reviewedScience', label: 'Review the leopard-spot science' },
  { key: 'collectedSamples', label: 'Collect every sample (spot, no-spot, blank)' },
  { key: 'returnedSafely', label: 'Return to the rover with the reserve intact' },
];

export interface MissionInput {
  navigating: boolean;
  lead: XY; // EV1
  target: XY | null;
  o2_min_left: number;
  scienceOpened: boolean;
  samplesCollected: number;
  samplesTotal: number;
}

/** Flags only ever turn on (an objective, once done, stays done until a reset). */
export function updateMission(prev: MissionFlags, m: MissionInput): MissionFlags {
  const atTarget = !!m.target && Math.hypot(m.lead.x - m.target.x, m.lead.y - m.target.y) <= ARRIVE_RADIUS_M;
  const reachedTarget = prev.reachedTarget || (m.navigating && atTarget);
  const atRover = Math.hypot(m.lead.x, m.lead.y) <= HOME_RADIUS_M;
  return {
    reachedTarget,
    reviewedScience: prev.reviewedScience || m.scienceOpened,
    collectedSamples: prev.collectedSamples || (m.samplesTotal > 0 && m.samplesCollected >= m.samplesTotal),
    // Coming home only counts after visiting the target, and only above the reserve.
    returnedSafely: prev.returnedSafely || (reachedTarget && m.navigating && atRover && m.o2_min_left > RESERVE_MIN),
  };
}

export function sameFlags(a: MissionFlags, b: MissionFlags) {
  return OBJECTIVES.every((o) => a[o.key] === b[o.key]);
}
