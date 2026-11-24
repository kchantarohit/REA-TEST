// Neon canyon highway at dusk: sky dome, sun, distant ridges, scrolling road and
// recycled scenery chunks (buildings with window strips, neon posts, rocks, arches).
import {
  BackSide,
  BoxGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { LANE_W } from './track.js';
import { groundTexture, roadTexture, sunTexture, windowsTexture } from './textures.js';

export const FOG_COLOR = '#6b2a72';
const ROAD_W = LANE_W * 3 + 1.0;
const ROAD_LEN = 260;
const CHUNK_LEN = 40;
const CHUNKS = 5;
const rand = (a, b) => a + Math.random() * (b - a);

function skyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new Color('#0c0724') },
      mid: { value: new Color('#3a1863') },
      low: { value: new Color(FOG_COLOR) },
      glow: { value: new Color('#ff8a63') },
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

export function createWorld(scene, renderer) {
  scene.fog = new Fog(FOG_COLOR, 38, 170);
  scene.add(new HemisphereLight('#a596ff', '#2b1036', 1.8));
  const key = new DirectionalLight('#ffc9a6', 2.1);
  key.position.set(-5, 12, 9);
  scene.add(key);

  const sky = new Mesh(new SphereGeometry(450, 32, 16), skyMaterial());
  sky.renderOrder = -1;
  scene.add(sky);

  const sun = new Mesh(
    new PlaneGeometry(170, 170),
    new MeshBasicMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false }),
  );
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

  // Road, canyon floor, glowing lane lines and curbs. Static meshes; the textures scroll.
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
  strip(ROAD_W, ROAD_LEN, new MeshLambertMaterial({ map: roadTex }), 0, 0);
  strip(400, ROAD_LEN, new MeshLambertMaterial({ map: groundTex }), 0, -0.05);
  const laneMat = new MeshBasicMaterial({ color: '#45f3ff' });
  const edgeMat = new MeshBasicMaterial({ color: '#ff4fd8' });
  for (const x of [-LANE_W / 2, LANE_W / 2]) strip(0.09, ROAD_LEN, laneMat, x, 0.012);
  for (const s of [-1, 1]) {
    strip(0.16, ROAD_LEN, edgeMat, s * (ROAD_W / 2 - 0.12), 0.012);
    const curb = new Mesh(new BoxGeometry(0.4, 0.32, ROAD_LEN), new MeshLambertMaterial({ color: '#251a45' }));
    curb.position.set(s * (ROAD_W / 2 + 0.2), 0.16, 20 - ROAD_LEN / 2);
    scene.add(curb);
    const cap = new Mesh(new BoxGeometry(0.42, 0.05, ROAD_LEN), edgeMat);
    cap.position.set(s * (ROAD_W / 2 + 0.2), 0.34, 20 - ROAD_LEN / 2);
    scene.add(cap);
  }

  // Scenery chunks, recycled from behind the camera to the far end.
  const bMats = ['#45f3ff', '#ff5ad1', '#ffb347'].map(
    (e) => new MeshLambertMaterial({ color: '#1b1636', emissive: e, emissiveMap: windowsTexture() }),
  );
  const postMats = [new MeshBasicMaterial({ color: '#ff4fd8' }), new MeshBasicMaterial({ color: '#45f3ff' })];
  const postGeo = new BoxGeometry(0.26, 6.5, 0.26).translate(0, 3.25, 0);
  const rockMat = new MeshLambertMaterial({ color: '#4b2466', flatShading: true });
  const rockGeo = new DodecahedronGeometry(1, 0);
  const archMat = new MeshLambertMaterial({ color: '#221a3d' });
  const archGlow = new MeshBasicMaterial({ color: '#45f3ff' });
  const archPost = new BoxGeometry(0.5, 8, 0.5).translate(0, 4, 0);
  const archBeam = new BoxGeometry(ROAD_W + 4, 0.6, 0.6);
  const archStrip = new BoxGeometry(ROAD_W + 3.6, 0.1, 0.62);

  const chunks = [];
  for (let i = 0; i < CHUNKS; i++) {
    const group = new Group();
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
      for (let k = 0; k < 2; k++) {
        const p = new Mesh(postGeo, postMats[k]);
        p.position.set(side * (ROAD_W / 2 + 1.2), 0, -(k * 20 + 6));
        group.add(p);
      }
      const r = new Mesh(rockGeo, rockMat);
      r.userData = { side };
      group.add(r);
      rocks.push(r);
    }
    const arch = new Group();
    for (const s of [-1, 1]) {
      const p = new Mesh(archPost, archMat);
      p.position.x = s * (ROAD_W / 2 + 1.7);
      arch.add(p);
    }
    const beam = new Mesh(archBeam, archMat);
    beam.position.y = 8;
    const glow = new Mesh(archStrip, archGlow);
    glow.position.y = 7.68;
    arch.add(beam, glow);
    arch.position.z = -16;
    group.add(arch);
    scene.add(group);
    chunks.push({ group, buildings, rocks, arch, s: 0 });
  }

  function layout(c) {
    for (const b of c.buildings) {
      const { side, k, w } = b.userData;
      b.visible = Math.random() < 0.92;
      b.material = bMats[(Math.random() * bMats.length) | 0];
      b.position.set(side * (ROAD_W / 2 + 3 + w / 2 + rand(0, 4)), 0, -(k * 13 + rand(3, 7)));
    }
    for (const r of c.rocks) {
      r.position.set(r.userData.side * rand(17, 26), -1, -rand(0, CHUNK_LEN));
      r.scale.set(rand(5, 10), rand(4, 13), rand(5, 10));
      r.rotation.y = rand(0, Math.PI);
    }
    c.arch.visible = Math.random() < 0.3;
  }

  return {
    sky,
    /** Lay chunks out fresh around track position d. */
    reset(d) {
      chunks.forEach((c, i) => {
        c.s = d - 20 + i * CHUNK_LEN;
        layout(c);
      });
    },
    update(d, camera) {
      roadTex.offset.y = (d / 16) % 1;
      groundTex.offset.y = (d / 8) % 1;
      for (const c of chunks) {
        if (c.s + CHUNK_LEN < d - 20) {
          c.s += CHUNKS * CHUNK_LEN;
          layout(c);
        }
        c.group.position.z = -(c.s - d);
      }
      sky.position.copy(camera.position);
    },
  };
}
