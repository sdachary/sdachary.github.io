import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld } from '../figure/world.mjs';
import { BOX, CORD_R, DESK, FACE_Y, PANEL, PITCH_X, STRIP } from '../figure/world.mjs';
import { logoFor } from '../logos';
import { glyphFor, GLYPH_PATHS, tint } from '../ui/ServiceIcon';
import type { ManacitraData } from '../types';

// The switchboard as a real object: the same world.mjs layout the SVG plate
// draws, but as meshes you can turn over. World coordinates are (x right, y
// toward the viewer, z up); three.js wants y up, so the mapping is (x, z, y)
// and the board faces the default camera.
//
// The scene is built once from the topology. Health and selection only touch
// materials, so a lamp going dark never rebuilds anything.

export interface ModelApi {
  focus(svcId: string | null): void;
}

interface Props {
  data: ManacitraData | null;
  health: { [id: string]: { online: boolean } | undefined };
  selected: string | null;
  hovered: string | null;
  theme: 'dark' | 'light';
  onSelect?: (svcId: string | null) => void;
  onHover?: (svcId: string | null, x?: number, y?: number) => void;
  onReady?: (api: ModelApi) => void;
}

const PALETTE = {
  dark: {
    page: 0x0b0b0b, desk: 0x171717, panel: 0x1f1f1f, trim: 0x2c2c2c,
    ring: 0x6a6a6a, plug: 0x8a8a8a, cord: 0x3f3f3f, hole: 0x080808,
    lamp: 0xffb454, off: 0x1a1a1a, cordLit: 0xff8c1a, focus: 0x6b9bff,
    screw: 0x444444,
  },
  light: {
    page: 0xececea, desk: 0xd6d6d3, panel: 0xf2f2f0, trim: 0xdad6d0,
    ring: 0xa4a4a8, plug: 0x8f8f94, cord: 0x8a8a8f, hole: 0x1d1d1d,
    lamp: 0xc26a00, off: 0xc9c9cc, cordLit: 0xc26a00, focus: 0x2f6ad0,
    screw: 0xb0b0b4,
  },
} as const;

// --- screen-printed panel faces -------------------------------------------------
// A real patch panel names every port on the metal, so the model prints the
// same mark + name the map puts in a pill — one canvas per face, drawn once at
// build time. The ink scales with the surface like real paint: lean in and it
// sharpens, and unlike a DOM label it can never float through the back of the
// board when you orbit round.
const PPU = 6;                                   // canvas pixels per world unit
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const RING_R = 3.1;                              // jack ring outer radius
const LAMP_TOP = 13.4;                           // lamp centre + 10, radius 3.4
const BOX_H = 32;                                // desk-box face height
const INK = {
  dark: { name: '#a3a3a3', mark: '#7a7a7a' },
  light: { name: '#1d1d1d', mark: '#5f5f63' },
} as const;

interface PrintStation {
  svc: { id: string; name: string; type: string; logo?: string };
  cx: number; zc: number; row?: number; place?: string;
}

// lowest world z the station's own label may reach — clear of the line strip on
// the bottom row, of the row below's lamp on the others, of the desk-box floor.
const labelFloor = (st: PrintStation, rows: number[]) =>
  st.place === 'box' ? BOX.top - BOX_H
    : st.row === 0 ? STRIP.zc + 3.5
      : rows[(st.row as number) - 1] + LAMP_TOP + 1;

// Fit one label's mark + name inside its cell. The WHOLE pair has to fit — the
// mark and the 2.5 gap count too, or a long name plus its logo spills into the
// neighbour's column ("Sadhan" + "Vishwakarma" read as one word). Type shrinks
// first, since a long name stays legible small; the mark only gives way last.
// `measure(fs)` returns the name's width in px at that world-unit size.
export function fitLabel(
  band: number, avail: number, measure: (fs: number) => number,
): { mw: number; fs: number; tw: number } {
  let mw = Math.min(6.4, band * 0.6);                 // mark, world units
  let fs = Math.min(4.2, band * 0.48);                // name, world units
  const room = () => avail - mw * PPU - 2.5 * PPU;
  let tw = measure(fs);
  while (tw > room() && fs > 1.7) { fs -= 0.2; tw = measure(fs); }
  fs = Math.max(1.7, fs);                           // 0.2 steps overshoot the floor
  tw = measure(fs);                                 // re-measure: the clamp changed fs
  while (tw > room() && mw > 2.6) mw -= 0.3;
  return { mw, fs, tw };
}

function drawFace(face: { x0: number; z0: number; w: number; h: number; stations: PrintStation[] }, dark: boolean) {
  const c = document.createElement('canvas');
  c.width = Math.round(face.w * PPU);
  c.height = Math.round(face.h * PPU);
  const g = c.getContext('2d')!;
  const ink = INK[dark ? 'dark' : 'light'];
  const font = (px: number) => `500 ${px}px ${SANS}`;
  const X = (x: number) => (x - face.x0) * PPU;
  const Y = (z: number) => (face.z0 + face.h - z) * PPU;
  const rows = [...new Set(face.stations.map((s) => s.zc))].sort((a, b) => a - b);

  for (const st of face.stations) {
    const top = st.zc - RING_R - 1;                     // below the jack ring
    const band = Math.max(5, top - labelFloor(st, rows));
    const avail = (PITCH_X - 5) * PPU;
    const { mw, fs, tw } = fitLabel(band, avail, (f) => {
      g.font = font(f * PPU);
      return g.measureText(st.svc.name).width;
    });

    // mark and name share one optical line — a pill, like the map's — so the
    // block is only as tall as the taller of the two
    const h = Math.max(mw, fs * 1.2);
    const midZ = top - h / 2;
    const left = st.cx - (mw + 2.5 + tw / PPU) / 2;
    const mx = X(left + mw / 2);
    const my = Y(midZ);
    const def = st.svc.logo ? logoFor(st.svc.logo) : null;
    if (def) {
      const [vx, vy, vw, vh] = def.vb.trim().split(/[\s,]+/).map(Number);
      const s = (mw * PPU) / Math.max(vw, vh);
      g.save();
      g.translate(mx, my);
      g.scale(s, s);
      g.translate(-vx - vw / 2, -vy - vh / 2);
      g.fillStyle = tint(def.color, dark);
      g.fill(new Path2D(def.d));
      g.restore();
    } else {
      const s = (mw * PPU) / 24;
      g.save();
      g.translate(mx, my);
      g.scale(s, s);
      g.translate(-12, -12);
      g.strokeStyle = ink.mark;
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke(new Path2D(GLYPH_PATHS[glyphFor(st.svc)]));
      g.restore();
    }
    g.font = font(fs * PPU);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = ink.name;
    g.fillText(st.svc.name, X(left + mw + 2.5), my);
  }
  return c;
}

const V = (p: number[]) => new THREE.Vector3(p[0], p[2], p[1]);

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a cylinder from a to b — plugs, and the short leads from a jack face to a cord
function between(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 12), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

export default function Model3D({ data, health, selected, hovered, theme, onSelect, onHover, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ paint(s: string | null, h: string | null): void; focus(s: string | null): void }>({
    paint: () => {},
    focus: () => {},
  });

  // --- build once ---------------------------------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !data) return;

    const world = buildWorld(data);
    const pal = PALETTE[theme];

    // everything the effect allocates lands here so the theme/data switch can
    // tear the whole scene down again
    const junk: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(x: T) => { junk.push(x); return x; };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(pal.page);
    scene.fog = new THREE.Fog(pal.page, 700, 1600);

    const camera = new THREE.PerspectiveCamera(38, 1, 1, 3000);
    camera.position.set(175, 215, 470);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = theme === 'light' ? 1.02 : 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft was removed in r186
    host.appendChild(renderer.domElement);

    // a real room's light bouncing round the board: the one thing that stops
    // the dark theme reading as a single black mass. Procedural, so no asset.
    const pmrem = track(new THREE.PMREMGenerator(renderer));
    const env = track(pmrem.fromScene(new RoomEnvironment(), 0.04));
    scene.environment = env.texture;

    const labels = new CSS2DRenderer();
    labels.domElement.className = 'mc-3d-labels';
    labels.domElement.style.position = 'absolute';
    labels.domElement.style.inset = '0';
    labels.domElement.style.pointerEvents = 'none';
    host.appendChild(labels.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 80;
    controls.maxDistance = 900;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.target.set(-4, 62, 6);

    scene.add(new THREE.AmbientLight(0xffffff, theme === 'light' ? 0.62 : 0.34));
    const key = new THREE.DirectionalLight(0xffffff, theme === 'light' ? 1.5 : 1.35);
    key.position.set(190, 260, 230);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 40;
    key.shadow.camera.far = 1400;
    key.shadow.camera.left = -340;
    key.shadow.camera.right = 340;
    key.shadow.camera.top = 340;
    key.shadow.camera.bottom = -340;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 1.2;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, theme === 'light' ? 0.45 : 0.55);
    rim.position.set(-280, 130, -190);
    scene.add(rim);

    const mat = (p: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial({
      // how much of the room the surface picks up — the dark board wants the
      // fill without losing its mood, the light one wants the bounce
      envMapIntensity: theme === 'light' ? 0.5 : 0.4,
      ...p,
    }));
    const geo = <T extends THREE.BufferGeometry>(x: T) => track(x);
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), m);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    };

    const deskMat = mat({ color: pal.desk, roughness: 0.85 });
    const panelMat = mat({ color: pal.panel, roughness: 0.72 });
    const trimMat = mat({ color: pal.trim, roughness: 0.6 });
    const plugMat = mat({ color: pal.plug, roughness: 0.4, metalness: 0.4 });
    const holeMat = mat({ color: pal.hole, roughness: 0.9 });
    const screwMat = mat({ color: pal.screw, roughness: 0.34, metalness: 0.8 });

    // countersunk screws — the small tell that a panel was made rather than drawn
    const screw = (x: number, z: number, faceZ: number) => {
      const s = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.9, 1.9, 1.4, 14)), screwMat);
      s.rotation.x = Math.PI / 2;
      s.position.set(x, z, faceZ + 0.6);
      s.castShadow = true;
      scene.add(s);
    };

    const desk = box(DESK.w, 8, DESK.d, deskMat, DESK.x + DESK.w / 2, 4, DESK.y + DESK.d / 2);
    desk.receiveShadow = true;
    for (const bay of world.bays) {
      const h = PANEL.z1 - PANEL.z0;
      const bx = (bay.x0 + bay.x1) / 2;
      const panel = box(bay.w, h, PANEL.d, panelMat, bx, h / 2, PANEL.y + PANEL.d / 2);
      panel.receiveShadow = true;
      const trim = box(bay.w - 26, 5, 3, trimMat, bx, STRIP.zc, STRIP.faceY - 1.5);
      trim.castShadow = true;
      for (const dx of [6, bay.w - 6]) for (const dz of [PANEL.z0 + 6, PANEL.z1 - 6]) screw(bay.x0 + dx, dz, FACE_Y);
      const label = document.createElement('div');
      label.className = 'mc-3d-tier';
      label.textContent = bay.zone.label || bay.zone.name;
      const tag = new CSS2DObject(label);
      tag.position.set(bx, PANEL.z1 + 10, PANEL.y + PANEL.d / 2);
      scene.add(tag);
    }
    const homeBox = box(BOX.w, BOX_H, BOX.d, panelMat, BOX.x + BOX.w / 2, BOX.top - BOX_H / 2, BOX.y + BOX.d / 2);
    homeBox.receiveShadow = true;
    if (world.box) {
      for (const dx of [4, BOX.w - 4]) for (const dz of [14, 36]) screw(BOX.x + dx, dz, BOX.faceY);
      const label = document.createElement('div');
      label.className = 'mc-3d-tier';
      label.textContent = world.box.zone.label || world.box.zone.name;
      const tag = new CSS2DObject(label);
      tag.position.set(BOX.x + BOX.w / 2, BOX.top + 8, BOX.y + BOX.d / 2);
      scene.add(tag);
    }

    // node -> the face its jacks sit on, and the hole each cord plugs into
    const faceOf = new Map<string, number>();
    for (const st of world.stations) faceOf.set(st.node, st.faceY);
    for (const bay of world.bays) faceOf.set(bay.strip.node, STRIP.faceY);
    const holeOf = (node: string, idx: number) => {
      const st = world.stations.find((s: any) => s.node === node);
      if (st) return st.holes.find((h: any) => h.conn === idx) ?? null;
      const bay = world.bays.find((b: any) => b.strip.node === node);
      return bay ? bay.strip.holes.find((h: any) => h.conn === idx) ?? null : null;
    };

    const glowTex = track(glowTexture());
    const pickMat = mat({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const pickable: THREE.Object3D[] = [];
    const lamps = new Map<string, THREE.MeshStandardMaterial>();
    const glows = new Map<string, THREE.Sprite>();
    const rings = new Map<string, THREE.MeshStandardMaterial>();
    const cords: Record<string, THREE.Mesh[]> = {};

    for (const st of world.stations) {
      const id = st.svc.id;

      const lamp = mat({ color: pal.off, roughness: 0.4 });
      const lampMesh = new THREE.Mesh(geo(new THREE.CylinderGeometry(3.4, 3.4, 2.2, 24)), lamp);
      lampMesh.rotation.x = Math.PI / 2;
      lampMesh.position.set(st.cx, st.zc + 10, st.faceY + 1.1);
      lampMesh.castShadow = true;
      scene.add(lampMesh);
      lamps.set(id, lamp);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: pal.lamp, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(26);
      glow.position.copy(lampMesh.position);
      scene.add(glow);
      glows.set(id, glow);

      const ring = mat({ color: pal.ring, roughness: 0.35, metalness: 0.55 });
      const ringMesh = new THREE.Mesh(geo(new THREE.TorusGeometry(2.4, 0.7, 8, 20)), ring);
      ringMesh.position.set(st.cx, st.zc, st.faceY + 0.9);
      ringMesh.castShadow = true;
      scene.add(ringMesh);
      rings.set(id, ring);

      const hole = new THREE.Mesh(geo(new THREE.CircleGeometry(2, 18)), holeMat);
      hole.position.set(st.cx, st.zc, st.faceY + 0.2);
      scene.add(hole);

      const hit = new THREE.Mesh(geo(new THREE.SphereGeometry(6.5, 8, 6)), pickMat);
      hit.position.set(st.cx, st.zc + 5, st.faceY + 1);
      hit.userData.svc = id;
      scene.add(hit);
      pickable.push(hit);
    }

    // screen-print the mark + name onto every face, exactly as the map lays a
    // service out in its pill: brand logo (or type glyph) over the real name
    const printOn = (x0: number, z0: number, w: number, h: number, stations: PrintStation[], faceZ: number) => {
      const tex = track(new THREE.CanvasTexture(drawFace({ x0, z0, w, h, stations }, theme === 'dark')));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const mesh = new THREE.Mesh(
        geo(new THREE.PlaneGeometry(w, h)),
        mat({ map: tex, transparent: true, depthWrite: false, roughness: 1, metalness: 0 }),
      );
      mesh.position.set(x0 + w / 2, z0 + h / 2, faceZ);
      mesh.receiveShadow = true;
      scene.add(mesh);
    };
    for (const bay of world.bays) {
      printOn(bay.x0, PANEL.z0, bay.w, PANEL.z1 - PANEL.z0, bay.stations, FACE_Y + 0.15);
    }
    if (world.box) {
      printOn(BOX.x, BOX.top - BOX_H, BOX.w, BOX_H, world.box.stations, BOX.faceY + 0.15);
    }

    // cords along the real routes, with a plug lead from each jack face
    for (const c of world.conns) {
      const curve = new THREE.CatmullRomCurve3(c.route.map(V), false, 'catmullrom', 0.4);
      const tube = new THREE.Mesh(geo(new THREE.TubeGeometry(curve, Math.max(32, c.route.length * 10), CORD_R, 8, false)), mat({ color: pal.cord, roughness: 0.85 }));
      tube.castShadow = true;
      scene.add(tube);
      for (const node of [c.a, c.b]) {
        const id = node.startsWith('svc:') ? node.slice(4) : null;
        if (id) (cords[id] ||= []).push(tube);
      }
      for (const [node, end] of [[c.a, c.endA], [c.b, c.endB]] as const) {
        const hole = holeOf(node, c.idx);
        const face = faceOf.get(node);
        if (!hole || face === undefined) continue;
        const plug = between(V([hole.x, face, hole.z]), V(end), 1.7, plugMat);
        plug.castShadow = true;
        scene.add(plug);
      }
    }

    // --- painting: health + hover ring + selected route -------------------------
    const paint = (sel: string | null, hov: string | null) => {
      for (const st of world.stations) {
        const id = st.svc.id;
        const on = !!health[id]?.online;
        const lamp = lamps.get(id)!;
        lamp.color.set(on ? pal.lamp : pal.off);
        lamp.emissive.set(on ? pal.lamp : 0x000000);
        lamp.emissiveIntensity = on ? 1.7 : 0;
        (glows.get(id)!.material as THREE.SpriteMaterial).opacity = on ? 0.55 : 0;

        rings.get(id)!.color.set(id === sel ? pal.lamp : id === hov ? pal.focus : pal.ring);
        for (const mesh of cords[id] || []) {
          const m = mesh.material as THREE.MeshStandardMaterial;
          const lit = id === sel;
          m.color.set(lit ? pal.cordLit : pal.cord);
          m.emissive.set(lit ? pal.cordLit : 0x000000);
          m.emissiveIntensity = lit ? 0.85 : 0;
        }
      }
    };

    // --- picking -----------------------------------------------------------------
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    let dragged = false;

    const pickAt = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(pickable, false)[0];
      return hit ? (hit.object.userData.svc as string) : null;
    };

    const onMove = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) dragged = true;
      if (down || !onHover) return;
      const id = pickAt(e);
      renderer.domElement.style.cursor = id ? 'pointer' : '';
      onHover(id, e.clientX, e.clientY);
    };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; dragged = false; };
    const onUp = (e: PointerEvent) => {
      const wasDrag = dragged;
      down = null;
      dragged = false;
      if (!wasDrag) onSelect?.(pickAt(e) ?? null);
    };
    const onLeave = () => onHover?.(null, 0, 0);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    // --- loop, resize, focus ------------------------------------------------------
    const target = new THREE.Vector3(-4, 62, 6);
    const camTo = new THREE.Vector3();
    const want = { on: false };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // render on demand: damping, focus glides and resizes set `dirty`; an idle
    // board costs nothing instead of a permanent full-rate WebGL loop
    let dirty = true;
    controls.addEventListener('change', () => { dirty = true; });
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (want.on) {
        if (reduced.matches || (controls.target.distanceTo(target) < 0.6 && camera.position.distanceTo(camTo) < 1)) {
          controls.target.copy(target);
          camera.position.copy(camTo);
          want.on = false;
        } else {
          controls.target.lerp(target, 0.14);
          camera.position.lerp(camTo, 0.14);
        }
        dirty = true;
      }
      if (!dirty) return;
      dirty = false;
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };

    const resize = () => {
      dirty = true;
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    tick();

    apiRef.current = {
      paint: (sel: string | null, hov: string | null) => { paint(sel, hov); dirty = true; },
      focus(svcId) {
        const st = svcId ? world.stations.find((s: any) => s.svc.id === svcId) : null;
        if (!st) return;
        target.set(st.cx, st.zc + 4, st.faceY + 14);
        // keep looking the same way, just come closer along the current angle
        const dir = camera.position.clone().sub(controls.target).normalize();
        camTo.copy(target).addScaledVector(dir, 300);
        want.on = true;
      },
    };
    paint(selected, hovered);
    onReady?.(apiRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      for (const item of junk) item.dispose();
      controls.dispose();
      renderer.dispose();
      labels.domElement.remove();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme]);

  // --- live state touches materials only -----------------------------------------
  useEffect(() => { apiRef.current.paint(selected, hovered); }, [selected, hovered, health]);

  return <div ref={hostRef} className="mc-3d" role="img" aria-label="3D model of the AcharyLab switchboard: drag to turn, scroll to zoom" />;
}
