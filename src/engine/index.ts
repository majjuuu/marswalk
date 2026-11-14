// Public surface of the engine. UI code should import from here only.
export * from './config';
export { canReturn, getReturnCostField, returnCostAt, statusForMargin } from './safeReturn';
export { buildRoute, estimateRoute, pointAlong, type Route } from './route';
export { initialRuntime, stepSim, type SimRuntime } from './sim';
export { getWarnings, type Warning } from './warnings';
export { cellIndexAt, gridExtent, slopeAt } from './grid';
