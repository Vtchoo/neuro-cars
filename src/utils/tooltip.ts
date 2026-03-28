import p5 from "p5"

function tooltip(p: p5, text: string[], x: number, y: number, scale = 1) {
    p.push()
    p.fill(0, 0, 0, 150)
    p.noStroke()
    const padding = 10 * scale
    const lineHeight = 12 * scale
    const width = Math.max(...text.map(t => p.textWidth(t) * scale)) + padding * 2
    const gap = 3 * scale
    const height = text.length * lineHeight + padding * 2 + gap * (text.length - 1)
    p.rect(x, y, width, height)
    p.fill(255)
    p.textAlign(p.LEFT, p.TOP)
    p.textSize(12 * scale)
    for (let i = 0; i < text.length; i++) {
        p.text(text[i], x + padding, y + padding + i * (lineHeight + gap))
    }
    p.pop()
}

export { tooltip }
