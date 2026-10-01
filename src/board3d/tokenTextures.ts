import * as THREE from 'three';
import { PIECE_GLYPHS } from '../config/pieceIdentity.ts';
import type { PieceSide, PieceType } from '../config/assets.ts';

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Creates or retrieves a cached CanvasTexture for the top surface of a 3D Xiangqi token.
 */
export function getTokenTexture(side: PieceSide, type: PieceType): THREE.CanvasTexture {
  const key = `${side}-${type}`;
  const existing = textureCache.get(key);
  if (existing) {
    return existing;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const center = size / 2;
    const radius = size / 2 - 8;

    // Base circular clip
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Wood / parchment radial gradient matching 2D Human Chess
    const woodGrad = ctx.createRadialGradient(center * 0.75, center * 0.65, radius * 0.1, center, center, radius);
    woodGrad.addColorStop(0, '#faf0d8');
    woodGrad.addColorStop(0.5, '#f4e0b5');
    woodGrad.addColorStop(0.85, '#e0be7e');
    woodGrad.addColorStop(1, '#cda25b');
    ctx.fillStyle = woodGrad;
    ctx.fill();

    // Subtle concentric wood grain rings
    ctx.strokeStyle = 'rgba(160, 110, 45, 0.12)';
    ctx.lineWidth = 3;
    for (let r = 40; r < radius - 20; r += 28) {
      ctx.beginPath();
      ctx.arc(center + (r % 6 - 3), center + (r % 4 - 2), r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Inset decorative groove
    ctx.beginPath();
    ctx.arc(center, center, radius - 26, 0, Math.PI * 2);
    ctx.strokeStyle = side === 'red' ? 'rgba(179, 38, 30, 0.4)' : 'rgba(30, 79, 163, 0.4)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Metallic rim highlight
    ctx.beginPath();
    ctx.arc(center, center, radius - 6, 0, Math.PI * 2);
    ctx.strokeStyle = side === 'red' ? '#c9a24a' : '#9bb5cf';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Chinese glyph
    const glyph = PIECE_GLYPHS[side][type] ?? '?';
    ctx.fillStyle = side === 'red' ? '#b3261e' : '#1e4fa3';
    ctx.font = 'bold 230px "Noto Serif TC", "Songti TC", "STSong", "PMingLiU", "MingLiU", serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Soft glyph shadow for carved feel
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    ctx.fillText(glyph, center, center + 8);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.center.set(0.5, 0.5);
  texture.rotation = Math.PI;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  textureCache.set(key, texture);
  return texture;
}

/**
 * Disposes all cached textures to free GPU memory.
 */
export function disposeTokenTextures(): void {
  for (const texture of textureCache.values()) {
    texture.dispose();
  }
  textureCache.clear();
}
