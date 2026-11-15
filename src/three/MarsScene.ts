import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { elevationAt } from '../engine';
import type { DetailIndex, ElevationGrid, MapPoint, XY, XYPair } from '../types';
import { DetailTiles } from './detailTiles';
import { dotCanvas, loadImage } from './textures';

/*
 * The 3D scene, written as a plain class so React only calls setters on it.
 *
 * Axes: our map is x = east, y = north, height up. three.js is y = up, so
 *   world = (x, height * exaggeration, -y)
 * The minus on y keeps north "into the screen" with a right-handed system.
 */

/**
 * overview = orbit from above · eye = ride along as EV1 (follows the sim)
 * explore = walk anywhere on foot at eye height (click the ground to go there;
 *           idea from gloriachang's HUD branch)
 */
export type CameraMode = 'overview' | 'eye' | 'explore';
/** Walking speed when exploring: faster than a real EVA so the demo stays snappy. */
const EXPLORE_SPEED_M_S = 30;
export const EYE_HEIGHT_M = 1.7;

export interface SceneCallbacks {
  onTerrainClick?: (p: XY) => void;
  onLabelClick?: (id: string) => void;
  /** Pointer over the terrain, or null when it leaves. */
  onHover?: (p: XY | null) => void;
  /** First-person position + compass bearing (deg clockwise from north), for the minimap. */
  onViewer?: (v: { pos: XY; bearingDeg: number }) => void;
}

export class MarsScene {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 1, 30000);
  private controls: OrbitControls;
  private terrain: THREE.Mesh;
  private terrainMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  private dotTex = new THREE.CanvasTexture(dotCanvas());
  // Two overlay groups so the per-tick redraw doesn't recreate clickable labels:
  //   fixed = route + map points (change rarely)
  //   live  = boundary + astronauts + rover label (change every sim tick)
  private fixed = new THREE.Group();
  private live = new THREE.Group();
  private lineMats = new Map<THREE.Group, LineMaterial[]>();
  private raf = 0;
  private exag = 1.5;
  private mode: CameraMode = 'overview';
  private eye = { pos: { x: 0, y: 0 } as XY, ahead: { x: 0, y: 1 } as XY, yaw: 0, pitch: -0.08 };
  /** Explore mode: where you stand, which way you face (radians, 0 = east), where you're walking to. */
  private walk = { pos: { x: 0, y: 0 } as XY, heading: Math.PI / 2, to: null as XY | null };
  private lastViewer = { x: NaN, y: NaN, b: NaN };
  private lastFrame = performance.now();
  private resizeObs: ResizeObserver;
  /** Eye-view compass: arrow + distance to the rover, which is usually behind you. */
  private hud = document.createElement('div');
  // Last inputs, so we can rebuild overlays after an exaggeration change.
  private last: {
    route: XYPair[];
    rings: XYPair[][];
    ringColor: string;
    points: MapPoint[];
    astronauts: XY[];
  } = { route: [], rings: [], ringColor: '#3ddc84', points: [], astronauts: [] };

  constructor(private container: HTMLElement, private elev: ElevationGrid, private cb: SceneCallbacks = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(this.labels.domElement);
    this.hud.className = 'hud3d';
    this.hud.style.display = 'none';
    container.appendChild(this.hud);

    this.scene.background = new THREE.Color('#1a1210');
    this.scene.add(new THREE.HemisphereLight(0xfff1e0, 0x3a2418, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-3000, 1500, 1500); // low sun from the west-southwest: shows relief
    this.scene.add(sun);

    this.terrain = new THREE.Mesh(new THREE.BufferGeometry(), this.terrainMat);
    this.scene.add(this.terrain, this.fixed, this.live);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.maxPolarAngle = Math.PI * 0.47; // never look up from below the horizon
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = false; // pan slides along the ground, not up/down into it
    this.controls.minDistance = 30;
    this.controls.maxDistance = 6000;

    this.buildTerrain();
    this.resetOverview();
    this.bindPointer();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.mode === 'overview') {
        this.controls.update();
        this.keepAboveGround();
      }
      else this.placeEyeCamera();
      this.pickHover();
      this.reportViewer();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    };
    loop();
  }

  // ------------------------------------------------------------ helpers
  /**
   * How high lines float above the ground. Overview: a few metres so they
   * don't flicker into the terrain. Eye view: just above the dirt, otherwise
   * a line 2 m up is above your 1.7 m eyes and slices through the view.
   */
  private lift(overview: number) {
    return this.mode === 'overview' ? overview : 0.15;
  }

  /** Local map point -> 3D position, lifted `lift` metres above the ground. */
  /**
   * Orbit/pan can push the camera inside a hill; then you'd see the terrain
   * from underneath (back faces aren't drawn, so it looks transparent).
   * Every frame: keep the target on the map and on the ground, and the camera
   * at least CAMERA_CLEARANCE_M above whatever ground is under it.
   */
  private keepAboveGround() {
    const CAMERA_CLEARANCE_M = 25;
    const t = this.controls.target;
    const { west, east, north, south } = this.extent();
    t.x = Math.max(west, Math.min(east, t.x));
    t.z = Math.max(-north, Math.min(-south, t.z));
    t.y = this.groundY({ x: t.x, y: -t.z });
    const cam = this.camera.position;
    const floor = this.groundY({ x: cam.x, y: -cam.z }) + CAMERA_CLEARANCE_M * Math.max(1, this.exag);
    if (cam.y < floor) cam.y = floor;
  }

  private extent() {
    const g = this.elev;
    return { west: g.origin_x, east: g.origin_x + g.width * g.cell_m, north: g.origin_y, south: g.origin_y - g.height * g.cell_m };
  }

  /** Ground height in scene units (exaggerated), using detail tiles when present. */
  private groundY(p: XY): number {
    return this.heightAt(p) * this.exag;
  }

  /** Terrain height in metres: fine 1 m detail tile if one covers p, else the 5 m grid. */
  private heightAt(p: XY): number {
    const fine = this.detailShown() ? this.detail!.heightAt(p) : null;
    return fine ?? elevationAt(this.elev, p);
  }

  // ------------------------------------------------------------ detail tiles
  private detail: DetailTiles | null = null;
  private detailWanted = true;
  private detailSlope: HTMLImageElement | null = null;

  private detailShown() {
    return !!this.detail && this.detailWanted && this.detail.count > 0;
  }

  /** Start streaming the 1 m / 25 cm tiles, nearest to `near` first. Safe to call once. */
  loadDetail(index: DetailIndex, near: XY) {
    if (this.detail) return;
    this.detail = new DetailTiles(index, this.elev, this.renderer.capabilities.getMaxAnisotropy());
    this.detail.group.visible = this.detailWanted;
    this.scene.add(this.detail.group);
    this.detail.load(near, this.exag, this.detailSlope, () => {
      // New ground under the base: sink the base there and re-drape lines/markers.
      this.buildTerrain();
      this.drawFixed();
      this.drawLive();
    });
  }

  /** Tiles are photos; hide them when another base map (minerals, thermal...) is chosen. */
  setDetailVisible(v: boolean) {
    if (v === this.detailWanted) return;
    this.detailWanted = v;
    if (this.detail) this.detail.group.visible = v;
    this.buildTerrain();
    this.drawFixed();
    this.drawLive();
  }

  async setDetailSlopeOverlay(url: string | null) {
    this.detailSlope = url ? await loadImage(url) : null;
    this.detail?.setSlopeOverlay(this.detailSlope);
  }

  private world(p: XY, lift = 0): THREE.Vector3 {
    return new THREE.Vector3(p.x, this.heightAt(p) * this.exag + lift, -p.y);
  }

  // ------------------------------------------------------------ terrain
  private buildTerrain() {
    const { width: W, height: H, cell_m, origin_x, origin_y, data } = this.elev;
    const pos = new Float32Array(W * H * 3);
    const uv = new Float32Array(W * H * 2);
    const sinkBase = this.detailShown();
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        pos[i * 3] = origin_x + (c + 0.5) * cell_m;
        // Where a sharp detail tile covers this spot, sink the coarse base 3 m
        // underneath so it can't poke through the tile.
        const sink = sinkBase && this.detail!.covers({ x: pos[i * 3], y: origin_y - (r + 0.5) * cell_m }, 6) ? 3 : 0;
        pos[i * 3 + 1] = (data[i] - sink) * this.exag;
        pos[i * 3 + 2] = -(origin_y - (r + 0.5) * cell_m);
        uv[i * 2] = (c + 0.5) / W;
        uv[i * 2 + 1] = 1 - (r + 0.5) / H; // texture row 0 = north = top
      }
    }
    // Two triangles per grid square, wound so normals point up.
    const idx = new Uint32Array((W - 1) * (H - 1) * 6);
    let k = 0;
    for (let r = 0; r < H - 1; r++) {
      for (let c = 0; c < W - 1; c++) {
        const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
        idx.set([a, d, b, b, d, e], k);
        k += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    this.terrain.geometry.dispose();
    this.terrain.geometry = geo;
  }

  setTexture(canvas: HTMLCanvasElement, tintMars: boolean) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.terrainMat.map?.dispose();
    this.terrainMat.map = tex;
    // The HiRISE ortho is greyscale; a warm tint makes it read as Mars.
    this.terrainMat.color.set(tintMars ? '#f0c9a4' : '#ffffff');
    this.terrainMat.needsUpdate = true;
  }

  setExaggeration(exag: number) {
    if (exag === this.exag) return;
    this.exag = exag;
    this.buildTerrain();
    this.detail?.setExaggeration(exag);
    this.drawFixed();
    this.drawLive();
  }

  // ------------------------------------------------------------ overlays
  setRoute(route: XYPair[]) {
    this.last.route = route;
    this.drawFixed();
  }
  setPoints(points: MapPoint[]) {
    this.last.points = points;
    this.drawFixed();
  }
  /** Boundary + astronauts together: they change on the same sim tick. */
  setLive(rings: XYPair[][], color: string, astronauts: XY[]) {
    Object.assign(this.last, { rings, ringColor: color, astronauts });
    if (astronauts[0]) this.eye.pos = astronauts[0];
    this.drawLive();
  }

  private lineMaterial(group: THREE.Group, color: string, px: number) {
    const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: px });
    m.resolution.set(this.container.clientWidth, this.container.clientHeight);
    this.lineMats.get(group)!.push(m);
    return m;
  }

  /** Remove and free everything in a group (geometries, materials, label DOM). */
  private clear(group: THREE.Group) {
    for (const child of [...group.children]) {
      child.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.remove();
        (o as THREE.Mesh).geometry?.dispose();
        if (o instanceof THREE.Sprite) o.material.dispose();
      });
      group.remove(child);
    }
    (this.lineMats.get(group) ?? []).forEach((m) => m.dispose());
    this.lineMats.set(group, []);
  }

  private marker(group: THREE.Group, p: XY, color: string, label: string, id: string | null, lift = 0) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.dotTex, color, sizeAttenuation: false, depthTest: false }),
    );
    sprite.scale.set(0.018, 0.018, 1); // fixed size on screen
    sprite.renderOrder = 10; // drawn over terrain so it's never hidden behind a hill
    sprite.position.copy(this.world(p, lift));
    const div = document.createElement('div');
    div.className = 'label3d' + (id ? ' clickable' : '');
    div.textContent = label;
    if (id) div.addEventListener('click', () => this.cb.onLabelClick?.(id));
    const obj = new CSS2DObject(div);
    obj.position.set(0, 0, 0);
    obj.center.set(-0.15, 0.5); // label sits to the right of the dot
    sprite.add(obj);
    group.add(sprite);
  }

  private drawFixed() {
    this.clear(this.fixed);
    const { route, points } = this.last;

    // Route: resample every 5 m so it hugs the terrain between grid points.
    if (route.length > 1) {
      const pts: number[] = [];
      for (let i = 1; i < route.length; i++) {
        const [x0, y0] = route[i - 1];
        const [x1, y1] = route[i];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5));
        for (let k = 0; k <= n; k++) {
          const v = this.world({ x: x0 + ((x1 - x0) * k) / n, y: y0 + ((y1 - y0) * k) / n }, this.lift(2));
          pts.push(v.x, v.y, v.z);
        }
      }
      const geo = new LineGeometry();
      geo.setPositions(pts);
      this.fixed.add(new Line2(geo, this.lineMaterial(this.fixed, '#7fb3ff', 3)));
    }

    const COLORS: Record<MapPoint['type'], string> = { rover: '#99aadd', target: '#cc99ff', sample: '#66ccff', hazard: '#ff6666' };
    for (const p of points) {
      if (p.type === 'rover') continue;
      const clickable = p.type === 'target' || p.type === 'sample';
      this.marker(this.fixed, p, COLORS[p.type], p.name, clickable ? p.id : null);
    }
  }

  private drawLive() {
    this.clear(this.live);
    const { rings, ringColor, astronauts } = this.last;

    // Safe-return boundary: all rings as one set of line segments.
    if (rings.length > 0) {
      const seg: number[] = [];
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i++) {
          const [ax, ay] = ring[i];
          const [bx, by] = ring[(i + 1) % ring.length];
          const a = this.world({ x: ax, y: ay }, this.lift(3));
          const b = this.world({ x: bx, y: by }, this.lift(3));
          seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      const geo = new LineSegmentsGeometry();
      geo.setPositions(seg);
      this.live.add(new LineSegments2(geo, this.lineMaterial(this.live, ringColor, 2.5)));
    }

    // Rover: label shows distance from EV1, so in eye view you know how far home is.
    const lead = astronauts[0];
    const dist = lead ? Math.hypot(lead.x, lead.y) : 0;
    this.marker(this.live, { x: 0, y: 0 }, '#ffffff', dist > 20 ? `Rover · ${Math.round(dist)} m` : 'Rover', null, 2);

    astronauts.forEach((a, i) => {
      if (this.mode === 'eye' && i === 0) return; // you are EV1 (in explore you're a free observer)
      this.marker(this.live, a, i ? '#ffb347' : '#4fd1ff', `EV${i + 1}`, null, 1);
    });
  }

  // ------------------------------------------------------------ cameras
  setCameraMode(mode: CameraMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    const ground = mode !== 'overview';
    this.controls.enabled = !ground;
    this.camera.near = ground ? 0.3 : 1;
    this.camera.updateProjectionMatrix();
    this.scene.fog = ground ? new THREE.Fog('#c9a07a', 400, 4000) : null; // dusty horizon
    this.scene.background = new THREE.Color(ground ? '#c9a07a' : '#1a1210');
    if (mode === 'explore') {
      // Start exploring from wherever EV1 is, facing the way EV1 was facing.
      this.walk = { pos: { ...this.eye.pos }, heading: this.eyeHeading(), to: null };
    }
    this.eye.yaw = 0;
    this.eye.pitch = -0.08;
    if (mode === 'overview') this.resetOverview();
    this.hud.style.display = ground ? '' : 'none';
    this.drawFixed();
    this.drawLive();
  }

  /** Where EV1 is looking: a point a little further along the route. */
  setEyeAhead(ahead: XY) {
    this.eye.ahead = ahead;
  }

  /** Explore mode: jump to a spot (e.g. clicked on the minimap). */
  walkTo(p: XY) {
    if (this.mode !== 'explore') return;
    this.walk.heading = Math.atan2(p.y - this.walk.pos.y, p.x - this.walk.pos.x);
    this.eye.yaw = 0;
    this.walk.to = p;
  }

  resetOverview() {
    const { route } = this.last;
    const xs = route.length ? route.map((p) => p[0]) : [0];
    const ys = route.length ? route.map((p) => p[1]) : [0];
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const target = this.world({ x: cx, y: cy });
    this.controls.target.copy(target);
    // Look from the south-east, high up, so the channel walls read clearly.
    this.camera.position.set(target.x + 900, target.y + 1100, target.z + 1300);
    this.controls.update();
  }

  private eyeHeading() {
    const { pos, ahead } = this.eye;
    return Math.atan2(ahead.y - pos.y, ahead.x - pos.x) + this.eye.yaw;
  }

  /** Explore mode: glide toward the clicked spot, staying on the ground. */
  private stepWalk() {
    const now = performance.now();
    // Real elapsed time (capped at 0.5 s), so walking speed doesn't depend on frame rate.
    const dt = Math.min(0.5, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const { pos, to } = this.walk;
    if (!to) return;
    const dx = to.x - pos.x;
    const dy = to.y - pos.y;
    const d = Math.hypot(dx, dy);
    const step = EXPLORE_SPEED_M_S * dt;
    if (d <= step) {
      this.walk.pos = { ...to };
      this.walk.to = null;
    } else {
      this.walk.pos = { x: pos.x + (dx / d) * step, y: pos.y + (dy / d) * step };
    }
  }

  /** Where the first-person camera is and which way it faces (eye and explore modes). */
  private viewer(): { pos: XY; heading: number } {
    if (this.mode === 'explore') return { pos: this.walk.pos, heading: this.walk.heading + this.eye.yaw };
    return { pos: this.eye.pos, heading: this.eyeHeading() };
  }

  /** Tell the page where the viewer is (minimap), only when it really changed. */
  private reportViewer() {
    if (!this.cb.onViewer) return;
    let pos: XY;
    let heading: number;
    if (this.mode === 'overview') {
      // Overview: the orbit point on the ground, and the camera's compass direction.
      pos = { x: this.controls.target.x, y: -this.controls.target.z };
      const d = new THREE.Vector3();
      this.camera.getWorldDirection(d);
      heading = Math.atan2(-d.z, d.x);
    } else {
      ({ pos, heading } = this.viewer());
    }
    const bearing = (((90 - (heading * 180) / Math.PI) % 360) + 360) % 360; // math angle -> compass
    const l = this.lastViewer;
    if (Math.hypot(pos.x - l.x, pos.y - l.y) < 0.5 && Math.abs(bearing - l.b) < 1) return;
    this.lastViewer = { x: pos.x, y: pos.y, b: bearing };
    this.cb.onViewer({ pos, bearingDeg: bearing });
  }

  private placeEyeCamera() {
    if (this.mode === 'explore') this.stepWalk();
    const { pos, heading } = this.viewer();
    const eye = this.world(pos, EYE_HEIGHT_M);
    const dir = new THREE.Vector3(Math.cos(heading), Math.tan(this.eye.pitch), -Math.sin(heading));
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.clone().add(dir));

    // Compass: angle between where you're facing and the rover (0 = straight ahead).
    const toRover = Math.atan2(-pos.y, -pos.x);
    const rel = Math.atan2(Math.sin(toRover - heading), Math.cos(toRover - heading)); // -pi..pi, + = left
    const deg = Math.round((rel * 180) / Math.PI);
    const dist = Math.round(Math.hypot(pos.x, pos.y));
    const side = Math.abs(deg) < 10 ? 'ahead' : Math.abs(deg) > 150 ? 'behind' : deg > 0 ? `${deg}° left` : `${-deg}° right`;
    this.hud.innerHTML = `<span class="arrow" style="transform: rotate(${-deg}deg)">↑</span><span>Rover ${dist} m · ${side}</span>`;
  }

  private hoverAt: { x: number; y: number } | null = null;

  /** At most one raycast per frame for the hover readout (raycasting every mousemove is wasteful). */
  private pickHover() {
    if (!this.hoverAt || !this.cb.onHover) return;
    const hit = this.terrainHit(this.hoverAt.x, this.hoverAt.y);
    this.hoverAt = null;
    this.cb.onHover(hit);
  }

  private terrainHit(clientX: number, clientY: number): XY | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObject(this.terrain)[0];
    return hit ? { x: hit.point.x, y: -hit.point.z } : null;
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerleave', () => this.cb.onHover?.(null));
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointermove', (e) => {
      if (!down && this.mode !== 'eye') this.hoverAt = { x: e.clientX, y: e.clientY };
      // Eye and explore views: drag to look around.
      if (!down || this.mode === 'overview') return;
      this.eye.yaw -= (e.movementX || 0) * 0.004;
      this.eye.pitch = Math.max(-1.2, Math.min(0.8, this.eye.pitch - (e.movementY || 0) * 0.004));
    });
    el.addEventListener('pointerup', (e) => {
      const wasClick = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5;
      down = null;
      if (!wasClick) return;
      const hit = this.terrainHit(e.clientX, e.clientY);
      if (!hit) return;
      if (this.mode === 'explore') {
        // Click the ground to walk there; turn to face where you're going.
        this.walk.heading = Math.atan2(hit.y - this.walk.pos.y, hit.x - this.walk.pos.x);
        this.eye.yaw = 0;
        this.walk.to = hit;
      } else if (this.mode === 'overview') {
        this.cb.onTerrainClick?.(hit); // Plan mode adds a waypoint
      }
    });
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.lineMats.forEach((mats) => mats.forEach((m) => m.resolution.set(w, h)));
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.detail?.dispose();
    this.clear(this.fixed);
    this.clear(this.live);
    this.terrain.geometry.dispose();
    this.terrainMat.map?.dispose();
    this.terrainMat.dispose();
    this.dotTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
    this.hud.remove();
  }
}
