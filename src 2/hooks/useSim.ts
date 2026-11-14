import { useEffect, useRef, useState } from 'react';
import { initialRuntime, stepSim, type Route, type SimRuntime } from '../engine';
import type { SlopeGrid, XY } from '../types';

const TICK_MS = 100;

/** Runs the sim on a timer. speed = sim minutes per real second. */
export function useSim(grid: SlopeGrid | null, route: Route | null, rover: XY, speed: number) {
  const [rt, setRt] = useState<SimRuntime>(() => initialRuntime(rover));
  const [playing, setPlaying] = useState(false);
  // Keep latest route in a ref so the interval doesn't restart on every change.
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    if (!playing || !grid) return;
    const id = setInterval(() => {
      const r = routeRef.current;
      if (!r) return;
      setRt((prev) => stepSim(prev, r, (speed * TICK_MS) / 1000, grid));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, grid, speed]);

  // Out of O2 = the scenario is over; stop the clock.
  useEffect(() => {
    if (rt.state.o2_min_left <= 0) setPlaying(false);
  }, [rt.state.o2_min_left]);

  return {
    rt,
    playing,
    setPlaying,
    reset: () => {
      setPlaying(false);
      setRt(initialRuntime(rover));
    },
    /** Restart progress along a NEW route without resetting O2/time. */
    followNewRoute: () => setRt((prev) => ({ ...prev, progress_m: 0 })),
  };
}
