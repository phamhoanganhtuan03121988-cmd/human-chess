import * as THREE from 'three';

const POSITION_MARKS: [number, number][] = [
  [1, 2], [7, 2], [1, 7], [7, 7],
  [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
  [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
];

let cachedBoardTexture: THREE.CanvasTexture | null = null;

/**
 * Creates or retrieves the high-resolution board canvas texture with traditional
 * Xiangqi grid, river divider ("楚河 漢界"), palace diagonals, and star marks.
 */
export function getBoardTexture(): THREE.CanvasTexture {
  if (cachedBoardTexture) {
    return cachedBoardTexture;
  }

  const canvas = document.createElement('canvas');
  const width = 1800;
  const height = 2000;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    // 1. Base board background: warm aged wood matching Human Chess (#e8c98f)
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      width * 0.2,
      width * 0.5,
      height * 0.5,
      width * 0.75,
    );
    bgGrad.addColorStop(0, '#f2d8a5');
    bgGrad.addColorStop(0.5, '#e8c98f');
    bgGrad.addColorStop(1, '#d5b273');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle natural wood grain lines across the board
    ctx.strokeStyle = 'rgba(120, 80, 30, 0.04)';
    ctx.lineWidth = 2;
    for (let y = 10; y < height; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(width * 0.3, y + (y % 8 - 4), width * 0.7, y - (y % 6 - 3), width, y);
      ctx.stroke();
    }

    // Outer board border
    const margin = 100;
    const spacing = 200;
    const gridX0 = margin;
    const gridX1 = margin + 8 * spacing; // 1700
    const gridY0 = margin;
    const gridY1 = margin + 9 * spacing; // 1900

    // Decorative double border
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 8;
    ctx.strokeRect(gridX0 - 30, gridY0 - 30, (gridX1 - gridX0) + 60, (gridY1 - gridY0) + 60);

    ctx.lineWidth = 3;
    ctx.strokeRect(gridX0 - 15, gridY0 - 15, (gridX1 - gridX0) + 30, (gridY1 - gridY0) + 30);

    // 2. Horizontal ranks (0 to 9)
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineCap = 'round';

    for (let r = 0; r <= 9; r++) {
      const y = gridY0 + r * spacing;
      ctx.beginPath();
      ctx.moveTo(gridX0, y);
      ctx.lineTo(gridX1, y);
      ctx.stroke();
    }

    // 3. Vertical files (0 to 8)
    for (let f = 0; f <= 8; f++) {
      const x = gridX0 + f * spacing;
      if (f === 0 || f === 8) {
        // Outer border lines run through the river
        ctx.beginPath();
        ctx.moveTo(x, gridY0);
        ctx.lineTo(x, gridY1);
        ctx.stroke();
      } else {
        // Files 1..7 stop at river (ranks 4 to 5)
        ctx.beginPath();
        ctx.moveTo(x, gridY0);
        ctx.lineTo(x, gridY0 + 4 * spacing);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, gridY0 + 5 * spacing);
        ctx.lineTo(x, gridY1);
        ctx.stroke();
      }
    }

    // 4. Palace diagonals
    // Top palace (ranks 0 to 2, files 3 to 5)
    ctx.beginPath();
    ctx.moveTo(gridX0 + 3 * spacing, gridY0);
    ctx.lineTo(gridX0 + 5 * spacing, gridY0 + 2 * spacing);
    ctx.moveTo(gridX0 + 5 * spacing, gridY0);
    ctx.lineTo(gridX0 + 3 * spacing, gridY0 + 2 * spacing);
    ctx.stroke();

    // Bottom palace (ranks 7 to 9, files 3 to 5)
    ctx.beginPath();
    ctx.moveTo(gridX0 + 3 * spacing, gridY0 + 7 * spacing);
    ctx.lineTo(gridX0 + 5 * spacing, gridY0 + 9 * spacing);
    ctx.moveTo(gridX0 + 5 * spacing, gridY0 + 7 * spacing);
    ctx.lineTo(gridX0 + 3 * spacing, gridY0 + 9 * spacing);
    ctx.stroke();

    // 5. Traditional star position marks
    const drawStar = (f: number, r: number) => {
      const cx = gridX0 + f * spacing;
      const cy = gridY0 + r * spacing;
      const d = 14;
      const len = 20;

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#5a3a1a';

      // Left corners (if f > 0)
      if (f > 0) {
        // Top-left
        ctx.beginPath();
        ctx.moveTo(cx - d - len, cy - d);
        ctx.lineTo(cx - d, cy - d);
        ctx.lineTo(cx - d, cy - d - len);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(cx - d - len, cy + d);
        ctx.lineTo(cx - d, cy + d);
        ctx.lineTo(cx - d, cy + d + len);
        ctx.stroke();
      }

      // Right corners (if f < 8)
      if (f < 8) {
        // Top-right
        ctx.beginPath();
        ctx.moveTo(cx + d + len, cy - d);
        ctx.lineTo(cx + d, cy - d);
        ctx.lineTo(cx + d, cy - d - len);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(cx + d + len, cy + d);
        ctx.lineTo(cx + d, cy + d);
        ctx.lineTo(cx + d, cy + d + len);
        ctx.stroke();
      }
    };

    const marks: [number, number][] = [
      [1, 2], [7, 2], [1, 7], [7, 7],
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
      [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
    ];
    for (const [mf, mr] of marks) {
      drawStar(mf, mr);
    }

    // 6. River Calligraphy ("楚 河" & "漢 界")
    const riverCenterY = gridY0 + 4.5 * spacing;
    ctx.font = 'bold 85px "Noto Serif TC", "Songti TC", "STSong", "PMingLiU", serif, sans-serif';
    ctx.fillStyle = 'rgba(90, 58, 26, 0.72)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Left half: 楚 河
    ctx.fillText('楚   河', gridX0 + 2 * spacing, riverCenterY);

    // Right half: 漢 界
    ctx.fillText('漢   界', gridX0 + 6 * spacing, riverCenterY);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  cachedBoardTexture = texture;
  return texture;
}

/**
 * Disposes cached board texture.
 */
export function disposeBoardTexture(): void {
  if (cachedBoardTexture) {
    cachedBoardTexture.dispose();
    cachedBoardTexture = null;
  }
}
