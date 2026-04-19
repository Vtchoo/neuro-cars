import p5 from 'p5'
import { NeuralNet, NeuralNetTrace } from '@/NeuralNet'

// ─── colour helpers ──────────────────────────────────────────────────────────

/** Map an activation value to an RGB tuple.
 *  -1 → red   |   0 → mid-grey   |   +1 → green  (works for tanh / softsign)
 *  For relu / sigmoid (range 0–1) the grey → green half is used directly.
 */
function neuronColor(value: number): [number, number, number] {
    const v = Math.max(-1, Math.min(1, value))
    if (v < 0) {
        const t = v + 1          // 0 = red, 1 = grey
        return [
            Math.round(220 + t * (150 - 220)),
            Math.round(50  + t * (150 - 50)),
            Math.round(50  + t * (150 - 50)),
        ]
    } else {
        const t = v              // 0 = grey, 1 = green
        return [
            Math.round(150 - t * (150 - 50)),
            Math.round(150 + t * (230 - 150)),
            Math.round(150 - t * (150 - 50)),
        ]
    }
}

/**
 * Map a weighted contribution (weight × source activation) to an RGBA tuple.
 * Positive → teal-blue, Negative → orange-red.
 * Alpha scales with magnitude (clamped).
 */
function edgeColor(contrib: number): [number, number, number, number] {
    const abs = Math.abs(contrib)
    const alpha = Math.min(220, abs * 180)
    if (contrib >= 0) {
        return [20, 190, 255, alpha]   // teal-blue
    } else {
        return [255, 100, 20, alpha]   // orange-red
    }
}

// ─── public draw function ────────────────────────────────────────────────────

export function drawNeuralNet(
    p: p5,
    net: NeuralNet,
    trace: NeuralNetTrace | null,
): void {
    p.push()
    // @ts-ignore – resetMatrix is valid in p5 but typings may vary
    p.resetMatrix()

    // ── layout constants ──
    const PANEL_X      = 20
    const PANEL_TOP    = 160          // below the controls tooltip
    const PANEL_W      = 210
    const MIN_RADIUS   = 3
    const MAX_RADIUS   = 8
    const MIN_SPACING  = MIN_RADIUS * 2.5
    const MAX_PANEL_H  = p.height - PANEL_TOP - 30
    const PADDING      = 12

    const totalLayers = 2 + net.layers   // input col + hidden cols + output col
    const layerSizes: number[] = [net.inputs]
    for (let i = 0; i < net.layers; i++) layerSizes.push(net.neurons)
    layerSizes.push(net.outputs)

    const maxNeurons = Math.max(...layerSizes)

    // Size neurons so they fit in MAX_PANEL_H
    const spacingFromH = (MAX_PANEL_H - PADDING * 2) / maxNeurons
    const neuronSpacing = Math.min(MAX_RADIUS * 2.8, Math.max(MIN_SPACING, spacingFromH))
    const neuronR = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, neuronSpacing / 2.5))

    const contentH = (maxNeurons - 1) * neuronSpacing
    const biasExtraH = neuronSpacing * 1.5 + neuronR * 1.6   // room for bias nodes
    const panelH = contentH + PADDING * 2 + neuronR * 2 + biasExtraH

    // ── background panel ──
    p.noStroke()
    p.fill(10, 10, 18, 200)
    p.rect(PANEL_X - PADDING, PANEL_TOP - PADDING, PANEL_W + PADDING * 2, panelH + PADDING * 2, 8)

    // ── compute neuron screen positions ──
    const colStep = PANEL_W / (totalLayers - 1)
    const positions: Array<Array<[number, number]>> = []

    for (let l = 0; l < totalLayers; l++) {
        const size = layerSizes[l]
        const colX = PANEL_X + l * colStep
        const blockH = (size - 1) * neuronSpacing
        const startY = PANEL_TOP + PADDING + neuronR + (contentH - blockH) / 2
        positions[l] = []
        for (let n = 0; n < size; n++) {
            positions[l][n] = [colX, startY + n * neuronSpacing]
        }
    }

    // ── draw edges ──
    p.strokeWeight(1)
    for (let t = 0; t < totalLayers - 1; t++) {
        const srcPts = positions[t]
        const dstPts = positions[t + 1]
        const contribs = trace?.weightedContributions[t]
        const biasContribs = trace?.biasContributions[t]

        for (let dst = 0; dst < dstPts.length; dst++) {
            for (let src = 0; src < srcPts.length; src++) {
                let r = 130, g = 130, b = 130, a = 25   // default dim grey

                if (contribs) {
                    const c = contribs[dst]?.[src] ?? 0
                    ;[r, g, b, a] = edgeColor(c)
                    if (a < 8) continue   // skip nearly-invisible edges
                }

                p.stroke(r, g, b, a)
                p.strokeWeight(Math.min(2.5, 0.6 + Math.abs(contribs?.[dst]?.[src] ?? 0) * 1.2))
                p.line(srcPts[src][0], srcPts[src][1], dstPts[dst][0], dstPts[dst][1])
            }

            // Bias edge: from bias node of layer t to dstPts[dst]
            const biasX = positions[t][0][0]
            const biasY = positions[t][positions[t].length - 1][1] + neuronSpacing * 1.5
            const bval = biasContribs?.[dst] ?? 0
            const [br, bg, bb, ba] = trace ? edgeColor(bval) : [130, 130, 130, 25]
            if (!trace || ba >= 8) {
                p.stroke(br, bg, bb, trace ? ba : 25)
                p.strokeWeight(trace ? Math.min(2.5, 0.6 + Math.abs(bval) * 1.2) : 0.6)
                p.line(biasX, biasY, dstPts[dst][0], dstPts[dst][1])
            }
        }
    }

    // ── draw bias nodes (one per source column, below the neurons) ──
    for (let t = 0; t < totalLayers - 1; t++) {
        const colX = positions[t][0][0]
        const biasY = positions[t][positions[t].length - 1][1] + neuronSpacing * 1.5
        p.noStroke()
        p.fill(220, 220, 100, 220)   // distinct yellow
        p.circle(colX, biasY, neuronR * 1.6)
        p.fill(30, 30, 30)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(Math.max(6, neuronR * 0.9))
        p.text('b', colX, biasY)
    }

    // ── draw neuron circles ──
    p.noStroke()
    for (let l = 0; l < totalLayers; l++) {
        for (let n = 0; n < layerSizes[l]; n++) {
            const [nx, ny] = positions[l][n]
            const val = trace?.layerActivations[l]?.[n] ?? 0
            const [r, g, b] = neuronColor(val)
            p.fill(r, g, b)
            p.circle(nx, ny, neuronR * 2)
        }
    }

    // ── layer labels ──
    p.noStroke()
    p.fill(200, 200, 200, 160)
    p.textAlign(p.CENTER, p.TOP)
    p.textSize(9)
    const labelY = PANEL_TOP + PADDING + neuronR + contentH + neuronSpacing * 0.4
    p.text('in', positions[0][0][0], labelY)
    p.text('out', positions[totalLayers - 1][0][0], labelY)

    p.pop()
}
