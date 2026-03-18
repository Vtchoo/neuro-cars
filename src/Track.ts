import p5 from "p5"
import { Vector } from "./Vector"
import * as TrackUtils from "./utils/track"




export enum TrackPieceType {
    Straight,
    Arc,
    Spline,
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

interface TrackMap {
    map: number[][]
    offset: Vector
    resolution: number
}

export interface TrackOptions {
    boundQueryType: "analytic" | "map"
}

export default class Track {
    pieces: TrackPiece[] = []
    startingPoint: Vector = new Vector(0, 0)

    private trackMap: TrackMap | null = null

    // debug
    drawLastPieceVector: boolean = true
    drawTrackMapBounds: boolean = true
    drawTrackMapCells: boolean = false

    boundQueryType: "analytic" | "map" = "map"

    /**
     * The analyticPieces array is used to store aggregated track pieces that can be used
     * for collision detection and other calculations that require a more continuous representation of the track.
     */
    private analyticPieces: TrackPiece[] = []

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
        this.trackMap = null // invalidate track map since the track has changed
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
        this.trackMap = null // invalidate track map since the track has changed
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

        this.trackMap = null // invalidate track map since the track has changed
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

        const startAngle = lastPieceDirection + (clockwise ? Math.PI / 2 : -Math.PI / 2)
        const center = new Vector(lastPieceEnd.x + radius * Math.cos(startAngle), lastPieceEnd.y + radius * Math.sin(startAngle))
        const endAngle = startAngle + (clockwise ? -angle : angle)
        const end = new Vector(center.x + radius * Math.cos(endAngle - (clockwise ? Math.PI / 2 : -Math.PI / 2)), center.y + radius * Math.sin(endAngle - (clockwise ? Math.PI / 2 : -Math.PI / 2)))
        this.addArc(lastPieceEnd, center, end, clockwise, width)
    }

    appendSpline(control1: Vector, control2: Vector, end: Vector, width: number) {
        const lastPieceEnd = this.getLastPieceEnd()
        if (!lastPieceEnd) {
            throw new Error("Cannot append spline piece to an empty track. Please add a starting piece first.")
        }
        this.addSpline(lastPieceEnd, control1, control2, end, width)
    }

    draw(p: p5, renderTrack: p5.Graphics) {
        renderTrack.background("green")
        renderTrack.push()
        renderTrack.strokeCap(p.SQUARE)
        renderTrack.noFill()
        renderTrack.strokeWeight(1)
        renderTrack.stroke("black")

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
            if (!this.trackMap) {
                this.trackMap = this.generateTrackMap(3)
            }
            const resolution = this.trackMap.resolution

            renderTrack.push()
            renderTrack.strokeWeight(1)
            renderTrack.stroke("purple")
            renderTrack.noFill()
            renderTrack.rect(this.startingPoint.x + this.trackMap.offset.x, this.startingPoint.y + this.trackMap.offset.y, this.trackMap.map[0].length * resolution, this.trackMap.map.length * resolution)

            if (this.drawTrackMapCells) {
                for (let row = 0; row < this.trackMap.map.length; row++) {
                    for (let col = 0; col < this.trackMap.map[0].length; col++) {
                        renderTrack.strokeWeight(1)
                        if (this.trackMap.map[row][col] === 0) {
                            renderTrack.stroke("gray")
                            renderTrack.fill("white")
                            // renderTrack.point(this.startingPoint.x + this.trackMap.offset.x + col * resolution + resolution / 2, this.startingPoint.y + this.trackMap.offset.y + row * resolution + resolution / 2)
                            renderTrack.rect(this.startingPoint.x + this.trackMap.offset.x + col * resolution, this.startingPoint.y + this.trackMap.offset.y + row * resolution, resolution, resolution)
                        } else {
                            renderTrack.stroke("limegreen")
                            renderTrack.fill("white")
                            renderTrack.rect(this.startingPoint.x + this.trackMap.offset.x + col * resolution, this.startingPoint.y + this.trackMap.offset.y + row * resolution, resolution, resolution)
                        }
                    }
                }
            }

            renderTrack.pop()
        }


        renderTrack.pop()
    }

    isInsideTrack(x: number, y: number): boolean {
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
                        return true
                    }
                }

                return false
            }
            case "map":
            default: {

                if (!this.trackMap) {
                    this.trackMap = this.generateTrackMap(3)
                }

                const col = Math.floor((x - this.startingPoint.x - this.trackMap.offset.x) / this.trackMap.resolution)
                const row = Math.floor((y - this.startingPoint.y - this.trackMap.offset.y) / this.trackMap.resolution)

                if (row < 0 || row >= this.trackMap.map.length || col < 0 || col >= this.trackMap.map[0].length) {
                    return false
                }
                return this.trackMap.map[row][col] === 0
            }
        }
    }

    generateTrackMap(resolution: number = 1): TrackMap {
        if (this.analyticPieces.length === 0) {
            return { map: [[1]], offset: new Vector(0, 0), resolution }
        }

        // Calculate bounding box of all track pieces
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        for (const piece of this.analyticPieces) {
            const bounds = this.getPieceBounds(piece)
            minX = Math.min(minX, bounds.minX)
            minY = Math.min(minY, bounds.minY)
            maxX = Math.max(maxX, bounds.maxX)
            maxY = Math.max(maxY, bounds.maxY)
        }

        // Add padding to ensure track edges are captured
        const maxTrackWidth = Math.max(...this.analyticPieces.map(p => p.width))
        const padding = maxTrackWidth / 2 + resolution * 2
        minX -= padding
        minY -= padding
        maxX += padding
        maxY += padding

        // Calculate matrix dimensions
        const width = Math.ceil((maxX - minX) / resolution)
        const height = Math.ceil((maxY - minY) / resolution)

        // Ensure minimum size
        const finalWidth = Math.max(width, 1)
        const finalHeight = Math.max(height, 1)

        // Create matrix (1 = grass/other, 0 = asphalt/track)
        const map: number[][] = Array(finalHeight).fill(null).map(() => Array(finalWidth).fill(1))

        // For each pixel, check if it's within track bounds
        for (let row = 0; row < finalHeight; row++) {
            for (let col = 0; col < finalWidth; col++) {
                const worldX = minX + (col + 0.5) * resolution  // Sample at center of pixel
                const worldY = minY + (row + 0.5) * resolution
                const queryPoint = { x: worldX, y: worldY }

                // Check distance to any track piece
                let isOnTrack = false
                for (const piece of this.analyticPieces) {
                    const distance = this.getDistanceToPiece(piece, queryPoint)
                    if (distance <= piece.width / 2) {
                        isOnTrack = true
                        break
                    }
                }

                map[row][col] = isOnTrack ? 0 : 1
            }
        }

        // Calculate offset from starting point
        const offset = new Vector(minX - this.startingPoint.x, minY - this.startingPoint.y)

        return { map, offset, resolution }
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
                const radius = TrackUtils.length(TrackUtils.sub(piece.start, piece.center))
                const centerX = piece.center.x
                const centerY = piece.center.y

                // For simplicity, use the full circle bounds
                // A more precise implementation would calculate the actual arc bounds
                const minX = centerX - radius - halfWidth
                const maxX = centerX + radius + halfWidth
                const minY = centerY - radius - halfWidth
                const maxY = centerY + radius + halfWidth
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

    private getDistanceToPiece(piece: TrackPiece, point: TrackUtils.Vec2): number {
        switch (piece.type) {
            case TrackPieceType.Straight: {
                const segment: TrackUtils.LineSegment = {
                    kind: "line",
                    start: { x: piece.start.x, y: piece.start.y },
                    end: { x: piece.end.x, y: piece.end.y }
                }
                return TrackUtils.closestPointOnLineSegment(segment, point).distance
            }

            case TrackPieceType.Arc: {
                const segment: TrackUtils.ArcSegment = {
                    kind: "arc",
                    start: { x: piece.start.x, y: piece.start.y },
                    end: { x: piece.end.x, y: piece.end.y },
                    center: { x: piece.center.x, y: piece.center.y },
                    clockwise: piece.clockwise,
                }
                return TrackUtils.closestPointOnArcSegment(segment, point).distance
            }

            case TrackPieceType.Spline: {
                // For splines, we would need a closestPointOnBezier function
                // For now, approximate by sampling points along the spline
                let minDistance = Infinity
                const samples = 20

                for (let i = 0; i <= samples; i++) {
                    const t = i / samples
                    const splinePoint = this.evaluateBezier(piece, t)
                    const distance = TrackUtils.length(TrackUtils.sub(point, splinePoint))
                    minDistance = Math.min(minDistance, distance)
                }

                return minDistance
            }

            default:
                return Infinity
        }
    }

    private evaluateBezier(piece: SplinePiece, t: number): TrackUtils.Vec2 {
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

        this.trackMap = null // invalidate track map since the track has changed
    }
}


// interface TrackPiece {
//     type: TrackPieceType
//     x: number
//     y: number
//     direction: number
//     radius?: number
// }

// export default class Track {
//     pieces: TrackPiece[] = []

//     private initialPosition: Vector
//     private initialDirection: number
//     trackWidth: number

//     startPosition: Vector
//     startDirection: number

//     constructor(startPosition: Vector, startDirection: number, trackWidth: number) {
//         this.startPosition = startPosition
//         this.startDirection = startDirection
//         this.trackWidth = trackWidth

//         this.initialPosition = new Vector(startPosition.x, startPosition.y).add(
//             -trackWidth * Math.sin(startDirection) / 2,
//             trackWidth * Math.cos(startDirection) / 2
//         )
//         this.initialDirection = startDirection

//         this.addPiece(TrackPieceType.Straight1Tile)
//     }


//     addPiece(type: TrackPieceType, radius?: number) {
//         const lastPiece = this.pieces.length > 0 ? this.pieces[this.pieces.length - 1] : null
//         let newPieceStartPosition
//         let newPieceDirection
//         // calculate new piece position and direction based on the last piece
//         if (lastPiece) {
//             switch (lastPiece.type) {
//                 case TrackPieceType.Straight1Tile:
//                 case TrackPieceType.StraightSqrt2Tile:
//                     newPieceStartPosition = new Vector(lastPiece.x, lastPiece.y).add(
//                         this.trackWidth * Math.cos(lastPiece.direction) * (lastPiece.type == TrackPieceType.Straight1Tile ? 1 : Math.SQRT2),
//                         this.trackWidth * Math.sin(lastPiece.direction) * (lastPiece.type == TrackPieceType.Straight1Tile ? 1 : Math.SQRT2)
//                     )
//                     newPieceDirection = lastPiece.direction
//                     break
//                 case TrackPieceType.Turn45DegLeft:
//                 case TrackPieceType.Turn90DegLeft:
//                     newPieceStartPosition = new Vector(lastPiece.x, lastPiece.y).add(
//                         this.trackWidth * Math.cos(lastPiece.direction + (lastPiece.type == TrackPieceType.Turn45DegLeft ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0)),
//                         this.trackWidth * Math.sin(lastPiece.direction + (lastPiece.type == TrackPieceType.Turn45DegLeft ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0))
//                     )
//                     newPieceDirection = lastPiece.direction + (lastPiece.type == TrackPieceType.Turn45DegLeft ? Math.PI / 4 : Math.PI / 2)
//                     break
//                 case TrackPieceType.Turn45DegRight:
//                 case TrackPieceType.Turn90DegRight:
//                     newPieceStartPosition = new Vector(lastPiece.x, lastPiece.y).add(
//                         this.trackWidth * Math.cos(lastPiece.direction - (lastPiece.type == TrackPieceType.Turn45DegRight ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0)),
//                         this.trackWidth * Math.sin(lastPiece.direction - (lastPiece.type == TrackPieceType.Turn45DegRight ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0))
//                     )
//                     newPieceDirection = lastPiece.direction - (lastPiece.type == TrackPieceType.Turn45DegRight ? Math.PI / 4 : Math.PI / 2)
//                     break
//             }
//         } else {
//             newPieceStartPosition = new Vector(this.initialPosition.x, this.initialPosition.y)
//             newPieceDirection = this.initialDirection
//         }

//         this.pieces.push({
//             type,
//             x: newPieceStartPosition.x,
//             y: newPieceStartPosition.y,
//             direction: newPieceDirection,
//             radius
//         })
//     }

//     draw(p: p5, renderTrack: p5.Graphics) {
//         renderTrack.push()
//         renderTrack.strokeCap(p.SQUARE)
//         renderTrack.noFill()
//         renderTrack.strokeWeight(this.trackWidth)
//         renderTrack.stroke("black")

//         for (let piece of this.pieces) {
//             switch (piece.type) {
//                 case TrackPieceType.Straight1Tile:
//                     renderTrack.line(piece.x,
//                         piece.y,
//                         piece.x + this.trackWidth * Math.cos(piece.direction) * 1.01,
//                         piece.y + this.trackWidth * Math.sin(piece.direction) * 1.01)
//                     renderTrack.strokeWeight(1)
//                     renderTrack.stroke("white")
//                     renderTrack.line(
//                         piece.x - this.trackWidth * Math.sin(piece.direction) / 2,
//                         piece.y + this.trackWidth * Math.cos(piece.direction) / 2,
//                         piece.x + this.trackWidth * Math.cos(piece.direction) - this.trackWidth * Math.sin(piece.direction) / 2,
//                         piece.y + this.trackWidth * Math.sin(piece.direction) + this.trackWidth * Math.cos(piece.direction) / 2
//                     )
//                     break
//                 case TrackPieceType.StraightSqrt2Tile:
//                     renderTrack.line(piece.x,
//                         piece.y,
//                         piece.x + this.trackWidth * Math.cos(piece.direction) * Math.SQRT2,
//                         piece.y + this.trackWidth * Math.sin(piece.direction) * Math.SQRT2)
//                     renderTrack.strokeWeight(1)
//                     renderTrack.stroke("white")
//                     renderTrack.line(
//                         piece.x - this.trackWidth * Math.sin(piece.direction) / 2,
//                         piece.y + this.trackWidth * Math.cos(piece.direction) / 2,
//                         piece.x + this.trackWidth * Math.cos(piece.direction) * Math.SQRT2 - this.trackWidth * Math.sin(piece.direction) / 2,
//                         piece.y + this.trackWidth * Math.sin(piece.direction) * Math.SQRT2 + this.trackWidth * Math.cos(piece.direction) / 2
//                     )
//                     break
//                 case TrackPieceType.Turn45DegLeft:
//                 case TrackPieceType.Turn45DegRight:
//                 case TrackPieceType.Turn90DegLeft:
//                 case TrackPieceType.Turn90DegRight:
//                     let radius = piece.radius ? piece.radius : 0
//                     let avgRadius = this.trackWidth * (1 + radius)
//                     let angleStart
//                     let angleEnd

//                     if (piece.type == TrackPieceType.Turn45DegLeft) {
//                         angleStart = piece.direction + Math.PI / 4 - .01
//                         angleEnd = piece.direction + Math.PI / 2 + .01
//                     } else if (piece.type == TrackPieceType.Turn45DegRight) {
//                         angleStart = piece.direction - Math.PI / 2 - .01
//                         angleEnd = piece.direction - Math.PI / 4 + .01
//                     } else if (piece.type == TrackPieceType.Turn90DegLeft) {
//                         angleStart = piece.direction + Math.PI / 2 - .01
//                         angleEnd = piece.direction + Math.PI + .01
//                     } else if (piece.type == TrackPieceType.Turn90DegRight) {
//                         angleStart = piece.direction - Math.PI - .01
//                         angleEnd = piece.direction - Math.PI / 2 + .01
//                     }

//                     renderTrack.arc(piece.x + Math.sin(piece.direction) * avgRadius / 2, piece.y - Math.cos(piece.direction) * avgRadius / 2, avgRadius, avgRadius, angleStart, angleEnd)
//                     renderTrack.strokeWeight(1)
//                     renderTrack.stroke("white")
//                     renderTrack.arc(piece.x + Math.sin(piece.direction) * avgRadius / 2, piece.y - Math.cos(piece.direction) * avgRadius / 2, avgRadius - this.trackWidth, avgRadius - this.trackWidth, angleStart, angleEnd)
//                     renderTrack.arc(piece.x + Math.sin(piece.direction) * avgRadius / 2, piece.y - Math.cos(piece.direction) * avgRadius / 2, avgRadius + this.trackWidth, avgRadius + this.trackWidth, angleStart, angleEnd)
//                     break
//             }
//         }

//         renderTrack.pop()
//     }
// }

//     renderTrack.push()
// renderTrack.strokeCap(p.SQUARE)
// renderTrack.noFill()
// renderTrack.strokeWeight(trkWidth)
// renderTrack.stroke("black")

// var pos = newVector(currentPosition.x, currentPosition.y)

// var advanceX
// var advanceY

// if (turn != "straight") {

//     var avgRadius = trkWidth * (1 + radius)
//     let angleStart
//     let angleEnd



//     if (turn == "left") {
//         angleStart = currDir + Math.PI / 4 - .01
//         angleEnd = currDir + Math.PI / 2 + .01

//         advanceX = avgRadius * Math.cos(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)
//         advanceY = avgRadius * Math.sin(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)

//         currentPosition.x += +advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
//         currentPosition.y += +advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
//         currentDirection -= Math.PI / 4

//     } else if (turn == "right") {
//         avgRadius *= -1
//         angleStart = currDir - Math.PI / 2 - .01
//         angleEnd = currDir - Math.PI / 4 + .01

//         advanceX = avgRadius * Math.cos(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)
//         advanceY = avgRadius * Math.sin(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)

//         currentPosition.x += -advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
//         currentPosition.y += -advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
//         currentDirection += Math.PI / 4
//     }

//     renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius, avgRadius, angleStart, angleEnd)
//     renderTrack.strokeWeight(1)
//     renderTrack.stroke("white")
//     renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius - trkWidth, avgRadius - trkWidth, angleStart, angleEnd)
//     renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius + trkWidth, avgRadius + trkWidth, angleStart, angleEnd)

// } else {

//     advanceX = trackWidth * radius * Math.cos(currentDirection)
//     advanceY = trackWidth * radius * Math.sin(currentDirection)
//     renderTrack.line(currentPosition.x,
//         currentPosition.y,
//         currentPosition.x + advanceX * 1.01,
//         currentPosition.y + advanceY * 1.01)

//     renderTrack.strokeWeight(1)
//     renderTrack.stroke("white")
//     renderTrack.line(
//         currentPosition.x - trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y + trkWidth * Math.cos(currDir) / 2,
//         currentPosition.x + trackWidth * radius * Math.cos(currDir) - trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y + trackWidth * radius * Math.sin(currDir) + trkWidth * Math.cos(currDir) / 2)
//     renderTrack.line(
//         currentPosition.x + trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y - trkWidth * Math.cos(currDir) / 2,
//         currentPosition.x + trackWidth * radius * Math.cos(currDir) + trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y + trackWidth * radius * Math.sin(currDir) - trkWidth * Math.cos(currDir) / 2)

//     currentPosition.x += advanceX
//     currentPosition.y += advanceY
// }

// renderTrack.pop()
