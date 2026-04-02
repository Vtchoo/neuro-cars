import { style } from "@/utils/css"
import { containerStyle } from "./styles"
import Game from "@/main"
import p5 from "p5"
import { buildGameMenu } from "./gameMenu"

export function buildMainMenu(game: Game, p: p5) {
    const menu = p.createElement("div")
    menu.style(style({
        ...containerStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '.5rem',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
    }))

    const title = p.createElement("h1", "Smart Race 2")
    title.parent(menu)

    const startButton = p.createElement("button", "Start")
    startButton.style(style({
        width: '100%',
        padding: '0.5rem',
        fontSize: '1.25rem',
    }))
    startButton.parent(menu)
    startButton.mouseClicked(() => {
        menu.remove()
        game.setPhase("setStart")
    })

    const loadTrackButton = p.createElement("button", "Load game")
    loadTrackButton.style(style({
        width: '100%',
        padding: '0.5rem',
        fontSize: '1.25rem',
    }))
    loadTrackButton.parent(menu)
    loadTrackButton.mouseClicked(() => {
        game.loadGame(() => {
            menu.remove()
            buildGameMenu(game, p)
        })
    })
}
