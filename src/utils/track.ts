import { ArcSegment, BezierSegment, LineSegment, wrapAngle, XY } from "./math";

export type ClosestPointResult = {
    point: XY;
    tangent: XY;      // normalized track-forward direction at closest point
    distance: number;
    distanceSq: number;
    t: number;          // local segment parameter [0,1]
    distanceFromTrackPieceStart: number;
};

export type TrackSegment = LineSegment | ArcSegment | BezierSegment;

type ClosestPointOnTrackResult = ClosestPointResult & {
    segmentIndex: number;
};

export type TrackQueryResult = ClosestPointResult & {
    segmentIndex: number;
    lateralOffset: number; // right positive, left negative
    headingAngle: number;  // signed angle from track tangent to car heading, in [-PI, PI]
};

/** Creates a zero-initialized TrackQueryResult — use for pre-allocation, then pass to queryTrack. */
export function makeTrackQueryResult(): TrackQueryResult {
    return {
        point: { x: 0, y: 0 },
        tangent: { x: 0, y: 0 },
        distanceSq: 0, distance: 0, t: 0, distanceFromTrackPieceStart: 0,
        segmentIndex: -1, lateralOffset: 0, headingAngle: 0,
    };
}

// ---------------------------------------------------------------------------
// Module-level scratch objects — NEVER store these references; they are
// overwritten on every call. Safe because JS is single-threaded and the call
// chain is fully synchronous.
// ---------------------------------------------------------------------------
const _cpPt: XY = { x: 0, y: 0 };
const _cpTg: XY = { x: 0, y: 0 };
const _cpScratch: ClosestPointResult = {
    point: _cpPt, tangent: _cpTg,
    distanceSq: 0, distance: 0, t: 0, distanceFromTrackPieceStart: 0,
};
const _bestPt: XY = { x: 0, y: 0 };
const _bestTg: XY = { x: 0, y: 0 };
const _bestScratch: ClosestPointOnTrackResult = {
    point: _bestPt, tangent: _bestTg,
    distanceSq: Infinity, distance: 0, t: 0, distanceFromTrackPieceStart: 0,
    segmentIndex: 0,
};

/**
 * Signed angular travel from 'from' to 'to'.
 * If ccw=true, result is in [0, 2π).
 * If ccw=false, result is in (-2π, 0].
 */
export function signedArcDelta(from: number, to: number, ccw: boolean): number {
    let d = wrapAngle(to - from);

    if (ccw) {
        if (d < 0) d += 2 * Math.PI;
    } else {
        if (d > 0) d -= 2 * Math.PI;
    }

    return d;
}

// Returns _cpScratch — do NOT store the reference, read immediately.
export function closestPointOnLineSegment(seg: LineSegment, q: XY): ClosestPointResult {
    const ax = seg.start.x, ay = seg.start.y;
    const bx = seg.end.x,   by = seg.end.y;
    const abx = bx - ax,    aby = by - ay;
    const abLenSq = abx * abx + aby * aby;

    if (abLenSq < 1e-12) {
        const dx = q.x - ax, dy = q.y - ay;
        const d2 = dx * dx + dy * dy;
        _cpPt.x = ax; _cpPt.y = ay;
        _cpTg.x = 1;  _cpTg.y = 0;
        _cpScratch.distanceSq = d2;
        _cpScratch.distance = Math.sqrt(d2);
        _cpScratch.t = 0;
        _cpScratch.distanceFromTrackPieceStart = 0;
        return _cpScratch;
    }

    const raw = ((q.x - ax) * abx + (q.y - ay) * aby) / abLenSq;
    const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const px = ax + abx * t,  py = ay + aby * t;
    const abLen = Math.sqrt(abLenSq);
    const dx = q.x - px, dy = q.y - py;
    const d2 = dx * dx + dy * dy;

    _cpPt.x = px; _cpPt.y = py;
    _cpTg.x = abx / abLen; _cpTg.y = aby / abLen;
    _cpScratch.distanceSq = d2;
    _cpScratch.distance = Math.sqrt(d2);
    _cpScratch.t = t;
    _cpScratch.distanceFromTrackPieceStart = t * abLen;
    return _cpScratch;
}

// Returns _cpScratch — do NOT store the reference, read immediately.
export function closestPointOnArcSegment(seg: ArcSegment, q: XY): ClosestPointResult {
    const cx = seg.center.x, cy = seg.center.y;
    const vsx = seg.start.x - cx, vsy = seg.start.y - cy;
    const vex = seg.end.x   - cx, vey = seg.end.y   - cy;
    const vqx = q.x - cx,         vqy = q.y - cy;

    const rs = Math.sqrt(vsx * vsx + vsy * vsy);
    const re = Math.sqrt(vex * vex + vey * vey);

    if (rs < 1e-12 || re < 1e-12) throw new Error("Arc start/end must not coincide with center.");

    const radius = 0.5 * (rs + re);
    if (Math.abs(rs - re) > 1e-6 * Math.max(1, radius)) throw new Error("Arc start and end are not on the same circle.");

    const a0 = Math.atan2(vsy, vsx);
    const a1 = Math.atan2(vey, vex);
    const aq = Math.atan2(vqy, vqx);

    const useCCW = seg.clockwise;
    const totalDelta = signedArcDelta(a0, a1, useCCW);
    const qDelta = signedArcDelta(a0, aq, useCCW);
    const onArc = useCCW
        ? qDelta >= 0 && qDelta <= totalDelta
        : qDelta <= 0 && qDelta >= totalDelta;

    let px: number, py: number, t: number;
    const vqLenSq = vqx * vqx + vqy * vqy;

    if (vqLenSq === 0) {
        const dsx = q.x - seg.start.x, dsy = q.y - seg.start.y;
        const dex = q.x - seg.end.x,   dey = q.y - seg.end.y;
        if (dsx * dsx + dsy * dsy <= dex * dex + dey * dey) {
            px = seg.start.x; py = seg.start.y; t = 0;
        } else {
            px = seg.end.x;   py = seg.end.y;   t = 1;
        }
    } else if (onArc) {
        const vqLen = Math.sqrt(vqLenSq);
        px = cx + (vqx / vqLen) * radius;
        py = cy + (vqy / vqLen) * radius;
        t = totalDelta === 0 ? 0 : qDelta / totalDelta;
    } else {
        const dsx = q.x - seg.start.x, dsy = q.y - seg.start.y;
        const dex = q.x - seg.end.x,   dey = q.y - seg.end.y;
        if (dsx * dsx + dsy * dsy <= dex * dex + dey * dey) {
            px = seg.start.x; py = seg.start.y; t = 0;
        } else {
            px = seg.end.x;   py = seg.end.y;   t = 1;
        }
    }

    // Forward tangent: rotate unit radial by ±90° (already unit length).
    const rpx = px - cx, rpy = py - cy;
    const rpLen = Math.sqrt(rpx * rpx + rpy * rpy);
    let tanX: number, tanY: number;
    if (rpLen < 1e-12) { tanX = 1; tanY = 0; }
    else {
        const rx = rpx / rpLen, ry = rpy / rpLen;
        if (!seg.clockwise) { tanX = ry;  tanY = -rx; }  // rotate -90°
        else                { tanX = -ry; tanY =  rx; }  // rotate +90°
    }

    const dx = q.x - px, dy = q.y - py;
    const d2 = dx * dx + dy * dy;
    const tc = t < 0 ? 0 : t > 1 ? 1 : t;

    _cpPt.x = px; _cpPt.y = py;
    _cpTg.x = tanX; _cpTg.y = tanY;
    _cpScratch.distanceSq = d2;
    _cpScratch.distance = Math.sqrt(d2);
    _cpScratch.t = tc;
    _cpScratch.distanceFromTrackPieceStart = tc * Math.abs(totalDelta) * radius;
    return _cpScratch;
}

/**
 * Right normal for a forward tangent.
 * If tangent points forward, this points to track-right.
 */
function rightNormalFromTangent(tangent: XY): XY {
    return { x: tangent.y, y: -tangent.x };
}

function carDirectionFromAngle(angle: number): XY {
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

function closestPointOnSegment(seg: TrackSegment, q: XY): ClosestPointResult {
    switch (seg.kind) {
        case "line":
            return closestPointOnLineSegment(seg, q);
        case "arc":
            return closestPointOnArcSegment(seg, q);
        default:
            throw new Error("Unsupported segment kind: " + (seg as any).kind);
        // case "bezier":
        //   return closestPointOnBezier(seg, q);
    }
}

// Search radius for neighbour-hint queries: checks hint ± NEIGHBOR_SEARCH_RADIUS segments.
// A car travelling at 80 m/s × 1/60 s × UNITS_PER_METER fits well within 1 segment, so
// radius 2 gives a comfortable safety margin while keeping the scan to 5 segments max.
const NEIGHBOR_SEARCH_RADIUS = 2;

// Returns _bestScratch — do NOT store the reference, read immediately.
function findClosestOnTrack(
    track: TrackSegment[],
    carPos: XY,
    hint: number
): ClosestPointOnTrackResult {
    if (hint >= 0 && hint < track.length && track.length > NEIGHBOR_SEARCH_RADIUS * 2) {
        let found = false;
        for (let offset = -NEIGHBOR_SEARCH_RADIUS; offset <= NEIGHBOR_SEARCH_RADIUS; offset++) {
            const i = (hint + offset + track.length) % track.length;
            const r = closestPointOnSegment(track[i], carPos); // writes _cpScratch
            if (!found || r.distanceSq < _bestScratch.distanceSq) {
                _bestPt.x = r.point.x;   _bestPt.y = r.point.y;
                _bestTg.x = r.tangent.x; _bestTg.y = r.tangent.y;
                _bestScratch.distanceSq = r.distanceSq;
                _bestScratch.distance   = r.distance;
                _bestScratch.t          = r.t;
                _bestScratch.distanceFromTrackPieceStart = r.distanceFromTrackPieceStart;
                _bestScratch.segmentIndex = i;
                found = true;
            }
        }
        if (found && _bestScratch.distanceSq < 1e9) return _bestScratch;
    }

    // Full scan fallback.
    let found = false;
    for (let i = 0; i < track.length; i++) {
        const r = closestPointOnSegment(track[i], carPos); // writes _cpScratch
        if (!found || r.distanceSq < _bestScratch.distanceSq) {
            _bestPt.x = r.point.x;   _bestPt.y = r.point.y;
            _bestTg.x = r.tangent.x; _bestTg.y = r.tangent.y;
            _bestScratch.distanceSq = r.distanceSq;
            _bestScratch.distance   = r.distance;
            _bestScratch.t          = r.t;
            _bestScratch.distanceFromTrackPieceStart = r.distanceFromTrackPieceStart;
            _bestScratch.segmentIndex = i;
            found = true;
        }
    }
    return _bestScratch;
}

/**
 * Query the track for the car's position. Writes the result into `out` if provided
 * (recommended — pass a pre-allocated TrackQueryResult to avoid heap allocation).
 * If `out` is omitted a new object is allocated (first-call / non-hot-path use only).
 */
export function queryTrack(
    track: TrackSegment[],
    carPos: XY,
    carAngle: number,
    hintSegmentIndex = -1,
    out?: TrackQueryResult
): TrackQueryResult {
    if (track.length === 0) throw new Error("Track must contain at least one segment.");

    const best = findClosestOnTrack(track, carPos, hintSegmentIndex); // writes _bestScratch

    // Normalize tangent (inline — avoids sub/normalize allocations)
    const tx = best.tangent.x, ty = best.tangent.y;
    const tLen = Math.sqrt(tx * tx + ty * ty);
    const ntx = tLen > 1e-12 ? tx / tLen : tx;
    const nty = tLen > 1e-12 ? ty / tLen : ty;

    // delta = carPos - best.point
    const dx = carPos.x - best.point.x;
    const dy = carPos.y - best.point.y;

    // right = rightNormal(tangent) = { x: nty, y: -ntx }
    const lateralOffset = dx * nty + dy * (-ntx);

    const headingAngle = wrapAngle(carAngle - Math.atan2(nty, ntx));

    const result = out ?? makeTrackQueryResult();
    result.point.x   = best.point.x;
    result.point.y   = best.point.y;
    result.tangent.x = ntx;
    result.tangent.y = nty;
    result.distanceSq = best.distanceSq;
    result.distance   = best.distance;
    result.t          = best.t;
    result.distanceFromTrackPieceStart = best.distanceFromTrackPieceStart;
    result.segmentIndex  = best.segmentIndex;
    result.lateralOffset = lateralOffset;
    result.headingAngle  = headingAngle;
    return result;
}