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
export function segmentIntersection(a1: XY, a2: XY, b1: XY, b2: XY): LineIntersection {
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
 * Checks if a line segment intersects with an infinite line, and if so, returns the point of intersection. Does check if the intersection point is within the line segment, but does not check if it is within the infinite line.
 */
export function lineSegmentIntersection(l1: XY, l2: XY, s1: XY, s2: XY): LineIntersection {
    const denom = (s2.y - s1.y) * (l2.x - l1.x) - (s2.x - s1.x) * (l2.y - l1.y);

    if (Math.abs(denom) < 1e-10) {
        return { intersects: false }; // Lines are parallel
    }

    const ua = ((s2.x - s1.x) * (l1.y - s1.y) - (s2.y - s1.y) * (l1.x - s1.x)) / denom;
    const ub = ((l2.x - l1.x) * (l1.y - s1.y) - (l2.y - l1.y) * (l1.x - s1.x)) / denom;

    if (ub >= 0 && ub <= 1) {
        const x = l1.x + ua * (l2.x - l1.x);
        const y = l1.y + ua * (l2.y - l1.y);
        return { intersects: true, point: { x, y } };
    }

    return { intersects: false };
}

/**
 * Checks if two infinite lines intersect, and if so, returns the point of intersection. Does not check if the intersection point is within the line segments.
 */
export function lineLineIntersection(a1: XY, a2: XY, b1: XY, b2: XY): LineIntersection {
    const denom = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

    if (Math.abs(denom) < 1e-10) {
        return { intersects: false }; // Lines are parallel
    }

    const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denom;
    const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denom;

    const x = a1.x + ua * (a2.x - a1.x);
    const y = a1.y + ua * (a2.y - a1.y);

    return { intersects: true, point: { x, y } };
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

export function calculateArcCenter(start: XY, startDir: number, end: XY, endDir: number): XY | null {
    // Calculate the perpendicular directions
    const startPerpDir = startDir + Math.PI / 2;
    const endPerpDir = endDir + Math.PI / 2;
    // Calculate the lines perpendicular to the start and end directions
    const startLine = {
        point: start,
        dir: startPerpDir
    };
    const endLine = {
        point: end,
        dir: endPerpDir
    };
    // Calculate the intersection of the two lines
    const intersection = lineLineIntersection(
        startLine.point,
        { x: startLine.point.x + Math.cos(startLine.dir), y: startLine.point.y + Math.sin(startLine.dir) },
        endLine.point,
        { x: endLine.point.x + Math.cos(endLine.dir), y: endLine.point.y + Math.sin(endLine.dir) }
    );
    if (intersection.point) {
        return { x: intersection.point.x, y: intersection.point.y };
    } else {
        return null;
    }
}

/**
 * Calculates the distance from a point to a line defined by two points. The line is infinite in both directions.
 */
export function distancePointToLine(point: XY, lineStart: XY, lineEnd: XY): number {
    const lineDir = sub(lineEnd, lineStart);
    const lineLengthSq = length(lineDir) ** 2;
    if (lineLengthSq === 0) {
        return length(sub(point, lineStart)); // Line start and end are the same point
    }

    const t = dot(sub(point, lineStart), lineDir) / lineLengthSq;
    const projection = add(lineStart, mul(lineDir, t));
    return length(sub(point, projection));
}

interface ClosestPointResult {
    point: XY;
    tangent: XY;
    distance: number;
    distanceSq: number;
    t: number;
}

/**
 * Calculate the closest point on an infinite line to a given point.
 */
export function closestPointOnLine(l1: XY, l2: XY, q: XY): ClosestPointResult {
    const lineDir = sub(l2, l1);
    const lineLengthSq = length(lineDir) ** 2;
    if (lineLengthSq === 0) {
        return {
            point: l1,
            tangent: { x: 0, y: 0 },
            distanceSq: lengthSq(sub(q, l1)),
            distance: length(sub(q, l1)),
            t: 0,
        };
    }

    const t = dot(sub(q, l1), lineDir) / lineLengthSq;
    const point = add(l1, mul(lineDir, t));
    return {
        point,
        tangent: normalize(lineDir),
        distanceSq: lengthSq(sub(q, point)),
        distance: length(sub(q, point)),
        t,
    };
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
