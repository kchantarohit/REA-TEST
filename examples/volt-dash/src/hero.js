// "Volt": a small round courier robot built from primitives. Faces -z while running
// (the chase camera sees its cargo pack); faces the camera on the title screen.
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { LANE_TIME, LANE_W } from './track.js';
import { blobTexture } from './textures.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * @typedef {{time: number, running: boolean, speed: number, x: number, y: number, floor: number,
 *   grounded: boolean, vy: number, rolling: boolean, laneVel: number, facing: number,
 *   spring: boolean, shield: boolean, invuln: number}} HeroFrame
 */

export function createHero(scene) {
  const mat = {
    shell: new MeshLambertMaterial({ color: '#eef1f8' }),
    accent: new MeshLambertMaterial({ color: '#ff8a2b', emissive: '#4a1800' }),
    dark: new MeshLambertMaterial({ color: '#161b30' }),
    trim: new MeshLambertMaterial({ color: '#69739a' }),
    eye: new MeshBasicMaterial({ color: '#45f3ff' }),
    tip: new MeshBasicMaterial({ color: '#ff4fd8' }),
    ring: new MeshBasicMaterial({ color: '#45f3ff', transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }),
    shield: new MeshBasicMaterial({ color: '#4dc3ff', transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false }),
  };
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // root (position, facing) > tilt (lean, stumble, crash) > squash (scale) > spin (flip/roll)
  const root = new Group();
  const tilt = new Group();
  const squash = new Group();
  const spin = new Group();
  root.add(tilt);
  tilt.add(squash);
  squash.add(spin);

  add(spin, new SphereGeometry(0.5, 28, 20), mat.shell);
  add(spin, new TorusGeometry(0.49, 0.045, 8, 36), mat.accent, 0, -0.12, 0).rotation.x = Math.PI / 2;
  // Wide visor and its glowing eye: thin bands of slightly larger spheres on the front (-z).
  add(spin, new SphereGeometry(0.515, 28, 8, Math.PI * 1.5 - 0.95, 1.9, Math.PI / 2 - 0.62, 0.64), mat.dark);
  const eye = add(spin, new SphereGeometry(0.524, 24, 3, Math.PI * 1.5 - 0.62, 1.24, Math.PI / 2 - 0.44, 0.2), mat.eye);
  const earGeo = new CylinderGeometry(0.13, 0.13, 0.1, 18);
  const earLightGeo = new CylinderGeometry(0.06, 0.06, 0.02, 12);
  for (const sx of [-1, 1]) {
    add(spin, earGeo, mat.accent, sx * 0.49, 0.06, 0).rotation.z = Math.PI / 2;
    add(spin, earLightGeo, mat.tip, sx * 0.55, 0.06, 0).rotation.z = Math.PI / 2;
  }
  // Courier pack on the back (+z).
  add(spin, new BoxGeometry(0.58, 0.5, 0.26), mat.accent, 0, -0.02, 0.4);
  add(spin, new BoxGeometry(0.62, 0.08, 0.3), mat.dark, 0, 0.25, 0.4);
  add(spin, new BoxGeometry(0.4, 0.06, 0.02), mat.eye, 0, 0.06, 0.535);
  // Antenna with glowing tip.
  const antenna = new Group();
  antenna.position.set(0.1, 0.46, 0.06);
  spin.add(antenna);
  add(antenna, new CylinderGeometry(0.022, 0.022, 0.4, 8), mat.dark, 0, 0.2, 0);
  add(antenna, new SphereGeometry(0.075, 14, 10), mat.tip, 0, 0.42, 0);
  // Hover wheel + glow ring.
  add(spin, new CylinderGeometry(0.09, 0.15, 0.18, 14), mat.dark, 0, -0.5, 0);
  const wheel = new Group();
  wheel.position.y = -0.58;
  spin.add(wheel);
  add(wheel, new CylinderGeometry(0.19, 0.19, 0.14, 20), mat.dark).rotation.z = Math.PI / 2;
  add(wheel, new TorusGeometry(0.19, 0.025, 6, 24), mat.eye).rotation.y = Math.PI / 2;
  add(wheel, new BoxGeometry(0.16, 0.05, 0.3), mat.trim);
  const ring = add(spin, new TorusGeometry(0.34, 0.035, 6, 32), mat.ring, 0, -0.74, 0);
  ring.rotation.x = Math.PI / 2;

  const shield = add(root, new SphereGeometry(0.98, 24, 16), mat.shield, 0, 0.8, 0);
  const shadow = new Mesh(
    new PlaneGeometry(1.4, 1.4),
    new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(root, shadow);

  const cyan = new Color('#45f3ff');
  const green = new Color('#4dff88');
  const red = new Color('#ff3355');
  const st = { flipT: 1, landK: 0, stumbleK: 0, rollK: 0, lean: 0, yaw: 0, bob: 0, antA: 0, antV: 0, crashK: 0, crashed: false, facing: Math.PI, blink: 2 };

  return {
    reset() {
      Object.assign(st, { flipT: 1, landK: 0, stumbleK: 0, rollK: 0, crashK: 0, crashed: false });
      spin.rotation.x = 0;
      root.visible = true;
    },
    jump() {
      st.flipT = 0;
    },
    land(k) {
      st.landK = Math.max(st.landK, k);
    },
    stumble() {
      st.stumbleK = 1;
    },
    crash() {
      st.crashed = true;
    },
    /** @param {number} dt @param {HeroFrame} s */
    update(dt, s) {
      const k = (rate) => 1 - Math.exp(-rate * dt);
      if (st.crashed) st.crashK = Math.min(1, st.crashK + dt * 3);
      st.facing += (s.facing - st.facing) * k(7);
      const lv = clamp(s.laneVel / (LANE_W / LANE_TIME), -1, 1);
      st.lean += (-lv * 0.5 - st.lean) * k(16);
      st.yaw += (-lv * 0.35 - st.yaw) * k(16);
      root.position.set(s.x, s.y, smooth(st.crashK) * 0.6);
      root.rotation.y = st.facing + st.yaw;

      st.stumbleK = Math.max(0, st.stumbleK - dt * 1.6);
      tilt.rotation.z = st.lean;
      tilt.rotation.x = smooth(st.crashK) * 1.35 + Math.sin(st.stumbleK * 26) * 0.28 * st.stumbleK;

      st.rollK += ((s.rolling ? 1 : 0) - st.rollK) * k(20);
      st.landK = Math.max(0, st.landK - dt * 5);
      const sy = (1 - 0.42 * st.rollK) * (1 - 0.25 * st.landK);
      const sxz = (1 + 0.16 * st.rollK) * (1 + 0.14 * st.landK);
      squash.scale.set(sxz, sy, sxz);
      st.bob += dt * (s.running ? 16 : 3);
      const bobY = s.running ? (s.grounded ? Math.abs(Math.sin(st.bob)) * 0.07 : 0) : 0.05 + Math.sin(st.bob) * 0.05;
      squash.position.y = 0.8 * sy + bobY;

      if (s.rolling) st.flipT = 1;
      if (st.flipT < 1) {
        st.flipT = Math.min(1, st.flipT + dt / 0.55);
        spin.rotation.x = -TAU * smooth(st.flipT);
      } else if (s.rolling) {
        spin.rotation.x -= dt * 15;
      } else {
        let a = spin.rotation.x % TAU;
        if (a > Math.PI) a -= TAU;
        if (a < -Math.PI) a += TAU;
        spin.rotation.x = a * (1 - k(14));
      }
      wheel.rotation.x -= (dt * s.speed) / 0.19;

      // Antenna: damped spring that trails lane changes and vertical motion.
      const target = -st.lean * 1.3;
      st.antV += ((target - st.antA) * 140 - st.antV * 9) * dt;
      st.antA += st.antV * dt;
      antenna.rotation.z = st.antA - 0.15;
      antenna.rotation.x = (s.running ? 0.3 : 0.05) + clamp(-s.vy * 0.02, -0.35, 0.35);

      st.blink -= dt;
      if (st.blink < -0.12) st.blink = 2 + Math.random() * 3;
      eye.visible = st.crashed || st.blink > 0;
      mat.eye.color.copy(st.crashed ? red : cyan);

      ring.scale.setScalar(1 + Math.sin(s.time * 11) * 0.08);
      mat.ring.color.copy(s.spring ? green : cyan);
      mat.ring.opacity = 0.6 + 0.25 * Math.sin(s.time * 11);

      shield.visible = s.shield;
      shield.scale.setScalar(1 + Math.sin(s.time * 6) * 0.03);
      mat.shield.opacity = 0.2 + 0.08 * Math.sin(s.time * 9);
      root.visible = !(s.invuln > 0 && Math.floor(s.time * 14) % 2 === 0);

      const above = Math.max(0, s.y - s.floor);
      const sc = 1 / (1 + above * 0.4);
      shadow.position.set(s.x, s.floor + 0.03, root.position.z);
      shadow.scale.setScalar(sc * (1 + 0.15 * st.rollK));
      shadow.material.opacity = 0.75 * sc;
    },
  };
}
