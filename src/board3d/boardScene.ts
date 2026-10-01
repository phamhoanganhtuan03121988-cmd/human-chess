import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BoardPerspective } from '../board/perspective.ts';
import type { Position, Side, PieceType } from '../engine/types.ts';
import type { PiecePlacement } from '../board/initialPosition.ts';
import type { Move } from '../engine/types.ts';
import { engineToWorld, worldToEngine } from './coordinates.ts';
import { getBoardTexture, disposeBoardTexture } from './boardTexture.ts';
import { getTokenTexture, disposeTokenTextures } from './tokenTextures.ts';

export interface BoardSceneOptions {
  perspective: BoardPerspective;
  onSelectPosition: (pos: Position) => void;
  reducedMotion: boolean;
}

interface PieceMeshEntry {
  mesh: THREE.Group;
  side: Side;
  type: PieceType;
  position: Position;
  topMaterial: THREE.MeshStandardMaterial;
  bodyMaterial: THREE.MeshStandardMaterial;
  rimMesh: THREE.Mesh;
}

export class Board3DScene {
  private container: HTMLElement;
  private options: BoardSceneOptions;
  private disposed = false;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private animationFrameId: number | null = null;

  // Visual groups
  private boardGroup: THREE.Group;
  private boardMesh: THREE.Mesh | null = null;
  private piecesGroup: THREE.Group;
  private markersGroup: THREE.Group;

  // Active pieces cache
  private pieceEntries = new Map<string, PieceMeshEntry>();

  // Shared geometries
  private tokenGeometry: THREE.CylinderGeometry;
  private rimGeometry: THREE.TorusGeometry;
  private ringGeometry: THREE.RingGeometry;
  private dotGeometry: THREE.CircleGeometry;

  // Shared materials
  private redBodyMaterial: THREE.MeshStandardMaterial;
  private blueBodyMaterial: THREE.MeshStandardMaterial;
  private redRimMaterial: THREE.MeshStandardMaterial;
  private blueRimMaterial: THREE.MeshStandardMaterial;
  private selectedRingMaterial: THREE.MeshBasicMaterial;
  private targetRingMaterial: THREE.MeshBasicMaterial;
  private captureRingMaterial: THREE.MeshBasicMaterial;
  private checkRingMaterial: THREE.MeshBasicMaterial;
  private lastMoveRingMaterial: THREE.MeshBasicMaterial;

  // Raycasting & Pointer Tracking
  private raycaster = new THREE.Raycaster();
  private ndcVector = new THREE.Vector2();
  private boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointerDownPos = { x: 0, y: 0 };
  private pointerDownTime = 0;
  private activePointers = 0;
  private isMultiTouch = false;

  // Animation state for moving piece
  private movingPieceState: {
    entry: PieceMeshEntry;
    fromWorld: { x: number; z: number };
    toWorld: { x: number; z: number };
    startTime: number;
    duration: number;
  } | null = null;

  constructor(container: HTMLElement, options: BoardSceneOptions) {
    this.container = container;
    this.options = options;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // transparent to inherit game ambient background

    // 2. Camera
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.resetCamera();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6.0;
    this.controls.maxDistance = 22.0;
    this.controls.maxPolarAngle = Math.PI / 2.18; // prevent dipping beneath board
    this.controls.target.set(0, 0, 0);

    // 5. Lighting
    this.setupLighting();

    // 6. Shared assets
    this.tokenGeometry = new THREE.CylinderGeometry(0.42, 0.435, 0.15, 36);
    this.rimGeometry = new THREE.TorusGeometry(0.425, 0.016, 8, 36);
    this.ringGeometry = new THREE.RingGeometry(0.38, 0.46, 36);
    this.dotGeometry = new THREE.CircleGeometry(0.12, 24);

    this.redBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x54120e,
      roughness: 0.38,
      metalness: 0.2,
    });
    this.blueBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f2547,
      roughness: 0.38,
      metalness: 0.2,
    });
    this.redRimMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4aa50,
      roughness: 0.25,
      metalness: 0.8,
    });
    this.blueRimMaterial = new THREE.MeshStandardMaterial({
      color: 0xa8c2dd,
      roughness: 0.22,
      metalness: 0.85,
    });

    this.selectedRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xf6e3a1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.targetRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x3f9a6b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.captureRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xc8321f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    this.checkRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xe0321f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.lastMoveRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xc9a24a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    // 7. Groups
    this.boardGroup = new THREE.Group();
    this.piecesGroup = new THREE.Group();
    this.markersGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);
    this.scene.add(this.markersGroup);

    // 8. Build Board Slab
    this.buildBoard();

    // 9. Event Listeners
    this.setupEvents();

    // 10. Start render loop
    this.renderLoop();
  }

  private setupLighting(): void {
    // Soft warm ambient
    const ambient = new THREE.AmbientLight(0xfff6ea, 1.1);
    this.scene.add(ambient);

    // Key directional light with soft shadows
    const keyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    keyLight.position.set(6, 14, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Fill rim light from opposite angle
    const fillLight = new THREE.DirectionalLight(0x8fa8cf, 0.7);
    fillLight.position.set(-8, 10, -8);
    this.scene.add(fillLight);
  }

  private buildBoard(): void {
    const boardTexture = getBoardTexture();

    // Top surface material with high-res Xiangqi markings
    const topMaterial = new THREE.MeshStandardMaterial({
      map: boardTexture,
      roughness: 0.45,
      metalness: 0.05,
    });

    // Dark hardwood side and bottom material
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b2310,
      roughness: 0.6,
      metalness: 0.1,
    });

    // Materials order for BoxGeometry: [right, left, top, bottom, front, back]
    const materials = [
      sideMaterial,
      sideMaterial,
      topMaterial,
      sideMaterial,
      sideMaterial,
      sideMaterial,
    ];

    // Width = 9.0, Height/thickness = 0.45, Depth = 10.0
    const slabGeometry = new THREE.BoxGeometry(9.0, 0.45, 10.0);
    this.boardMesh = new THREE.Mesh(slabGeometry, materials);
    this.boardMesh.position.set(0, -0.225, 0); // Top surface at y = 0
    this.boardMesh.receiveShadow = true;

    // Wooden plinth / pedestal under the board slab
    const plinthGeo = new THREE.BoxGeometry(9.4, 0.25, 10.4);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x241407,
      roughness: 0.6,
      metalness: 0.15,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.set(0, -0.45, 0); // Well below top surface (top at Y = -0.325)
    plinthMesh.receiveShadow = true;

    this.boardGroup.add(this.boardMesh);
    this.boardGroup.add(plinthMesh);

    // Align board slab orientation with perspective
    this.updateBoardPerspective();
  }

  public resetCamera(): void {
    this.camera.position.set(0, 11.2, 9.8);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  public updatePerspective(perspective: BoardPerspective): void {
    if (this.options.perspective !== perspective) {
      this.options.perspective = perspective;
      this.updateBoardPerspective();
    }
  }

  private updateBoardPerspective(): void {
    if (!this.boardMesh) return;
    // When perspective is 'blue', rotating the board group 180° flips the river text upright for Blue
    this.boardMesh.rotation.y = this.options.perspective === 'blue' ? Math.PI : 0;
  }

  public updateReducedMotion(reduced: boolean): void {
    this.options.reducedMotion = reduced;
  }

  /**
   * Syncs piece meshes with the engine placements.
   */
  public syncPieces(
    placements: readonly PiecePlacement[],
    selectedPos: Position | null,
    checkedGeneral: Position | null,
  ): void {
    const activeKeys = new Set<string>();

    for (const p of placements) {
      const pos = { x: p.x, y: p.y };
      const key = `${p.x},${p.y}`;
      activeKeys.add(key);

      const isSelected = selectedPos !== null && selectedPos.x === p.x && selectedPos.y === p.y;
      const isChecked = checkedGeneral !== null && checkedGeneral.x === p.x && checkedGeneral.y === p.y;

      let entry = this.pieceEntries.get(key);
      if (!entry || entry.side !== p.side || entry.type !== p.type) {
        if (entry) {
          this.piecesGroup.remove(entry.mesh);
          entry.topMaterial.dispose();
        }
        entry = this.createPieceMesh(p.side, p.type, pos);
        this.pieceEntries.set(key, entry);
        this.piecesGroup.add(entry.mesh);
      }

      // Position in world space
      const world = engineToWorld(pos, this.options.perspective);
      const targetY = isSelected ? 0.3 : 0.075;

      // If this piece is currently undergoing a parabolic move, skip instant reposition
      if (!this.movingPieceState || this.movingPieceState.entry !== entry) {
        entry.mesh.position.set(world.x, targetY, world.z);
      }

      // Apply alert/check glow
      if (isChecked) {
        entry.rimMesh.material = this.checkRingMaterial;
      } else {
        entry.rimMesh.material = entry.side === 'red' ? this.redRimMaterial : this.blueRimMaterial;
      }
    }

    // Remove pieces no longer on the board
    for (const [key, entry] of this.pieceEntries.entries()) {
      if (!activeKeys.has(key)) {
        this.piecesGroup.remove(entry.mesh);
        entry.topMaterial.dispose();
        this.pieceEntries.delete(key);
      }
    }
  }

  private createPieceMesh(side: Side, type: PieceType, pos: Position): PieceMeshEntry {
    const group = new THREE.Group();
    group.userData = { position: { x: pos.x, y: pos.y }, side, type };

    const tokenTexture = getTokenTexture(side, type);
    const topMaterial = new THREE.MeshStandardMaterial({
      map: tokenTexture,
      roughness: 0.35,
      metalness: 0.1,
    });
    const bodyMaterial = side === 'red' ? this.redBodyMaterial : this.blueBodyMaterial;
    const bottomMaterial = new THREE.MeshStandardMaterial({
      color: 0x221307,
      roughness: 0.8,
    });

    // Cylinder materials: [side, top, bottom]
    const materials = [bodyMaterial, topMaterial, bottomMaterial];
    const cylinder = new THREE.Mesh(this.tokenGeometry, materials);
    cylinder.userData = group.userData;
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    group.add(cylinder);

    // Beveled rim
    const rimMaterial = side === 'red' ? this.redRimMaterial : this.blueRimMaterial;
    const rimMesh = new THREE.Mesh(this.rimGeometry, rimMaterial);
    rimMesh.userData = group.userData;
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.075;
    group.add(rimMesh);

    return {
      mesh: group,
      side,
      type,
      position: pos,
      topMaterial,
      bodyMaterial,
      rimMesh,
    };
  }

  /**
   * Syncs ground indicators: legal moves, selected ring, check alert, last move.
   */
  public syncMarkers(
    selectedPos: Position | null,
    legalMoveTargets: readonly Position[],
    captureTargets: readonly Position[],
    lastMove: Move | null,
    checkedGeneral: Position | null,
  ): void {
    // Clear old markers
    while (this.markersGroup.children.length > 0) {
      const child = this.markersGroup.children[0];
      this.markersGroup.remove(child);
    }

    // 1. Selected ring under active piece
    if (selectedPos) {
      const selWorld = engineToWorld(selectedPos, this.options.perspective);
      const selRing = new THREE.Mesh(this.ringGeometry, this.selectedRingMaterial);
      selRing.rotation.x = -Math.PI / 2;
      selRing.position.set(selWorld.x, 0.006, selWorld.z);
      this.markersGroup.add(selRing);
    }

    // 2. Empty legal destination dots
    const captureSet = new Set(captureTargets.map((c) => `${c.x},${c.y}`));
    for (const target of legalMoveTargets) {
      if (captureSet.has(`${target.x},${target.y}`)) continue;
      const w = engineToWorld(target, this.options.perspective);

      const dot = new THREE.Mesh(this.dotGeometry, this.targetRingMaterial);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(w.x, 0.005, w.z);

      const ring = new THREE.Mesh(this.ringGeometry, this.targetRingMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.scale.set(0.65, 0.65, 0.65);
      ring.position.set(w.x, 0.005, w.z);

      this.markersGroup.add(dot);
      this.markersGroup.add(ring);
    }

    // 3. Capture target rings
    for (const target of captureTargets) {
      const w = engineToWorld(target, this.options.perspective);
      const ring = new THREE.Mesh(this.ringGeometry, this.captureRingMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(w.x, 0.008, w.z);
      this.markersGroup.add(ring);
    }

    // 4. Last move indicators
    if (lastMove) {
      const fromW = engineToWorld(lastMove.from, this.options.perspective);
      const toW = engineToWorld(lastMove.to, this.options.perspective);

      const fromRing = new THREE.Mesh(this.dotGeometry, this.lastMoveRingMaterial);
      fromRing.rotation.x = -Math.PI / 2;
      fromRing.scale.set(0.7, 0.7, 0.7);
      fromRing.position.set(fromW.x, 0.004, fromW.z);

      const toRing = new THREE.Mesh(this.ringGeometry, this.lastMoveRingMaterial);
      toRing.rotation.x = -Math.PI / 2;
      toRing.position.set(toW.x, 0.004, toW.z);

      this.markersGroup.add(fromRing);
      this.markersGroup.add(toRing);
    }

    // 5. In-check General alert
    if (checkedGeneral) {
      const genW = engineToWorld(checkedGeneral, this.options.perspective);
      const checkRing = new THREE.Mesh(this.ringGeometry, this.checkRingMaterial);
      checkRing.rotation.x = -Math.PI / 2;
      checkRing.scale.set(1.15, 1.15, 1.15);
      checkRing.position.set(genW.x, 0.007, genW.z);
      this.markersGroup.add(checkRing);
    }
  }

  /**
   * Starts a smooth parabolic movement animation for a piece.
   */
  public animateMove(move: Move, durationMs = 240): void {
    if (this.options.reducedMotion) return;

    const key = `${move.from.x},${move.from.y}`;
    const entry = this.pieceEntries.get(key);
    if (!entry) return;

    const fromWorld = engineToWorld(move.from, this.options.perspective);
    const toWorld = engineToWorld(move.to, this.options.perspective);

    this.movingPieceState = {
      entry,
      fromWorld,
      toWorld,
      startTime: performance.now(),
      duration: durationMs,
    };
  }

  private setupEvents(): void {
    const dom = this.renderer.domElement;

    // Track pointers to safely distinguish tap from drag/orbit
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerCancel);

    window.addEventListener('resize', this.onWindowResize);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.activePointers++;
    if (this.activePointers > 1) {
      this.isMultiTouch = true;
    } else {
      this.isMultiTouch = false;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerDownTime = performance.now();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.activePointers = Math.max(0, this.activePointers - 1);

    if (this.isMultiTouch) {
      if (this.activePointers === 0) {
        this.isMultiTouch = false;
      }
      return;
    }

    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    const elapsed = performance.now() - this.pointerDownTime;

    // User gesture constraint: short movement (<= 7px) within 600ms = deliberate tap/select
    if (dist <= 7 && elapsed < 600) {
      this.handlePointerClick(e.clientX, e.clientY);
    }
  };

  private onPointerCancel = (): void => {
    this.activePointers = 0;
    this.isMultiTouch = false;
  };

  private handlePointerClick(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.ndcVector.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndcVector, this.camera);

    // 1. Raycast against piece meshes first
    const pieceMeshes = Array.from(this.pieceEntries.values()).map((e) => e.mesh);
    const pieceIntersects = this.raycaster.intersectObjects(pieceMeshes, true);

    if (pieceIntersects.length > 0) {
      let topObj: THREE.Object3D | null = pieceIntersects[0].object;
      while (topObj && !topObj.userData?.position && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj?.userData?.position) {
        this.options.onSelectPosition(topObj.userData.position);
        return;
      }
    }

    // 2. Raycast against board plane for empty intersections
    const intersectionPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.boardPlane, intersectionPoint);
    if (hit) {
      const enginePos = worldToEngine(intersectionPoint.x, intersectionPoint.z, this.options.perspective, 0.48);
      if (enginePos) {
        this.options.onSelectPosition(enginePos);
      }
    }
  }

  private onWindowResize = (): void => {
    if (this.disposed || !this.container) return;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 600;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private renderLoop = (): void => {
    if (this.disposed) return;
    this.animationFrameId = requestAnimationFrame(this.renderLoop);

    // Update OrbitControls
    this.controls.update();

    // Update moving piece parabolic trajectory
    if (this.movingPieceState) {
      const now = performance.now();
      const progress = Math.min(1, (now - this.movingPieceState.startTime) / this.movingPieceState.duration);

      const x = THREE.MathUtils.lerp(this.movingPieceState.fromWorld.x, this.movingPieceState.toWorld.x, progress);
      const z = THREE.MathUtils.lerp(this.movingPieceState.fromWorld.z, this.movingPieceState.toWorld.z, progress);
      // Parabolic arc in Y
      const arc = Math.sin(progress * Math.PI) * 0.65;
      const y = 0.075 + arc;

      this.movingPieceState.entry.mesh.position.set(x, y, z);

      if (progress >= 1) {
        this.movingPieceState = null;
      }
    }

    // Render scene
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Event listeners
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('resize', this.onWindowResize);

    // Controls
    this.controls.dispose();

    // Pieces
    for (const entry of this.pieceEntries.values()) {
      this.piecesGroup.remove(entry.mesh);
      entry.topMaterial.dispose();
    }
    this.pieceEntries.clear();

    // Geometries
    this.tokenGeometry.dispose();
    this.rimGeometry.dispose();
    this.ringGeometry.dispose();
    this.dotGeometry.dispose();

    // Materials
    this.redBodyMaterial.dispose();
    this.blueBodyMaterial.dispose();
    this.redRimMaterial.dispose();
    this.blueRimMaterial.dispose();
    this.selectedRingMaterial.dispose();
    this.targetRingMaterial.dispose();
    this.captureRingMaterial.dispose();
    this.checkRingMaterial.dispose();
    this.lastMoveRingMaterial.dispose();

    // Textures
    disposeBoardTexture();
    disposeTokenTextures();

    // Renderer & Canvas
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    this.renderer.dispose();
  }
}
