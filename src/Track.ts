import p5 from "p5"
import { Vector } from "./Vector"




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

export default class Track {
    pieces: TrackPiece[] = []
    startingPoint: Vector = new Vector(0, 0)

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
    }

    appendStraight(length: number, width: number) {
        const lastPieceEnd = this.getLastPieceEnd()
        if (!lastPieceEnd) {
            throw new Error("Cannot append straight piece to an empty track. Please add a starting piece first.")
        }
        const lastPieceDirection = Math.atan2(lastPieceEnd.y - this.startingPoint.y, lastPieceEnd.x - this.startingPoint.x)
        const newEnd = new Vector(lastPieceEnd.x + length * Math.cos(lastPieceDirection), lastPieceEnd.y + length * Math.sin(lastPieceDirection))
        this.addStraight(lastPieceEnd, newEnd, width)
    }

    appendArc(radius: number, clockwise: boolean, width: number) {
        const lastPieceEnd = this.getLastPieceEnd()
        if (!lastPieceEnd) {
            throw new Error("Cannot append arc piece to an empty track. Please add a starting piece first.")
        }
        const lastPieceDirection = Math.atan2(lastPieceEnd.y - this.startingPoint.y, lastPieceEnd.x - this.startingPoint.x)
        const centerDirection = lastPieceDirection + (clockwise ? Math.PI / 2 : -Math.PI / 2)
        const center = new Vector(lastPieceEnd.x + radius * Math.cos(centerDirection), lastPieceEnd.y + radius * Math.sin(centerDirection))
        const newEndDirection = lastPieceDirection + (clockwise ? Math.PI / 2 : -Math.PI / 2)
        const newEnd = new Vector(center.x + radius * Math.cos(newEndDirection), center.y + radius * Math.sin(newEndDirection))
        this.addArc(lastPieceEnd, center, newEnd, clockwise, width)
    }

    appendSpline(control1: Vector, control2: Vector, end: Vector, width: number) {
        const lastPieceEnd = this.getLastPieceEnd()
        if (!lastPieceEnd) {
            throw new Error("Cannot append spline piece to an empty track. Please add a starting piece first.")
        }
        this.addSpline(lastPieceEnd, control1, control2, end, width)
    }

    draw(p: p5, renderTrack: p5.Graphics) {
        renderTrack.push()
        renderTrack.strokeCap(p.SQUARE)
        renderTrack.noFill()
        renderTrack.strokeWeight(1)
        renderTrack.stroke("black")

        for (let piece of this.analyticPieces) {
            renderTrack.strokeWeight(piece.width)
            switch (piece.type) {
                case TrackPieceType.Straight:
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
                    break
                case TrackPieceType.Arc:
                    const radius = Math.sqrt((piece.center.x - piece.start.x) ** 2 + (piece.center.y - piece.start.y) ** 2)
                    const angleStart = Math.atan2(piece.start.y - piece.center.y, piece.start.x - piece.center.x)
                    const angleEnd = Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x)
                    renderTrack.arc(piece.center.x, piece.center.y, radius * 2, radius * 2, angleStart, angleEnd, piece.clockwise ? "chord" : "open")
                    renderTrack.strokeWeight(1)
                    renderTrack.stroke("white")
                    renderTrack.arc(piece.center.x, piece.center.y, (radius - piece.width) * 2, (radius - piece.width) * 2, angleStart, angleEnd, piece.clockwise ? "chord" : "open")
                    renderTrack.arc(piece.center.x, piece.center.y, (radius + piece.width) * 2, (radius + piece.width) * 2, angleStart, angleEnd, piece.clockwise ? "chord" : "open")
                    break
                case TrackPieceType.Spline:
                    renderTrack.stroke("white")
                    renderTrack.strokeWeight(piece.width + 2)
                    renderTrack.bezier(piece.start.x, piece.start.y, piece.control1.x, piece.control1.y, piece.control2.x, piece.control2.y, piece.end.x, piece.end.y)
                    renderTrack.stroke("black")
                    renderTrack.strokeWeight(piece.width)
                    renderTrack.bezier(piece.start.x, piece.start.y, piece.control1.x, piece.control1.y, piece.control2.x, piece.control2.y, piece.end.x, piece.end.y)
                    break
            }
        }

        renderTrack.pop()
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
