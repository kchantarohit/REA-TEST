// The courier crew: six original stylized low-poly people built from three.js primitives.
// One parametric rig (hips > torso > neck > head, shoulders > elbows, hips > knees) is
// dressed per character from catalog `look` + the worn outfit's colours. Every model is
// centred like the v2 bots (feet at y = -0.8, faces -z) so hero.js can keep its flips,
// squash and lean; the model itself poses run / jump tuck / roll tuck / scooter / idle.
//
// Performance: all meshes share a handful of unit geometries (scaled per mesh) and each
// model owns ~10 flat-shaded Lambert materials, so recolouring an outfit is just colour
// writes and only one model renders during a run.
import {
  BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, SphereGeometry, TorusGeometry,
} from 'three';
import { CHARACTERS } from './catalog.js';

/**
 * @typedef {{lean: number, crashed: boolean, eyesOpen: boolean, time: number, running: boolean, speed: number, vy: number,
 *   grounded?: boolean, rolling?: boolean, ride?: boolean, caught?: boolean}} ModelCtx
 * @typedef {{group: Group, rollSquash: number, update: (dt: number, c: ModelCtx) => void, setOutfit: (o: object) => void}} Model
 */

// Shared unit geometries (scaled per mesh).
const U = {
  box: new BoxGeometry(1, 1, 1),
  cyl: new CylinderGeometry(0.5, 0.5, 1, 8).translate(0, -0.5, 0), // hangs down from its pivot
  limb: new CylinderGeometry(0.5, 0.42, 1, 7).translate(0, -0.5, 0),
  torso: new CylinderGeometry(0.5, 0.4, 1, 8).translate(0, 0.5, 0), // grows up from the hips, wider at the chest
  ball: new SphereGeometry(0.5, 12, 9),
  lowBall: new SphereGeometry(0.5, 8, 6),
  dome: new SphereGeometry(0.5, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
  ring: new TorusGeometry(0.5, 0.09, 6, 18),
  halfRing: new TorusGeometry(0.5, 0.11, 6, 14, Math.PI),
  cone: new ConeGeometry(0.5, 1, 8),
  // Head wrap: a sphere with the face cut out of the -z side.
  wrap: new SphereGeometry(0.5, 14, 10, Math.PI * 1.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.86),
};

const BUILD = {
  slim: { sh: 0.19, chest: 0.36, waist: 0.3, depth: 0.2, arm: 0.075, leg: 0.1 },
  lean: { sh: 0.205, chest: 0.4, waist: 0.32, depth: 0.22, arm: 0.08, leg: 0.105 },
  broad: { sh: 0.25, chest: 0.5, waist: 0.42, depth: 0.28, arm: 0.1, leg: 0.125 },
};
const FOOT_Y = -0.8;
const THIGH = 0.4;
const SHIN = 0.38;
const UPPER = 0.27;
const FORE = 0.25;
const TORSO_H = 0.56;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, to, k) => cur + (to - cur) * k;

/** @param {typeof CHARACTERS[number]} def */
function buildHuman(def) {
  const look = def.look;
  const b = BUILD[look.build] || BUILD.lean;
  // A little self-light keeps faces and clothes readable under the dusk sky's dark ground bounce.
  const mat = (color) => {
    const m = new MeshLambertMaterial({ color, flatShading: true });
    m.emissive.set(color).multiplyScalar(0.22);
    return m;
  };
  const M = {
    skin: mat(look.skin),
    skinDark: mat(look.skin),
    hair: mat(look.hair),
    top: mat('#888'),
    top2: mat('#888'),
    legs: mat('#888'),
    shoes: mat('#888'),
    acc: mat('#888'),
    sole: mat('#f4efe6'),
    dark: mat('#1a1220'),
    white: mat('#fbf6ee'),
  };
  M.skinDark.color.multiplyScalar(0.78);
  M.skin.emissive.set(look.skin).multiplyScalar(0.32);
  M.skinDark.emissive.set(look.skin).multiplyScalar(0.22);

  const g = new Group();
  /** Add a scaled shared mesh. */
  const put = (geo, m, parent, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) => {
    const mesh = new Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  const pivot = (parent, x, y, z) => {
    const p = new Group();
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  };

  // ---- hips + legs ----
  const hipY = FOOT_Y + THIGH + SHIN + 0.05;
  const hips = pivot(g, 0, hipY, 0);
  put(U.lowBall, M.legs, hips, [0, -0.02, 0], [b.waist * 1.05, 0.2, b.depth * 1.05]);
  const legs = [-1, 1].map((sx) => {
    const thigh = pivot(hips, sx * b.waist * 0.27, -0.04, 0);
    put(U.limb, M.legs, thigh, [0, 0, 0], [b.leg * 2, THIGH, b.leg * 2]);
    const knee = pivot(thigh, 0, -THIGH, 0);
    put(U.limb, M.legs, knee, [0, 0, 0], [b.leg * 1.75, SHIN, b.leg * 1.75]);
    const foot = pivot(knee, 0, -SHIN, 0);
    put(U.box, M.shoes, foot, [0, -0.035, -0.05], [b.leg * 1.9, 0.08, 0.27]);
    put(U.box, M.sole, foot, [0, -0.08, -0.05], [b.leg * 1.95, 0.025, 0.28]);
    return { thigh, knee, foot };
  });

  // ---- torso ----
  const torso = pivot(hips, 0, 0.02, 0);
  put(U.torso, M.top, torso, [0, 0, 0], [b.chest, TORSO_H, b.depth * 1.6]);
  // accents: a chest band and a hem stripe in the outfit's second colour
  put(U.box, M.top2, torso, [0, TORSO_H * 0.62, -b.depth * 0.78], [b.chest * 0.92, 0.06, 0.03]);
  put(U.box, M.top2, torso, [0, TORSO_H * 0.08, -b.depth * 0.66], [b.waist * 0.95, 0.05, 0.03]); // hem
  put(U.ring, M.top2, torso, [0, TORSO_H * 0.97, 0], [b.chest * 0.5, b.depth * 0.9, 0.5]).rotation.x = Math.PI / 2; // collar
  // ---- neck + head ----
  const neck = pivot(torso, 0, TORSO_H, 0);
  put(U.cyl, M.skin, neck, [0, 0.09, 0], [0.09, 0.1, 0.09]);
  const head = pivot(neck, 0, 0.1, 0);
  const H = 0.29; // head height
  put(U.ball, M.skin, head, [0, H / 2, 0], [0.235, H, 0.26]);
  put(U.ball, M.skin, head, [0, H * 0.25, -0.03], [0.2, 0.15, 0.22]); // jaw
  for (const sx of [-1, 1]) put(U.lowBall, M.skinDark, head, [sx * 0.118, H * 0.5, 0.01], [0.04, 0.07, 0.05]); // ears
  put(U.cone, M.skinDark, head, [0, H * 0.45, -0.135], [0.045, 0.07, 0.04]).rotation.x = -Math.PI / 2 + 0.25; // nose
  const eyes = [-1, 1].map((sx) => {
    put(U.lowBall, M.white, head, [sx * 0.052, H * 0.56, -0.118], [0.045, 0.035, 0.02]);
    return put(U.lowBall, M.dark, head, [sx * 0.052, H * 0.56, -0.126], [0.026, 0.03, 0.012]);
  });
  const brows = [-1, 1].map((sx) => put(U.box, M.hair, head, [sx * 0.053, H * 0.7, -0.123], [0.06, 0.016, 0.015]));
  const mouth = put(U.box, M.dark, head, [0, H * 0.27, -0.128], [0.05, 0.012, 0.01]);

  // ---- hair styles ----
  // Hair caps are domes tipped back so the hairline sits above the brows, never over the eyes.
  const top = (sx, sy, sz, y = H * 0.6, z = 0.03) => {
    const m = put(U.dome, M.hair, head, [0, y, z], [sx, sy, sz]);
    m.rotation.x = 0.42;
    return m;
  };
  switch (look.hairStyle) {
    case 'twists':
      top(0.25, 0.28, 0.275);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const t = put(U.cyl, M.hair, head, [Math.cos(a) * 0.08, H * 0.98, Math.sin(a) * 0.08 + 0.01], [0.045, 0.1, 0.045]);
        t.rotation.set(Math.PI + Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
      break;
    case 'bob':
      top(0.27, 0.3, 0.29, H * 0.64);
      put(U.box, M.hair, head, [0, H * 0.42, 0.06], [0.27, 0.26, 0.19]); // back
      put(U.box, M.hair, head, [0, H * 0.76, -0.12], [0.21, 0.06, 0.05]); // bangs
      for (const sx of [-1, 1]) put(U.box, M.hair, head, [sx * 0.125, H * 0.36, -0.02], [0.04, 0.22, 0.2]);
      break;
    case 'puff':
      top(0.25, 0.22, 0.27);
      put(U.ball, M.hair, head, [0, H * 1.08, 0.05], [0.25, 0.22, 0.25]);
      put(U.ring, M.top2, head, [0, H * 0.93, 0.04], [0.18, 0.18, 0.4]).rotation.x = Math.PI / 2; // hair tie
      break;
    case 'wrap': {
      // Sporty head wrap: covers hair and neck, leaves the face open.
      const w = put(U.wrap, M.acc, head, [0, H * 0.5, 0.012], [0.27, 0.33, 0.29]);
      w.rotation.y = 0;
      put(U.cone, M.acc, neck, [0, -0.02, 0.01], [0.3, 0.2, 0.27]);
      break;
    }
    case 'shaved':
      top(0.24, 0.24, 0.27, H * 0.58);
      break;
    default: // short
      top(0.25, 0.25, 0.275);
      put(U.box, M.hair, head, [0, H * 0.45, 0.08], [0.22, 0.18, 0.1]);
  }
  if (look.beard) {
    put(U.ball, M.hair, head, [0, H * 0.22, -0.04], [0.215, 0.17, 0.2]);
    put(U.box, M.skin, head, [0, H * 0.3, -0.13], [0.07, 0.035, 0.02]); // lips gap
  }
  if (look.glasses) {
    for (const sx of [-1, 1]) {
      const r = put(U.ring, M.dark, head, [sx * 0.055, H * 0.56, -0.135], [0.09, 0.08, 0.3]);
      r.rotation.x = 0;
    }
    put(U.box, M.dark, head, [0, H * 0.58, -0.136], [0.03, 0.01, 0.01]);
  }
  // ---- accessories ----
  switch (look.acc) {
    case 'headphones':
    case 'bigphones': {
      const big = look.acc === 'bigphones' ? 1.25 : 1;
      put(U.halfRing, M.acc, head, [0, H * 0.58, 0.01], [0.27 * big, 0.3 * big, 0.5]);
      for (const sx of [-1, 1]) {
        const cup = put(U.cyl, M.acc, head, [sx * 0.135 * big, H * 0.5, 0.01], [0.09 * big, 0.06, 0.09 * big]);
        cup.rotation.z = (sx * Math.PI) / 2;
      }
      break;
    }
    case 'beanie':
      put(U.dome, M.acc, head, [0, H * 0.7, 0.03], [0.26, 0.3, 0.28]).rotation.x = 0.35;
      put(U.ring, M.acc, head, [0, H * 0.74, 0.02], [0.25, 0.26, 0.6]).rotation.x = Math.PI / 2 + 0.35;
      break;
    case 'flatcap':
      put(U.cyl, M.acc, head, [0, H * 1.0, 0.01], [0.27, 0.08, 0.29]);
      put(U.box, M.acc, head, [0, H * 0.9, -0.15], [0.2, 0.025, 0.09]).rotation.x = 0.25;
      break;
    case 'scarf':
      put(U.ring, M.acc, neck, [0, 0.03, 0], [0.24, 0.24, 0.9]).rotation.x = Math.PI / 2;
      put(U.box, M.acc, torso, [0.07, TORSO_H * 0.72, -b.depth * 0.82], [0.07, 0.22, 0.03]).rotation.z = 0.15;
      break;
    default:
  }
  // ---- bags ----
  const strap = () => {
    const s = put(U.box, M.dark, torso, [0, TORSO_H * 0.55, -b.depth * 0.8], [0.04, TORSO_H * 1.25, 0.02]);
    s.rotation.z = 0.75;
    const s2 = put(U.box, M.dark, torso, [0, TORSO_H * 0.55, b.depth * 0.8], [0.04, TORSO_H * 1.25, 0.02]);
    s2.rotation.z = 0.75;
  };
  switch (look.bag) {
    case 'messenger':
      put(U.box, M.top2, torso, [-b.chest * 0.42, TORSO_H * 0.1, b.depth * 0.6], [0.1, 0.24, 0.3]);
      put(U.box, M.dark, torso, [-b.chest * 0.42, TORSO_H * 0.2, b.depth * 0.6], [0.11, 0.06, 0.31]);
      strap();
      break;
    case 'backpack':
      put(U.box, M.acc, torso, [0, TORSO_H * 0.55, b.depth * 0.95], [b.chest * 0.75, TORSO_H * 0.7, 0.18]);
      put(U.box, M.top2, torso, [0, TORSO_H * 0.38, b.depth * 0.95 + 0.09], [b.chest * 0.5, 0.12, 0.04]);
      break;
    case 'sling':
      put(U.box, M.acc, torso, [0.05, TORSO_H * 0.6, b.depth * 0.85], [0.14, 0.32, 0.1]).rotation.z = -0.7;
      strap();
      break;
    case 'hip':
      put(U.box, M.acc, hips, [0.08, 0.02, -b.depth * 0.75], [0.2, 0.09, 0.08]);
      break;
    case 'satchel':
      put(U.box, M.acc, torso, [b.chest * 0.45, TORSO_H * 0.05, b.depth * 0.2], [0.08, 0.22, 0.26]);
      strap();
      break;
    default:
  }

  // ---- arms ----
  const arms = [-1, 1].map((sx) => {
    const shoulder = pivot(torso, sx * (b.chest * 0.5 + b.arm * 0.4), TORSO_H * 0.9, 0);
    put(U.ball, M.top, shoulder, [0, -0.01, 0], [b.arm * 2.5, b.arm * 2.2, b.arm * 2.5]);
    put(U.limb, M.top, shoulder, [0, 0, 0], [b.arm * 2, UPPER, b.arm * 2]);
    const elbow = pivot(shoulder, 0, -UPPER, 0);
    put(U.limb, M.top, elbow, [0, 0, 0], [b.arm * 1.8, FORE * 0.75, b.arm * 1.8]);
    put(U.cyl, M.top2, elbow, [0, -FORE * 0.68, 0], [b.arm * 1.9, 0.04, b.arm * 1.9]); // cuff
    put(U.lowBall, M.skin, elbow, [0, -FORE - 0.02, 0], [0.075, 0.09, 0.075]); // hand
    return { shoulder, elbow, sx };
  });

  // ---- animation ----
  const P = { phase: Math.random() * 6, air: 0, tuck: 0, ride: 0, idle: 0, crash: 0, caught: 0, look: 0 };
  return {
    group: g,
    rollSquash: 0.12, // the tuck pose already makes the body small
    /** @param {{top: string, top2: string, legs: string, shoes: string, acc: string}} o */
    setOutfit(o) {
      for (const k of ['top', 'top2', 'legs', 'shoes', 'acc']) {
        M[k].color.set(o[k]);
        M[k].emissive.set(o[k]).multiplyScalar(0.22);
      }
    },
    /** @param {number} dt @param {ModelCtx} c */
    update(dt, c) {
      const k = (r) => 1 - Math.exp(-r * dt);
      const air = !c.grounded && c.running && !c.ride ? 1 : 0;
      P.air = damp(P.air, air, k(14));
      P.tuck = damp(P.tuck, c.rolling ? 1 : 0, k(22));
      P.ride = damp(P.ride, c.ride ? 1 : 0, k(10));
      P.idle = damp(P.idle, c.running || c.crashed ? 0 : 1, k(6));
      P.crash = damp(P.crash, c.crashed ? 1 : 0, k(10));
      P.caught = damp(P.caught, c.caught ? 1 : 0, k(12));
      const cadence = 1.5 + clamp(c.speed, 0, 46) * 0.055; // strides per second
      P.phase += dt * Math.PI * 2 * (c.running ? (c.ride ? 0.9 : cadence) : 0.35);
      const ph = P.phase;
      const s = Math.sin(ph);
      const run = (1 - P.air) * (1 - P.tuck) * (1 - P.ride) * (1 - P.idle) * (1 - P.crash);

      // Legs: run stride with knee fold on the back swing, tuck in the air / roll, scooter kick.
      legs.forEach((L, i) => {
        const side = i === 0 ? 1 : -1;
        const sw = s * side;
        const back = Math.max(0, -Math.sin(ph * 1 + (side > 0 ? 0 : Math.PI) - 0.6));
        let thigh = run * sw * 0.85;
        let knee = run * -(0.25 + back * 1.35);
        // jump: one knee drives up, the other trails
        thigh += P.air * (side > 0 ? 1.25 : 0.35);
        knee += P.air * (side > 0 ? -1.7 : -0.9);
        thigh += P.tuck * 1.9;
        knee += P.tuck * -2.3;
        // scooter: left foot planted on the deck, right foot kicks the road
        const kick = Math.sin(ph * 1.0);
        thigh += P.ride * (side > 0 ? 0.08 : -0.25 + kick * 0.55);
        knee += P.ride * (side > 0 ? -0.12 : -0.35 - Math.max(0, kick) * 0.6);
        // idle: soft weight shift
        thigh += P.idle * (side > 0 ? 0.04 : -0.06) * (1 + Math.sin(c.time * 1.3) * 0.5);
        knee += P.idle * -0.05;
        thigh += P.crash * (side > 0 ? 0.6 : -0.3);
        L.thigh.rotation.x = thigh;
        L.thigh.rotation.z = side * (0.04 + P.air * 0.08 + P.crash * 0.25);
        L.knee.rotation.x = knee;
        L.foot.rotation.x = -thigh * 0.25 - knee * 0.4;
      });
      // Arms: counter-swing, bent elbows; up and out in the air; hug the knees in a roll.
      arms.forEach((A, i) => {
        const side = i === 0 ? 1 : -1;
        const sw = -s * side;
        let sh = run * sw * 0.9;
        let el = run * (1.25 + Math.max(0, sw) * 0.4);
        let out = run * 0.12;
        sh += P.air * 2.3;
        el += P.air * 0.35;
        out += P.air * 0.55;
        sh += P.tuck * 1.5;
        el += P.tuck * 1.6;
        out += P.tuck * 0.1;
        sh += P.ride * 1.05;
        el += P.ride * 0.45;
        out += P.ride * 0.05;
        // idle: relaxed, with a little swing; crash: flail; caught: hands up in surprise
        sh += P.idle * (0.08 + Math.sin(c.time * 1.3 + i) * 0.04);
        el += P.idle * 0.35;
        out += P.idle * 0.12;
        sh += P.crash * (1.9 + Math.sin(c.time * 22 + i * 2) * 0.5);
        out += P.crash * 0.9;
        sh += P.caught * 2.8;
        out += P.caught * 0.3;
        A.shoulder.rotation.x = sh;
        A.shoulder.rotation.z = A.sx * out;
        A.elbow.rotation.x = el;
      });
      torso.rotation.x = run * (0.18 + clamp(c.speed / 46, 0, 1) * 0.12) + P.tuck * 0.9 + P.air * 0.25 + P.ride * 0.2 - P.caught * 0.3;
      torso.rotation.y = run * s * 0.12;
      torso.rotation.z = -c.lean * 0.5;
      head.rotation.x = -run * 0.15 + P.tuck * 0.5 - P.ride * 0.1 - P.idle * 0.04;
      // On menus the courier glances around now and then.
      P.look = damp(P.look, P.idle * Math.sin(c.time * 0.5) * 0.35, k(3));
      head.rotation.y = P.look;
      hips.position.y = hipY - P.tuck * 0.35 - P.ride * 0.04;
      for (const e of eyes) e.scale.y = c.eyesOpen ? 0.03 : 0.004;
      for (const br of brows) br.position.y = H * (c.crashed || c.caught ? 0.76 : 0.7);
      mouth.scale.set(c.crashed || c.caught ? 0.035 : 0.05, c.crashed || c.caught ? 0.04 : 0.012, 0.01);
    },
  };
}

/**
 * @param {string} id character id
 * @param {object} [outfit] colours; defaults to the character's first outfit
 * @returns {Model}
 */
export function buildModel(id, outfit) {
  const def = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  const m = buildHuman(def);
  m.setOutfit(outfit || def.outfits[0]);
  return m;
}
