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
let advancedEditor: p5.Element
let trackSelector: p5.Element

// Track selection state
let trackCursorIndex = 0
let selectionStart: number | null = null
let selectionEnd: number | null = null
let isSelectionMode = false

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

    let angleIncrement = Math.PI / 16
    
    const angleIncrementButtons = p.createElement("div")
    angleIncrementButtons.style(style({
        display: 'flex',
        gap: '.5rem',
        width: '100%',
        alignItems: 'center',
    }))
    const decreaseAngleIncrementButton = p.createButton("- angle")
    decreaseAngleIncrementButton.style(style({
        flex: 1,
        whiteSpace: 'nowrap',
    }))
    decreaseAngleIncrementButton.mouseClicked(() => {
        angleIncrement = Math.max(angleIncrement - Math.PI / 64, Math.PI / 64)
        angleIncrementLabel.html(`${(angleIncrement * 180 / Math.PI).toFixed(1)}°`)
    })
    const angleIncrementLabel = p.createElement("div")
    angleIncrementLabel.html(`${(angleIncrement * 180 / Math.PI).toFixed(1)}°`)
    const increaseAngleIncrementButton = p.createButton("+ angle")
    increaseAngleIncrementButton.style(style({
        flex: 1,
        whiteSpace: 'nowrap',
    }))
    increaseAngleIncrementButton.mouseClicked(() => {
        angleIncrement = Math.min(angleIncrement + Math.PI / 64, Math.PI / 4)
        angleIncrementLabel.html(`${(angleIncrement * 180 / Math.PI).toFixed(1)}°`)
    })
    angleIncrementButtons.child(decreaseAngleIncrementButton)
    angleIncrementButtons.child(angleIncrementLabel)
    angleIncrementButtons.child(increaseAngleIncrementButton)
    editor.child(angleIncrementButtons)

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
            button.mouseClicked(() => {
                game.track.appendArc(turnInfo.radius * trackWidth, angleIncrement, turnInfo.direction === "right", trackWidth)
            })
            buttons.push(button)
            row.child(button)
        }
        editor.child(row)
    }

    const straightButton = p.createButton("1 unit Straight")
    straightButton.style(wideButtonStyle)
    straightButton.mouseClicked(() => {
        game.track.appendStraight(trackWidth, trackWidth)
    })
    buttons.push(straightButton)
    editor.child(straightButton)

    const sqrt2Button = p.createButton("SQRT(2) units straight")
    sqrt2Button.style(wideButtonStyle)
    sqrt2Button.mouseClicked(() => {
        game.track.appendStraight(Math.sqrt(2) * trackWidth, trackWidth)
    })
    buttons.push(sqrt2Button)
    editor.child(sqrt2Button)

    const deleteLastButton = p.createButton("Delete Last")
    deleteLastButton.style(wideButtonStyle)
    deleteLastButton.mouseClicked(() => {
        if (game.track.pieces.length > 1) {
            game.track.deleteLastPiece()
        }
    })
    buttons.push(deleteLastButton)
    editor.child(deleteLastButton)

    const tryFinishTrackButton = p.createButton("Auto complete")
    tryFinishTrackButton.style(wideButtonStyle)
    tryFinishTrackButton.mouseClicked(() => {
        game.track.tryFinishTrack()
    })
    buttons.push(tryFinishTrackButton)
    editor.child(tryFinishTrackButton)

    const buildPreviewButton = p.createButton("Build")
    buildPreviewButton.style(wideButtonStyle)
    buildPreviewButton.mouseClicked(() => {
        game.track.buildPreviewTrackPieces()
    })
    buttons.push(buildPreviewButton)
    editor.child(buildPreviewButton)

    // Create Advanced Track Editor
    createAdvancedTrackEditor(p, game, trackWidth)
    
    // Create Track Selection System  
    createTrackSelector(p, game, trackWidth)

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
    resetButton.mouseClicked(() => resetTrack(game))
    buttons.push(resetButton)
    controls.child(resetButton)

    const doneButton = p.createButton("Done!")
    doneButton.size(buttonWidth, buttonHeight)
    doneButton.mouseClicked(() => setTrack(game, p))
    buttons.push(doneButton)
    controls.child(doneButton)

    const loadTrackButton = p.createButton("Load Track")
    loadTrackButton.size(buttonWidth, buttonHeight)
    loadTrackButton.mouseClicked(() => loadTrackInEditor(p, game))
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
    if (advancedEditor) advancedEditor.remove()
    if (trackSelector) trackSelector.remove()

    game.gameMenu = buildGameMenu(game, p)

    game.setPhase("setup")
}

function createAdvancedTrackEditor(p: p5, game: Game, trackWidth: number) {
    advancedEditor = p.createElement("div")
    advancedEditor.style(style({
        ...containerStyle,
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '.5rem',
        width: '200px'
    }))

    const title = p.createElement("h3", "Advanced Track Editor")
    title.style(style({
        margin: '0',
        textAlign: 'center',
        color: 'black'
    }))
    advancedEditor.child(title)

    // Piece Type Selector
    const pieceTypeLabel = p.createElement("label", "Piece Type:")
    pieceTypeLabel.style(style({ color: 'black', fontSize: '12px' }))
    advancedEditor.child(pieceTypeLabel)

    const pieceTypeSelect = p.createSelect()
    pieceTypeSelect.option("Straight")
    pieceTypeSelect.option("Arc")
    pieceTypeSelect.style(style({ width: '100%' }))
    advancedEditor.child(pieceTypeSelect)

    // Length Input
    const lengthLabel = p.createElement("label", "Length (units):")
    lengthLabel.style(style({ color: 'black', fontSize: '12px' }))
    advancedEditor.child(lengthLabel)

    const lengthInput = p.createInput("2.0", "number")
    lengthInput.style(style({ width: '100%' }))
    lengthInput.attribute("step", "0.1")
    lengthInput.attribute("min", "0.1")
    advancedEditor.child(lengthInput)

    // Radius Input (for arcs only)
    const radiusLabel = p.createElement("label", "Radius (units):")
    radiusLabel.style(style({ color: 'black', fontSize: '12px' }))
    advancedEditor.child(radiusLabel)

    const radiusInput = p.createInput("2.5", "number")
    radiusInput.style(style({ width: '100%' }))
    radiusInput.attribute("step", "0.1")
    radiusInput.attribute("min", "0.1")
    advancedEditor.child(radiusInput)

    // Direction (for arcs only)
    const directionLabel = p.createElement("label", "Direction:")
    directionLabel.style(style({ color: 'black', fontSize: '12px' }))
    advancedEditor.child(directionLabel)

    const directionSelect = p.createSelect()
    directionSelect.option("Left")
    directionSelect.option("Right")
    directionSelect.style(style({ width: '100%' }))
    advancedEditor.child(directionSelect)

    // Update visibility based on piece type
    const updateVisibility = () => {
        const isArc = pieceTypeSelect.value() === "Arc"
        radiusLabel.style(style({ display: isArc ? 'block' : 'none' }))
        radiusInput.style(style({ display: isArc ? 'block' : 'none' }))
        directionLabel.style(style({ display: isArc ? 'block' : 'none' }))
        directionSelect.style(style({ display: isArc ? 'block' : 'none' }))
    }
    
    pieceTypeSelect.changed(updateVisibility)
    updateVisibility()

    // Preview Button
    const previewButton = p.createButton("Preview Piece")
    previewButton.style(wideButtonStyle)
    previewButton.mouseClicked(() => {
        const pieceType = pieceTypeSelect.value() as string
        const length = parseFloat(lengthInput.value() as string)
        
        if (pieceType === "Straight") {
            game.track.appendStraight(length * trackWidth, trackWidth, true)
        } else if (pieceType === "Arc") {
            const radius = parseFloat(radiusInput.value() as string)
            const isClockwise = directionSelect.value() === "Right"
            const angle = length / radius // Convert length to angle (length = arc length)
            game.track.appendArc(radius * trackWidth, angle, isClockwise, trackWidth, true)
        }
    })
    advancedEditor.child(previewButton)

    // Build Button  
    const buildButton = p.createButton("Build Piece")
    buildButton.style(wideButtonStyle)
    buildButton.mouseClicked(() => {
        game.track.buildPreviewTrackPieces()
    })
    advancedEditor.child(buildButton)
}

function createTrackSelector(p: p5, game: Game, trackWidth: number) {
    trackSelector = p.createElement("div")
    trackSelector.style(style({
        ...containerStyle,
        position: 'absolute',
        bottom: '1rem',
        right: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '.5rem',
        width: '200px'
    }))

    const title = p.createElement("h3", "Track Editor")
    title.style(style({
        margin: '0',
        textAlign: 'center',
        color: 'black'
    }))
    trackSelector.child(title)

    // Cursor Info
    const cursorInfo = p.createElement("div", "Piece: 0 / 0")
    cursorInfo.style(style({ color: 'black', fontSize: '12px', textAlign: 'center' }))
    trackSelector.child(cursorInfo)

    // Navigation buttons
    const navRow = p.createElement("div")
    navRow.style(style({
        display: 'flex',
        gap: '.5rem',
        width: '100%'
    }))

    const prevButton = p.createButton("◀ Prev")
    prevButton.style(style({ flex: '1' }))
    prevButton.mouseClicked(() => {
        if (game.track.pieces.length > 0) {
            trackCursorIndex = (trackCursorIndex - 1 + game.track.pieces.length) % game.track.pieces.length
            updateCursorInfo()
        }
    })
    navRow.child(prevButton)

    const nextButton = p.createButton("Next ▶")
    nextButton.style(style({ flex: '1' }))
    nextButton.mouseClicked(() => {
        if (game.track.pieces.length > 0) {
            trackCursorIndex = (trackCursorIndex + 1) % game.track.pieces.length
            updateCursorInfo()
        }
    })
    navRow.child(nextButton)

    trackSelector.child(navRow)

    // Selection controls
    const selectionRow = p.createElement("div")
    selectionRow.style(style({
        display: 'flex',
        gap: '.5rem',
        width: '100%'
    }))

    const startSelectButton = p.createButton("Start Select")
    startSelectButton.style(style({ flex: '1' }))
    startSelectButton.mouseClicked(() => {
        selectionStart = trackCursorIndex
        selectionEnd = null
        updateCursorInfo()
    })
    selectionRow.child(startSelectButton)

    const endSelectButton = p.createButton("End Select")
    endSelectButton.style(style({ flex: '1' }))
    endSelectButton.mouseClicked(() => {
        if (selectionStart !== null) {
            selectionEnd = trackCursorIndex
            updateCursorInfo()
        }
    })
    selectionRow.child(endSelectButton)

    trackSelector.child(selectionRow)

    // Selection info
    const selectionInfo = p.createElement("div", "No selection")
    selectionInfo.style(style({ color: 'black', fontSize: '12px', textAlign: 'center' }))
    trackSelector.child(selectionInfo)

    // Replace button
    const replaceButton = p.createButton("Replace Selection")
    replaceButton.style(wideButtonStyle)
    replaceButton.mouseClicked(() => {
        replaceSelectedTrackPieces(game, trackWidth)
    })
    trackSelector.child(replaceButton)

    // Build Replacement button
    const buildReplacementButton = p.createButton("Build Replacement")
    buildReplacementButton.style(wideButtonStyle)
    buildReplacementButton.mouseClicked(() => {
        buildReplacementPieces(game)
    })
    trackSelector.child(buildReplacementButton)

    // Clear selection button
    const clearButton = p.createButton("Clear Selection")
    clearButton.style(wideButtonStyle)
    clearButton.mouseClicked(() => {
        selectionStart = null
        selectionEnd = null
        updateCursorInfo()
    })
    trackSelector.child(clearButton)

    // Help section
    const helpTitle = p.createElement("h4", "Controls:")
    helpTitle.style(style({
        margin: '10px 0 5px 0',
        color: 'black',
        fontSize: '14px'
    }))
    trackSelector.child(helpTitle)

    const helpText = p.createElement("div", "A/D or ← →: Move cursor<br>Space: Start/End selection<br>Esc: Clear selection")
    helpText.style(style({
        color: 'black',
        fontSize: '11px',
        lineHeight: '1.3'
    }))
    trackSelector.child(helpText)

    function updateCursorInfo() {
        const totalPieces = game.track.pieces.length
        cursorInfo.html(`Piece: ${trackCursorIndex + 1} / ${totalPieces}`)
        
        if (selectionStart !== null && selectionEnd !== null) {
            const start = Math.min(selectionStart, selectionEnd)
            const end = Math.max(selectionStart, selectionEnd)
            selectionInfo.html(`Selected: ${start + 1} to ${end + 1} (${end - start + 1} pieces)`)
        } else if (selectionStart !== null) {
            selectionInfo.html(`Selection start: ${selectionStart + 1}`)
        } else {
            selectionInfo.html("No selection")
        }
    }

    // Store updateCursorInfo globally for keyboard updates
    (window as any).updateTrackBuilderUI = updateCursorInfo
}

function replaceSelectedTrackPieces(game: Game, trackWidth: number) {
    if (selectionStart === null || selectionEnd === null) {
        alert("Please select a range of track pieces first")
        return
    }

    const start = Math.min(selectionStart, selectionEnd)
    const end = Math.max(selectionStart, selectionEnd)

    if (start === 0 || end === game.track.pieces.length - 1) {
        alert("Cannot replace the first or last piece of the track")
        return
    }

    // Get connection points
    const startPiece = game.track.pieces[start - 1] // Piece before selection
    const endPiece = game.track.pieces[end + 1] // Piece after selection

    if (!startPiece || !endPiece) {
        alert("Invalid selection for replacement")
        return
    }

    const startPoint = startPiece.end
    const startDirection = Track.getTrackPieceEndDirection(startPiece)
    const endPoint = endPiece.start  
    const endDirection = Track.getTrackPieceStartDirection(endPiece)

    // Use connectPoints function to generate replacement pieces
    const replacementPieces = Track.connectPoints(startPoint, startDirection, endPoint, endDirection, trackWidth)

    if (replacementPieces) {
        // Set as preview
        game.track.setPreviewTrackPieces(replacementPieces)
        console.log("Generated replacement pieces:", replacementPieces)
    } else {
        alert("Could not generate replacement pieces for this selection")
    }
}

function buildReplacementPieces(game: Game) {
    if (selectionStart === null || selectionEnd === null) {
        alert("No replacement pieces to build")
        return
    }

    if (game.track.previewTrackPieces.length === 0) {
        alert("No preview pieces to build. Generate replacement first.")
        return
    }

    const start = Math.min(selectionStart, selectionEnd)
    const end = Math.max(selectionStart, selectionEnd)

    // Remove selected pieces
    const removedCount = end - start + 1
    game.track.pieces.splice(start, removedCount)

    // Insert replacement pieces
    const replacementPieces = [...game.track.previewTrackPieces]
    game.track.pieces.splice(start, 0, ...replacementPieces)

    // Clear preview
    game.track.previewTrackPieces = []

    // Regenerate analytic pieces
    game.track.generateAnalyticPieces()

    // Clear selection
    selectionStart = null
    selectionEnd = null

    console.log("Replacement pieces built successfully")
}

// Function to draw track selection visual indicators
export function drawTrackSelection(p: p5, track: Track) {
    if (track.pieces.length === 0) return

    p.push()
    
    // Draw cursor highlight
    if (trackCursorIndex >= 0 && trackCursorIndex < track.pieces.length) {
        const cursorPiece = track.pieces[trackCursorIndex]
        drawPieceHighlight(p, cursorPiece, 'rgba(255, 255, 0, 0.3)', 8) // Yellow cursor
    }

    // Draw selection highlight
    if (selectionStart !== null && selectionEnd !== null) {
        const start = Math.min(selectionStart, selectionEnd)
        const end = Math.max(selectionStart, selectionEnd)
        
        for (let i = start; i <= end; i++) {
            if (i >= 0 && i < track.pieces.length) {
                const piece = track.pieces[i]
                drawPieceHighlight(p, piece, 'rgba(255, 0, 0, 0.2)', 6) // Red selection
            }
        }
    }

    p.pop()
}

function drawPieceHighlight(p: p5, piece: any, color: string, strokeWeight: number) {
    p.stroke(color)
    p.strokeWeight(strokeWeight)
    p.fill(color)

    switch (piece.type) {
        case TrackPieceType.Straight:
            p.line(piece.start.x, piece.start.y, piece.end.x, piece.end.y)
            break
        case TrackPieceType.Arc:
            const radius = Math.sqrt((piece.center.x - piece.start.x) ** 2 + (piece.center.y - piece.start.y) ** 2)
            const angleStart = Math.atan2(piece.start.y - piece.center.y, piece.start.x - piece.center.x)
            const angleEnd = Math.atan2(piece.end.y - piece.center.y, piece.end.x - piece.center.x)
            const actualAngleStart = piece.clockwise ? angleStart : angleEnd
            const actualAngleEnd = piece.clockwise ? angleEnd : angleStart
            p.arc(piece.center.x, piece.center.y, radius * 2, radius * 2, actualAngleStart, actualAngleEnd)
            break
        case TrackPieceType.Spline:
            p.bezier(piece.start.x, piece.start.y, piece.control1.x, piece.control1.y, piece.control2.x, piece.control2.y, piece.end.x, piece.end.y)
            break
    }
}

// Function to get current track selection state (for external access)
export function getTrackSelectionState() {
    return {
        cursorIndex: trackCursorIndex,
        selectionStart,
        selectionEnd,
        isSelectionMode
    }
}

// Functions for external control of track selection
export function setTrackCursor(index: number) {
    trackCursorIndex = index
}

export function setSelectionStart(index: number) {
    selectionStart = index
    selectionEnd = null
}

export function setSelectionEnd(index: number) {
    if (selectionStart !== null) {
        selectionEnd = index
    }
}

export function clearSelection() {
    selectionStart = null
    selectionEnd = null
}

// Handle keyboard input for track builder
export function handleTrackBuilderKeyPress(key: string, track: Track) {
    switch (key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            // Move cursor left (with looping)
            if (track.pieces.length > 0) {
                trackCursorIndex = (trackCursorIndex - 1 + track.pieces.length) % track.pieces.length
                updateUI()
            }
            break
        case 'ArrowRight':
        case 'd':
        case 'D':
            // Move cursor right (with looping)
            if (track.pieces.length > 0) {
                trackCursorIndex = (trackCursorIndex + 1) % track.pieces.length
                updateUI()
            }
            break
        case ' ':
            // Spacebar: Start/End selection
            if (selectionStart === null) {
                selectionStart = trackCursorIndex
                selectionEnd = null
            } else {
                selectionEnd = trackCursorIndex
            }
            updateUI()
            break
        case 'Escape':
            // Clear selection
            selectionStart = null
            selectionEnd = null
            updateUI()
            break
    }
}

function updateUI() {
    if ((window as any).updateTrackBuilderUI) {
        (window as any).updateTrackBuilderUI()
    }
}