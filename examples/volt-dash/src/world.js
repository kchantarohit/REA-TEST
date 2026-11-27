// The highway and its surroundings for the five stage themes: sky dome, sun, ridges,
// scrolling road, recycled scenery chunks (one prop style per theme) and weather
// particles. setTheme() lerps every colour and swaps prop styles over ~2 s.
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { LANE_W } from './track.js';
import { dotTexture, groundTexture, roadTexture, sunTexture, windowsTexture } from './textures.js';

export const FOG_COLOR = '#6b2a72';
const ROAD_W = LANE_W * 3 + 1.0;
const ROAD_LEN = 260;
const CHUNK_LEN = 40;
const CHUNKS = 5;
const SWAP_TIME = 2;
const rand = (a, b) => a + Math.random() * (b - a);

/** Colour sets per theme. road/ground are multiplied over the textures. */
const THEMES = [
  { // Neon City
    top: '#0c0724', mid: '#3a1863', low: '#6b2a72', glow: '#ff8a63', fog: '#6b2a72', hemi: '#a596ff', hemiG: '#2b1036',
    key: '#ffc9a6', road: '#ffffff', ground: '#ffffff', lane: '#45f3ff', edge: '#ff4fd8', ridge: '#2a1142', curb: '#251a45',
    roadE: '#000000', groundE: '#000000', sun: 1, snow: 0, sparks: 0, stars: 0, groundA: 1,
  },
  { // Sunset Canyon
    top: '#2a1035', mid: '#b5452e', low: '#e0773f', glow: '#ffd27a', fog: '#c9683b', hemi: '#ffd2a8', hemiG: '#5a2416',
    key: '#ffe0b0', road: '#ffd2b4', ground: '#ffb48a', lane: '#ffe07a', edge: '#ff6a2e', ridge: '#7c3320', curb: '#7a3a24',
    roadE: '#3a1a10', groundE: '#8a3a18', sun: 1, snow: 0, sparks: 0, stars: 0, groundA: 1,
  },
  { // Frost Line
    top: '#0b2550', mid: '#3d7bb6', low: '#b4dbf4', glow: '#effaff', fog: '#a7d0ec', hemi: '#e6f6ff', hemiG: '#557590',
    key: '#ffffff', road: '#d8ecff', ground: '#ffffff', lane: '#4fd8ff', edge: '#ffffff', ridge: '#8db4d6', curb: '#9ab8d4',
    roadE: '#24364e', groundE: '#b4cde2', sun: 0.35, snow: 1, sparks: 0, stars: 0, groundA: 1,
  },
  { // Storm Foundry
    top: '#040406', mid: '#1b1114', low: '#3a1916', glow: '#8a2a14', fog: '#2b1513', hemi: '#8a6a74', hemiG: '#1a0a0a',
    key: '#ff9a70', road: '#b0a0a0', ground: '#8a6060', lane: '#ff3b30', edge: '#ffb02e', ridge: '#150a0a', curb: '#3a2626',
    roadE: '#0c0606', groundE: '#1a0a08', sun: 0, snow: 0, sparks: 1, stars: 0, groundA: 1,
  },
  { // Cosmic Skyway
    top: '#04021a', mid: '#170d48', low: '#2a1062', glow: '#18c6b8', fog: '#1d0f4a', hemi: '#a090ff', hemiG: '#0a0420',
    key: '#b0f0ff', road: '#b8a8ff', ground: '#40308a', lane: '#2affd5', edge: '#c058ff', ridge: '#120830', curb: '#2a1a66',
    roadE: '#0c0630', groundE: '#000000', sun: 0, snow: 0, sparks: 0, stars: 1, groundA: 0,
  },
];
const COLOR_KEYS = ['top', 'mid', 'low', 'glow', 'fog', 'hemi', 'hemiG', 'key', 'road', 'ground', 'lane', 'edge', 'ridge', 'curb', 'roadE', 'groundE'];
const NUM_KEYS = ['sun', 'snow', 'sparks', 'stars', 'groundA'];
const toState = (t) => ({
  ...Object.fromEntries(COLOR_KEYS.map((k) => [k, new Color(t[k])])),
  ...Object.fromEntries(NUM_KEYS.map((k) => [k, t[k]])),
});

function skyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new Color() },
      mid: { value: new Color() },
      low: { value: new Color() },
      glow: { value: new Color() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 glow;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 c = mix(low, glow, smoothstep(0.0, 0.05, h));
        c = mix(c, mid, smoothstep(0.05, 0.28, h));
        c = mix(c, top, smoothstep(0.28, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** UVs scaled so one window tile covers ~4x8 world units on every wall; roofs stay dark. */
function buildingGeometry(w, h, d) {
  const g = new BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * faces[f][0]) / 4, (uv.getY(i) * faces[f][1]) / 8);
    }
  }
  return g;
}

const DOT = { tex: null };
function particles(count, color, size, attenuate, additive) {
  DOT.tex = DOT.tex || dotTexture();
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new PointsMaterial({ color, size, map: DOT.tex, sizeAttenuation: attenuate, transparent: true, opacity: 0, depthWrite: false, fog: false });
  if (additive) mat.blending = AdditiveBlending;
  const p = new Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

export function createWorld(scene, renderer) {
  const fog = new Fog(FOG_COLOR, 38, 170);
  scene.fog = fog;
  const hemi = new HemisphereLight('#a596ff', '#2b1036', 1.8);
  scene.add(hemi);
  const key = new DirectionalLight('#ffc9a6', 2.1);
  key.position.set(-5, 12, 9);
  scene.add(key);

  const skyMat = skyMaterial();
  const sky = new Mesh(new SphereGeometry(450, 32, 16), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  const sunMat = new MeshBasicMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false });
  const sun = new Mesh(new PlaneGeometry(170, 170), sunMat);
  sun.position.set(0, 30, -420);
  scene.add(sun);

  const ridgeMat = new MeshBasicMaterial({ color: '#2a1142', fog: false });
  const ridgeGeo = new ConeGeometry(1, 1, 5);
  for (let i = 0; i < 16; i++) {
    const h = rand(35, 95);
    const m = new Mesh(ridgeGeo, ridgeMat);
    m.scale.set(rand(40, 80), h, rand(30, 60));
    m.position.set(-380 + i * 50 + rand(-15, 15), h / 2 - 6, rand(-330, -280));
    m.rotation.y = rand(0, Math.PI);
    scene.add(m);
  }

  // Road, ground, glowing lane lines and curbs. Static meshes; the textures scroll.
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const roadTex = roadTexture();
  roadTex.repeat.set(1, ROAD_LEN / 16);
  roadTex.anisotropy = aniso;
  const groundTex = groundTexture();
  groundTex.repeat.set(400 / 8, ROAD_LEN / 8);
  groundTex.anisotropy = aniso;

  const strip = (w, len, mat, x, y, z = 20 - len / 2) => {
    const m = new Mesh(new PlaneGeometry(w, len), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  const roadMat = new MeshLambertMaterial({ map: roadTex });
  const groundMat = new MeshLambertMaterial({ map: groundTex, transparent: true });
  strip(ROAD_W, ROAD_LEN, roadMat, 0, 0);
  const groundMesh = strip(400, ROAD_LEN, groundMat, 0, -0.05);
  const laneMat = new MeshBasicMaterial({ color: '#45f3ff' });
  const edgeMat = new MeshBasicMaterial({ color: '#ff4fd8' });
  const curbMat = new MeshLambertMaterial({ color: '#251a45' });
  for (const x of [-LANE_W / 2, LANE_W / 2]) strip(0.09, ROAD_LEN, laneMat, x, 0.012);
  for (const s of [-1, 1]) {
    strip(0.16, ROAD_LEN, edgeMat, s * (ROAD_W / 2 - 0.12), 0.012);
    const curb = new Mesh(new BoxGeometry(0.4, 0.32, ROAD_LEN), curbMat);
    curb.position.set(s * (ROAD_W / 2 + 0.2), 0.16, 20 - ROAD_LEN / 2);
    scene.add(curb);
    const cap = new Mesh(new BoxGeometry(0.42, 0.05, ROAD_LEN), edgeMat);
    cap.position.set(s * (ROAD_W / 2 + 0.2), 0.34, 20 - ROAD_LEN / 2);
    scene.add(cap);
  }

  // ---------- prop styles (one Group per theme inside every chunk) ----------
  const bMats = ['#45f3ff', '#ff5ad1', '#ffb347'].map(
    (e) => new MeshLambertMaterial({ color: '#1b1636', emissive: e, emissiveMap: windowsTexture() }),
  );
  const M = {
    post: [new MeshBasicMaterial({ color: '#ff4fd8' }), new MeshBasicMaterial({ color: '#45f3ff' })],
    cityRock: new MeshLambertMaterial({ color: '#4b2466', flatShading: true }),
    arch: new MeshLambertMaterial({ color: '#221a3d' }),
    archGlow: new MeshBasicMaterial({ color: '#45f3ff' }),
    sand: [new MeshLambertMaterial({ color: '#c8643a', flatShading: true }), new MeshLambertMaterial({ color: '#a84a2c', flatShading: true })],
    sandCap: new MeshLambertMaterial({ color: '#e89a5a', flatShading: true }),
    pine: new MeshLambertMaterial({ color: '#1f5a5a', flatShading: true }),
    snow: new MeshLambertMaterial({ color: '#ffffff', flatShading: true }),
    ice: new MeshLambertMaterial({ color: '#9fe8ff', emissive: '#2a7fa8', transparent: true, opacity: 0.85, flatShading: true }),
    iceLamp: new MeshBasicMaterial({ color: '#bff4ff' }),
    steel: new MeshLambertMaterial({ color: '#3a3236' }),
    rust: new MeshLambertMaterial({ color: '#5a3328' }),
    warn: new MeshBasicMaterial({ color: '#ff2a1a' }),
    hazard: new MeshBasicMaterial({ color: '#ffb02e' }),
    plat: new MeshLambertMaterial({ color: '#2a1f66', emissive: '#120a40' }),
    platGlow: new MeshBasicMaterial({ color: '#2affd5' }),
    ringGlow: new MeshBasicMaterial({ color: '#c058ff' }),
    asteroid: new MeshLambertMaterial({ color: '#5a4a8a', flatShading: true }),
  };
  const G = {
    post: new BoxGeometry(0.26, 6.5, 0.26).translate(0, 3.25, 0),
    rock: new DodecahedronGeometry(1, 0),
    archPost: new BoxGeometry(0.5, 8, 0.5).translate(0, 4, 0),
    archBeam: new BoxGeometry(ROAD_W + 4, 0.6, 0.6),
    archStrip: new BoxGeometry(ROAD_W + 3.6, 0.1, 0.62),
    pillar: new CylinderGeometry(1, 1.15, 1, 7).translate(0, 0.5, 0),
    cone: new ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
    crystal: new OctahedronGeometry(1, 0),
    stack: new CylinderGeometry(1, 1.2, 1, 10).translate(0, 0.5, 0),
    box: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    lamp: new SphereGeometry(0.35, 10, 8),
    plat: new BoxGeometry(1, 0.5, 1),
    platEdge: new BoxGeometry(1.02, 0.08, 1.02),
    ring: new TorusGeometry(ROAD_W / 2 + 1.6, 0.22, 8, 40),
  };
  const mk = (geo, mat, parent) => {
    const m = new Mesh(geo, mat);
    parent.add(m);
    return m;
  };

  /** Each builder returns {group, layout()} for one chunk. */
  const STYLES = [
    // 0 Neon City: lit towers, neon posts, rocks, light arch.
    (group) => {
      const buildings = [];
      const rocks = [];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const w = rand(3, 6);
          const m = new Mesh(buildingGeometry(w, rand(7, 25), rand(6, 11)), bMats[0]);
          m.userData = { side, k, w };
          group.add(m);
          buildings.push(m);
        }
        for (let k = 0; k < 2; k++) mk(G.post, M.post[k], group).position.set(side * (ROAD_W / 2 + 1.2), 0, -(k * 20 + 6));
        const r = mk(G.rock, M.cityRock, group);
        r.userData = { side };
        rocks.push(r);
      }
      const arch = new Group();
      for (const s of [-1, 1]) mk(G.archPost, M.arch, arch).position.x = s * (ROAD_W / 2 + 1.7);
      mk(G.archBeam, M.arch, arch).position.y = 8;
      mk(G.archStrip, M.archGlow, arch).position.y = 7.68;
      arch.position.z = -16;
      group.add(arch);
      return () => {
        for (const b of buildings) {
          const { side, k, w } = b.userData;
          b.visible = Math.random() < 0.92;
          b.material = bMats[(Math.random() * bMats.length) | 0];
          b.position.set(side * (ROAD_W / 2 + 3 + w / 2 + rand(0, 4)), 0, -(k * 13 + rand(3, 7)));
        }
        for (const r of rocks) {
          r.position.set(r.userData.side * rand(17, 26), -1, -rand(0, CHUNK_LEN));
          r.scale.set(rand(5, 10), rand(4, 13), rand(5, 10));
          r.rotation.y = rand(0, Math.PI);
        }
        arch.visible = Math.random() < 0.3;
      };
    },
    // 1 Sunset Canyon: layered rock pillars, mesas and boulders.
    (group) => {
      const items = [];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const p = new Group();
          const base = mk(G.pillar, M.sand[k % 2], p);
          const cap = mk(G.pillar, M.sandCap, p);
          p.userData = { side, k, base, cap };
          group.add(p);
          items.push(p);
        }
      }
      const boulders = [-1, 1].map((side) => {
        const r = mk(G.rock, M.sand[1], group);
        r.userData = { side };
        return r;
      });
      return () => {
        for (const p of items) {
          const { side, k, base, cap } = p.userData;
          const h = rand(6, 22);
          const r = rand(1.4, 3.2);
          base.scale.set(r, h, r);
          cap.scale.set(r * 1.18, rand(0.8, 1.6), r * 1.18);
          cap.position.y = h;
          p.position.set(side * (ROAD_W / 2 + 3.5 + r + rand(0, 7) + (k % 2) * 6), 0, -(k * 10 + rand(0, 6)));
          p.rotation.y = rand(0, Math.PI);
        }
        for (const r of boulders) {
          r.position.set(r.userData.side * rand(ROAD_W / 2 + 2, 9), 0.2, -rand(0, CHUNK_LEN));
          r.scale.set(rand(0.8, 1.6), rand(0.6, 1.2), rand(0.8, 1.6));
          r.rotation.y = rand(0, Math.PI);
        }
      };
    },
    // 2 Frost Line: snowy pines, ice crystals, lamp posts.
    (group) => {
      const trees = [];
      const crystals = [];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const t = new Group();
          for (let i = 0; i < 3; i++) {
            const c = mk(G.cone, M.pine, t);
            c.scale.set(1.6 - i * 0.4, 2.2, 1.6 - i * 0.4);
            c.position.y = 0.8 + i * 1.3;
            const s = mk(G.cone, M.snow, t);
            s.scale.set(0.9 - i * 0.22, 0.9, 0.9 - i * 0.22);
            s.position.y = 0.8 + i * 1.3 + 1.35;
          }
          t.userData = { side, k };
          group.add(t);
          trees.push(t);
        }
        const c = mk(G.crystal, M.ice, group);
        c.userData = { side };
        crystals.push(c);
        mk(G.post, M.steel, group).position.set(side * (ROAD_W / 2 + 1.2), 0, -12);
        mk(G.lamp, M.iceLamp, group).position.set(side * (ROAD_W / 2 + 1.2), 6.6, -12);
      }
      return () => {
        for (const t of trees) {
          const { side, k } = t.userData;
          const s = rand(0.8, 1.9);
          t.scale.set(s, s, s);
          t.position.set(side * (ROAD_W / 2 + 3 + rand(0, 12)), 0, -(k * 10 + rand(0, 6)));
          t.visible = Math.random() < 0.9;
        }
        for (const c of crystals) {
          c.position.set(c.userData.side * rand(10, 20), 1.5, -rand(0, CHUNK_LEN));
          c.scale.set(rand(1, 2), rand(3, 6), rand(1, 2));
          c.rotation.set(rand(-0.3, 0.3), rand(0, Math.PI), rand(-0.3, 0.3));
        }
      };
    },
    // 3 Storm Foundry: smoke stacks, tanks, warning lights, pipe arch.
    (group) => {
      const stacks = [];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const g = new Group();
          const body = mk(G.stack, k === 1 ? M.rust : M.steel, g);
          const band = mk(G.stack, M.hazard, g);
          const light = mk(G.lamp, M.warn, g);
          g.userData = { side, k, body, band, light };
          group.add(g);
          stacks.push(g);
        }
        const tank = mk(G.box, M.rust, group);
        tank.scale.set(3, 3, 7);
        tank.position.set(side * (ROAD_W / 2 + 4), 0, -28);
        mk(G.post, M.steel, group).position.set(side * (ROAD_W / 2 + 1.2), 0, -6);
        mk(G.lamp, M.warn, group).position.set(side * (ROAD_W / 2 + 1.2), 6.6, -6);
      }
      const arch = new Group();
      for (const s of [-1, 1]) mk(G.archPost, M.steel, arch).position.x = s * (ROAD_W / 2 + 1.7);
      mk(G.archBeam, M.rust, arch).position.y = 8;
      mk(G.archStrip, M.hazard, arch).position.y = 7.68;
      arch.position.z = -20;
      group.add(arch);
      return () => {
        for (const g of stacks) {
          const { side, k, body, band, light } = g.userData;
          const h = rand(10, 26);
          const r = rand(1, 2.2);
          body.scale.set(r, h, r);
          band.scale.set(r * 1.04, 1.2, r * 1.04);
          band.position.y = h - 2.5;
          light.position.y = h + 0.4;
          g.position.set(side * (ROAD_W / 2 + 4 + r + rand(0, 8)), 0, -(k * 13 + rand(2, 7)));
        }
        arch.visible = Math.random() < 0.45;
      };
    },
    // 4 Cosmic Skyway: floating platforms, asteroids, glowing rings over the road.
    (group) => {
      const plats = [];
      const rocks = [];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const p = new Group();
          mk(G.plat, M.plat, p);
          mk(G.platEdge, M.platGlow, p).position.y = 0.25;
          p.userData = { side, k, phase: rand(0, 6) };
          group.add(p);
          plats.push(p);
        }
        const r = mk(G.rock, M.asteroid, group);
        r.userData = { side };
        rocks.push(r);
      }
      const ring = mk(G.ring, M.ringGlow, group);
      ring.position.set(0, 3.2, -18);
      return () => {
        for (const p of plats) {
          const { side, k } = p.userData;
          const w = rand(3, 7);
          p.scale.set(w, 1, rand(3, 7));
          p.position.set(side * (ROAD_W / 2 + 3 + w / 2 + rand(0, 8)), rand(-2, 9), -(k * 13 + rand(0, 6)));
          p.userData.baseY = p.position.y;
        }
        for (const r of rocks) {
          r.position.set(r.userData.side * rand(12, 24), rand(4, 16), -rand(0, CHUNK_LEN));
          r.scale.setScalar(rand(1.2, 3));
        }
        ring.visible = Math.random() < 0.4;
      };
    },
  ];

  const chunks = [];
  for (let i = 0; i < CHUNKS; i++) {
    const root = new Group();
    const styles = STYLES.map((build) => {
      const group = new Group();
      const layout = build(group);
      group.visible = false;
      root.add(group);
      return { group, layout };
    });
    scene.add(root);
    chunks.push({ root, styles, s: 0 });
  }

  // ---------- weather particles ----------
  const quality = { n: 1 };
  const snow = particles(700, '#ffffff', 0.16, true, false);
  const sparks = particles(260, '#ffae42', 0.18, true, true);
  const stars = particles(1400, '#ffffff', 4, true, false); // attenuated: non-attenuated points did not show on SwiftShader
  scene.add(snow, sparks, stars);
  const SNOW_BOX = { x: 30, y: 16, z: 70 };
  {
    const p = snow.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, rand(-SNOW_BOX.x, SNOW_BOX.x), rand(0, SNOW_BOX.y), rand(-SNOW_BOX.z, 8));
    const q = sparks.geometry.attributes.position;
    for (let i = 0; i < q.count; i++) q.setXYZ(i, (Math.random() < 0.5 ? -1 : 1) * rand(ROAD_W / 2 + 2, 16), rand(0, 14), rand(-90, 8));
    const st = stars.geometry.attributes.position;
    for (let i = 0; i < st.count; i++) {
      const u = rand(-0.15, 1);
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(1 - u * u);
      st.setXYZ(i, Math.cos(a) * r * 400, u * 400, Math.sin(a) * r * 400);
    }
  }
  const sparkVel = Float32Array.from({ length: sparks.geometry.attributes.position.count }, () => rand(2, 7));

  // ---------- theme state ----------
  const cur = toState(THEMES[0]);
  let from = toState(THEMES[0]);
  let to = toState(THEMES[0]);
  let blend = 1;
  let style = 0;
  let prevStyle = 0;
  let swapT = SWAP_TIME;
  let time = 0;

  function apply() {
    const k = blend * blend * (3 - 2 * blend);
    for (const key of COLOR_KEYS) cur[key].copy(from[key]).lerp(to[key], k);
    for (const key of NUM_KEYS) cur[key] = from[key] + (to[key] - from[key]) * k;
    skyMat.uniforms.top.value.copy(cur.top);
    skyMat.uniforms.mid.value.copy(cur.mid);
    skyMat.uniforms.low.value.copy(cur.low);
    skyMat.uniforms.glow.value.copy(cur.glow);
    fog.color.copy(cur.fog);
    renderer.setClearColor(cur.fog);
    hemi.color.copy(cur.hemi);
    hemi.groundColor.copy(cur.hemiG);
    key.color.copy(cur.key);
    roadMat.color.copy(cur.road);
    roadMat.emissive.copy(cur.roadE);
    groundMat.color.copy(cur.ground);
    groundMat.emissive.copy(cur.groundE);
    groundMat.opacity = cur.groundA;
    groundMesh.visible = cur.groundA > 0.01;
    laneMat.color.copy(cur.lane);
    edgeMat.color.copy(cur.edge);
    curbMat.color.copy(cur.curb);
    ridgeMat.color.copy(cur.ridge);
    sunMat.opacity = cur.sun;
    sun.visible = cur.sun > 0.01;
    snow.material.opacity = 0.9 * cur.snow;
    snow.visible = cur.snow > 0.01;
    sparks.material.opacity = cur.sparks;
    sparks.visible = cur.sparks > 0.01;
    stars.material.opacity = cur.stars;
    stars.visible = cur.stars > 0.01;
  }
  apply();

  /** Show one prop style per chunk; during a swap the old style sinks and the new one rises. */
  function styleScale(c) {
    const half = SWAP_TIME / 2;
    for (let i = 0; i < c.styles.length; i++) {
      const st = c.styles[i];
      let y = 0;
      if (swapT >= SWAP_TIME) y = i === style ? 1 : 0;
      else if (swapT < half) y = i === prevStyle ? 1 - swapT / half : 0;
      else y = i === style ? (swapT - half) / half : 0;
      st.group.visible = y > 0.001;
      st.group.scale.y = Math.max(0.001, y);
    }
  }

  const layoutChunk = (c) => c.styles.forEach((st) => st.layout());

  return {
    sky,
    /** Lay chunks out fresh around track position d. */
    reset(d) {
      chunks.forEach((c, i) => {
        c.s = d - 20 + i * CHUNK_LEN;
        layoutChunk(c);
        styleScale(c);
      });
    },
    /** Switch to theme index 0..4; instant skips the 2 s blend (run start, debug jumps). */
    setTheme(index, instant = false) {
      const t = THEMES[index % THEMES.length];
      if (instant) {
        from = toState(t);
        to = toState(t);
        blend = 1;
        prevStyle = style = index % THEMES.length;
        swapT = SWAP_TIME;
        apply();
        for (const c of chunks) {
          layoutChunk(c);
          styleScale(c);
        }
        return;
      }
      from = toState(t);
      for (const k of COLOR_KEYS) from[k].copy(cur[k]);
      for (const k of NUM_KEYS) from[k] = cur[k];
      to = toState(t);
      blend = 0;
      prevStyle = style;
      style = index % THEMES.length;
      swapT = prevStyle === style ? SWAP_TIME : 0;
    },
    /** 'low' trims particle counts. */
    setQuality(q) {
      quality.n = q === 'low' ? 0.35 : 1;
      for (const p of [snow, sparks, stars]) p.geometry.setDrawRange(0, Math.floor(p.geometry.attributes.position.count * quality.n));
    },
    update(d, camera, dt) {
      time += dt;
      if (blend < 1) {
        blend = Math.min(1, blend + dt / SWAP_TIME);
        apply();
      }
      if (swapT < SWAP_TIME) swapT = Math.min(SWAP_TIME, swapT + dt);
      roadTex.offset.y = (d / 16) % 1;
      groundTex.offset.y = (d / 8) % 1;
      for (const c of chunks) {
        if (c.s + CHUNK_LEN < d - 20) {
          c.s += CHUNKS * CHUNK_LEN;
          layoutChunk(c);
        }
        c.root.position.z = -(c.s - d);
        styleScale(c);
      }
      if (style === 4 || prevStyle === 4) {
        for (const c of chunks) {
          for (const p of c.styles[4].group.children) {
            if (p.userData.baseY !== undefined) p.position.y = p.userData.baseY + Math.sin(time * 0.8 + p.userData.phase) * 0.6;
          }
        }
      }
      M.warn.color.setRGB(Math.sin(time * 6) > 0 ? 1 : 0.25, 0.08, 0.05);
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      if (snow.visible) {
        const p = snow.geometry.attributes.position;
        const fall = dt * 3.2;
        const drift = d - (snow.userData.d ?? d);
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - fall;
          let z = p.getZ(i) + drift; // road moves towards the camera
          if (y < 0) y += SNOW_BOX.y;
          if (z > 8) z -= SNOW_BOX.z + 8;
          p.setXYZ(i, p.getX(i) + Math.sin(time + i) * dt * 0.6, y, z);
        }
        p.needsUpdate = true;
      }
      snow.userData.d = d;
      if (sparks.visible) {
        const p = sparks.geometry.attributes.position;
        const drift = d - (sparks.userData.d ?? d);
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - sparkVel[i] * dt;
          let z = p.getZ(i) + drift;
          if (y < 0) y = rand(8, 14);
          if (z > 8) z -= 98;
          p.setXYZ(i, p.getX(i), y, z);
        }
        p.needsUpdate = true;
      }
      sparks.userData.d = d;
    },
  };
}
