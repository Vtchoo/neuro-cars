import * as THREE from "three";
import Track, { TrackPieceType, type TrackPiece } from "../../Track";
import { signedArcDelta } from "../../utils/track";

export type RoadSample = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  distance: number;
};

/** Visual tessellation is independent of the cached simulation geometry. */
export function sampleRoad(piece: TrackPiece): RoadSample[] {
  const estimate =
    piece.type === TrackPieceType.Spline
      ? Math.hypot(
          piece.control1.x - piece.start.x,
          piece.control1.y - piece.start.y,
        ) +
        Math.hypot(
          piece.control2.x - piece.control1.x,
          piece.control2.y - piece.control1.y,
        ) +
        Math.hypot(
          piece.end.x - piece.control2.x,
          piece.end.y - piece.control2.y,
        )
      : Track.getTrackPieceLength(piece);
  const count = Math.max(1, Math.min(4096, Math.ceil(estimate / 8)));
  const samples: RoadSample[] = [];
  let distance = 0;
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      u = 1 - t;
    let x: number, y: number, dx: number, dy: number;
    if (piece.type === TrackPieceType.Spline) {
      x =
        u * u * u * piece.start.x +
        3 * u * u * t * piece.control1.x +
        3 * u * t * t * piece.control2.x +
        t * t * t * piece.end.x;
      y =
        u * u * u * piece.start.y +
        3 * u * u * t * piece.control1.y +
        3 * u * t * t * piece.control2.y +
        t * t * t * piece.end.y;
      dx =
        3 * u * u * (piece.control1.x - piece.start.x) +
        6 * u * t * (piece.control2.x - piece.control1.x) +
        3 * t * t * (piece.end.x - piece.control2.x);
      dy =
        3 * u * u * (piece.control1.y - piece.start.y) +
        6 * u * t * (piece.control2.y - piece.control1.y) +
        3 * t * t * (piece.end.y - piece.control2.y);
      if (Math.hypot(dx, dy) < 1e-9) {
        const a = i === 0 ? piece.control2 : piece.control1;
        dx = i === 0 ? a.x - piece.start.x : piece.end.x - a.x;
        dy = i === 0 ? a.y - piece.start.y : piece.end.y - a.y;
      }
    } else if (piece.type === TrackPieceType.Arc) {
      const radius = Math.hypot(
        piece.start.x - piece.center.x,
        piece.start.y - piece.center.y,
      );
      const a = Math.atan2(
        piece.start.y - piece.center.y,
        piece.start.x - piece.center.x,
      );
      const delta = signedArcDelta(
        a,
        Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x),
        piece.clockwise,
      );
      const angle = a + delta * t;
      x = piece.center.x + radius * Math.cos(angle);
      y = piece.center.y + radius * Math.sin(angle);
      dx = -Math.sin(angle) * delta;
      dy = Math.cos(angle) * delta;
    } else {
      dx = piece.end.x - piece.start.x;
      dy = piece.end.y - piece.start.y;
      x = piece.start.x + t * dx;
      y = piece.start.y + t * dy;
    }
    const magnitude = Math.hypot(dx, dy) || 1;
    if (i) distance += Math.hypot(x - samples[i - 1].x, y - samples[i - 1].y);
    samples.push({ x, y, nx: -dy / magnitude, ny: dx / magnitude, distance });
  }
  return samples;
}

export function disposeGroup(group: THREE.Group) {
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        material.dispose();
    }
  });
  group.clear();
}

/** Road meshes and editor handles; track shape, collision, and distances live in Track. */
export default class Track3d extends Track {
  private _object?: THREE.Group;
  get object() {
    return (this._object ??= new THREE.Group());
  }
  private source: TrackPiece[] | null = null;
  private previewSource: TrackPiece[] | null = null;

  private ribbon(
    samples: RoadSample[],
    a: number,
    b: number,
    height: number,
    color: number,
    curbs = false,
  ) {
    const vertices: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    for (const s of samples) {
      vertices.push(
        s.x + s.nx * a,
        height,
        s.y + s.ny * a,
        s.x + s.nx * b,
        height,
        s.y + s.ny * b,
      );
      const c = new THREE.Color(
        curbs && Math.floor(s.distance / 10) % 2 === 0 ? 0x9a2424 : color,
      );
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let i = 0; i < samples.length - 1; i++) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: curbs ? 0xffffff : color,
        vertexColors: curbs,
        side: THREE.DoubleSide,
        roughness: 0.95,
      }),
    );
    mesh.receiveShadow = true;
    this.object.add(mesh);
  }

  render(scene: THREE.Scene) {
    if (this.object.parent !== scene) scene.add(this.object);
    if (
      this.source === this.analyticPieces &&
      this.previewSource === this.previewTrackPieces
    )
      return;
    this.source = this.analyticPieces;
    this.previewSource = this.previewTrackPieces;
    disposeGroup(this.object);
    for (const piece of [...this.pieces, ...this.previewTrackPieces]) {
      const samples = sampleRoad(piece),
        half = piece.width / 2;
      // Separate edge strips avoid coplanar white/asphalt surfaces and depth flicker.
      this.ribbon(samples, -half - 1, -half, 0.1, 0xffffff);
      this.ribbon(samples, half, half + 1, 0.1, 0xffffff);
      this.ribbon(samples, -half, half, 0.1, 0x3a3a3a);
      this.ribbon(samples, half + 1, half + 10, 0.12, 0xd9d9d9, true);
      this.ribbon(samples, -half - 10, -half - 1, 0.12, 0xd9d9d9, true);
    }
    const first = this.pieces[0];
    if (first) {
      const heading = Track.getTrackPieceStartDirection(first),
        count = Math.max(1, Math.ceil(first.width / 10));
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < count; i++) {
          const tile = new THREE.Mesh(
            new THREE.PlaneGeometry(10, first.width / count),
            new THREE.MeshBasicMaterial({
              color: (i + row) % 2 ? 0xffffff : 0x111111,
              side: THREE.DoubleSide,
            }),
          );
          tile.rotation.set(-Math.PI / 2, 0, 0);
          const along = (row - 0.5) * 10,
            across = -first.width / 2 + ((i + 0.5) * first.width) / count;
          tile.position.set(
            first.start.x +
              along * Math.cos(heading) -
              across * Math.sin(heading),
            0.2,
            first.start.y +
              along * Math.sin(heading) +
              across * Math.cos(heading),
          );
          tile.rotateZ(-heading);
          this.object.add(tile);
        }
    }
  }

  dispose() {
    this.object.removeFromParent();
    disposeGroup(this.object);
  }
}
