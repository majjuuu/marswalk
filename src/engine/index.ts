// Public surface of the engine. UI code should import from here only.
export * from './config';
export { canReturn, forecastMinutesToTurnback, getReturnCostField, marginFor, returnCostAt, statusForMargin, type RoutePlan } from './safeReturn';
export { buildRoute, estimateRoute, pointAlong, type Route } from './route';
export { initialRuntime, stepSim, type SimRuntime } from './sim';
export { getWarnings, type Warning } from './warnings';
export { cellIndexAt, elevationAt, gridExtent, slopeAt } from './grid';
export { NO_PROGRESS, OBJECTIVES, sameFlags, updateMission, type MissionFlags } from './objectives';
