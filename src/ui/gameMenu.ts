import { style } from "@/utils/css"
import { containerStyle } from "./styles"
import Game from "@/main"
import p5 from "p5"

export function buildGameMenu(game: Game, p: p5) {
    const menu = p.createElement("div")
    menu.style(style({
        ...containerStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '.5rem',
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        width: '15rem',
    }))
    
    const ticksLabel = p.createElement("span", `Ticks: ${game.maxTicks}`)
    ticksLabel.style(style({
        fontSize: '.75rem',
        fontWeight: 'bold',
    }))

    const ticksRow = p.createElement("div")
    ticksRow.style(style({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    }))
    ticksRow.parent(menu)
    const minus5PercentButton = p.createButton("-5%")
    minus5PercentButton.mouseClicked(() => {
        const decrement = Math.floor(game.maxTicks * 0.05)
        game.incrementMaxTicks(-decrement)
        ticksLabel.html(`Ticks: ${game.maxTicks}`)
    })
    const minus100Button = p.createButton("-100")
    minus100Button.mouseClicked(() => {
        game.incrementMaxTicks(-100)
        ticksLabel.html(`Ticks: ${game.maxTicks}`)
    })
    const plus5PercentButton = p.createButton("+5%")
    plus5PercentButton.mouseClicked(() => {
        const increment = Math.ceil(game.maxTicks * 0.05)
        game.incrementMaxTicks(increment)
        ticksLabel.html(`Ticks: ${game.maxTicks}`)
    })
    const plus100Button = p.createButton("+100")
    plus100Button.mouseClicked(() => {
        game.incrementMaxTicks(100)
        ticksLabel.html(`Ticks: ${game.maxTicks}`)
    })
    minus5PercentButton.parent(ticksRow)
    minus100Button.parent(ticksRow)
    ticksLabel.parent(ticksRow)
    plus100Button.parent(ticksRow)
    plus5PercentButton.parent(ticksRow)

    const increaseMaxTicksButton = p.createButton(`Extend time: ${game.increaseMaxTicksIfBestCarIsRunning ? 'On' : 'Off'}`)
    increaseMaxTicksButton.parent(menu)
    increaseMaxTicksButton.attribute("title", "If enabled, the game will automatically increase the max ticks for the next generation if the best car is still running when the max ticks is reached.")
    increaseMaxTicksButton.mouseClicked(() => {
        game.increaseMaxTicksIfBestCarIsRunning = !game.increaseMaxTicksIfBestCarIsRunning
        const isEnabled = game.increaseMaxTicksIfBestCarIsRunning
        increaseMaxTicksButton.html(`Extend time: ${isEnabled ? 'On' : 'Off'}`)
    })

    const showFitnessGraphButton = p.createButton(`Show Fitness Graph: ${game.drawGraphs ? 'On' : 'Off'}`)
    showFitnessGraphButton.parent(menu)
    showFitnessGraphButton.mouseClicked(() => {
        game.toggleDrawGraphs()
        const isDrawing = showFitnessGraphButton.html().includes("Off")
        showFitnessGraphButton.html(`Show Fitness Graph: ${isDrawing ? 'On' : 'Off'}`)
    })

    const showInputsButton = p.createButton(`Show Inputs: ${game.showInputs}`)
    showInputsButton.parent(menu)
    showInputsButton.mouseClicked(() => {
        game.toggleShowInputs()
        const currentMode = game.showInputs
        showInputsButton.html(`Show Inputs: ${currentMode}`)
    })

    const followBestCarButton = p.createButton(`Follow Best Car: ${game.followBestCar}`)
    followBestCarButton.parent(menu)
    followBestCarButton.mouseClicked(() => {
        const nextMode = game.toggleFollowBestCar()
        followBestCarButton.html(`Follow Best Car: ${nextMode}`)
    })

    return menu
}
