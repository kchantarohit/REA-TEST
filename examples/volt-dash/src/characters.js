// Six original characters built from three.js primitives. Every model is centred on
// its body (about 1 unit tall, feet near y = -0.75), faces -z, and animates its own
// idle details in update(); the hero rig (hero.js) handles running, jumps and rolls.
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';

/**
 * @typedef {{lean: number, crashed: boolean, eyesOpen: boolean, time: number, running: boolean, speed: number, vy: number}} ModelCtx
 * @typedef {{group: Group, update: (dt: number, c: ModelCtx) => void}} Model
 */

const lambert = (color, extra = {}) => new MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new MeshBasicMaterial({ color, ...extra });
const glow = (color, opacity = 0.85) => basic(color, { transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
const RED = new Color('#ff3355');

function adder(parent) {
  return (geo, mat, x = 0, y = 0, z = 0, p = parent) => {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  };
}

/** Volt: round courier robot with visor, cargo pack, antenna and hover wheel. */
function volt() {
  const g = new Group();
  const add = adder(g);
  const mat = {
    shell: lambert('#eef1f8'),
    accent: lambert('#ff8a2b', { emissive: '#4a1800' }),
    dark: lambert('#161b30'),
    trim: lambert('#69739a'),
    eye: basic('#45f3ff'),
    tip: basic('#ff4fd8'),
    ring: glow('#45f3ff', 0.8),
  };
  add(new SphereGeometry(0.5, 28, 20), mat.shell);
  add(new TorusGeometry(0.49, 0.045, 8, 36), mat.accent, 0, -0.12, 0).rotation.x = Math.PI / 2;
  add(new SphereGeometry(0.515, 28, 8, Math.PI * 1.5 - 0.95, 1.9, Math.PI / 2 - 0.62, 0.64), mat.dark);
  const eye = add(new SphereGeometry(0.524, 24, 3, Math.PI * 1.5 - 0.62, 1.24, Math.PI / 2 - 0.44, 0.2), mat.eye);
  const earGeo = new CylinderGeometry(0.13, 0.13, 0.1, 18);
  const earLightGeo = new CylinderGeometry(0.06, 0.06, 0.02, 12);
  for (const sx of [-1, 1]) {
    add(earGeo, mat.accent, sx * 0.49, 0.06, 0).rotation.z = Math.PI / 2;
    add(earLightGeo, mat.tip, sx * 0.55, 0.06, 0).rotation.z = Math.PI / 2;
  }
  add(new BoxGeometry(0.58, 0.5, 0.26), mat.accent, 0, -0.02, 0.4);
  add(new BoxGeometry(0.62, 0.08, 0.3), mat.dark, 0, 0.25, 0.4);
  add(new BoxGeometry(0.4, 0.06, 0.02), mat.eye, 0, 0.06, 0.535);
  const antenna = new Group();
  antenna.position.set(0.1, 0.46, 0.06);
  g.add(antenna);
  add(new CylinderGeometry(0.022, 0.022, 0.4, 8), mat.dark, 0, 0.2, 0, antenna);
  add(new SphereGeometry(0.075, 14, 10), mat.tip, 0, 0.42, 0, antenna);
  add(new CylinderGeometry(0.09, 0.15, 0.18, 14), mat.dark, 0, -0.5, 0);
  const wheel = new Group();
  wheel.position.y = -0.58;
  g.add(wheel);
  add(new CylinderGeometry(0.19, 0.19, 0.14, 20), mat.dark, 0, 0, 0, wheel).rotation.z = Math.PI / 2;
  add(new TorusGeometry(0.19, 0.025, 6, 24), mat.eye, 0, 0, 0, wheel).rotation.y = Math.PI / 2;
  add(new BoxGeometry(0.16, 0.05, 0.3), mat.trim, 0, 0, 0, wheel);
  const ring = add(new TorusGeometry(0.34, 0.035, 6, 32), mat.ring, 0, -0.74, 0);
  ring.rotation.x = Math.PI / 2;
  const cyan = new Color('#45f3ff');
  let antA = 0;
  let antV = 0;
  return {
    group: g,
    update(dt, c) {
      const target = -c.lean * 1.3;
      antV += ((target - antA) * 140 - antV * 9) * dt;
      antA += antV * dt;
      antenna.rotation.z = antA - 0.15;
      antenna.rotation.x = (c.running ? 0.3 : 0.05) + Math.max(-0.35, Math.min(0.35, -c.vy * 0.02));
      wheel.rotation.x -= (dt * c.speed) / 0.19;
      eye.visible = c.eyesOpen;
      mat.eye.color.copy(c.crashed ? RED : cyan);
      ring.scale.setScalar(1 + Math.sin(c.time * 11) * 0.08);
      mat.ring.opacity = 0.6 + 0.25 * Math.sin(c.time * 11);
    },
  };
}

/** Bit: tiny cube bot with a pixel-face screen and a hover thruster. */
function bit() {
  const g = new Group();
  const add = adder(g);
  const body = lambert('#2fd3a0');
  const dark = lambert('#10241f');
  const pix = basic('#7dff6a');
  add(new BoxGeometry(0.66, 0.6, 0.6), body, 0, -0.05, 0);
  add(new BoxGeometry(0.7, 0.08, 0.64), lambert('#e9fff6'), 0, 0.27, 0);
  add(new BoxGeometry(0.5, 0.36, 0.04), dark, 0, -0.02, -0.31);
  const eyes = [-0.12, 0.12].map((x) => add(new BoxGeometry(0.09, 0.11, 0.02), pix, x, 0.02, -0.335));
  const mouth = add(new BoxGeometry(0.16, 0.035, 0.02), pix, 0, -0.1, -0.335);
  for (const sx of [-1, 1]) {
    add(new CylinderGeometry(0.018, 0.018, 0.22, 6), dark, sx * 0.18, 0.4, 0);
    add(new BoxGeometry(0.08, 0.08, 0.08), basic('#ffe14d'), sx * 0.18, 0.53, 0);
    add(new BoxGeometry(0.12, 0.16, 0.16), lambert('#e9fff6'), sx * 0.4, -0.12, 0);
  }
  add(new CylinderGeometry(0.16, 0.1, 0.12, 12), dark, 0, -0.41, 0);
  const flame = add(new ConeGeometry(0.1, 0.32, 10).rotateX(Math.PI), glow('#7dff6a'), 0, -0.6, 0);
  g.scale.setScalar(1.05);
  return {
    group: g,
    update(dt, c) {
      for (const e of eyes) {
        e.visible = c.eyesOpen;
        e.scale.y = c.crashed ? 0.3 : 1;
      }
      mouth.scale.x = c.crashed ? 0.5 : 1 + 0.2 * Math.sin(c.time * 3);
      flame.scale.set(1, 0.8 + 0.4 * Math.abs(Math.sin(c.time * 30)), 1);
    },
  };
}

/** Moss: chunky stone golem with moss caps and amber eyes. */
function moss() {
  const g = new Group();
  const add = adder(g);
  const stone = lambert('#8c8a99', { flatShading: true });
  const stoneDark = lambert('#6a6878', { flatShading: true });
  const mossMat = lambert('#6dbb3c', { flatShading: true });
  const eyeMat = basic('#ffb02e');
  add(new DodecahedronGeometry(0.5, 0), stone, 0, -0.05, 0).scale.set(1.1, 0.95, 1);
  const head = new Group();
  head.position.set(0, 0.5, -0.05);
  g.add(head);
  add(new DodecahedronGeometry(0.3, 0), stoneDark, 0, 0, 0, head);
  add(new SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mossMat, 0, 0.1, 0, head).scale.set(1.05, 0.6, 1.05);
  const eyes = [-0.11, 0.11].map((x) => add(new SphereGeometry(0.055, 10, 8), eyeMat, x, 0.02, -0.27, head));
  const arms = [-1, 1].map((sx) => {
    const arm = new Group();
    arm.position.set(sx * 0.6, 0.15, 0);
    g.add(arm);
    add(new DodecahedronGeometry(0.2, 0), stoneDark, 0, -0.2, 0, arm);
    add(new DodecahedronGeometry(0.16, 0), stone, 0, -0.45, -0.02, arm);
    add(new SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mossMat, 0, -0.08, 0, arm).scale.set(1.2, 0.5, 1.2);
    return arm;
  });
  for (const sx of [-1, 1]) add(new BoxGeometry(0.24, 0.26, 0.3), stoneDark, sx * 0.22, -0.6, 0);
  add(new SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mossMat, 0.18, 0.32, 0.1).scale.set(1.4, 0.5, 1.2);
  return {
    group: g,
    update(dt, c) {
      const sw = Math.sin(c.time * (c.running ? 12 : 2));
      arms[0].rotation.x = sw * (c.running ? 0.6 : 0.12);
      arms[1].rotation.x = -sw * (c.running ? 0.6 : 0.12);
      head.rotation.y = c.running ? 0 : Math.sin(c.time * 0.7) * 0.25;
      for (const e of eyes) e.visible = c.eyesOpen;
      eyeMat.color.set(c.crashed ? '#ff3355' : '#ffb02e');
      eyeMat.color.multiplyScalar(0.8 + 0.2 * Math.sin(c.time * 3));
    },
  };
}

/** Ember: charcoal bot with a crown of flickering flame "hair". */
function ember() {
  const g = new Group();
  const add = adder(g);
  const shell = lambert('#2b2530');
  const plate = lambert('#ff7a2e', { emissive: '#6a1a00' });
  add(new CylinderGeometry(0.4, 0.34, 0.62, 18), shell, 0, -0.12, 0);
  add(new SphereGeometry(0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, 0.19, 0);
  add(new SphereGeometry(0.34, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shell, 0, -0.43, 0);
  add(new TorusGeometry(0.4, 0.04, 8, 30), plate, 0, -0.16, 0).rotation.x = Math.PI / 2;
  add(new BoxGeometry(0.3, 0.18, 0.04), plate, 0, -0.28, -0.37);
  const visor = add(new BoxGeometry(0.5, 0.12, 0.08), basic('#ffd24d'), 0, 0.1, -0.35);
  const flames = [];
  const hair = [
    [0, 0.55, 0.05, 0.16, 0.6, '#ff5a1f'], [-0.17, 0.46, 0.08, 0.12, 0.42, '#ff8a2b'], [0.17, 0.46, 0.08, 0.12, 0.42, '#ff8a2b'],
    [0, 0.48, 0.2, 0.13, 0.46, '#ffb02e'], [-0.08, 0.5, -0.12, 0.1, 0.34, '#ffe14d'], [0.1, 0.5, -0.1, 0.1, 0.3, '#ffe14d'],
  ];
  for (const [x, y, z, r, h, col] of hair) {
    const f = add(new ConeGeometry(r, h, 8).translate(0, h / 2, 0), glow(col, 0.9), x, y - 0.12, z);
    f.rotation.x = -0.25;
    flames.push(f);
  }
  for (const sx of [-1, 1]) add(new SphereGeometry(0.13, 12, 8), shell, sx * 0.18, -0.68, 0);
  return {
    group: g,
    update(dt, c) {
      flames.forEach((f, i) => {
        f.scale.set(1, 0.75 + 0.35 * Math.abs(Math.sin(c.time * (9 + i * 1.7) + i)), 1);
        f.rotation.z = Math.sin(c.time * 5 + i) * 0.15 + c.lean * 0.6;
      });
      visor.visible = c.eyesOpen;
      visor.material.color.set(c.crashed ? '#ff3355' : '#ffd24d');
    },
  };
}

/** Nimbus: a cloud sprite made of breathing puffs with orbiting wisps. */
function nimbus() {
  const g = new Group();
  const add = adder(g);
  const cloud = lambert('#f4fbff', { emissive: '#3a5a7a' });
  const puffs = [
    [0, 0, 0, 0.42], [-0.34, -0.08, 0.04, 0.3], [0.34, -0.08, 0.04, 0.3], [-0.18, 0.28, 0.04, 0.26],
    [0.2, 0.26, 0.06, 0.28], [0, -0.3, 0.05, 0.3], [0, 0.1, 0.25, 0.3],
  ].map(([x, y, z, r]) => add(new SphereGeometry(r, 16, 12), cloud, x, y, z));
  const eyeMat = basic('#1b2a4a');
  const eyes = [-0.13, 0.13].map((x) => {
    const e = add(new SphereGeometry(0.06, 10, 8), eyeMat, x, 0.04, -0.4);
    e.scale.set(0.8, 1.3, 0.5);
    return e;
  });
  for (const sx of [-1, 1]) add(new SphereGeometry(0.05, 8, 6), basic('#ff9ac8'), sx * 0.24, -0.06, -0.37).scale.set(1.2, 0.7, 0.5);
  const wisps = [0, 1, 2].map(() => add(new SphereGeometry(0.08, 10, 8), glow('#bfe6ff', 0.9)));
  g.position.y = 0.05;
  return {
    group: g,
    update(dt, c) {
      puffs.forEach((p, i) => p.scale.setScalar(1 + 0.05 * Math.sin(c.time * 2.4 + i)));
      wisps.forEach((w, i) => {
        const a = c.time * 2 + (i * Math.PI * 2) / 3;
        w.position.set(Math.cos(a) * 0.62, -0.3 + Math.sin(a * 2) * 0.15, Math.sin(a) * 0.62);
      });
      for (const e of eyes) e.visible = c.eyesOpen;
      eyeMat.color.set(c.crashed ? '#ff3355' : '#1b2a4a');
    },
  };
}

/** Orbit: a cat-eared space bot wearing a spinning planetary ring. */
function orbit() {
  const g = new Group();
  const add = adder(g);
  const white = lambert('#f3eefc');
  const purple = lambert('#7a4ad8', { emissive: '#1c0a40' });
  const visorMat = lambert('#1a1036');
  const eyeMat = basic('#45f3ff');
  add(new SphereGeometry(0.34, 20, 14), purple, 0, -0.3, 0);
  add(new SphereGeometry(0.38, 22, 16), white, 0, 0.2, 0);
  add(new SphereGeometry(0.39, 22, 10, Math.PI * 1.5 - 0.8, 1.6, Math.PI / 2 - 0.45, 0.75), visorMat, 0, 0.2, 0);
  const eyes = [-0.12, 0.12].map((x) => add(new SphereGeometry(0.06, 10, 8), eyeMat, x, 0.24, -0.36));
  for (const sx of [-1, 1]) {
    const ear = add(new ConeGeometry(0.12, 0.24, 4), purple, sx * 0.22, 0.56, 0);
    ear.rotation.z = -sx * 0.35;
    add(new SphereGeometry(0.1, 10, 8), white, sx * 0.3, -0.62, 0);
  }
  add(new CylinderGeometry(0.02, 0.02, 0.16, 6), white, 0, 0.62, 0);
  add(new SphereGeometry(0.05, 10, 8), basic('#ffe14d'), 0, 0.72, 0);
  const tail = add(new TorusGeometry(0.22, 0.04, 6, 16, Math.PI * 1.2), purple, 0, -0.35, 0.36);
  tail.rotation.y = Math.PI / 2;
  const ringPivot = new Group();
  ringPivot.rotation.set(0.35, 0, 0.25);
  g.add(ringPivot);
  const ring = add(new TorusGeometry(0.66, 0.045, 6, 40), glow('#c58bff', 0.95), 0, 0, 0, ringPivot);
  ring.rotation.x = Math.PI / 2;
  const moon = add(new SphereGeometry(0.06, 10, 8), basic('#ffe14d'), 0.66, 0, 0, ringPivot);
  return {
    group: g,
    update(dt, c) {
      ringPivot.rotation.y += dt * 1.6;
      moon.scale.setScalar(1 + 0.2 * Math.sin(c.time * 5));
      tail.rotation.z = Math.sin(c.time * 4) * 0.3;
      for (const e of eyes) {
        e.visible = c.eyesOpen;
        e.scale.y = c.crashed ? 0.3 : 1;
      }
    },
  };
}

const BUILDERS = { volt, bit, moss, ember, nimbus, orbit };

/** @param {string} id @returns {Model} */
export function buildModel(id) {
  return (BUILDERS[id] || volt)();
}
