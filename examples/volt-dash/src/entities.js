// Spawns rows from the pattern generator and owns the pooled meshes for obstacles,
// Sparks (one InstancedMesh), gems, power-up tokens and daily-word letter tokens. Positions live in track space
// (s = distance along the road); render z = -(s - d), with the hero fixed at z = 0.
import {
  AdditiveBlending,
  DoubleSide,
  BoxGeometry,
  ConeGeometry,
  DodecahedronGeometry,
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
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import {
  BARRIER_D,
  BARRIER_H,
  GAP_LEN,
  GATE_BOTTOM,
  GATE_D,
  LANE_W,
  LASER_D,
  POD_H,
  POD_LEN,
  RAMP_LEN,
  ROLLER_LEN,
  SLIDER_H,
  SLIDER_LEN,
  START_S,
  TELEGRAPH,
  createGenerator,
  laneX,
  laserOn,
  podFront,
  rollerS,
  sliderProgress,
  sliderX,
} from './track.js';
import { gapTexture, letterTexture, panelTexture, stripeTexture } from './textures.js';

const SPAWN_AHEAD = 165;
const KEEP_BEHIND = 12;
const MAX_CELLS = 320;
export const POWER_COLORS = { magnet: '#ff3d6e', spring: '#4dff88', shield: '#4dc3ff', x2: '#ffb02e', hyper: '#b36bff' };

/**
 * @typedef {import('./track.js').Obstacle & {mesh: Group}} LiveObstacle
 * @typedef {{s: number, x: number, y: number, pulled: boolean, px: number, py: number, pz: number}} LiveCell
 * @typedef {import('./track.js').PowerSpec & {mesh: Group}} LivePower
 * @typedef {import('./track.js').CellSpec & {mesh: Group}} LiveGem
 * @typedef {import('./track.js').CellSpec & {mesh: Group, ch: string}} LiveLetter
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
  const rockMat = new MeshLambertMaterial({ color: '#b5643a', flatShading: true });
  const magmaMat = new MeshBasicMaterial({ color: '#ffb347' });
  const sledTex = stripeTexture('#45f3ff', '#20344f');
  const sledMat = new MeshLambertMaterial({ color: '#d7ecff', map: panelTexture() });
  const sledBand = new MeshLambertMaterial({ map: sledTex, emissive: '#ffffff', emissiveMap: sledTex, emissiveIntensity: 0.5 });
  const warnMat = new MeshBasicMaterial({ color: '#ffe14d', transparent: true, depthWrite: false });
  const beamMat = new MeshBasicMaterial({ color: '#ff2a4a', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const idleBeamMat = new MeshBasicMaterial({ color: '#3dff8a', transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false });
  const laserPostMat = new MeshLambertMaterial({ color: '#6a6488', emissive: '#1a1630' });
  const gapMat = new MeshBasicMaterial({ map: gapTexture(), color: '#ffffff' });
  const gapEdge = new MeshBasicMaterial({ color: '#ff9f2e' });

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
    rock: new DodecahedronGeometry(ROLLER_LEN / 2, 0),
    rockBand: new TorusGeometry(ROLLER_LEN / 2 + 0.02, 0.09, 6, 24),
    sled: new BoxGeometry(1.9, SLIDER_H - 0.35, SLIDER_LEN).translate(0, 0.35 + (SLIDER_H - 0.35) / 2, -SLIDER_LEN / 2),
    sledBand: new BoxGeometry(1.94, 0.3, SLIDER_LEN + 0.04).translate(0, 1.2, -SLIDER_LEN / 2),
    sledSkid: new BoxGeometry(1.5, 0.12, SLIDER_LEN - 0.6).translate(0, 0.2, -SLIDER_LEN / 2),
    arrowHead: new ConeGeometry(0.55, 0.8, 3).rotateZ(-Math.PI / 2),
    arrowTail: new BoxGeometry(0.8, 0.28, 0.12),
    floorArrow: new ConeGeometry(0.75, 1.2, 3).rotateX(-Math.PI / 2).scale(1, 0.05, 1),
    laserPost: new BoxGeometry(0.26, 3.2, 0.26).translate(0, 1.6, -LASER_D / 2),
    laserHead: new BoxGeometry(0.44, 0.44, 0.44).translate(0, 3.3, -LASER_D / 2),
    laserFloor: new BoxGeometry(LANE_W - 0.3, 0.04, 0.5).translate(0, 0.02, -LASER_D / 2),
    beam: new BoxGeometry(LANE_W - 0.3, 0.11, 0.11),
    gap: new PlaneGeometry(LANE_W + 0.1, GAP_LEN).rotateX(-Math.PI / 2).translate(0, 0.02, -GAP_LEN / 2),
    gapEdge: new BoxGeometry(LANE_W + 0.1, 0.08, 0.26),
    gem: new OctahedronGeometry(0.34, 0).scale(1, 1.25, 1),
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
    } else if (kind === 'roller') {
      const spinner = new Group();
      spinner.position.y = ROLLER_LEN / 2;
      spinner.position.z = -ROLLER_LEN / 2;
      spinner.add(new Mesh(geo.rock, rockMat));
      const band = new Mesh(geo.rockBand, magmaMat);
      band.rotation.y = Math.PI / 2;
      spinner.add(band);
      const band2 = new Mesh(geo.rockBand, magmaMat);
      band2.rotation.x = Math.PI / 2;
      band2.scale.setScalar(0.98);
      spinner.add(band2);
      g.add(spinner);
      g.userData.spinner = spinner;
    } else if (kind === 'slider') {
      const body = new Group();
      body.add(new Mesh(geo.sled, sledMat), new Mesh(geo.sledBand, sledBand), new Mesh(geo.sledSkid, chevMat));
      const arrow = new Group();
      const head = new Mesh(geo.arrowHead, warnMat);
      head.position.x = 0.5;
      const tail = new Mesh(geo.arrowTail, warnMat);
      tail.position.x = -0.2;
      arrow.add(head, tail);
      arrow.position.set(0, SLIDER_H + 0.75, -SLIDER_LEN / 2);
      body.add(arrow);
      g.add(body);
      const marker = new Mesh(geo.floorArrow, warnMat); // ghost arrow on the target lane
      marker.position.y = 0.03;
      g.add(marker);
      Object.assign(g.userData, { body, arrow, marker });
    } else if (kind === 'laser') {
      add(geo.laserPost, laserPostMat, -LANE_W / 2 + 0.15);
      add(geo.laserPost, laserPostMat, LANE_W / 2 - 0.15);
      const headMat = new MeshBasicMaterial({ color: '#ff2a4a' });
      add(geo.laserHead, headMat, -LANE_W / 2 + 0.15);
      add(geo.laserHead, headMat, LANE_W / 2 - 0.15);
      add(geo.laserFloor, headMat);
      const beams = [];
      for (let i = 0; i < 6; i++) {
        const b = add(geo.beam, beamMat);
        b.position.set(0, 0.3 + i * 0.5, -LASER_D / 2);
        beams.push(b);
      }
      Object.assign(g.userData, { beams, headMat });
    } else if (kind === 'gap') {
      add(geo.gap, gapMat);
      const front = add(geo.gapEdge, gapEdge);
      front.position.y = 0.03;
      const back = add(geo.gapEdge, gapEdge);
      back.position.set(0, 0.03, -GAP_LEN);
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
    } else if (kind === 'hyper') {
      for (const z of [-0.12, 0.14]) {
        const c = new Mesh(new ConeGeometry(0.22, 0.3, 3), core);
        c.rotation.z = -Math.PI / 2;
        c.position.x = z;
        g.add(c);
      }
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

  const gemMat = new MeshLambertMaterial({ color: '#ff4fd8', emissive: '#a0168a', flatShading: true });
  const gemRing = new MeshBasicMaterial({ color: '#ffd1f5' });
  function buildGem() {
    const g = new Group();
    g.add(new Mesh(geo.gem, gemMat));
    const r = new Mesh(geo.ring, gemRing);
    r.scale.setScalar(0.9);
    g.add(r);
    scene.add(g);
    return g;
  }

  const letterTex = {};
  const letterRim = new MeshLambertMaterial({ color: '#ff4f7b', emissive: '#5a0f2a' });
  function buildLetter() {
    const g = new Group();
    const face = new Mesh(new PlaneGeometry(0.9, 0.9), new MeshBasicMaterial({ transparent: true, side: DoubleSide, depthWrite: false }));
    g.add(face);
    const rim = new Mesh(new TorusGeometry(0.44, 0.05, 6, 24), letterRim);
    g.add(rim);
    g.userData.face = face;
    scene.add(g);
    return g;
  }

  const pools = { barrier: [], gate: [], pod: [], roller: [], slider: [], laser: [], gap: [], magnet: [], spring: [], shield: [], x2: [], hyper: [], gem: [], letter: [] };
  /** @type {LiveObstacle[]} */
  const obstacles = [];
  /** @type {LiveCell[]} */
  const cells = [];
  /** @type {LivePower[]} */
  const powers = [];
  /** @type {LiveGem[]} */
  const gems = [];
  /** @type {LiveLetter[]} */
  const letters = [];
  /** Returns the letter the player still needs, or null; set by main.js. */
  let letterFor = () => null;
  let gen = null;
  let nextS = START_S;

  function acquire(key) {
    const m = pools[key].pop() || (key === 'gem' ? buildGem() : key === 'letter' ? buildLetter() : key in POWER_COLORS ? buildPower(key) : build(key));
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
      obstacles.push({ ...ob, mesh, done: false });
    }
    for (const c of row.cells) {
      if (cells.length >= MAX_CELLS) break;
      cells.push({ s: c.s, x: laneX(c.lane), y: c.y, pulled: false, px: 0, py: 0, pz: 0 });
    }
    if (row.power) powers.push({ ...row.power, mesh: acquire(row.power.kind) });
    if (row.gem) gems.push({ ...row.gem, mesh: acquire('gem') });
    const ch = row.letter && !letters.length ? letterFor() : null;
    if (ch) {
      const mesh = acquire('letter');
      const face = mesh.userData.face;
      face.material.map = letterTex[ch] || (letterTex[ch] = letterTexture(ch));
      face.material.needsUpdate = true;
      letters.push({ ...row.letter, ch, mesh });
    }
  }

  function clear() {
    for (const ob of obstacles) release(ob.kind, ob.mesh);
    for (const p of powers) release(p.kind, p.mesh);
    for (const g of gems) release('gem', g.mesh);
    for (const l of letters) release('letter', l.mesh);
    letters.length = 0;
    obstacles.length = 0;
    powers.length = 0;
    gems.length = 0;
    cells.length = 0;
    cellMesh.count = 0;
    gen = null;
  }

  function removeCell(i) {
    cells[i] = cells[cells.length - 1];
    cells.pop();
  }
  function removeGem(i) {
    release('gem', gems[i].mesh);
    gems[i] = gems[gems.length - 1];
    gems.pop();
  }
  function removeLetter(i) {
    release('letter', letters[i].mesh);
    letters.splice(i, 1);
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
    gems,
    letters,
    clear,
    /** @param {() => string|null} fn */
    setLetterSource(fn) {
      letterFor = fn;
    },
    /** Start a fresh run with a seeded generator; the first row sits `lead` metres after d0. */
    reset(seed, d0 = 0, lead = START_S) {
      clear();
      gen = createGenerator(seed);
      nextS = d0 + lead;
    },
    /** Drop every obstacle in [from, to] (used when reviving). */
    clearAhead(from, to) {
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        if (ob.s + ob.len < from || ob.s > to) continue;
        release(ob.kind, ob.mesh);
        obstacles[i] = obstacles[obstacles.length - 1];
        obstacles.pop();
      }
    },
    /** Generate rows up to the spawn horizon and recycle everything behind the hero. */
    spawn(d) {
      if (!gen) return;
      while (nextS < d + SPAWN_AHEAD) {
        const row = gen.next(nextS);
        spawnRow(row);
        nextS = row.nextS;
      }
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        const back = ob.kind === 'roller' ? rollerS(ob, d) + ob.len : ob.s + ob.len;
        if (back > d - KEEP_BEHIND) continue;
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
      for (let i = gems.length - 1; i >= 0; i--) {
        if (gems[i].s < d - 4) removeGem(i);
      }
      for (let i = letters.length - 1; i >= 0; i--) {
        if (letters[i].s < d - 4) removeLetter(i);
      }
    },
    removeCell,
    removeLetter,
    removeGem,
    removePower,
    /** Place meshes for the current track position. */
    sync(d, time) {
      const flash = Math.floor(time * 8) % 2 === 0;
      for (const ob of obstacles) {
        const u = ob.mesh.userData;
        if (ob.kind === 'roller') {
          const rs = rollerS(ob, d);
          ob.mesh.position.set(laneX(ob.lane), 0, -(rs - d));
          u.spinner.rotation.x = -rs / (ROLLER_LEN / 2); // roll towards the camera
          continue;
        }
        if (ob.kind === 'slider') {
          ob.mesh.position.set(laneX(ob.lane), 0, -(ob.s - d));
          const p = sliderProgress(ob, d);
          const ahead = ob.s - d;
          u.body.position.x = sliderX(ob, d) - laneX(ob.lane);
          u.body.position.y = 0.08 * Math.sin(time * 5 + ob.s);
          const dir = Math.sign(ob.to - ob.lane);
          u.arrow.scale.x = dir;
          const warn = ahead < TELEGRAPH && p < 1;
          u.arrow.visible = warn && flash;
          u.marker.visible = warn && !flash;
          u.marker.position.x = laneX(ob.to) - laneX(ob.lane);
          u.marker.rotation.y = -dir * Math.PI / 2;
          continue;
        }
        if (ob.kind === 'laser') {
          // On: solid red curtain. Off: faint green standby lines, so the rhythm reads at a glance.
          const on = laserOn(ob, d);
          for (const b of u.beams) {
            b.material = on ? beamMat : idleBeamMat;
            b.scale.y = on ? 1 : 0.4;
          }
          u.headMat.color.set(on ? '#ff2a4a' : '#3dff8a');
        }
        ob.mesh.position.set(laneX(ob.lane), 0, -((ob.kind === 'pod' ? podFront(ob) : ob.s) - d));
      }
      beamMat.opacity = 0.7 + 0.3 * Math.sin(time * 40);
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
      for (const g of gems) {
        g.mesh.position.set(laneX(g.lane), g.y + Math.sin(time * 3 + 1) * 0.15, -(g.s - d));
        g.mesh.rotation.y = time * 2.6;
      }
      for (const l of letters) {
        l.mesh.position.set(laneX(l.lane), l.y + Math.sin(time * 2.5) * 0.12, -(l.s - d));
        l.mesh.rotation.y = Math.sin(time * 2) * 0.5; // wobbles but stays readable
        l.mesh.scale.setScalar(1 + 0.06 * Math.sin(time * 6));
      }
    },
  };
}
