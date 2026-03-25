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

    game.track.addStraight(initialTrackPiece.start, initialTrackPiece.end, initialTrackPiece.width)
    console.log(game.track.pieces)
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
                game.track.appendArc(turnInfo.radius * trackWidth, Math.PI / 4, turnInfo.direction === "right", trackWidth)
            })
        }
    }

    buttons[8] = p.createButton("1 unit Straight")
    buttons[8].size(2 * buttonWidth + 5, buttonHeight)
    buttons[8].position(20, 20 + 4 * (buttonHeight + 5))
    // buttons[8].mousePressed(() => { buildTrack(1, "straight", trackWidth, currentDirection, renderTrack, p) })
    buttons[8].mousePressed(() => {
        game.track.appendStraight(trackWidth, trackWidth)
    })

    buttons[9] = p.createButton("SQRT(2) units straight")
    buttons[9].size(2 * buttonWidth + 5, buttonHeight)
    buttons[9].position(20, 20 + 5 * (buttonHeight + 5))
    buttons[9].mousePressed(() => { game.track.appendStraight(Math.sqrt(2) * trackWidth, trackWidth) })

    buttons[10] = p.createButton("Delete Last")
    buttons[10].size(2 * buttonWidth + 5, buttonHeight)
    buttons[10].position(20, 20 + 6 * (buttonHeight + 5))
    buttons[10].mousePressed(() => {
        if (game.track.pieces.length > 1) {
            game.track.deleteLastPiece()
        }
    })


    buttons[11] = p.createButton("Show Grid")
    buttons[11].size(2 * buttonWidth + 5, buttonHeight)
    buttons[11].position(20, 20 + 7 * (buttonHeight + 5))
    buttons[11].mousePressed(() => { showGrid = !showGrid })

    buttons[12] = p.createButton("Reset")
    buttons[12].size(buttonWidth, buttonHeight)
    // buttons[12].position(20, p.height - buttonHeight - 20)
    buttons[12].style(`bottom: 20px; left: 20px; position: absolute;`)
    buttons[12].mousePressed(() => resetTrack(game))

    buttons[13] = p.createButton("Done!")
    buttons[13].size(buttonWidth, buttonHeight)
    // buttons[13].position(20 + 1 * (buttonWidth + 5), p.height - buttonHeight - 20)
    buttons[13].style(`bottom: 20px; left: ${buttonWidth + 25}px; position: absolute;`)
    buttons[13].mousePressed(() => setTrack(renderTrack, trackMap, renderMap, p, resolution, game))

    buttons[14] = p.createButton("Load Track")
    buttons[14].size(buttonWidth, buttonHeight)
    // buttons[14].position(20 + 2 * (buttonWidth + 5), p.height - buttonHeight - 20)
    buttons[14].style(`bottom: 20px; left: ${2 * (buttonWidth + 25)}px; position: absolute;`)
    buttons[14].mousePressed(() => loadTrackInEditor(p, game))
}

function resetTrack(game: Game) {
    // Clear track pieces and reset to start
    game.setPhase("resetTrack")
}

function loadTrackInEditor(p: p5, game: Game) {
    // Create a file input element to load a track
    const input = p.createFileInput((file: any) => {
        if (file.type === 'application' && file.subtype === 'json' || file.name.endsWith('.json')) {
            const fr = new FileReader()
            fr.onload = (e) => {
                try {
                    const saveData = JSON.parse(e.target?.result as string)
                    if (saveData.track && saveData.track.pieces) {
                        // Load the track data into the current track
                        const track = Track.fromData(saveData.track)
                        console.log("Track loaded successfully")
                        
                        // Update the track in the game
                        game.track = track
                        game.start = track.startingPoint
                        game.direction = track.startingDirection
                        
                        alert("Track loaded successfully!")
                    } else {
                        alert("Invalid save file - no track data found") 
                    }
                } catch (error) {
                    console.error("Error loading track:", error)
                    alert("Error loading track file")
                }
            }
            fr.readAsText(file.file)
        } else {
            alert("Please select a JSON file")
        }
        
        // Remove the file input after use
        input.remove()
    })
    
    // Trigger the file input
    input.elt.click()
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

    // Show additional buttons to control the visualization
    const exibInputs = p.createButton("Show Inputs")
    exibInputs.size(buttonWidth, buttonHeight)
    // exibInputs.position(20, p.height - buttonHeight - 20)
    exibInputs.style(`bottom: 20px; left: 20px; position: absolute;`)
    exibInputs.mousePressed(() => game.toggleShowInputs())

    const exibMap = p.createButton("Show Map")
    exibMap.size(buttonWidth, buttonHeight)
    // exibMap.position(20 + (buttonWidth + 5) * 1, p.height - buttonHeight - 20)
    exibMap.style(`bottom: 20px; left: ${buttonWidth + 25}px; position: absolute;`)
    exibMap.mousePressed(() => game.toggleShowMap())

    const incrTime = p.createButton("Increase simul. time")
    incrTime.size(buttonWidth, buttonHeight)
    // incrTime.position(20 + (buttonWidth + 5) * 2, p.height - buttonHeight - 20)
    incrTime.style(`bottom: 20px; left: ${2 * (buttonWidth + 5)}px; position: absolute;`)
    incrTime.mousePressed(() => game.incrementMaxTicks(100))

    const showGraph = p.createButton("Show graphs")
    showGraph.size(buttonWidth, buttonHeight)
    // showGraph.position(20 + (buttonWidth + 5) * 3, p.height - buttonHeight - 20)
    showGraph.style(`bottom: 20px; left: ${3 * (buttonWidth + 5)}px; position: absolute;`)
    showGraph.mousePressed(() => game.toggleDrawGraphs())

    const followBest = p.createButton("Follow best car")
    followBest.size(buttonWidth, buttonHeight)
    // followBest.position(20 + (buttonWidth + 5) * 4, p.height - buttonHeight - 20)
    followBest.style(`bottom: 20px; left: ${4 * (buttonWidth + 5)}px; position: absolute;`)
    followBest.mousePressed(() => { game.followBestCar = !game.followBestCar })

    game.setPhase("setup")
}