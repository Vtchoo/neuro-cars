export type Vec2 = { x: number; y: number };

export type ClosestPointResult = {
    point: Vec2;
    distance: number;
    distanceSq: number;
    t: number; // segment-local parameter, usually in [0, 1]
};

export type LineSegment = {
    kind: "line";
    start: Vec2;
    end: Vec2;
};

export type ArcSegment = {
    kind: "arc";
    start: Vec2;
    end: Vec2;
    center: Vec2;
    clockwise: boolean;
};

export type BezierSegment = {
    kind: "bezier";
    p0: Vec2;
    p1: Vec2;
    p2: Vec2;
    p3: Vec2;
};

type TrackSegment = LineSegment | ArcSegment | BezierSegment;

type ClosestPointOnTrackResult = ClosestPointResult & {
    segmentIndex: number;
};

export function add(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(v: Vec2, s: number): Vec2 {
    return { x: v.x * s, y: v.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec2, b: Vec2): number {
    return a.x * b.y - a.y * b.x;
}

export function lengthSq(v: Vec2): number {
    return dot(v, v);
}

export function length(v: Vec2): number {
    return Math.sqrt(lengthSq(v));
}

export function normalize(v: Vec2): Vec2 {
    const len = length(v);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

export function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

export function distanceSq(a: Vec2, b: Vec2): number {
    return lengthSq(sub(a, b));
}

export function angleOf(v: Vec2): number {
    return Math.atan2(v.y, v.x);
}

export function wrapAngle(a: number): number {
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
}

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

export function closestPointOnLineSegment(seg: LineSegment, q: Vec2): ClosestPointResult {
    const a = seg.start;
    const b = seg.end;
    const ab = sub(b, a);
    const abLenSq = lengthSq(ab);

    if (abLenSq === 0) {
        const d2 = distanceSq(q, a);
        return {
            point: a,
            distanceSq: d2,
            distance: Math.sqrt(d2),
            t: 0,
        };
    }

    const t = clamp(dot(sub(q, a), ab) / abLenSq, 0, 1);
    const point = add(a, mul(ab, t));
    const d2 = distanceSq(q, point);

    return {
        point,
        distanceSq: d2,
        distance: Math.sqrt(d2),
        t,
    };
}

export function closestPointOnArcSegment(seg: ArcSegment, q: Vec2): ClosestPointResult {
    const { start, end, center } = seg;

    const vs = sub(start, center);
    const ve = sub(end, center);
    const vq = sub(q, center);

    const rs = length(vs);
    const re = length(ve);

    if (rs === 0 || re === 0) {
        throw new Error("Arc start/end must not coincide with center.");
    }

    // Validate roughly same radius
    const radius = (rs + re) * 0.5;
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

    let point: Vec2;
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

    const d2 = distanceSq(q, point);

    return {
        point,
        distanceSq: d2,
        distance: Math.sqrt(d2),
        t: clamp(t, 0, 1),
    };
}