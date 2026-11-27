// The hero rig: positions, leans, squashes, flips and rolls whichever character model
// is selected (characters.js). Faces -z while running (the chase camera sees its back);
// faces the camera on menus. The collision box is the same for every character.
import {
  AdditiveBlending,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { LANE_TIME, LANE_W } from './track.js';
import { buildModel } from './characters.js';
import { blobTexture } from './textures.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * @typedef {{time: number, running: boolean, speed: number, x: number, y: number, floor: number,
 *   grounded: boolean, vy: number, rolling: boolean, laneVel: number, facing: number,
 *   spring: boolean, shield: boolean, hyper: boolean, invuln: number, spinY?: number}} HeroFrame
 */

export function createHero(scene) {
  // root (position, facing) > tilt (lean, stumble, crash) > squash (scale) > spin (flip/roll) > model
  const root = new Group();
  const tilt = new Group();
  const squash = new Group();
  const spin = new Group();
  root.add(tilt);
  tilt.add(squash);
  squash.add(spin);

  const shieldMat = new MeshBasicMaterial({ color: '#4dc3ff', transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false });
  const shield = new Mesh(new SphereGeometry(0.98, 24, 16), shieldMat);
  shield.position.y = 0.8;
  root.add(shield);
  const trailMat = new MeshBasicMaterial({ color: '#b36bff', transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false });
  const trail = new Mesh(new ConeGeometry(0.5, 2.6, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.5), trailMat);
  const auraMat = new MeshBasicMaterial({ color: '#c9a2ff', transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false });
  const aura = new Mesh(new SphereGeometry(0.85, 20, 14), auraMat);
  trail.add(aura);
  aura.position.z = 0;
  trail.position.y = 0.8;
  root.add(trail);
  const shadow = new Mesh(
    new PlaneGeometry(1.4, 1.4),
    new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(root, shadow);

  /** @type {Record<string, import('./characters.js').Model>} */
  const cache = {};
  let model = null;
  let modelId = '';
  function setModel(id) {
    if (id === modelId) return;
    if (model) spin.remove(model.group);
    model = cache[id] || (cache[id] = buildModel(id));
    modelId = id;
    spin.add(model.group);
  }
  setModel('volt');

  const st = { flipT: 1, landK: 0, stumbleK: 0, rollK: 0, lean: 0, yaw: 0, bob: 0, crashK: 0, crashed: false, facing: Math.PI, blink: 2, popK: 0 };
  const ctx = { lean: 0, crashed: false, eyesOpen: true, time: 0, running: false, speed: 0, vy: 0 };

  return {
    setModel,
    get modelId() {
      return modelId;
    },
    /** Little hop + squash used when a new character is shown. */
    pop() {
      st.popK = 1;
    },
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
    revive() {
      st.crashed = false;
      st.crashK = 0;
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
      root.rotation.y = st.facing + st.yaw + (s.spinY || 0);

      st.stumbleK = Math.max(0, st.stumbleK - dt * 1.6);
      tilt.rotation.z = st.lean;
      tilt.rotation.x = smooth(st.crashK) * 1.35 + Math.sin(st.stumbleK * 26) * 0.28 * st.stumbleK + (s.hyper ? -0.25 : 0);

      st.rollK += ((s.rolling ? 1 : 0) - st.rollK) * k(20);
      st.landK = Math.max(0, st.landK - dt * 5);
      st.popK = Math.max(0, st.popK - dt * 2.2);
      const pop = Math.sin(st.popK * Math.PI);
      const sy = (1 - 0.42 * st.rollK) * (1 - 0.25 * st.landK) * (1 + 0.12 * pop);
      const sxz = (1 + 0.16 * st.rollK) * (1 + 0.14 * st.landK) * (1 - 0.06 * pop);
      squash.scale.set(sxz, sy, sxz);
      st.bob += dt * (s.running ? 16 : 3);
      const bobY = s.running ? (s.grounded ? Math.abs(Math.sin(st.bob)) * 0.07 : 0) : 0.05 + Math.sin(st.bob) * 0.05;
      squash.position.y = 0.8 * sy + bobY + pop * 0.35;

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

      st.blink -= dt;
      if (st.blink < -0.12) st.blink = 2 + Math.random() * 3;
      Object.assign(ctx, {
        lean: st.lean, crashed: st.crashed, eyesOpen: st.crashed || st.blink > 0, time: s.time,
        running: s.running, speed: s.speed, vy: s.vy,
      });
      model.update(dt, ctx);

      shield.visible = s.shield;
      shield.scale.setScalar(1 + Math.sin(s.time * 6) * 0.03);
      shieldMat.opacity = 0.2 + 0.08 * Math.sin(s.time * 9);
      trail.visible = s.hyper;
      trailMat.opacity = 0.25 + 0.1 * Math.sin(s.time * 30);
      aura.scale.setScalar(1 + 0.08 * Math.sin(s.time * 20));
      root.visible = !(s.invuln > 0 && !s.hyper && Math.floor(s.time * 14) % 2 === 0);

      const above = Math.max(0, s.y - Math.max(0, s.floor));
      const sc = 1 / (1 + above * 0.4);
      shadow.visible = s.floor >= 0;
      shadow.position.set(s.x, Math.max(0, s.floor) + 0.03, root.position.z);
      shadow.scale.setScalar(sc * (1 + 0.15 * st.rollK));
      shadow.material.opacity = 0.75 * sc;
    },
  };
}
