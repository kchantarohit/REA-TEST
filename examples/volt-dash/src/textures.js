// Procedural canvas textures (no image assets).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function make(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Diagonal hazard stripes. */
export const stripeTexture = (a, b) =>
  make(128, 32, (g, w, h) => {
    g.fillStyle = b;
    g.fillRect(0, 0, w, h);
    g.fillStyle = a;
    for (let x = -h; x < w + h; x += 32) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 16, h);
      g.lineTo(x + 16 + h, 0);
      g.lineTo(x + h, 0);
      g.closePath();
      g.fill();
    }
  });

/** Window strips for building emissive maps. Pixel (0,0) stays black for roofs. */
export const windowsTexture = () =>
  make(
    64,
    128,
    (g, w, h) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      for (let y = 8; y < h - 4; y += 10) {
        for (let x = 6; x < w - 6; x += 14) {
          if (Math.random() < 0.55) {
            g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`;
            g.fillRect(x, y, 10, 4);
          }
        }
      }
    },
    true,
  );

export const roadTexture = () =>
  make(
    128,
    256,
    (g, w, h) => {
      g.fillStyle = '#1c1733';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = '#2e2752';
      g.fillRect(0, 0, w, 3);
      g.fillRect(0, h / 2, w, 2);
    },
    true,
  );

export const groundTexture = () =>
  make(
    64,
    64,
    (g, w, h) => {
      g.fillStyle = '#170d2b';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3b1c60';
      g.fillRect(0, 0, w, 2);
      g.fillRect(0, 0, 2, h);
    },
    true,
  );

/** Soft round blob used as the hero's fake shadow. */
export const blobTexture = () =>
  make(64, 64, (g, w) => {
    const r = w / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  });

/** Setting sun with horizontal cut-outs. */
export const sunTexture = () =>
  make(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffe27a');
    grad.addColorStop(0.55, '#ff8a5c');
    grad.addColorStop(1, '#ff3f8e');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) g.fillRect(0, 140 + i * 17, w, 2 + i * 1.6);
  });

/** Panel seams for cargo pods (tinted by material colour). */
export const panelTexture = () =>
  make(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h);
    g.fillRect(0, 12, w, 2);
    g.fillRect(0, h - 14, w, 2);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 56, w, 16);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let x = 8; x < w; x += 32) {
      g.beginPath();
      g.arc(x, 24, 2, 0, Math.PI * 2);
      g.arc(x + 16, h - 24, 2, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Missing road segment: a deep void fading darker towards the middle, with faint specks. */
export const gapTexture = () =>
  make(64, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a1640');
    grad.addColorStop(0.18, '#07040f');
    grad.addColorStop(0.82, '#07040f');
    grad.addColorStop(1, '#2a1640');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(180,160,255,${Math.random() * 0.35})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  });

/** Soft white dot for particles (snow, sparks, stars). */
export const dotTexture = () =>
  make(32, 32, (g, w) => {
    const r = w / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  });

/** Stencilled municipal lettering for Clank's plates (cream paint on a dark plate). */
export const stencilTexture = (text) =>
  make(256, 96, (g, w, h) => {
    g.fillStyle = '#2a1a1c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6a4030';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#f2dfb8';
    g.font = '900 58px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
    g.fillStyle = '#2a1a1c'; // stencil bridges
    for (let x = 30; x < w; x += 42) g.fillRect(x, 0, 3, h);
  });

/** Daily-word letter token: a cream sticker disc with an ink letter and a pink rim. */
export const letterTexture = (ch) =>
  make(128, 128, (g, w) => {
    const r = w / 2;
    g.fillStyle = '#ff4f7b';
    g.beginPath();
    g.arc(r, r, r - 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff1dc';
    g.beginPath();
    g.arc(r, r, r - 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#26122f';
    g.font = '900 80px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, r, r + 5);
  });
