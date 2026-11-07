import type p5 from "p5";
import Track, {
  TrackPieceType,
  type SplinePiece,
  type TrackQuadTreeNode,
} from "../../Track";

const asphaltColor = "#3a3a3a";

export default class Track2d extends Track {
  drawLastPieceVector: boolean = true;
  drawTrackMapBounds: boolean = false;
  drawQuadTree: boolean = false;
  drawSplineSegments: boolean = false;
  private splineCurbCache = new WeakMap<
    SplinePiece,
    { coordinates: number[]; edges: Path2D[] }
  >();
  private getSplineCurbPaths(piece: SplinePiece): Path2D[] {
    const coordinates = [
      piece.start.x,
      piece.start.y,
      piece.control1.x,
      piece.control1.y,
      piece.control2.x,
      piece.control2.y,
      piece.end.x,
      piece.end.y,
      piece.width,
    ];
    const cached = this.splineCurbCache.get(piece);
    if (
      cached &&
      coordinates.every((value, i) => value === cached.coordinates[i])
    )
      return cached.edges;

    // Rendering samples stay separate from the simulation's adaptive chords.
    // Cache native paths so normal calculation and path construction only happen after edits.
    const samples = Track.splineSamples(piece);
    const edges = [new Path2D(), new Path2D()];
    const offset = piece.width / 2 + 5;
    for (let i = 0; i < samples.length; i++) {
      const t = i / (samples.length - 1),
        u = 1 - t;
      let dx =
        3 * u * u * (piece.control1.x - piece.start.x) +
        6 * u * t * (piece.control2.x - piece.control1.x) +
        3 * t * t * (piece.end.x - piece.control2.x);
      let dy =
        3 * u * u * (piece.control1.y - piece.start.y) +
        6 * u * t * (piece.control2.y - piece.control1.y) +
        3 * t * t * (piece.end.y - piece.control2.y);
      // Coincident endpoint handles can have a zero derivative.
      if (Math.hypot(dx, dy) < 1e-9) {
        const before = samples[Math.max(0, i - 1)].point;
        const after = samples[Math.min(samples.length - 1, i + 1)].point;
        dx = after.x - before.x;
        dy = after.y - before.y;
      }
      const magnitude = Math.hypot(dx, dy);
      const nx = magnitude > 0 ? -dy / magnitude : 0;
      const ny = magnitude > 0 ? dx / magnitude : 1;
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        const x = samples[i].point.x + sign * nx * offset;
        const y = samples[i].point.y + sign * ny * offset;
        if (i === 0) edges[side].moveTo(x, y);
        else edges[side].lineTo(x, y);
      }
    }
    this.splineCurbCache.set(piece, { coordinates, edges });
    return edges;
  }
  draw(p: p5) {
    // renderTrack.background("green")
    p.push();
    p.strokeCap(p.SQUARE);
    p.noFill();
    p.strokeWeight(1);
    p.stroke("black");

    if (this.drawQuadTree) {
      if (!this.quadTree) {
        this.buildQuadTree();
      }

      const drawTrackQuadTreeNode = (node: TrackQuadTreeNode) => {
        if (node.isLeaf) {
          p.push();
          if (node.hasTrack) {
            p.stroke("rgba(255, 0, 0, 0.5)");
          } else {
            p.stroke("rgba(0, 0, 255, 0.5)");
          }
          p.noFill();
          p.rect(
            node.bounds.minX,
            node.bounds.minY,
            node.bounds.maxX - node.bounds.minX,
            node.bounds.maxY - node.bounds.minY,
          );
          p.pop();
        }
        if (!node.isLeaf && node.children) {
          for (let child of node.children) {
            drawTrackQuadTreeNode(child);
          }
        }
      };

      if (this.quadTree) {
        drawTrackQuadTreeNode(this.quadTree);
      }
    }

    for (let piece of this.pieces) {
      p.strokeWeight(piece.width);
      switch (piece.type) {
        case TrackPieceType.Straight:
          p.push();
          p.stroke(asphaltColor);
          p.line(piece.start.x, piece.start.y, piece.end.x, piece.end.y);
          p.strokeWeight(1);
          p.stroke("white");
          const dir = Math.atan2(
            piece.end.y - piece.start.y,
            piece.end.x - piece.start.x,
          );
          p.line(
            piece.start.x - (piece.width * Math.sin(dir)) / 2,
            piece.start.y + (piece.width * Math.cos(dir)) / 2,
            piece.end.x - (piece.width * Math.sin(dir)) / 2,
            piece.end.y + (piece.width * Math.cos(dir)) / 2,
          );
          p.line(
            piece.start.x + (piece.width * Math.sin(dir)) / 2,
            piece.start.y - (piece.width * Math.cos(dir)) / 2,
            piece.end.x + (piece.width * Math.sin(dir)) / 2,
            piece.end.y - (piece.width * Math.cos(dir)) / 2,
          );

          // draw curbs on each side with dashed lines
          p.strokeWeight(10);
          p.stroke("lightgray");
          p.line(
            piece.start.x - ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.start.y + ((piece.width + 10) * Math.cos(dir)) / 2,
            piece.end.x - ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.end.y + ((piece.width + 10) * Math.cos(dir)) / 2,
          );
          p.line(
            piece.start.x + ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.start.y - ((piece.width + 10) * Math.cos(dir)) / 2,
            piece.end.x + ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.end.y - ((piece.width + 10) * Math.cos(dir)) / 2,
          );
          p.stroke("darkred");
          p.drawingContext.setLineDash([10, 10]);
          p.line(
            piece.start.x - ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.start.y + ((piece.width + 10) * Math.cos(dir)) / 2,
            piece.end.x - ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.end.y + ((piece.width + 10) * Math.cos(dir)) / 2,
          );
          p.line(
            piece.start.x + ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.start.y - ((piece.width + 10) * Math.cos(dir)) / 2,
            piece.end.x + ((piece.width + 10) * Math.sin(dir)) / 2,
            piece.end.y - ((piece.width + 10) * Math.cos(dir)) / 2,
          );
          p.drawingContext.setLineDash([]);

          p.pop();
          break;
        case TrackPieceType.Arc:
          const radius = Math.sqrt(
            (piece.center.x - piece.start.x) ** 2 +
              (piece.center.y - piece.start.y) ** 2,
          );
          const angleStart = Math.atan2(
            piece.start.y - piece.center.y,
            piece.start.x - piece.center.x,
          );
          const angleEnd = Math.atan2(
            piece.end.y - piece.center.y,
            piece.end.x - piece.center.x,
          );
          // in p5, arcs are alays drawn clockwise, so we need to swap the start and end angles if the piece is counterclockwise
          const actualAngleStart = piece.clockwise ? angleStart : angleEnd;
          const actualAngleEnd = piece.clockwise ? angleEnd : angleStart;
          p.push();
          p.stroke(asphaltColor);
          p.arc(
            piece.center.x,
            piece.center.y,
            radius * 2,
            radius * 2,
            actualAngleStart,
            actualAngleEnd,
          );
          p.strokeWeight(1);
          p.stroke("white");
          p.arc(
            piece.center.x,
            piece.center.y,
            (radius - piece.width / 2) * 2,
            (radius - piece.width / 2) * 2,
            actualAngleStart,
            actualAngleEnd,
            "open",
          );
          p.arc(
            piece.center.x,
            piece.center.y,
            (radius + piece.width / 2) * 2,
            (radius + piece.width / 2) * 2,
            actualAngleStart,
            actualAngleEnd,
            "open",
          );

          // draw curbs on each side with dashed lines
          p.strokeWeight(10);
          p.stroke("lightgray");
          p.arc(
            piece.center.x,
            piece.center.y,
            (radius - piece.width / 2 - 5) * 2,
            (radius - piece.width / 2 - 5) * 2,
            actualAngleStart,
            actualAngleEnd,
            "open",
          );
          p.arc(
            piece.center.x,
            piece.center.y,
            (radius + piece.width / 2 + 5) * 2,
            (radius + piece.width / 2 + 5) * 2,
            actualAngleStart,
            actualAngleEnd,
            "open",
          );
          p.stroke("darkred");
          p.drawingContext.setLineDash([10, 10]);
          p.arc(
            piece.center.x,
            piece.center.y,
            (radius - piece.width / 2 - 5) * 2,
            (radius - piece.width / 2 - 5) * 2,
            actualAngleStart,
            actualAngleEnd,
            "open",
          );
          p.arc(
            piece.center.x,
            piece.center.y,
            (radius + piece.width / 2 + 5) * 2,
            (radius + piece.width / 2 + 5) * 2,
            actualAngleStart,
            actualAngleEnd,
            "open",
          );
          p.drawingContext.setLineDash([]);

          p.pop();
          break;
        case TrackPieceType.Spline:
          p.push();
          p.stroke("white");
          p.strokeWeight(piece.width + 2);
          p.bezier(
            piece.start.x,
            piece.start.y,
            piece.control1.x,
            piece.control1.y,
            piece.control2.x,
            piece.control2.y,
            piece.end.x,
            piece.end.y,
          );
          p.stroke(asphaltColor);
          p.strokeWeight(piece.width);
          // Overlap adjoining pieces by one pixel to cover white end seams.
          const startDirection = Track.getTrackPieceStartDirection(piece);
          const endDirection = Track.getTrackPieceEndDirection(piece);
          const startDx = Math.cos(startDirection),
            startDy = Math.sin(startDirection);
          const endDx = Math.cos(endDirection),
            endDy = Math.sin(endDirection);
          p.bezier(
            piece.start.x - startDx,
            piece.start.y - startDy,
            piece.control1.x - startDx,
            piece.control1.y - startDy,
            piece.control2.x + endDx,
            piece.control2.y + endDy,
            piece.end.x + endDx,
            piece.end.y + endDy,
          );
          // Match straight/arc curbs: 10-unit bands just outside each edge.
          p.strokeWeight(10);
          p.strokeJoin(p.ROUND);
          p.stroke("lightgray");
          const curbPaths = this.getSplineCurbPaths(piece);
          const context = p.drawingContext as CanvasRenderingContext2D;
          for (const path of curbPaths) context.stroke(path);
          p.stroke("darkred");
          context.setLineDash([10, 10]);
          for (const path of curbPaths) context.stroke(path);
          context.setLineDash([]);
          p.pop();
          break;
      }
    }

    // draw finish line
    if (this.pieces.length > 0) {
      const firstPiece = this.pieces[0];
      const finishLineLength = firstPiece.width / 2;
      const finishLineDirection = Track.getTrackPieceStartDirection(firstPiece);
      const start = firstPiece.start;
      p.push();
      p.strokeWeight(10);
      p.stroke("black");
      p.line(
        start.x -
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection + Math.PI / 2),
        start.y -
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection + Math.PI / 2),
        start.x -
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection - Math.PI / 2),
        start.y -
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection - Math.PI / 2),
      );
      p.drawingContext.setLineDash([10, 10]);
      p.stroke("white");
      p.line(
        start.x -
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection + Math.PI / 2),
        start.y -
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection + Math.PI / 2),
        start.x -
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection - Math.PI / 2),
        start.y -
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection - Math.PI / 2),
      );
      p.drawingContext.setLineDash([]);
      // draw another line 10px further
      p.stroke("white");
      p.line(
        start.x +
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection + Math.PI / 2),
        start.y +
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection + Math.PI / 2),
        start.x +
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection - Math.PI / 2),
        start.y +
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection - Math.PI / 2),
      );
      p.drawingContext.setLineDash([10, 10]);
      p.stroke("black");
      p.line(
        start.x +
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection + Math.PI / 2),
        start.y +
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection + Math.PI / 2),
        start.x +
          Math.cos(finishLineDirection) * 5 +
          finishLineLength * Math.cos(finishLineDirection - Math.PI / 2),
        start.y +
          Math.sin(finishLineDirection) * 5 +
          finishLineLength * Math.sin(finishLineDirection - Math.PI / 2),
      );
      p.drawingContext.setLineDash([]);
      p.pop();
    }

    for (let piece of this.previewTrackPieces) {
      p.strokeWeight(piece.width);
      p.stroke("rgba(0, 0, 255, 0.5)");
      switch (piece.type) {
        case TrackPieceType.Straight:
          p.line(piece.start.x, piece.start.y, piece.end.x, piece.end.y);
          break;
        case TrackPieceType.Arc:
          const radius = Math.sqrt(
            (piece.center.x - piece.start.x) ** 2 +
              (piece.center.y - piece.start.y) ** 2,
          );
          const angleStart = Math.atan2(
            piece.start.y - piece.center.y,
            piece.start.x - piece.center.x,
          );
          const angleEnd = Math.atan2(
            piece.end.y - piece.center.y,
            piece.end.x - piece.center.x,
          );
          // in p5, arcs are alays drawn clockwise, so we need to swap the start and end angles if the piece is counterclockwise
          const actualAngleStart = piece.clockwise ? angleStart : angleEnd;
          const actualAngleEnd = piece.clockwise ? angleEnd : angleStart;
          p.arc(
            piece.center.x,
            piece.center.y,
            radius * 2,
            radius * 2,
            actualAngleStart,
            actualAngleEnd,
          );
          break;
        case TrackPieceType.Spline:
          p.bezier(
            piece.start.x,
            piece.start.y,
            piece.control1.x,
            piece.control1.y,
            piece.control2.x,
            piece.control2.y,
            piece.end.x,
            piece.end.y,
          );
          break;
      }
    }

    if (this.drawSplineSegments) {
      p.push();
      p.stroke("cyan");
      p.strokeWeight(2);
      for (const segment of this.splineSegments) {
        p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
      }
      // Mark the joins so individual chords remain visible along nearly straight curves.
      p.strokeWeight(5);
      for (const segment of this.splineSegments) {
        p.point(segment.start.x, segment.start.y);
        p.point(segment.end.x, segment.end.y);
      }
      p.pop();
    }

    if (this.drawLastPieceVector) {
      const lastPieceEnd = this.getLastPieceEnd();
      const lastPieceDirection = this.getLastPieceEndDirection();
      if (lastPieceEnd && lastPieceDirection !== null) {
        p.push();
        p.stroke("red");
        p.strokeWeight(2);
        p.line(
          lastPieceEnd.x,
          lastPieceEnd.y,
          lastPieceEnd.x + 20 * Math.cos(lastPieceDirection),
          lastPieceEnd.y + 20 * Math.sin(lastPieceDirection),
        );
        p.pop();

        // draw gizmo for the last piece end point
        p.push();
        p.strokeWeight(2);
        p.stroke("blue");
        p.line(
          lastPieceEnd.x,
          lastPieceEnd.y,
          lastPieceEnd.x + 10,
          lastPieceEnd.y,
        );
        p.stroke("yellow");
        p.line(
          lastPieceEnd.x,
          lastPieceEnd.y,
          lastPieceEnd.x,
          lastPieceEnd.y + 10,
        );
        p.pop();
      }
    }

    if (this.drawTrackMapBounds) {
      const boundingBox = this.calculateTrackBounds();

      p.push();
      p.strokeWeight(1);
      p.stroke("purple");
      p.noFill();
      p.rect(
        boundingBox.minX,
        boundingBox.minY,
        boundingBox.maxX - boundingBox.minX,
        boundingBox.maxY - boundingBox.minY,
      );
      p.pop();

      for (let piece of this.analyticPieces) {
        const pieceBounds = this.getPieceBounds(piece);
        p.push();
        p.strokeWeight(1);
        p.stroke("orange");
        p.noFill();
        p.rect(
          pieceBounds.minX,
          pieceBounds.minY,
          pieceBounds.maxX - pieceBounds.minX,
          pieceBounds.maxY - pieceBounds.minY,
        );
        p.pop();
      }
    }

    p.pop();
  }
}
