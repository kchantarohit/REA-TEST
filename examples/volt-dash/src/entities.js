// Spawns rows from the pattern generator and owns the pooled meshes for obstacles,
// volt cells (one InstancedMesh) and power-up tokens. Positions live in track space
// (s = distance along the road); render z = -(s - d), with the hero fixed at z = 0.
import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import {
  BARRIER_D,
  BARRIER_H,
  GATE_BOTTOM,
  GATE_D,
  POD_H,
  POD_LEN,
  RAMP_LEN,
  START_S,
  createGenerator,
  laneX,
  podFront,
} from './track.js';
import { panelTexture, stripeTexture } from './textures.js';

const SPAWN_AHEAD = 165;
const KEEP_BEHIND = 12;
const MAX_CELLS = 320;
export const POWER_COLORS = { magnet: '#ff3d6e', spring: '#4dff88', shield: '#4dc3ff', x2: '#ffb02e' };

/**
 * @typedef {import('./track.js').Obstacle & {mesh: Group}} LiveObstacle
 * @typedef {{s: number, x: number, y: number, pulled: boolean, px: number, py: number, pz: number}} LiveCell
 * @typedef {import('./track.js').PowerSpec & {mesh: Group}} LivePower
 */

function rampGeometry() {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(RAMP_LEN, 0);
  shape.lineTo(0, POD_H);
  shape.lineTo(0, 0);
  const g = new ExtrudeGeometry(shape, { depth: 1.9, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); // shape x -> +z (towards the camera), extrusion -> -x
  g.translate(0.95, 0, 0);
  return g;
}

export function createEntities(scene) {
  const metal = new MeshLambertMaterial({ color: '#2b2643' });
  const barTex = stripeTexture('#ff8a2b', '#1c1430');
  const barMat = new MeshLambertMaterial({ map: barTex, emissive: '#ffffff', emissiveMap: barTex, emissiveIntensity: 0.4 });
  const gateTex = stripeTexture('#ff3d6e', '#1c1430');
  const gateMat = new MeshLambertMaterial({ map: gateTex, emissive: '#ffffff', emissiveMap: gateTex, emissiveIntensity: 0.45 });
  const gateGlow = new MeshBasicMaterial({ color: '#ff6aa8' });
  const podTex = panelTexture();
  const podMats = ['#1fb8a9', '#7b5cff', '#ff9f2e'].map((c) => new MeshLambertMaterial({ color: c, map: podTex }));
  const trimMat = new MeshBasicMaterial({ color: '#c8fbff' });
  const lampMat = new MeshBasicMaterial({ color: '#fff3c4' });
  const rampMat = new MeshLambertMaterial({ color: '#34305a' });
  const chevMat = new MeshBasicMaterial({ color: '#45f3ff' });

  // Every obstacle mesh has its front face at local z = 0 and extends towards -z.
  const geo = {
    bar: new BoxGeometry(2.0, 0.34, BARRIER_D).translate(0, BARRIER_H - 0.17, -BARRIER_D / 2),
    barLeg: new BoxGeometry(0.14, BARRIER_H - 0.3, 0.14).translate(0, (BARRIER_H - 0.3) / 2, -BARRIER_D / 2),
    gatePost: new BoxGeometry(0.16, 2.7, 0.16).translate(0, 1.35, -GATE_D / 2),
    gatePanel: new BoxGeometry(2.0, 1.0, GATE_D).translate(0, GATE_BOTTOM + 0.56, -GATE_D / 2),
    gateEdge: new BoxGeometry(2.0, 0.08, GATE_D + 0.04).translate(0, GATE_BOTTOM + 0.04, -GATE_D / 2),
    gateCap: new BoxGeometry(2.3, 0.14, 0.3).translate(0, 2.72, -GATE_D / 2),
    podBody: new BoxGeometry(1.9, POD_H, POD_LEN).translate(0, POD_H / 2, -POD_LEN / 2),
    podTrim: new BoxGeometry(0.07, 0.07, POD_LEN).translate(0, POD_H, -POD_LEN / 2),
    podLamp: new BoxGeometry(1.4, 0.14, 0.05).translate(0, 0.45, 0.02),
    ramp: rampGeometry(),
    chevron: new BoxGeometry(1.6, 0.04, 0.22),
    ring: new TorusGeometry(0.5, 0.06, 8, 28),
  };

  function build(kind) {
    const g = new Group();
    const add = (geometry, material, x = 0) => {
      const m = new Mesh(geometry, material);
      m.position.x = x;
      g.add(m);
      return m;
    };
    if (kind === 'barrier') {
      add(geo.bar, barMat);
      add(geo.barLeg, metal, -0.8);
      add(geo.barLeg, metal, 0.8);
    } else if (kind === 'gate') {
      add(geo.gatePost, metal, -1.02);
      add(geo.gatePost, metal, 1.02);
      add(geo.gatePanel, gateMat);
      add(geo.gateEdge, gateGlow);
      add(geo.gateCap, metal);
    } else {
      g.userData.body = add(geo.podBody, podMats[0]);
      add(geo.podTrim, trimMat, -0.95);
      add(geo.podTrim, trimMat, 0.95);
      add(geo.podLamp, lampMat);
      const ramp = new Group();
      ramp.add(new Mesh(geo.ramp, rampMat));
      const slope = Math.atan2(POD_H, RAMP_LEN);
      for (const u of [1.2, 2.8, 4.4]) {
        const c = new Mesh(geo.chevron, chevMat);
        c.position.set(0, POD_H * (1 - u / RAMP_LEN) + 0.03, u);
        c.rotation.x = slope;
        ramp.add(c);
      }
      g.add(ramp);
      g.userData.ramp = ramp;
    }
    scene.add(g);
    return g;
  }

  function buildPower(kind) {
    const g = new Group();
    const color = POWER_COLORS[kind];
    g.add(new Mesh(geo.ring, new MeshBasicMaterial({ color })));
    const core = new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.55, flatShading: true });
    if (kind === 'magnet') {
      const u = new Mesh(new TorusGeometry(0.2, 0.08, 8, 16, Math.PI), core);
      u.rotation.z = Math.PI;
      g.add(u);
    } else if (kind === 'spring') {
      for (let i = 0; i < 3; i++) {
        const coil = new Mesh(new TorusGeometry(0.16, 0.04, 6, 16), core);
        coil.rotation.x = Math.PI / 2;
        coil.position.y = -0.14 + i * 0.14;
        g.add(coil);
      }
      g.add(new Mesh(new CylinderGeometry(0.03, 0.03, 0.4, 6), core));
    } else if (kind === 'shield') {
      g.add(new Mesh(new IcosahedronGeometry(0.26, 0), core));
    } else {
      const ball = new SphereGeometry(0.13, 12, 8);
      for (const x of [-0.14, 0.14]) {
        const b = new Mesh(ball, core);
        b.position.x = x;
        g.add(b);
      }
    }
    scene.add(g);
    return g;
  }

  const cellMesh = new InstancedMesh(
    new OctahedronGeometry(0.3, 0).scale(1, 1.4, 1),
    new MeshLambertMaterial({ color: '#ffe066', emissive: '#d99a00', flatShading: true }),
    MAX_CELLS,
  );
  cellMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  cellMesh.frustumCulled = false; // instances move every frame; bounds would go stale
  cellMesh.count = 0;
  scene.add(cellMesh);

  const pools = { barrier: [], gate: [], pod: [], magnet: [], spring: [], shield: [], x2: [] };
  /** @type {LiveObstacle[]} */
  const obstacles = [];
  /** @type {LiveCell[]} */
  const cells = [];
  /** @type {LivePower[]} */
  const powers = [];
  let gen = null;
  let nextS = START_S;

  function acquire(key) {
    const m = pools[key].pop() || (key in POWER_COLORS ? buildPower(key) : build(key));
    m.visible = true;
    return m;
  }
  function release(key, mesh) {
    mesh.visible = false;
    pools[key].push(mesh);
  }

  function spawnRow(row) {
    for (const ob of row.obstacles) {
      const mesh = acquire(ob.kind);
      if (ob.kind === 'pod') {
        mesh.userData.ramp.visible = ob.ramp;
        mesh.userData.body.material = podMats[(Math.floor(ob.s) + ob.lane) % podMats.length];
      }
      obstacles.push({ ...ob, mesh });
    }
    for (const c of row.cells) {
      if (cells.length >= MAX_CELLS) break;
      cells.push({ s: c.s, x: laneX(c.lane), y: c.y, pulled: false, px: 0, py: 0, pz: 0 });
    }
    if (row.power) powers.push({ ...row.power, mesh: acquire(row.power.kind) });
  }

  function clear() {
    for (const ob of obstacles) release(ob.kind, ob.mesh);
    for (const p of powers) release(p.kind, p.mesh);
    obstacles.length = 0;
    powers.length = 0;
    cells.length = 0;
    cellMesh.count = 0;
    gen = null;
  }

  function removeCell(i) {
    cells[i] = cells[cells.length - 1];
    cells.pop();
  }
  function removePower(i) {
    release(powers[i].kind, powers[i].mesh);
    powers[i] = powers[powers.length - 1];
    powers.pop();
  }

  const m4 = new Matrix4();

  return {
    obstacles,
    cells,
    powers,
    clear,
    /** Start a fresh run with a seeded generator. */
    reset(seed) {
      clear();
      gen = createGenerator(seed);
      nextS = START_S;
    },
    /** Generate rows up to the spawn horizon and recycle everything behind the hero. */
    spawn(d, difficulty) {
      if (!gen) return;
      while (nextS < d + SPAWN_AHEAD) {
        const row = gen.next(nextS, difficulty);
        spawnRow(row);
        nextS = row.nextS;
      }
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        if (ob.s + ob.len > d - KEEP_BEHIND) continue;
        release(ob.kind, ob.mesh);
        obstacles[i] = obstacles[obstacles.length - 1];
        obstacles.pop();
      }
      for (let i = cells.length - 1; i >= 0; i--) {
        if (!cells[i].pulled && cells[i].s < d - 4) removeCell(i);
      }
      for (let i = powers.length - 1; i >= 0; i--) {
        if (powers[i].s < d - 4) removePower(i);
      }
    },
    removeCell,
    removePower,
    /** Place meshes for the current track position. */
    sync(d, time) {
      for (const ob of obstacles) {
        ob.mesh.position.set(laneX(ob.lane), 0, -((ob.kind === 'pod' ? podFront(ob) : ob.s) - d));
      }
      let n = 0;
      for (const c of cells) {
        m4.makeRotationY(time * 3 + c.s * 0.35);
        if (c.pulled) m4.setPosition(c.px, c.py, c.pz);
        else m4.setPosition(c.x, c.y + Math.sin(time * 4 + c.s) * 0.08, -(c.s - d));
        cellMesh.setMatrixAt(n++, m4);
      }
      cellMesh.count = n;
      cellMesh.instanceMatrix.needsUpdate = true;
      for (const p of powers) {
        p.mesh.position.set(laneX(p.lane), p.y + Math.sin(time * 3) * 0.15, -(p.s - d));
        p.mesh.rotation.y = time * 2.2;
      }
    },
  };
}
