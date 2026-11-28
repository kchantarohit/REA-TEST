// Original rideables and machines built from primitives:
//  - the Kick Scooter consumable (rides under the hero's feet),
//  - Clank, a huge rusty runaway street-sweeper mech that chases the runner: spinning gutter
//    brushes, a roller broom, glaring headlights, a rotating beacon and a steaming stack.
// Both face -z like everything else on the road.
import {
  AdditiveBlending, BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PlaneGeometry, SphereGeometry, TorusGeometry,
} from 'three';
import { stencilTexture } from './textures.js';

const lam = (color, extra = {}) => new MeshLambertMaterial({ color, flatShading: true, ...extra });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

/** Kick scooter: deck, two wheels, T-bar with grips and a little front lamp. Origin = road level under the deck. */
export function buildScooter() {
  const g = new Group();
  const deck = lam('#ff4f7b');
  const dark = lam('#1d1626');
  const metal = lam('#c9c3d6');
  const grip = lam('#fff1dc');
  add(g, new BoxGeometry(0.2, 0.05, 0.78), deck, 0, 0.11, 0.02);
  add(g, new BoxGeometry(0.21, 0.012, 0.6), lam('#2a1540'), 0, 0.14, 0.05); // grip tape
  const wheels = [-0.36, 0.38].map((z) => {
    const w = add(g, new CylinderGeometry(0.085, 0.085, 0.07, 12), dark, 0, 0.085, z);
    w.rotation.z = Math.PI / 2;
    add(w, new CylinderGeometry(0.04, 0.04, 0.075, 8), metal);
    return w;
  });
  add(g, new BoxGeometry(0.06, 0.04, 0.14), deck, 0, 0.16, 0.42).rotation.x = -0.6; // rear fender
  const stem = new Group();
  stem.position.set(0, 0.12, -0.36);
  stem.rotation.x = -0.18;
  g.add(stem);
  add(stem, new CylinderGeometry(0.025, 0.03, 0.95, 8).translate(0, 0.475, 0), metal);
  add(stem, new CylinderGeometry(0.022, 0.022, 0.48, 8), metal, 0, 0.95, 0).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) add(stem, new CylinderGeometry(0.03, 0.03, 0.12, 8), grip, sx * 0.21, 0.95, 0).rotation.z = Math.PI / 2;
  add(stem, new CylinderGeometry(0.05, 0.05, 0.05, 10), new MeshBasicMaterial({ color: '#fff3c4' }), 0, 0.72, -0.04).rotation.x = Math.PI / 2;
  return {
    group: g,
    /** @param {number} dt @param {number} speed */
    update(dt, speed) {
      for (const w of wheels) w.rotation.x -= (dt * speed) / 0.085;
    },
  };
}

/** Clank: origin at road level, centred; brushes at the front (-z). */
export function buildClank() {
  const g = new Group();
  const rust = lam('#b5532e');
  const rustDark = lam('#7a3420');
  const paint = lam('#d9a23a'); // faded municipal yellow
  const steel = lam('#5d5866');
  const dark = lam('#1b1520');
  const bristle = lam('#3a2c22');
  const eyeMat = new MeshBasicMaterial({ color: '#fff4c8' });
  const beaconMat = new MeshBasicMaterial({ color: '#ffb02e' });
  const beamMat = new MeshBasicMaterial({ color: '#fff0b0', transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const steamMat = new MeshLambertMaterial({ color: '#e9e4ee', transparent: true, opacity: 0.55, depthWrite: false });

  const body = new Group(); // bobs and rattles
  g.add(body);
  // chassis + hopper
  add(body, new BoxGeometry(2.3, 0.85, 2.7), rust, 0, 0.85, 0.2);
  add(body, new BoxGeometry(2.36, 0.16, 2.76), rustDark, 0, 0.5, 0.2);
  add(body, new BoxGeometry(1.9, 1.15, 1.5), paint, 0, 1.85, 0.75);
  add(body, new BoxGeometry(1.96, 0.12, 1.56), rustDark, 0, 2.45, 0.75);
  for (let i = 0; i < 4; i++) add(body, new BoxGeometry(0.05, 0.75, 0.04), rustDark, -0.6 + i * 0.4, 1.85, -0.02); // hopper ribs
  // number plate on the back, stencilled
  const plate = new Mesh(new PlaneGeometry(1.1, 0.42), new MeshBasicMaterial({ map: stencilTexture('C-14'), transparent: true }));
  plate.position.set(0, 1.9, 1.51);
  body.add(plate);
  const backPlate = new Mesh(new PlaneGeometry(1.4, 0.5), new MeshBasicMaterial({ map: stencilTexture('CLANK'), transparent: true }));
  backPlate.position.set(0, 0.95, 1.56);
  body.add(backPlate);
  // cab "face": a scowling front with two headlight eyes and a grille mouth
  const face = new Group();
  face.position.set(0, 1.45, -1.05);
  body.add(face);
  add(face, new BoxGeometry(1.9, 0.95, 0.5), rust);
  const eyes = [-1, 1].map((sx) => {
    add(face, new CylinderGeometry(0.24, 0.26, 0.12, 16), dark, sx * 0.5, 0.08, -0.27).rotation.x = Math.PI / 2;
    const e = add(face, new CylinderGeometry(0.18, 0.18, 0.1, 16), eyeMat, sx * 0.5, 0.08, -0.32);
    e.rotation.x = Math.PI / 2;
    const brow = add(face, new BoxGeometry(0.55, 0.12, 0.14), rustDark, sx * 0.48, 0.36, -0.3);
    brow.rotation.z = sx * 0.32;
    return e;
  });
  add(face, new BoxGeometry(1.0, 0.24, 0.1), dark, 0, -0.3, -0.27);
  for (let i = 0; i < 6; i++) add(face, new BoxGeometry(0.05, 0.22, 0.12), steel, -0.4 + i * 0.16, -0.3, -0.29);
  // headlight beams onto the road ahead (towards the runner)
  for (const sx of [-1, 1]) {
    const beam = add(face, new ConeGeometry(0.9, 4.2, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -2.1), beamMat, sx * 0.5, 0.05, -0.35);
    beam.rotation.x = -0.28;
  }
  // smokestack + beacon
  add(body, new CylinderGeometry(0.16, 0.2, 0.9, 10), steel, 0.65, 2.9, 1.15);
  add(body, new TorusGeometry(0.18, 0.04, 6, 14), rustDark, 0.65, 3.33, 1.15).rotation.x = Math.PI / 2;
  const beacon = new Group();
  beacon.position.set(-0.55, 2.6, 0.75);
  body.add(beacon);
  add(beacon, new CylinderGeometry(0.16, 0.2, 0.22, 12), beaconMat, 0, 0.1, 0);
  const flare = add(beacon, new BoxGeometry(0.7, 0.06, 0.08), new MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }), 0, 0.12, 0);
  // wheels
  const wheels = [];
  for (const [x, z] of [[-1.12, -0.6], [1.12, -0.6], [-1.12, 1.15], [1.12, 1.15]]) {
    const w = add(g, new CylinderGeometry(0.42, 0.42, 0.34, 14), dark, x, 0.42, z);
    w.rotation.z = Math.PI / 2;
    add(w, new CylinderGeometry(0.2, 0.2, 0.36, 8), steel);
    wheels.push(w);
  }
  // front roller broom + two gutter brushes
  const roller = add(g, new CylinderGeometry(0.32, 0.32, 2.2, 12), bristle, 0, 0.33, -1.35);
  roller.rotation.z = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const r = add(roller, new BoxGeometry(0.06, 2.22, 0.06), lam('#5a4636'));
    const a = (i / 8) * Math.PI * 2;
    r.position.set(Math.cos(a) * 0.31, 0, Math.sin(a) * 0.31);
  }
  const brushes = [-1, 1].map((sx) => {
    const arm = add(g, new BoxGeometry(0.12, 0.12, 0.9), steel, sx * 1.05, 0.45, -1.4);
    arm.rotation.y = sx * -0.5;
    const b = new Group();
    b.position.set(sx * 1.3, 0.12, -1.75);
    g.add(b);
    add(b, new CylinderGeometry(0.15, 0.15, 0.2, 10), steel, 0, 0.18, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const t = add(b, new ConeGeometry(0.06, 0.62, 5), bristle, Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3);
      t.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
    }
    return b;
  });
  // grabber arms (raised in the lunge)
  const grabbers = [-1, 1].map((sx) => {
    const p = new Group();
    p.position.set(sx * 0.95, 2.0, -0.6);
    body.add(p);
    add(p, new BoxGeometry(0.16, 0.16, 1.3).translate(0, 0, -0.65), steel);
    const claw = add(p, new BoxGeometry(0.5, 0.36, 0.14), rustDark, 0, -0.08, -1.32);
    claw.rotation.x = 0.3;
    p.rotation.x = 0.9; // folded down along the face at rest
    return p;
  });
  // steam puffs (pooled)
  const puffs = Array.from({ length: 9 }, (_, i) => {
    const m = add(g, new SphereGeometry(0.22, 8, 6), steamMat, 0.65, 3.4, 1.15);
    m.userData.t = i / 9;
    return m;
  });

  let rage = 0;
  let lunge = 0;
  return {
    group: g,
    /**
     * @param {number} dt
     * @param {{time: number, speed: number, danger: number, lunge: boolean, lowFx: boolean}} s
     */
    update(dt, s) {
      rage += ((s.danger > 0 ? 1 : 0) - rage) * (1 - Math.exp(-dt * 4));
      lunge += ((s.lunge ? 1 : 0) - lunge) * (1 - Math.exp(-dt * 6));
      const roll = dt * Math.max(8, s.speed);
      for (const w of wheels) w.rotation.x -= roll / 0.42;
      roller.rotation.x -= roll / 0.32;
      brushes[0].rotation.y += dt * (9 + rage * 10);
      brushes[1].rotation.y -= dt * (9 + rage * 10);
      body.position.y = Math.abs(Math.sin(s.time * 17)) * (0.03 + rage * 0.05);
      body.rotation.z = Math.sin(s.time * 9) * (0.012 + rage * 0.02);
      body.rotation.x = -lunge * 0.18;
      beacon.rotation.y += dt * (4 + rage * 6);
      beaconMat.color.setHSL(0.09, 1, 0.55 + 0.15 * Math.sin(s.time * 12));
      flare.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(s.time * 6));
      const glare = 0.85 + 0.15 * Math.sin(s.time * 20) + rage * 0.3;
      for (const e of eyes) e.scale.set(1, 1, 1 + rage * 0.1);
      eyeMat.color.setRGB(1, 0.96 - rage * 0.35 * glare, 0.78 - rage * 0.5);
      beamMat.opacity = 0.1 + rage * 0.08;
      for (const [i, p] of grabbers.entries()) p.rotation.x = 0.9 - lunge * (1.9 + Math.sin(s.time * 14 + i) * 0.15);
      puffs.forEach((p) => {
        p.visible = !s.lowFx || p.userData.t < 0.34;
        p.userData.t = (p.userData.t + dt * (0.55 + rage * 0.5)) % 1;
        const t = p.userData.t;
        // Puffs rise and trail a little; kept short so they never drift into the chase camera.
        p.position.set(0.65 + Math.sin(t * 9 + p.id) * 0.15, 3.4 + t * 1.3, 1.15 + t * 0.9);
        p.scale.setScalar(0.5 + t * 0.9);
        p.material.opacity = 0.55;
      });
      steamMat.opacity = 0.5;
    },
  };
}
