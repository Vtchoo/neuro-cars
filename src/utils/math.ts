export interface XY {
    x: number
    y: number
}

export interface LineIntersection {
    intersects: boolean
    point?: XY
}

export type LineSegment = {
    kind: "line";
    start: XY;
    end: XY;
};

export type ArcSegment = {
    kind: "arc";
    start: XY;
    end: XY;
    center: XY;
    clockwise: boolean;
};

export type BezierSegment = {
    kind: "bezier";
    p0: XY;
    p1: XY;
    p2: XY;
    p3: XY;
};

/**
 * Checks if two line segments intersect
 */
export function lineSegmentIntersection(a1: XY, a2: XY, b1: XY, b2: XY): LineIntersection {
    const denom = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

    if (Math.abs(denom) < 1e-10) {
        return { intersects: false }; // Lines are parallel
    }

    const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denom;
    const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        const x = a1.x + ua * (a2.x - a1.x);
        const y = a1.y + ua * (a2.y - a1.y);
        return { intersects: true, point: { x, y } };
    }

    return { intersects: false };
}

/**
 * Finds the intersection points between a circle and a line segment. Returns an array of 0, 1, or 2 intersections.
 */
export function circleLineIntersection(center: XY, radius: number, lineStart: XY, lineEnd: XY): LineIntersection[] {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const fx = lineStart.x - center.x;
    const fy = lineStart.y - center.y;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return [{ intersects: false }]; // No intersection
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDiscriminant) / (2 * a);
    const t2 = (-b + sqrtDiscriminant) / (2 * a);
    const intersections: LineIntersection[] = [];

    if (t1 >= 0 && t1 <= 1) {
        intersections.push({
            intersects: true,
            point: {
                x: lineStart.x + t1 * dx,
                y: lineStart.y + t1 * dy
            }
        });
    }

    if (t2 >= 0 && t2 <= 1) {
        intersections.push({
            intersects: true,
            point: {
                x: lineStart.x + t2 * dx,
                y: lineStart.y + t2 * dy
            }
        });
    }

    if (intersections.length === 0) {
        intersections.push({ intersects: false });
    }

    return intersections;
}


export function arcLineIntersection(arc: ArcSegment, lineStart: XY, lineEnd: XY): LineIntersection[] {
    const circleIntersections = circleLineIntersection(arc.center, length(sub(arc.start, arc.center)), lineStart, lineEnd);
    const validIntersections: LineIntersection[] = [];
    for (const intersection of circleIntersections) {
        if (intersection.intersects) {
            const point = intersection.point!;
            const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
            const startAngle = Math.atan2(arc.start.y - arc.center.y, arc.start.x - arc.center.x);
            const endAngle = Math.atan2(arc.end.y - arc.center.y, arc.end.x - arc.center.x);
            const isWithinArc = !arc.clockwise ? (angle <= startAngle && angle >= endAngle) || (startAngle < endAngle && (angle <= startAngle || angle >= endAngle))
                : (angle >= startAngle && angle <= endAngle) || (startAngle > endAngle && (angle >= startAngle || angle <= endAngle));
            if (isWithinArc) {
                validIntersections.push(intersection);
            }
        }
    }
    return validIntersections.length > 0 ? validIntersections : [{ intersects: false }];
}

export function add(a: XY, b: XY): XY {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: XY, b: XY): XY {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(v: XY, s: number): XY {
    return { x: v.x * s, y: v.y * s };
}

export function dot(a: XY, b: XY): number {
    return a.x * b.x + a.y * b.y;
}

export function cross(a: XY, b: XY): number {
    return a.x * b.y - a.y * b.x;
}

export function lengthSq(v: XY): number {
    return dot(v, v);
}

export function length(v: XY): number {
    return Math.sqrt(lengthSq(v));
}

export function normalize(v: XY): XY {
    const len = length(v);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

export function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

export function distanceSq(a: XY, b: XY): number {
    return lengthSq(sub(a, b));
}

export function angleOf(v: XY): number {
    return Math.atan2(v.y, v.x);
}

export function wrapAngle(a: number): number {
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
}
