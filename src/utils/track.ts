import { add, angleOf, ArcSegment, BezierSegment, clamp, distanceSq, dot, length, lengthSq, LineSegment, mul, normalize, sub, wrapAngle, XY } from "./math";

export type ClosestPointResult = {
    point: XY;
    tangent: XY;      // normalized track-forward direction at closest point
    distance: number;
    distanceSq: number;
    t: number;          // local segment parameter [0,1]
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

export function closestPointOnLineSegment(seg: LineSegment, q: XY): ClosestPointResult {
    const a = seg.start;
    const b = seg.end;
    const ab = sub(b, a);
    const abLenSq = lengthSq(ab);

    if (abLenSq < 1e-12) {
        const tangent = { x: 1, y: 0 };
        const d2 = distanceSq(q, a);
        return {
            point: a,
            tangent,
            distanceSq: d2,
            distance: Math.sqrt(d2),
            t: 0,
        };
    }

    const t = clamp(dot(sub(q, a), ab) / abLenSq, 0, 1);
    const point = add(a, mul(ab, t));
    const tangent = normalize(ab);
    const d2 = distanceSq(q, point);

    return {
        point,
        tangent,
        distanceSq: d2,
        distance: Math.sqrt(d2),
        t,
    };
}

export function closestPointOnArcSegment(seg: ArcSegment, q: XY): ClosestPointResult {
    const { start, end, center } = seg;

    const vs = sub(start, center);
    const ve = sub(end, center);
    const vq = sub(q, center);

    const rs = length(vs);
    const re = length(ve);

    if (rs < 1e-12 || re < 1e-12) {
        throw new Error("Arc start/end must not coincide with center.");
    }

    const radius = 0.5 * (rs + re);
    if (Math.abs(rs - re) > 1e-6 * Math.max(1, radius)) {
        throw new Error("Arc start and end are not on the same circle.");
    }

    const a0 = angleOf(vs);
    const a1 = angleOf(ve);
    const aq = angleOf(vq);

    // // Choose minor arc direction
    // const ccwDelta = signedArcDelta(a0, a1, true);   // [0, 2π)
    // const cwDelta = signedArcDelta(a0, a1, false);   // (-2π, 0]

    const useCCW = seg.clockwise;
    const totalDelta = signedArcDelta(a0, a1, useCCW);

    // Where does q lie along that directed arc?
    const qDelta = signedArcDelta(a0, aq, useCCW);
    const onArc =
        useCCW
            ? qDelta >= 0 && qDelta <= totalDelta
            : qDelta <= 0 && qDelta >= totalDelta;

    let point: XY;
    let t: number;

    if (lengthSq(vq) === 0) {
        // Query exactly at center: any circle point is equally radially valid,
        // so fall back to nearest endpoint.
        const d2Start = distanceSq(q, start);
        const d2End = distanceSq(q, end);
        if (d2Start <= d2End) {
            point = start;
            t = 0;
        } else {
            point = end;
            t = 1;
        }
    } else if (onArc) {
        const dir = normalize(vq);
        point = add(center, mul(dir, radius));
        t = totalDelta === 0 ? 0 : qDelta / totalDelta;
    } else {
        const d2Start = distanceSq(q, start);
        const d2End = distanceSq(q, end);
        if (d2Start <= d2End) {
            point = start;
            t = 0;
        } else {
            point = end;
            t = 1;
        }
    }

    // Forward tangent follows arc direction.
    const radial = normalize(sub(point, center));
    const tangent = seg.clockwise
        ? { x: radial.y, y: -radial.x }   // rotate radial by -90°
        : { x: -radial.y, y: radial.x };  // rotate radial by +90°

    const d2 = distanceSq(q, point);

    return {
        point,
        tangent: normalize(tangent),
        distanceSq: d2,
        distance: Math.sqrt(d2),
        t: clamp(t, 0, 1),
    };
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

export function queryTrack(
    track: TrackSegment[],
    carPos: XY,
    carAngle: number
): TrackQueryResult {
    if (track.length === 0) {
        throw new Error("Track must contain at least one segment.");
    }

    let best: (ClosestPointResult & { segmentIndex: number }) | null = null;

    for (let i = 0; i < track.length; i++) {
        const r = closestPointOnSegment(track[i], carPos);
        if (!best || r.distanceSq < best.distanceSq) {
            best = { ...r, segmentIndex: i };
        }
    }

    const tangent = normalize(best!.tangent);
    const delta = sub(carPos, best!.point);

    // Right-positive lateral offset
    const right = rightNormalFromTangent(tangent);
    const lateralOffset = dot(delta, right);

    // Signed heading angle from track tangent to car heading, in [-PI, PI]
    const trackAngle = angleOf(tangent);
    const headingAngle = wrapAngle(carAngle - trackAngle);

    return {
        ...best!,
        tangent,
        lateralOffset,
        headingAngle,
    };
}