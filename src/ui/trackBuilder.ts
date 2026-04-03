// Creates the menu for building the track pieces (just like in Roller Coaster Tycoon)

import p5 from "p5"
import { newVector, Vector } from "../Vector"
import Game from "../main"
import Track, { StraightPiece, TrackPieceType } from "../Track"
import { style } from "../utils/css"
import { containerStyle } from "./styles"
import { buildGameMenu } from "./gameMenu"

// Visual settings
const buttonWidth = 60
const buttonHeight = 50

let currentPosition: Vector
let currentDirection: number

let buttons: p5.Element[]
let editor: p5.Element
let controls: p5.Element

let showGrid = true

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

const wideButtonStyle = style({
    width: `100%`,
    height: `${buttonHeight}px`
})

export function createTrackBuilder(p: p5, initialPosition: Vector, initialDirection: number, trackWidth: number, renderTrack: p5.Graphics, trackMap: number[][], renderMap: p5.Graphics, resolution: number, game: Game, track: Track) {

    editor = p.createElement("div")
    editor.style(style({
        ...containerStyle,
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '.5rem'
    }))

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
    buttons = []

    for (let i = 0; i < 5; i++) {
        const row = p.createElement("div")
        row.style(style({
            display: 'flex',
            gap: '.5rem',
            width: '100%',
        }))

        for (let j = 0; j < 2; j++) {
            const button = p.createButton(turnButtons[i * 2 + j].label)
            const turnInfo = turnButtons[i * 2 + j]
            button.size(buttonWidth, buttonHeight)
            button.style(style({
                flex: 1,
            }))
            button.mousePressed(() => {
                game.track.appendArc(turnInfo.radius * trackWidth, Math.PI / 16, turnInfo.direction === "right", trackWidth)
            })
            buttons.push(button)
            row.child(button)
        }
        editor.child(row)
    }

    const straightButton = p.createButton("1 unit Straight")
    straightButton.style(wideButtonStyle)
    straightButton.mousePressed(() => {
        game.track.appendStraight(trackWidth, trackWidth)
    })
    buttons.push(straightButton)
    editor.child(straightButton)

    const sqrt2Button = p.createButton("SQRT(2) units straight")
    sqrt2Button.style(wideButtonStyle)
    sqrt2Button.mousePressed(() => {
        game.track.appendStraight(Math.sqrt(2) * trackWidth, trackWidth)
    })
    buttons.push(sqrt2Button)
    editor.child(sqrt2Button)

    const deleteLastButton = p.createButton("Delete Last")
    deleteLastButton.style(wideButtonStyle)
    deleteLastButton.mousePressed(() => {
        if (game.track.pieces.length > 1) {
            game.track.deleteLastPiece()
        }
    })
    buttons.push(deleteLastButton)
    editor.child(deleteLastButton)

    const tryFinishTrackButton = p.createButton("Auto finish")
    tryFinishTrackButton.style(wideButtonStyle)
    tryFinishTrackButton.mousePressed(() => {
        game.track.tryFinishTrack()
    })
    buttons.push(tryFinishTrackButton)
    editor.child(tryFinishTrackButton)

    const buildPreviewButton = p.createButton("Build")
    buildPreviewButton.style(wideButtonStyle)
    buildPreviewButton.mousePressed(() => {
        game.track.buildPreviewTrackPieces()
    })
    buttons.push(buildPreviewButton)
    editor.child(buildPreviewButton)

    controls = p.createElement("div")
    controls.style(style({
        ...containerStyle,
        display: 'flex',
        gap: '.5rem',
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
    }))

    const resetButton = p.createButton("Reset")
    resetButton.size(buttonWidth, buttonHeight)
    resetButton.mousePressed(() => resetTrack(game))
    buttons.push(resetButton)
    controls.child(resetButton)

    const doneButton = p.createButton("Done!")
    doneButton.size(buttonWidth, buttonHeight)
    doneButton.mousePressed(() => setTrack(game, p))
    buttons.push(doneButton)
    controls.child(doneButton)

    const loadTrackButton = p.createButton("Load Track")
    loadTrackButton.size(buttonWidth, buttonHeight)
    loadTrackButton.mousePressed(() => loadTrackInEditor(p, game))
    buttons.push(loadTrackButton)
    controls.child(loadTrackButton)
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

export function setTrack(game: Game, p: p5) {

    editor.remove()
    controls.remove()

    game.gameMenu = buildGameMenu(game, p)

    game.setPhase("setup")
}