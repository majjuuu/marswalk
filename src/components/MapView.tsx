import L from 'leaflet';
import { useMemo } from 'react';
import { CircleMarker, ImageOverlay, MapContainer, Marker, Polygon, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import { gridExtent } from '../engine';
import type { MapPoint, SafeReturn, SlopeGrid, XY, XYPair } from '../types';
import { MAP_COLORS } from '../theme';
import { placeholderBasemapUrl, slopeHeatmapUrl } from './rasters';

export interface LayerVisibility {
  basemap: boolean;
  slope: boolean;
  boundary: boolean;
  route: boolean;
  points: boolean;
}

interface Props {
  grid: SlopeGrid;
  basemapUrl: string | null;
  points: MapPoint[];
  layers: LayerVisibility;
  safe: SafeReturn | null;
  route: XYPair[];
  waypoints: XY[];
  astronauts: XY[];
  onMapClick?: (p: XY) => void;
  onPointClick?: (p: MapPoint) => void;
  onHover?: (p: XY | null) => void;
}

// L.CRS.Simple treats coordinates as plain numbers. Leaflet wants [lat, lng],
// which for us means [y, x]. This helper is the ONLY place that flip happens.
const ll = (x: number, y: number): [number, number] => [y, x];

const STATUS_COLOR = { ok: MAP_COLORS.ok, warn: MAP_COLORS.warn, turnback: MAP_COLORS.turnback } as const;
const POINT_COLOR = MAP_COLORS.point;

const roverIcon = L.divIcon({ className: 'rover-icon', html: '🚙', iconSize: [24, 24] });

function ClickHandler({ onClick, onHover }: { onClick?: (p: XY) => void; onHover?: (p: XY | null) => void }) {
  useMapEvents({
    click: (e) => onClick?.({ x: e.latlng.lng, y: e.latlng.lat }),
    mousemove: (e) => onHover?.({ x: e.latlng.lng, y: e.latlng.lat }),
    mouseout: () => onHover?.(null),
  });
  return null;
}

export function MapView(p: Props) {
  const ext = gridExtent(p.grid);
  const bounds: L.LatLngBoundsExpression = [ll(ext.west, ext.south), ll(ext.east, ext.north)];
  // Building the images is slow-ish (360k pixels), so only redo it if the grid changes.
  const slopeUrl = useMemo(() => slopeHeatmapUrl(p.grid), [p.grid]);
  const baseUrl = useMemo(() => p.basemapUrl ?? placeholderBasemapUrl(p.grid), [p.grid, p.basemapUrl]);
  const statusColor = p.safe ? STATUS_COLOR[p.safe.status] : STATUS_COLOR.ok;

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      minZoom={-3}
      maxZoom={3}
      zoomSnap={0.25}
      attributionControl={false}
      className="map"
    >
      {p.layers.basemap && <ImageOverlay url={baseUrl} bounds={bounds} />}
      {p.layers.slope && <ImageOverlay url={slopeUrl} bounds={bounds} opacity={0.7} />}

      {p.layers.boundary && p.safe && p.safe.rings && p.safe.rings.length > 0 && (
        <Polygon
          // First ring = outer edge, the rest become holes (steep patches).
          positions={p.safe.rings.map((ring) => ring.map(([x, y]) => ll(x, y)))}
          pathOptions={{ color: statusColor, fillColor: statusColor, fillOpacity: 0.12, weight: 2 }}
          interactive={false}
        />
      )}

      {p.layers.route && p.route.length > 1 && (
        <Polyline positions={p.route.map(([x, y]) => ll(x, y))} pathOptions={{ color: MAP_COLORS.route, weight: 3, dashArray: '6 6' }} />
      )}
      {p.waypoints.map((w, i) => (
        <CircleMarker key={i} center={ll(w.x, w.y)} radius={5} pathOptions={{ color: MAP_COLORS.route, fillOpacity: 1 }}>
          <Tooltip direction="top">WP {i + 1}</Tooltip>
        </CircleMarker>
      ))}

      {p.layers.points &&
        p.points
          .filter((pt) => pt.type !== 'rover')
          .map((pt) => (
            <CircleMarker
              key={pt.id}
              center={ll(pt.x, pt.y)}
              radius={pt.type === 'hazard' ? 9 : 6}
              // bubblingMouseEvents: false stops the click also adding a waypoint in Plan mode.
              pathOptions={{ color: POINT_COLOR[pt.type], fillOpacity: pt.type === 'hazard' ? 0.25 : 0.9 }}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => p.onPointClick?.(pt) }}
            >
              <Tooltip permanent direction="right" className="pt-label">
                {pt.name}
              </Tooltip>
            </CircleMarker>
          ))}

      <Marker position={ll(0, 0)} icon={roverIcon} />
      {p.astronauts.map((a, i) => (
        <CircleMarker key={`astro${i}`} center={ll(a.x, a.y)} radius={6} pathOptions={{ color: '#fff', fillColor: i ? MAP_COLORS.ev2 : MAP_COLORS.ev1, fillOpacity: 1, weight: 2 }}>
          <Tooltip direction="bottom">EV{i + 1}</Tooltip>
        </CircleMarker>
      ))}

      <ClickHandler onClick={p.onMapClick} onHover={p.onHover} />
    </MapContainer>
  );
}
