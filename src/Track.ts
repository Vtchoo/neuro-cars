import p5 from "p5"
import { Vector } from "./Vector"
import { ArcSegment, closestPointOnArcSegment, closestPointOnLineSegment, length, LineSegment, sub, XY, } from "./utils/track"

interface BoundingBox {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

interface QuadTreeNode {
    bounds: BoundingBox
    isLeaf: boolean
    hasTrack: boolean
    children?: QuadTreeNode[]
    trackPieces?: TrackPiece[]
}

interface LineIntersection {
    intersects: boolean
    point?: { x: number, y: number }
}



export enum TrackPieceType {
    Straight = "Straight",
    Arc = "Arc",
    Spline = "Spline",
}

interface BaseTrackPiece {
    width: number
}

export interface StraightPiece extends BaseTrackPiece {
    type: TrackPieceType.Straight
    start: Vector
    end: Vector
}

export interface ArcPiece extends BaseTrackPiece {
    type: TrackPieceType.Arc
    start: Vector
    center: Vector
    end: Vector
    clockwise: boolean
}

export interface SplinePiece extends BaseTrackPiece {
    type: TrackPieceType.Spline
    start: Vector
    control1: Vector
    control2: Vector
    end: Vector
}

export type TrackPiece = StraightPiece | ArcPiece | SplinePiece

export interface TrackOptions {
    boundQueryType: "analytic" | "map" | "quadTree"
}

export default class Track {
    pieces: TrackPiece[] = []
    startingPoint: Vector = new Vector(0, 0)
    startingDirection: number = 0

    // debug
    drawLastPieceVector: boolean = true
    drawTrackMapBounds: boolean = false
    // drawTrackMapCells: boolean = false
    drawQuadTree: boolean = false

    useTrackMapCache: boolean = false
    trackMapCache = new Map<string, boolean>()
    boundQueryType: "analytic" | "map" | "quadTree" = "quadTree"

    /**
     * The analyticPieces array is used to store aggregated track pieces that can be used
     * for collision detection and other calculations that require a more continuous representation of the track.
     */
    analyticPieces: TrackPiece[] = []

    /**
     * QuadTree root node for efficient spatial queries
     */
    private quadTree: QuadTreeNode | null = null

    /**
     * Maximum depth for quadtree subdivision
     */
    private maxQuadTreeDepth: number = 12

    /**
     * Minimum size for quadtree subdivision
     */
    private minQuadTreeSize: number = 2

    getLastPieceEnd(): Vector | null {
        if (this.pieces.length === 0) {
            return null
        }
        const lastPiece = this.pieces[this.pieces.length - 1]
        return lastPiece.end
    }

    addStraight(start: Vector, end: Vector, width: number) {
        this.pieces.push({
            type: TrackPieceType.Straight,
            start,
            end,
            width,
        })

        // If last piece is also a straight piece and has the same width, we can merge them into one piece for easier calculations
        const lastAnalyticPiece = this.analyticPieces.length > 0 ? this.analyticPieces[this.analyticPieces.length - 1] : null
        if (lastAnalyticPiece && lastAnalyticPiece.type === TrackPieceType.Straight && lastAnalyticPiece.width === width) {
            this.analyticPieces[this.analyticPieces.length - 1] = {
                type: TrackPieceType.Straight,
                start: lastAnalyticPiece.start,
                end,
                width,
            }
        } else {
            this.analyticPieces.push({
                type: TrackPieceType.Straight,
                start,
                end,
                width,
            })
        }

        // Rebuild quadTree if using quadTree bound query
        // if (this.boundQueryType === "quadTree") {
        //     this.buildQuadTree();
        // }
    }

    addArc(start: Vector, center: Vector, end: Vector, clockwise: boolean, width: number) {
        this.pieces.push({
            type: TrackPieceType.Arc,
            start,
            center,
            end,
            clockwise,
            width,
        })

        // If last piece is also an arc with the same center, direction, and width, we can merge them into one piece for easier calculations
        const lastAnalyticPiece = this.analyticPieces.length > 0 ? this.analyticPieces[this.analyticPieces.length - 1] : null
        if (lastAnalyticPiece && lastAnalyticPiece.type === TrackPieceType.Arc && lastAnalyticPiece.center.x === center.x && lastAnalyticPiece.center.y === center.y && lastAnalyticPiece.clockwise === clockwise && lastAnalyticPiece.width === width) {
            this.analyticPieces[this.analyticPieces.length - 1] = {
                type: TrackPieceType.Arc,
                start: lastAnalyticPiece.start,
                center,
                end,
                clockwise,
                width,
            }
        } else {
            this.analyticPieces.push({
                type: TrackPieceType.Arc,
                start,
                center,
                end,
                clockwise,
                width,
            })
        }

        // Rebuild quadTree if using quadTree bound query
        // if (this.boundQueryType === "quadTree") {
        //     this.buildQuadTree();
        // }
    }

    addSpline(start: Vector, control1: Vector, control2: Vector, end: Vector, width: number) {
        this.pieces.push({
            type: TrackPieceType.Spline,
            start,
            control1,
            control2,
            end,
            width,
        })

        // Rebuild quadTree if using quadTree bound query
        // if (this.boundQueryType === "quadTree") {
        //     this.buildQuadTree();
        // }
    }

    getLastPieceEndDirection(): number | null {
        const lastPiece = this.pieces.length > 0 ? this.pieces[this.pieces.length - 1] : null
        if (!lastPiece) {
            return null
        }

        switch (lastPiece.type) {
            case TrackPieceType.Straight:
                return Math.atan2(lastPiece.end.y - lastPiece.start.y, lastPiece.end.x - lastPiece.start.x)
            case TrackPieceType.Arc:
                // For arcs, the direction at the end point is tangent to the circle at the end point
                const radiusVector = new Vector(lastPiece.end.x - lastPiece.center.x, lastPiece.end.y - lastPiece.center.y)
                const tangentVector = new Vector(-radiusVector.y, radiusVector.x) // rotate radius vector by 90 degrees to get tangent vector
                if (!lastPiece.clockwise) {
                    tangentVector.x *= -1
                    tangentVector.y *= -1
                }
                return Math.atan2(tangentVector.y, tangentVector.x)
            case TrackPieceType.Spline:
                // For splines, we can approximate the direction at the end using the tangent at the end point
                const dx = lastPiece.end.x - lastPiece.control2.x
                const dy = lastPiece.end.y - lastPiece.control2.y
                return Math.atan2(dy, dx)
        }
    }

    static getTrackPieceStartDirection(piece: TrackPiece): number {
        switch (piece.type) {
            case TrackPieceType.Straight:
                return Math.atan2(piece.end.y - piece.start.y, piece.end.x - piece.start.x)
            case TrackPieceType.Arc:
                // For arcs, the direction at the start point is tangent to the circle at the start point
                const radiusVector = new Vector(piece.start.x - piece.center.x, piece.start.y - piece.center.y)
                const tangentVector = new Vector(-radiusVector.y, radiusVector.x) // rotate radius vector by 90 degrees to get tangent vector
                if (!piece.clockwise) {
                    tangentVector.x *= -1
                    tangentVector.y *= -1
                }
                return Math.atan2(tangentVector.y, tangentVector.x)
            case TrackPieceType.Spline:
                // For splines, we can approximate the direction at the start using the tangent at the start point
                const dx = piece.control1.x - piece.start.x
                const dy = piece.control1.y - piece.start.y
                return Math.atan2(dy, dx)
        }
    }

    appendStraight(length: number, width: number) {
        const lastPieceEnd = this.getLastPieceEnd()
        if (!lastPieceEnd) {
            throw new Error("Cannot append straight piece to an empty track. Please add a starting piece first.")
        }
        const lastPieceDirection = this.getLastPieceEndDirection()
        if (lastPieceDirection === null) {
            throw new Error("Cannot determine direction of the last piece. Please check the track pieces for consistency.")
        }
        const newEnd = new Vector(lastPieceEnd.x + length * Math.cos(lastPieceDirection), lastPieceEnd.y + length * Math.sin(lastPieceDirection))
        this.addStraight(lastPieceEnd, newEnd, width)
    }

    appendArc(radius: number, angle: number, clockwise: boolean, width: number) {
        const lastPieceEnd = this.getLastPieceEnd()
        if (!lastPieceEnd) {
            throw new Error("Cannot append arc piece to an empty track. Please add a starting piece first.")
        }
        const lastPieceDirection = this.getLastPieceEndDirection()
        if (lastPieceDirection === null) {
            throw new Error("Cannot determine direction of the last piece. Please check the track pieces for consistency.")
        }

        const startAngle = lastPieceDirection + (clockwise ? -Math.PI / 2 : Math.PI / 2)
        const center = new Vector(lastPieceEnd.x - radius * Math.cos(startAngle), lastPieceEnd.y - radius * Math.sin(startAngle))
        const endAngle = startAngle + (clockwise ? angle : -angle)
        const end = new Vector(center.x + radius * Math.cos(endAngle), center.y + radius * Math.sin(endAngle))
        this.addArc(lastPieceEnd, center, end, clockwise, width)
    }

    appendSpline(control1: Vector, control2: Vector, end: Vector, width: number) {
        const lastPieceEnd = this.getLastPieceEnd()
        if (!lastPieceEnd) {
            throw new Error("Cannot append spline piece to an empty track. Please add a starting piece first.")
        }
        this.addSpline(lastPieceEnd, control1, control2, end, width)
    }

    draw(p: p5, renderTrack: p5) {
        // renderTrack.background("green")
        renderTrack.push()
        renderTrack.strokeCap(p.SQUARE)
        renderTrack.noFill()
        renderTrack.strokeWeight(1)
        renderTrack.stroke("black")

        if (this.drawQuadTree) {

            if (!this.quadTree) {
                this.buildQuadTree()
            }

            const drawQuadTreeNode = (node: QuadTreeNode) => {
                renderTrack.push()
                if (node.hasTrack) {
                    renderTrack.stroke("rgba(255, 0, 0, 0.5)")
                } else {
                    renderTrack.stroke("rgba(0, 0, 255, 0.5)")
                }
                renderTrack.noFill()
                renderTrack.rect(node.bounds.minX, node.bounds.minY, node.bounds.maxX - node.bounds.minX, node.bounds.maxY - node.bounds.minY)
                renderTrack.pop()
                if (!node.isLeaf && node.children) {
                    for (let child of node.children) {
                        drawQuadTreeNode(child)
                    }
                }
            }

            if (this.quadTree) {
                drawQuadTreeNode(this.quadTree)
            }
        }


        for (let piece of this.analyticPieces) {
            renderTrack.strokeWeight(piece.width)
            switch (piece.type) {
                case TrackPieceType.Straight:
                    renderTrack.push()
                    renderTrack.line(piece.start.x, piece.start.y, piece.end.x, piece.end.y)
                    renderTrack.strokeWeight(1)
                    renderTrack.stroke("white")
                    const dir = Math.atan2(piece.end.y - piece.start.y, piece.end.x - piece.start.x)
                    renderTrack.line(
                        piece.start.x - piece.width * Math.sin(dir) / 2,
                        piece.start.y + piece.width * Math.cos(dir) / 2,
                        piece.end.x - piece.width * Math.sin(dir) / 2,
                        piece.end.y + piece.width * Math.cos(dir) / 2
                    )
                    renderTrack.line(
                        piece.start.x + piece.width * Math.sin(dir) / 2,
                        piece.start.y - piece.width * Math.cos(dir) / 2,
                        piece.end.x + piece.width * Math.sin(dir) / 2,
                        piece.end.y - piece.width * Math.cos(dir) / 2
                    )
                    renderTrack.pop()
                    break
                case TrackPieceType.Arc:
                    const radius = Math.sqrt((piece.center.x - piece.start.x) ** 2 + (piece.center.y - piece.start.y) ** 2)
                    const angleStart = Math.atan2(piece.start.y - piece.center.y, piece.start.x - piece.center.x)
                    const angleEnd = Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x)
                    // in p5, arcs are alays drawn clockwise, so we need to swap the start and end angles if the piece is counterclockwise
                    const actualAngleStart = piece.clockwise ? angleStart : angleEnd
                    const actualAngleEnd = piece.clockwise ? angleEnd : angleStart
                    renderTrack.push()
                    renderTrack.arc(piece.center.x, piece.center.y, radius * 2, radius * 2, actualAngleStart, actualAngleEnd)
                    renderTrack.strokeWeight(1)
                    renderTrack.stroke("white")
                    renderTrack.arc(piece.center.x, piece.center.y, (radius - piece.width / 2) * 2, (radius - piece.width / 2) * 2, actualAngleStart, actualAngleEnd, "open")
                    renderTrack.arc(piece.center.x, piece.center.y, (radius + piece.width / 2) * 2, (radius + piece.width / 2) * 2, actualAngleStart, actualAngleEnd, "open")
                    renderTrack.pop()
                    break
                case TrackPieceType.Spline:
                    renderTrack.push()
                    renderTrack.stroke("white")
                    renderTrack.strokeWeight(piece.width + 2)
                    renderTrack.bezier(piece.start.x, piece.start.y, piece.control1.x, piece.control1.y, piece.control2.x, piece.control2.y, piece.end.x, piece.end.y)
                    renderTrack.stroke("black")
                    renderTrack.strokeWeight(piece.width)
                    renderTrack.bezier(piece.start.x, piece.start.y, piece.control1.x, piece.control1.y, piece.control2.x, piece.control2.y, piece.end.x, piece.end.y)
                    renderTrack.pop()
                    break
            }
        }

        if (this.drawLastPieceVector) {
            const lastPieceEnd = this.getLastPieceEnd()
            const lastPieceDirection = this.getLastPieceEndDirection()
            if (lastPieceEnd && lastPieceDirection !== null) {
                renderTrack.push()
                renderTrack.stroke("red")
                renderTrack.strokeWeight(2)
                renderTrack.line(lastPieceEnd.x, lastPieceEnd.y, lastPieceEnd.x + 20 * Math.cos(lastPieceDirection), lastPieceEnd.y + 20 * Math.sin(lastPieceDirection))
                renderTrack.pop()

                // draw gizmo for the last piece end point
                renderTrack.push()
                renderTrack.strokeWeight(2)
                renderTrack.stroke("blue")
                renderTrack.line(lastPieceEnd.x, lastPieceEnd.y, lastPieceEnd.x + 10, lastPieceEnd.y)
                renderTrack.stroke("yellow")
                renderTrack.line(lastPieceEnd.x, lastPieceEnd.y, lastPieceEnd.x, lastPieceEnd.y + 10)
                renderTrack.pop()
            }
        }

        if (this.drawTrackMapBounds) {
            const boundingBox = this.calculateTrackBounds()

            renderTrack.push()
            renderTrack.strokeWeight(1)
            renderTrack.stroke("purple")
            renderTrack.noFill()
            renderTrack.rect(boundingBox.minX, boundingBox.minY, boundingBox.maxX - boundingBox.minX, boundingBox.maxY - boundingBox.minY)
            renderTrack.pop()
        }


        renderTrack.pop()
    }

    isInsideTrack(x: number, y: number): boolean {

        const cacheKey = `${Math.floor(x)},${Math.floor(y)}`

        if (this.useTrackMapCache && this.trackMapCache.has(cacheKey)) {
            return this.trackMapCache.get(cacheKey)!
        }

        switch (this.boundQueryType) {
            case "analytic": {
                if (this.analyticPieces.length === 0) {
                    return false
                }

                const queryPoint = { x, y }

                // Check distance to any track piece
                for (const piece of this.analyticPieces) {
                    const distance = this.getDistanceToPiece(piece, queryPoint)
                    if (distance <= piece.width / 2) {
                        if (this.useTrackMapCache)
                            this.trackMapCache.set(cacheKey, true)
                        return true
                    }
                }

                if (this.useTrackMapCache)
                    this.trackMapCache.set(cacheKey, false)

                return false
            }
            case "quadTree": {
                if (!this.quadTree) {
                    this.buildQuadTree()
                }

                if (!this.quadTree || this.analyticPieces.length === 0) {
                    if (this.useTrackMapCache)
                        this.trackMapCache.set(cacheKey, false)
                    return false
                }

                const result = this.queryQuadTree(this.quadTree, x, y)
                if (this.useTrackMapCache)
                    this.trackMapCache.set(cacheKey, result)
                return result
            }
            case "map":
            default: {
                throw new Error("Map-based bound query is not available anymore due to performance issues. Please use analytic-based query instead.")
            }
        }
    }

    private calculateTrackBounds(): BoundingBox {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        for (const piece of this.analyticPieces || this.pieces) {
            const bounds = this.getPieceBounds(piece)
            minX = Math.min(minX, bounds.minX)
            minY = Math.min(minY, bounds.minY)
            maxX = Math.max(maxX, bounds.maxX)
            maxY = Math.max(maxY, bounds.maxY)
        }

        console.log(`Calculated track bounds: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`)
        return { minX, minY, maxX, maxY }
    }

    private getPieceBounds(piece: TrackPiece): { minX: number, minY: number, maxX: number, maxY: number } {
        const halfWidth = piece.width / 2

        switch (piece.type) {
            case TrackPieceType.Straight: {
                const minX = Math.min(piece.start.x, piece.end.x) - halfWidth
                const maxX = Math.max(piece.start.x, piece.end.x) + halfWidth
                const minY = Math.min(piece.start.y, piece.end.y) - halfWidth
                const maxY = Math.max(piece.start.y, piece.end.y) + halfWidth
                return { minX, minY, maxX, maxY }
            }

            case TrackPieceType.Arc: {
                const radius = length(sub(piece.start, piece.center))
                const centerX = piece.center.x
                const centerY = piece.center.y

                // Calculate the actual arc bounds instead of using full circle
                const startAngle = Math.atan2(piece.start.y - centerY, piece.start.x - centerX)
                const endAngle = Math.atan2(piece.end.y - centerY, piece.end.x - centerX)

                // Helper function to check if an angle is within the arc
                const isAngleInArc = (angle: number): boolean => {
                    // Normalize all angles to [0, 2π]
                    const normalizeAngle = (a: number) => {
                        while (a < 0) a += 2 * Math.PI
                        while (a >= 2 * Math.PI) a -= 2 * Math.PI
                        return a
                    }

                    const normStart = normalizeAngle(startAngle)
                    const normEnd = normalizeAngle(endAngle)
                    const normAngle = normalizeAngle(angle)

                    if (!piece.clockwise) {
                        // Clockwise: from start to end going clockwise (decreasing angles)
                        if (normStart >= normEnd) {
                            // Normal case: start > end, angle should be between start and end
                            return normAngle >= normEnd && normAngle <= normStart
                        } else {
                            // Arc crosses 0: angle should be >= end or <= start
                            return normAngle >= normEnd || normAngle <= normStart
                        }
                    } else {
                        // Counter-clockwise: from start to end going counter-clockwise (increasing angles)
                        if (normStart <= normEnd) {
                            // Normal case: start < end, angle should be between start and end
                            return normAngle >= normStart && normAngle <= normEnd
                        } else {
                            // Arc crosses 0: angle should be >= start or <= end
                            return normAngle >= normStart || normAngle <= normEnd
                        }
                    }
                }

                // Collect points that contribute to the bounding box
                const boundingPoints: Vector[] = [piece.start, piece.end]

                // Check if any cardinal directions (0°, 90°, 180°, 270°) are within the arc
                const cardinalAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]

                for (const cardinalAngle of cardinalAngles) {
                    if (isAngleInArc(cardinalAngle)) {
                        // Add the point on the circle at this cardinal angle
                        const x = centerX + radius * Math.cos(cardinalAngle)
                        const y = centerY + radius * Math.sin(cardinalAngle)
                        boundingPoints.push(new Vector(x, y))
                    }
                }

                // Calculate bounds from all collected points
                const minX = Math.min(...boundingPoints.map(p => p.x)) - halfWidth
                const maxX = Math.max(...boundingPoints.map(p => p.x)) + halfWidth
                const minY = Math.min(...boundingPoints.map(p => p.y)) - halfWidth
                const maxY = Math.max(...boundingPoints.map(p => p.y)) + halfWidth

                return { minX, minY, maxX, maxY }
            }

            case TrackPieceType.Spline: {
                // For splines, approximate bounds using control points
                const xs = [piece.start.x, piece.control1.x, piece.control2.x, piece.end.x]
                const ys = [piece.start.y, piece.control1.y, piece.control2.y, piece.end.y]

                const minX = Math.min(...xs) - halfWidth
                const maxX = Math.max(...xs) + halfWidth
                const minY = Math.min(...ys) - halfWidth
                const maxY = Math.max(...ys) + halfWidth
                return { minX, minY, maxX, maxY }
            }

            default:
                return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
        }
    }

    private getDistanceToPiece(piece: TrackPiece, point: XY): number {
        switch (piece.type) {
            case TrackPieceType.Straight: {
                const segment: LineSegment = {
                    kind: "line",
                    start: { x: piece.start.x, y: piece.start.y },
                    end: { x: piece.end.x, y: piece.end.y }
                }
                return closestPointOnLineSegment(segment, point).distance
            }

            case TrackPieceType.Arc: {
                const segment: ArcSegment = {
                    kind: "arc",
                    start: { x: piece.start.x, y: piece.start.y },
                    end: { x: piece.end.x, y: piece.end.y },
                    center: { x: piece.center.x, y: piece.center.y },
                    clockwise: piece.clockwise,
                }
                return closestPointOnArcSegment(segment, point).distance
            }

            case TrackPieceType.Spline: {
                // For splines, we would need a closestPointOnBezier function
                // For now, approximate by sampling points along the spline
                let minDistance = Infinity
                const samples = 20

                for (let i = 0; i <= samples; i++) {
                    const t = i / samples
                    const splinePoint = this.evaluateBezier(piece, t)
                    const distance = length(sub(point, splinePoint))
                    minDistance = Math.min(minDistance, distance)
                }

                return minDistance
            }

            default:
                return Infinity
        }
    }

    private evaluateBezier(piece: SplinePiece, t: number): XY {
        const t2 = t * t
        const t3 = t2 * t
        const mt = 1 - t
        const mt2 = mt * mt
        const mt3 = mt2 * mt

        return {
            x: mt3 * piece.start.x + 3 * mt2 * t * piece.control1.x + 3 * mt * t2 * piece.control2.x + t3 * piece.end.x,
            y: mt3 * piece.start.y + 3 * mt2 * t * piece.control1.y + 3 * mt * t2 * piece.control2.y + t3 * piece.end.y
        }
    }

    deleteLastPiece() {
        if (this.pieces.length === 0) {
            return
        }
        this.pieces.pop()

        // regenerate analytic pieces from sratch since we can't be sure which piece was merged with the last piece
        const newAnalyticPieces: TrackPiece[] = []
        for (let piece of this.pieces) {
            const lastAnalyticPiece = newAnalyticPieces[newAnalyticPieces.length - 1]
            if (!lastAnalyticPiece) {
                newAnalyticPieces.push(piece)
                continue
            }

            if (piece.type === TrackPieceType.Straight && lastAnalyticPiece.type === TrackPieceType.Straight && piece.width === lastAnalyticPiece.width) {
                newAnalyticPieces[newAnalyticPieces.length - 1] = {
                    ...lastAnalyticPiece,
                    end: piece.end
                }
            } else if (piece.type === TrackPieceType.Arc && lastAnalyticPiece.type === TrackPieceType.Arc && piece.center.x === lastAnalyticPiece.center.x && piece.center.y === lastAnalyticPiece.center.y && piece.clockwise === lastAnalyticPiece.clockwise && piece.width === lastAnalyticPiece.width) {
                newAnalyticPieces[newAnalyticPieces.length - 1] = {
                    ...lastAnalyticPiece,
                    end: piece.end
                }
            } else {
                newAnalyticPieces.push(piece)
            }
        }
        this.analyticPieces = newAnalyticPieces

        // Rebuild quadTree if using quadTree bound query
        // if (this.boundQueryType === "quadTree") {
        //     this.buildQuadTree();
        // }
    }

    // Export track data for saving
    exportData(): any {
        return {
            startingPoint: {
                x: this.startingPoint.x,
                y: this.startingPoint.y
            },
            startingDirection: this.startingDirection,
            pieces: this.pieces.map(piece => {
                switch (piece.type) {
                    case TrackPieceType.Straight:
                        return {
                            type: TrackPieceType.Straight,
                            start: { x: piece.start.x, y: piece.start.y },
                            end: { x: piece.end.x, y: piece.end.y },
                            width: piece.width
                        };
                    case TrackPieceType.Arc:
                        return {
                            type: TrackPieceType.Arc,
                            start: { x: piece.start.x, y: piece.start.y },
                            center: { x: piece.center.x, y: piece.center.y },
                            end: { x: piece.end.x, y: piece.end.y },
                            clockwise: piece.clockwise,
                            width: piece.width
                        };
                    case TrackPieceType.Spline:
                        return {
                            type: TrackPieceType.Spline,
                            start: { x: piece.start.x, y: piece.start.y },
                            control1: { x: piece.control1.x, y: piece.control1.y },
                            control2: { x: piece.control2.x, y: piece.control2.y },
                            end: { x: piece.end.x, y: piece.end.y },
                            width: piece.width
                        };
                }
            })
        };
    }

    // Import track data for loading
    static fromData(data: any): Track {
        const track = new Track();
        track.startingPoint = new Vector(data.startingPoint.x, data.startingPoint.y);
        track.startingDirection = data.startingDirection;

        // Load all pieces first without generating analytic pieces (for performance)
        for (const pieceData of data.pieces) {
            let piece: TrackPiece;
            switch (pieceData.type) {
                case TrackPieceType.Straight:
                    piece = {
                        type: TrackPieceType.Straight,
                        start: new Vector(pieceData.start.x, pieceData.start.y),
                        end: new Vector(pieceData.end.x, pieceData.end.y),
                        width: pieceData.width
                    };
                    break;
                case TrackPieceType.Arc:
                    piece = {
                        type: TrackPieceType.Arc,
                        start: new Vector(pieceData.start.x, pieceData.start.y),
                        center: new Vector(pieceData.center.x, pieceData.center.y),
                        end: new Vector(pieceData.end.x, pieceData.end.y),
                        clockwise: pieceData.clockwise,
                        width: pieceData.width
                    };
                    break;
                case TrackPieceType.Spline:
                    piece = {
                        type: TrackPieceType.Spline,
                        start: new Vector(pieceData.start.x, pieceData.start.y),
                        control1: new Vector(pieceData.control1.x, pieceData.control1.y),
                        control2: new Vector(pieceData.control2.x, pieceData.control2.y),
                        end: new Vector(pieceData.end.x, pieceData.end.y),
                        width: pieceData.width
                    };
                    break;
                default:
                    throw new Error(`Unknown piece type: ${pieceData.type}`);
            }
            track.pieces.push(piece);
        }

        // Generate optimized analytic pieces in batch for much better performance
        track.generateAnalyticPieces();

        return track;
    }

    /**
     * Generates optimized analytic pieces from the current pieces array.
     * This merges consecutive pieces of the same type and properties for better performance.
     */
    generateAnalyticPieces() {
        this.analyticPieces = [];

        for (const piece of this.pieces) {
            const lastAnalytic = this.analyticPieces[this.analyticPieces.length - 1];

            // Try to merge with the last analytic piece if possible
            if (this.canMergeWithLast(piece, lastAnalytic)) {
                this.mergeWithLastAnalytic(piece);
            } else {
                // Add as new analytic piece
                this.analyticPieces.push(this.clonePiece(piece));
            }
        }

        console.log(`Generated ${this.analyticPieces.length} analytic pieces from ${this.pieces.length} original pieces`);
    }

    /**
     * Builds the quadTree for efficient spatial queries
     */
    private buildQuadTree() {
        if (this.analyticPieces.length === 0) {
            this.quadTree = null;
            return;
        }

        const bounds = this.calculateTrackBounds();
        // Add some padding to ensure the track is fully contained
        const padding = 50;
        bounds.minX -= padding;
        bounds.minY -= padding;
        bounds.maxX += padding;
        bounds.maxY += padding;

        this.quadTree = this.createQuadTreeNode(bounds, this.analyticPieces, 0);
    }

    /**
     * Creates a quadTree node recursively
     */
    private createQuadTreeNode(bounds: BoundingBox, trackPieces: TrackPiece[], depth: number): QuadTreeNode {
        const node: QuadTreeNode = {
            bounds,
            isLeaf: true,
            hasTrack: false,
            trackPieces: [...trackPieces]
        };

        // Check if we should stop subdividing
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;

        if (depth >= this.maxQuadTreeDepth ||
            Math.min(width, height) < this.minQuadTreeSize ||
            trackPieces.length === 0) {

            node.hasTrack = this.checkQuadrantHasTrack(bounds, trackPieces);
            return node;
        }

        // The root node (depth 0) must always be subdivided since its borders
        // won't intersect with track pieces by design (they contain the entire track with padding)
        const shouldSubdivide = depth === 0 || this.shouldSubdivideQuadrant(bounds, trackPieces);

        if (!shouldSubdivide) {
            // If no border crossing, check if any corner is inside the track
            node.hasTrack = this.checkQuadrantCornerInTrack(bounds);
        } else {
            // Subdivide into 4 children
            node.isLeaf = false;
            node.children = [];

            const midX = (bounds.minX + bounds.maxX) / 2;
            const midY = (bounds.minY + bounds.maxY) / 2;

            const childBounds = [
                { minX: bounds.minX, minY: bounds.minY, maxX: midX, maxY: midY }, // Bottom-left
                { minX: midX, minY: bounds.minY, maxX: bounds.maxX, maxY: midY }, // Bottom-right
                { minX: bounds.minX, minY: midY, maxX: midX, maxY: bounds.maxY }, // Top-left
                { minX: midX, minY: midY, maxX: bounds.maxX, maxY: bounds.maxY }  // Top-right
            ];

            for (const childBound of childBounds) {
                // Get track pieces that intersect with this child
                const relevantPieces = trackPieces.filter(piece =>
                    this.pieceIntersectsBounds(piece, childBound)
                );

                node.children.push(this.createQuadTreeNode(childBound, relevantPieces, depth + 1));
            }
        }

        return node;
    }

    /**
     * Checks if track piece boundaries cross the quadrant borders
     */
    private shouldSubdivideQuadrant(bounds: BoundingBox, trackPieces: TrackPiece[]): boolean {
        const quadrantLines = [
            { start: { x: bounds.minX, y: bounds.minY }, end: { x: bounds.maxX, y: bounds.minY } }, // Bottom edge
            { start: { x: bounds.maxX, y: bounds.minY }, end: { x: bounds.maxX, y: bounds.maxY } }, // Right edge
            { start: { x: bounds.maxX, y: bounds.maxY }, end: { x: bounds.minX, y: bounds.maxY } }, // Top edge
            { start: { x: bounds.minX, y: bounds.maxY }, end: { x: bounds.minX, y: bounds.minY } }  // Left edge
        ];

        for (const piece of trackPieces) {
            for (const quadLine of quadrantLines) {
                if (this.trackPieceCrossesLine(piece, quadLine.start, quadLine.end)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Checks if any corner of the quadrant is inside the track
     */
    private checkQuadrantCornerInTrack(bounds: BoundingBox): boolean {
        const corners = [
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY },
            { x: bounds.minX, y: bounds.maxY }
        ];

        for (const corner of corners) {
            // Use analytic method to check if corner is in track
            const queryPoint = { x: corner.x, y: corner.y };
            for (const piece of this.analyticPieces) {
                const distance = this.getDistanceToPiece(piece, queryPoint);
                if (distance <= piece.width / 2) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Checks if a track piece intersects with the given bounds
     */
    private pieceIntersectsBounds(piece: TrackPiece, bounds: BoundingBox): boolean {
        const pieceBounds = this.getPieceBounds(piece);

        return !(pieceBounds.maxX < bounds.minX ||
            pieceBounds.minX > bounds.maxX ||
            pieceBounds.maxY < bounds.minY ||
            pieceBounds.minY > bounds.maxY);
    }

    /**
     * Checks if a track piece crosses a line segment
     */
    private trackPieceCrossesLine(piece: TrackPiece, lineStart: XY, lineEnd: XY): boolean {
        switch (piece.type) {
            case TrackPieceType.Straight: {
                // For straights, check if some of the 2 parallel lines that form the track width intersect with the line
                const dir = Math.atan2(piece.end.y - piece.start.y, piece.end.x - piece.start.x);
                const offsetX = piece.width * Math.sin(dir) / 2;
                const offsetY = piece.width * Math.cos(dir) / 2;
                const line1Start = { x: piece.start.x - offsetX, y: piece.start.y + offsetY };
                const line1End = { x: piece.end.x - offsetX, y: piece.end.y + offsetY };
                const line2Start = { x: piece.start.x + offsetX, y: piece.start.y - offsetY };
                const line2End = { x: piece.end.x + offsetX, y: piece.end.y - offsetY };
                return this.lineSegmentIntersection(line1Start, line1End, lineStart, lineEnd).intersects ||
                    this.lineSegmentIntersection(line2Start, line2End, lineStart, lineEnd).intersects;
            }
            case TrackPieceType.Arc: {
                // let's do the actual arc-line intersection check
                const radius = Math.sqrt((piece.center.x - piece.start.x) ** 2 + (piece.center.y - piece.start.y) ** 2);
                const internalRadius = radius - piece.width / 2;
                const externalRadius = radius + piece.width / 2;

                // Check intersection with both the internal and external circles
                const internalArc = {
                    center: piece.center,
                    start: {
                        x: piece.center.x + internalRadius * Math.cos(Math.atan2(piece.start.y - piece.center.y, piece.start.x - piece.center.x)),
                        y: piece.center.y + internalRadius * Math.sin(Math.atan2(piece.start.y - piece.center.y, piece.start.x - piece.center.x))
                    },
                    end: {
                        x: piece.center.x + internalRadius * Math.cos(Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x)),
                        y: piece.center.y + internalRadius * Math.sin(Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x))
                    },
                    clockwise: piece.clockwise,
                    kind: "arc" as const
                }
                const internalIntersections = this.arcLineIntersection(internalArc, lineStart, lineEnd);

                const externalArc = {
                    center: piece.center,
                    start: {
                        x: piece.center.x + externalRadius * Math.cos(Math.atan2(piece.start.y - piece.center.y, piece.start.x - piece.center.x)),
                        y: piece.center.y + externalRadius * Math.sin(Math.atan2(piece.start.y - piece.center.y, piece.start.x - piece.center.x))
                    },
                    end: {
                        x: piece.center.x + externalRadius * Math.cos(Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x)),
                        y: piece.center.y + externalRadius * Math.sin(Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x))
                    },
                    clockwise: piece.clockwise,
                    kind: "arc" as const
                }
                const externalIntersections = this.arcLineIntersection(externalArc, lineStart, lineEnd);

                if (internalIntersections.some(intersection => intersection.intersects) || externalIntersections.some(intersection => intersection.intersects)) {
                    return true;
                }

                return false;
            }
            case TrackPieceType.Spline: {
                // For splines, sample points along the curve and check intersections
                const samples = 10;
                for (let i = 0; i < samples; i++) {
                    const t1 = i / samples;
                    const t2 = (i + 1) / samples;
                    const p1 = this.evaluateBezier(piece, t1);
                    const p2 = this.evaluateBezier(piece, t2);

                    if (this.lineSegmentIntersection(p1, p2, lineStart, lineEnd).intersects) {
                        return true;
                    }
                }
                return false;
            }
        }

        return false;
    }

    /**
     * Checks if two line segments intersect
     */
    private lineSegmentIntersection(a1: XY, a2: XY, b1: XY, b2: XY): LineIntersection {
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

    private circleLineIntersection(center: XY, radius: number, lineStart: XY, lineEnd: XY): LineIntersection[] {
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

    private arcLineIntersection(arc: ArcSegment, lineStart: XY, lineEnd: XY): LineIntersection[] {
        const circleIntersections = this.circleLineIntersection(arc.center, length(sub(arc.start, arc.center)), lineStart, lineEnd);
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


    /**
     * Checks if a quadrant has track (fallback method)
     */
    private checkQuadrantHasTrack(bounds: BoundingBox, trackPieces: TrackPiece[]): boolean {
        // Check center point of quadrant
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        const queryPoint = { x: centerX, y: centerY };
        for (const piece of trackPieces) {
            const distance = this.getDistanceToPiece(piece, queryPoint);
            if (distance <= piece.width / 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Queries the quadTree to check if a point is inside the track
     */
    private queryQuadTree(node: QuadTreeNode, x: number, y: number): boolean {
        // Check if point is within bounds
        if (x < node.bounds.minX || x > node.bounds.maxX ||
            y < node.bounds.minY || y > node.bounds.maxY) {
            return false;
        }

        if (node.isLeaf) {
            return node.hasTrack;
        }

        // Query children
        if (node.children) {
            for (const child of node.children) {
                if (this.queryQuadTree(child, x, y)) {
                    return true;
                }
            }
        }

        return false;
    }


    private canMergeWithLast(piece: TrackPiece, lastAnalytic: TrackPiece | undefined): boolean {
        if (!lastAnalytic || piece.type !== lastAnalytic.type || piece.width !== lastAnalytic.width) {
            return false;
        }

        switch (piece.type) {
            case TrackPieceType.Straight:
                // Can merge straights if they're collinear (same direction)
                const lastStraight = lastAnalytic as StraightPiece;
                const dir1 = Math.atan2(lastStraight.end.y - lastStraight.start.y, lastStraight.end.x - lastStraight.start.x);
                const dir2 = Math.atan2(piece.end.y - piece.start.y, piece.end.x - piece.start.x);
                return Math.abs(dir1 - dir2) < 0.001; // Small tolerance for floating point errors

            case TrackPieceType.Arc:
                // Can merge arcs if they have same center and direction
                const lastArc = lastAnalytic as ArcPiece;
                const arcPiece = piece as ArcPiece;
                return Math.abs(lastArc.center.x - arcPiece.center.x) < 0.001 &&
                    Math.abs(lastArc.center.y - arcPiece.center.y) < 0.001 &&
                    lastArc.clockwise === arcPiece.clockwise;

            case TrackPieceType.Spline:
                // Don't merge splines for now as it's more complex
                return false;
        }
    }

    private mergeWithLastAnalytic(piece: TrackPiece) {
        const lastIndex = this.analyticPieces.length - 1;
        const lastAnalytic = this.analyticPieces[lastIndex];

        switch (piece.type) {
            case TrackPieceType.Straight:
                // Extend the last straight to the new end point
                this.analyticPieces[lastIndex] = {
                    ...lastAnalytic,
                    end: new Vector(piece.end.x, piece.end.y)
                } as StraightPiece;
                break;

            case TrackPieceType.Arc:
                // Extend the last arc to the new end point
                this.analyticPieces[lastIndex] = {
                    ...lastAnalytic,
                    end: new Vector(piece.end.x, piece.end.y)
                } as ArcPiece;
                break;
        }
    }

    private clonePiece(piece: TrackPiece): TrackPiece {
        switch (piece.type) {
            case TrackPieceType.Straight:
                return {
                    type: TrackPieceType.Straight,
                    start: new Vector(piece.start.x, piece.start.y),
                    end: new Vector(piece.end.x, piece.end.y),
                    width: piece.width
                };
            case TrackPieceType.Arc:
                const arcPiece = piece as ArcPiece;
                return {
                    type: TrackPieceType.Arc,
                    start: new Vector(piece.start.x, piece.start.y),
                    center: new Vector(arcPiece.center.x, arcPiece.center.y),
                    end: new Vector(piece.end.x, piece.end.y),
                    clockwise: arcPiece.clockwise,
                    width: piece.width
                };
            case TrackPieceType.Spline:
                const splinePiece = piece as SplinePiece;
                return {
                    type: TrackPieceType.Spline,
                    start: new Vector(piece.start.x, piece.start.y),
                    control1: new Vector(splinePiece.control1.x, splinePiece.control1.y),
                    control2: new Vector(splinePiece.control2.x, splinePiece.control2.y),
                    end: new Vector(piece.end.x, piece.end.y),
                    width: piece.width
                };
        }
    }
}
