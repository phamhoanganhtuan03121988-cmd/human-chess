// Board geometry validation. Run with: npm run validate-board
// Prints every intersection check and every starting piece position,
// exiting non-zero on any problem.
import {
  FILES,
  INTERSECTION_COUNT,
  RANKS,
  getAllIntersections,
  isInPalace,
  isOnOwnSide,
  isValidCoordinate,
} from '../src/board/geometry.ts';
import { BOARD_MARGIN, getBoardPoint, getIntersectionPosition } from '../src/board/layout.ts';
import { INITIAL_POSITION } from '../src/board/initialPosition.ts';

const problems: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) problems.push(message);
};

// Intersections
const points = getAllIntersections();
check(FILES === 9, `expected 9 files, got ${FILES}`);
check(RANKS === 10, `expected 10 ranks, got ${RANKS}`);
check(INTERSECTION_COUNT === 90 && points.length === 90, `expected 90 intersections, got ${points.length}`);
check(new Set(points.map((p) => `${p.x},${p.y}`)).size === points.length, 'duplicate intersections');
for (const { x, y } of points) {
  const p = getBoardPoint(x, y);
  // On-line check: offset from the first line must be a whole number of spacings.
  check(p.x - BOARD_MARGIN === x && p.y - BOARD_MARGIN === y, `(${x},${y}) is not on an intersection`);
}
console.log(`Intersections: ${points.length} generated (${FILES} files × ${RANKS} ranks), all on grid lines`);

console.log('Corners:');
for (const [x, y] of [[0, 0], [8, 0], [0, 9], [8, 9]] as const) {
  const { left, top } = getIntersectionPosition(x, y);
  console.log(`  (${x},${y}) → left ${left.toFixed(4)}%  top ${top.toFixed(4)}%`);
}

// Starting position
check(INITIAL_POSITION.length === 32, `expected 32 starting pieces, got ${INITIAL_POSITION.length}`);
check(new Set(INITIAL_POSITION.map((p) => `${p.x},${p.y}`)).size === INITIAL_POSITION.length, 'two pieces share an intersection');
console.log(`\nStarting pieces (${INITIAL_POSITION.length}):`);
for (const p of INITIAL_POSITION) {
  const valid = isValidCoordinate(p.x, p.y);
  check(valid, `${p.side} ${p.type} has invalid coordinate (${p.x},${p.y})`);
  check(!valid || isOnOwnSide(p.y, p.side), `${p.side} ${p.type} (${p.x},${p.y}) is not on its own half`);
  if (p.type === 'general' || p.type === 'advisor') {
    check(isInPalace(p.x, p.y, p.side), `${p.side} ${p.type} (${p.x},${p.y}) is outside its palace`);
  }
  const pos = valid ? getIntersectionPosition(p.x, p.y) : undefined;
  console.log(
    `  ${valid ? 'OK' : '✗ '}  ${p.side.toUpperCase().padEnd(4)} ${p.type.toUpperCase().padEnd(8)} (${p.x},${p.y})` +
      (pos ? `  → ${pos.left.toFixed(2)}%, ${pos.top.toFixed(2)}%` : ''),
  );
}

if (problems.length) {
  console.error(`\nBoard validation FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nBoard validation PASSED.');
