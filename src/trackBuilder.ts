// Creates the menu for building the track pieces (just like in Roller Coaster Tycoon)

import p5 from "p5"
import { newVector, Vector } from "./Vector"
import Game from "./main"
import Track, { StraightPiece, TrackPieceType } from "./Track"

// Visual settings
const buttonWidth = 60
const buttonHeight = 50

let currentPosition: Vector
let currentDirection: number

let buttons: p5.Element[]

let showGrid = true

const turnButtons = [
    { label: 'Large Left', radius: 3.5, direction: 'left' },
    { label: 'Large Right', radius: 3.5, direction: 'right' },
    { label: 'Big Left', radius: 2.5, direction: 'left' },
    { label: 'Big Right', radius: 2.5, direction: 'right' },
    { label: 'Medium Left', radius: 1.5, direction: 'left' },
    { label: 'Medium Right', radius: 1.5, direction: 'right' },
    { label: 'Small Left', radius: 0.5, direction: 'left' },
    { label: 'Small Right', radius: 0.5, direction: 'right' },
]

export function createTrackBuilder(p: p5, initialPosition: Vector, initialDirection: number, trackWidth: number, renderTrack: p5.Graphics, trackMap: number[][], renderMap: p5.Graphics, resolution: number, game: Game, track: Track) {

    currentPosition = initialPosition
    currentDirection = initialDirection

    const initialTrackPiece = {
        type: TrackPieceType.Straight,
        start: new Vector(currentPosition.x - trackWidth * Math.cos(currentDirection), currentPosition.y - trackWidth * Math.sin(currentDirection)),
        end: new Vector(currentPosition.x, currentPosition.y),
        width: trackWidth,
    } as StraightPiece

    track.addStraight(initialTrackPiece.start, initialTrackPiece.end, initialTrackPiece.width)
    console.log(track.pieces)
    buttons = new Array()

    buttons[0] = p.createButton("Large Left")
    buttons[1] = p.createButton("Large Right")
    buttons[2] = p.createButton("Big Left")
    buttons[3] = p.createButton("Big Right")
    buttons[4] = p.createButton("Medium Left")
    buttons[5] = p.createButton("Medium Right")
    buttons[6] = p.createButton("Small Left")
    buttons[7] = p.createButton("Small Right")

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {

            // let dir
            // if (j == 0) { dir = "left" } else { dir = "right" }

            // buttons[i * 2 + j].size(buttonWidth, buttonHeight)
            // buttons[i * 2 + j].position(20 + (buttonWidth + 5) * j, 20 + (buttonHeight + 5) * i)
            // buttons[i * 2 + j].mousePressed(() => {
            //     // buildTrack(6 - 2 * i, dir, trackWidth, currentDirection, renderTrack, p)
            //     track.appendArc((6 - 2 * i) * trackWidth, Math.PI / 4, dir === "right", trackWidth)
            // })

            const button = buttons[i * 2 + j]
            const turnInfo = turnButtons[i * 2 + j]
            button.size(buttonWidth, buttonHeight)
            button.position(20 + (buttonWidth + 5) * j, 20 + (buttonHeight + 5) * i)
            button.mousePressed(() => {
                track.appendArc(turnInfo.radius * trackWidth, Math.PI / 4, turnInfo.direction === "right", trackWidth)
            })
        }
    }

    buttons[8] = p.createButton("1 unit Straight")
    buttons[8].size(2 * buttonWidth + 5, buttonHeight)
    buttons[8].position(20, 20 + 4 * (buttonHeight + 5))
    // buttons[8].mousePressed(() => { buildTrack(1, "straight", trackWidth, currentDirection, renderTrack, p) })
    buttons[8].mousePressed(() => {
        track.appendStraight(trackWidth, trackWidth)
    })

    buttons[9] = p.createButton("SQRT(2) units straight")
    buttons[9].size(2 * buttonWidth + 5, buttonHeight)
    buttons[9].position(20, 20 + 5 * (buttonHeight + 5))
    buttons[9].mousePressed(() => { track.appendStraight(Math.sqrt(2) * trackWidth, trackWidth) })

    buttons[10] = p.createButton("Delete Last")
    buttons[10].size(2 * buttonWidth + 5, buttonHeight)
    buttons[10].position(20, 20 + 6 * (buttonHeight + 5))
    buttons[10].mousePressed(() => {
        if (track.pieces.length > 1) {
            track.deleteLastPiece()
        }
    })


    buttons[11] = p.createButton("Show Grid")
    buttons[11].size(2 * buttonWidth + 5, buttonHeight)
    buttons[11].position(20, 20 + 7 * (buttonHeight + 5))
    buttons[11].mousePressed(() => { showGrid = !showGrid })

    buttons[12] = p.createButton("Reset")
    buttons[12].size(buttonWidth, buttonHeight)
    buttons[12].position(20, p.height - buttonHeight - 20)
    buttons[12].mousePressed(resetTrack)

    buttons[13] = p.createButton("Done!")
    buttons[13].size(buttonWidth, buttonHeight)
    buttons[13].position(20 + 1 * (buttonWidth + 5), p.height - buttonHeight - 20)
    buttons[13].mousePressed(() => setTrack(renderTrack, trackMap, renderMap, p, resolution, game))
}


function buildTrack(radius: number, turn: string, trackWidth: number, currDir: number, renderTrack: p5.Graphics, p: p5) {
    return
    renderTrack.push()
    renderTrack.strokeCap(p.SQUARE)
    renderTrack.noFill()
    renderTrack.strokeWeight(trackWidth)
    renderTrack.stroke("black")

    var pos = newVector(currentPosition.x, currentPosition.y)

    var advanceX
    var advanceY

    if (turn != "straight") {

        var avgRadius = trackWidth * (1 + radius)
        let angleStart
        let angleEnd



        if (turn == "left") {
            angleStart = currDir + Math.PI / 4 - .01
            angleEnd = currDir + Math.PI / 2 + .01

            advanceX = avgRadius * Math.cos(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)
            advanceY = avgRadius * Math.sin(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)

            currentPosition.x += +advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
            currentPosition.y += +advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
            currentDirection -= Math.PI / 4

        } else if (turn == "right") {
            avgRadius *= -1
            angleStart = currDir - Math.PI / 2 - .01
            angleEnd = currDir - Math.PI / 4 + .01

            advanceX = avgRadius * Math.cos(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)
            advanceY = avgRadius * Math.sin(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)

            currentPosition.x += -advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
            currentPosition.y += -advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
            currentDirection += Math.PI / 4
        }

        renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius, avgRadius, angleStart, angleEnd)
        renderTrack.strokeWeight(1)
        renderTrack.stroke("white")
        renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius - trackWidth, avgRadius - trackWidth, angleStart, angleEnd)
        renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius + trackWidth, avgRadius + trackWidth, angleStart, angleEnd)

    } else {

        advanceX = trackWidth * radius * Math.cos(currentDirection)
        advanceY = trackWidth * radius * Math.sin(currentDirection)
        renderTrack.line(currentPosition.x,
            currentPosition.y,
            currentPosition.x + advanceX * 1.01,
            currentPosition.y + advanceY * 1.01)

        renderTrack.strokeWeight(1)
        renderTrack.stroke("white")
        renderTrack.line(
            currentPosition.x - trackWidth * Math.sin(currDir) / 2,
            currentPosition.y + trackWidth * Math.cos(currDir) / 2,
            currentPosition.x + trackWidth * radius * Math.cos(currDir) - trackWidth * Math.sin(currDir) / 2,
            currentPosition.y + trackWidth * radius * Math.sin(currDir) + trackWidth * Math.cos(currDir) / 2)
        renderTrack.line(
            currentPosition.x + trackWidth * Math.sin(currDir) / 2,
            currentPosition.y - trackWidth * Math.cos(currDir) / 2,
            currentPosition.x + trackWidth * radius * Math.cos(currDir) + trackWidth * Math.sin(currDir) / 2,
            currentPosition.y + trackWidth * radius * Math.sin(currDir) - trackWidth * Math.cos(currDir) / 2)

        currentPosition.x += advanceX
        currentPosition.y += advanceY
    }

    renderTrack.pop()
    console.log("Track segment built")
}

function resetTrack() {
    // Resets the grid
    for (let i = 0; i < canvas.width; i++) {
        for (let j = 0; j < canvas.height; j++) {
            grid.set(i, j, "rgba(0,0,0,0)")
        }
    }
    grid.updatePixels()
    phase = "resetTrack"
}

export function createGrid(grid: p5.Graphics, start: Vector, direction: number, trackWidth: number, p: p5) {
    var spacing = trackWidth
    var angle = direction
    var anchor = start

    var offset = (grid.width % spacing) / spacing

    for (let i = 0; i < 2 * grid.width / spacing; i++) {
        for (let j = 0; j < 2 * grid.width / spacing; j++) {
            grid.push()
            grid.stroke("white")
            grid.noFill()
            grid.translate(anchor.x, anchor.y)
            grid.rotate(angle)
            grid.rectMode(p.CENTER)
            grid.square(-grid.width + spacing * (i + offset), -grid.width + spacing * (j + offset), spacing)
            grid.pop()
        }
    }
}

export function setTrack(renderTrack: p5.Graphics, trackMap: number[][], renderMap: p5.Graphics, p: p5, resolution: number, game: Game) {

    // Removes the track builder
    if (typeof buttons != "undefined") {
        buttons.forEach(function (element) { element.remove() })
    }

    // Hides the grid, if it is showing
    if (showGrid == true) { showGrid = false }

    // Creates the collison map for the track
    renderTrack.loadPixels()

    // Also creates a visual representation of the collision map
    renderMap.push()

    for (let i = 0; i < Math.floor(renderMap.width / resolution); i++) {
        for (let j = 0; j < Math.floor(renderMap.height / resolution); j++) {

            if (renderTrack.pixels[4 * (j * renderMap.width + i) * resolution + 1] > 20) {
                renderMap.fill("red")
                trackMap[i][j] = 0
            } else {
                renderMap.fill("white")
                trackMap[i][j] = 1
            }
            renderMap.rect(i * resolution, j * resolution, resolution, resolution)
        }
    }
    renderMap.pop()

    // Show additional buttons to control the visualization
    const exibInputs = p.createButton("Show Inputs")
    exibInputs.size(buttonWidth, buttonHeight)
    exibInputs.position(20, p.height - buttonHeight - 20)
    exibInputs.mousePressed(() => { showInputs = !showInputs })

    const exibMap = p.createButton("Show Map")
    exibMap.size(buttonWidth, buttonHeight)
    exibMap.position(20 + (buttonWidth + 5) * 1, p.height - buttonHeight - 20)
    exibMap.mousePressed(() => { showMap = !showMap })

    const incrTime = p.createButton("Increase simul. time")
    incrTime.size(buttonWidth, buttonHeight)
    incrTime.position(20 + (buttonWidth + 5) * 2, p.height - buttonHeight - 20)
    incrTime.mousePressed(() => { maxticks += 100 })

    const showGraph = p.createButton("Show graphs")
    showGraph.size(buttonWidth, buttonHeight)
    showGraph.position(20 + (buttonWidth + 5) * 3, p.height - buttonHeight - 20)
    showGraph.mousePressed(() => { drawGraphs = !drawGraphs })

    game.setPhase("setup")
}