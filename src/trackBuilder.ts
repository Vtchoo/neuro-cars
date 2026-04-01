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

// const turnButtons = [
//     { label: 'Large Left', radius: 3.5, direction: 'left' },
//     { label: 'Large Right', radius: 3.5, direction: 'right' },
//     { label: 'Big Left', radius: 2.5, direction: 'left' },
//     { label: 'Big Right', radius: 2.5, direction: 'right' },
//     { label: 'Medium Left', radius: 1.5, direction: 'left' },
//     { label: 'Medium Right', radius: 1.5, direction: 'right' },
//     { label: 'Small Left', radius: 0.5, direction: 'left' },
//     { label: 'Small Right', radius: 0.5, direction: 'right' },
// ]
const turnButtons = [
    { label: 'Very Large Left', radius: 5.5, direction: 'left' },
    { label: 'Very Large Right', radius: 5.5, direction: 'right' },
    { label: 'Large Left', radius: 4.5, direction: 'left' },
    { label: 'Large Right', radius: 4.5, direction: 'right' },
    { label: 'Big Left', radius: 3.5, direction: 'left' },
    { label: 'Big Right', radius: 3.5, direction: 'right' },
    { label: 'Medium Left', radius: 2.5, direction: 'left' },
    { label: 'Medium Right', radius: 2.5, direction: 'right' },
    { label: 'Small Left', radius: 1.5, direction: 'left' },
    { label: 'Small Right', radius: 1.5, direction: 'right' },
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

    buttons.push(p.createButton("Very Large Left"))
    buttons.push(p.createButton("Very Large Right"))
    buttons.push(p.createButton("Large Left"))
    buttons.push(p.createButton("Large Right"))
    buttons.push(p.createButton("Big Left"))
    buttons.push(p.createButton("Big Right"))
    buttons.push(p.createButton("Medium Left"))
    buttons.push(p.createButton("Medium Right"))
    buttons.push(p.createButton("Small Left"))
    buttons.push(p.createButton("Small Right"))

    for (let i = 0; i < 5; i++) {
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
                game.track.appendArc(turnInfo.radius * trackWidth, Math.PI / 16, turnInfo.direction === "right", trackWidth)
            })
        }
    }

    const straightButton = p.createButton("1 unit Straight")
    straightButton.size(2 * buttonWidth + 5, buttonHeight)
    straightButton.position(20, 20 + buttons.length * (buttonHeight + 5))
    // straightButton.mousePressed(() => { buildTrack(1, "straight", trackWidth, currentDirection, renderTrack, p) })
    straightButton.mousePressed(() => {
        game.track.appendStraight(trackWidth, trackWidth)
    })
    buttons.push(straightButton)

    const sqrt2Button = p.createButton("SQRT(2) units straight")
    sqrt2Button.size(2 * buttonWidth + 5, buttonHeight)
    sqrt2Button.position(20, 20 + buttons.length * (buttonHeight + 5))
    sqrt2Button.mousePressed(() => { game.track.appendStraight(Math.sqrt(2) * trackWidth, trackWidth) })
    buttons.push(sqrt2Button)

    const deleteLastButton = p.createButton("Delete Last")
    deleteLastButton.size(2 * buttonWidth + 5, buttonHeight)
    deleteLastButton.position(20, 20 + buttons.length * (buttonHeight + 5))
    deleteLastButton.mousePressed(() => {
        if (game.track.pieces.length > 1) {
            game.track.deleteLastPiece()
        }
    })
    buttons.push(deleteLastButton)

    const showGridButton = p.createButton("Show Grid")
    showGridButton.size(2 * buttonWidth + 5, buttonHeight)
    showGridButton.position(20, 20 + buttons.length * (buttonHeight + 5))
    showGridButton.mousePressed(() => { showGrid = !showGrid })
    buttons.push(showGridButton)

    const resetButton = p.createButton("Reset")
    resetButton.size(buttonWidth, buttonHeight)
    // resetButton.position(20, p.height - buttonHeight - 20)
    resetButton.style(`bottom: 20px; left: 20px; position: absolute;`)
    resetButton.mousePressed(() => resetTrack(game))
    buttons.push(resetButton)

    const doneButton = p.createButton("Done!")
    doneButton.size(buttonWidth, buttonHeight)
    // doneButton.position(20 + 1 * (buttonWidth + 5), p.height - buttonHeight - 20)
    doneButton.style(`bottom: 20px; left: ${buttonWidth + 25}px; position: absolute;`)
    doneButton.mousePressed(() => setTrack(renderTrack, trackMap, renderMap, p, resolution, game))
    buttons.push(doneButton)

    const loadTrackButton = p.createButton("Load Track")
    loadTrackButton.size(buttonWidth, buttonHeight)
    // loadTrackButton.position(20 + 2 * (buttonWidth + 5), p.height - buttonHeight - 20)
    loadTrackButton.style(`bottom: 20px; left: ${2 * (buttonWidth + 25)}px; position: absolute;`)
    loadTrackButton.mousePressed(() => loadTrackInEditor(p, game))
    buttons.push(loadTrackButton)
}

function resetTrack(game: Game) {
    // Clear track pieces and reset to start
    game.setPhase("resetTrack")
}

function loadTrackInEditor(p: p5, game: Game) {
    // Create a file input element to load a track
    const input = p.createFileInput((file: any) => {
        if (file.type !== 'application' || file.subtype !== 'json' || !file.name.endsWith('.json')) {
            alert("Please select a JSON file")
            // Remove the file input after use
            input.remove()
            return
        }

        const fr = new FileReader()
        fr.onload = (e) => {
            try {
                const saveData = JSON.parse(e.target?.result as string)
                if (!saveData.track.pieces) {
                    alert("Invalid save file - no track data found")
                    // Remove the file input after use
                    input.remove()
                    return
                }
                // Load the track data into the current track
                const track = Track.fromData(saveData.track)
                console.log("Track loaded successfully")

                // Update the track in the game
                game.track = track
                game.start = track.startingPoint
                game.direction = track.startingDirection

                alert("Track loaded successfully!")
            } catch (error) {
                console.error("Error loading track:", error)
                alert("Error loading track file")
            }
        }
        fr.readAsText(file.file)

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