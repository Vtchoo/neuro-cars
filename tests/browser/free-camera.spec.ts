import { test, expect } from '@playwright/test'

test('free camera pans on the track plane and rotates around its sightline intersection', async ({page}) => {
    await page.goto('/3d/')
    await expect(page.locator('#scene-3d')).toBeVisible()
    const before = await page.evaluate(() => {
        const g = (window as any).game
        g.controls.enableDamping = false
        g.camera.position.set(0,500,500)
        g.controls.target.set(0,100,0)
        g.controls.update()
        return {position:g.camera.position.toArray(),direction:g.camera.getWorldDirection(g.camera.position.clone()).toArray(),target:g.controls.target.toArray()}
    })
    expect(before.target[1]).toBeCloseTo(0,8)
    before.position.forEach((value:number,i:number)=>expect(value).toBeCloseTo([0,500,500][i],8))
    // The original view passes through (0, 100, 0), and hits y=0 at z=-125.
    expect(before.target[2]).toBeCloseTo(-125,8)
    await page.mouse.move(800,350)
    await page.mouse.down({button:'right'})
    await page.mouse.move(950,450,{steps:8})
    await page.mouse.up({button:'right'})
    const panned = await page.evaluate(() => {
        const g=(window as any).game
        return {position:g.camera.position.toArray(),target:g.controls.target.toArray(),direction:g.camera.getWorldDirection(g.camera.position.clone()).toArray()}
    })
    expect(panned.target[1]).toBeCloseTo(0,8)
    expect(panned.position).not.toEqual(before.position)
    panned.direction.forEach((value:number,i:number)=>expect(value).toBeCloseTo(before.direction[i],8))
    await page.mouse.move(800,350)
    await page.mouse.down()
    await page.mouse.move(950,380,{steps:8})
    await page.mouse.up()
    const rotated = await page.evaluate(() => {
        const g=(window as any).game
        return {position:g.camera.position.toArray(),target:g.controls.target.toArray()}
    })
    rotated.target.forEach((value:number,i:number)=>expect(value).toBeCloseTo(panned.target[i],8))
    expect(rotated.position).not.toEqual(panned.position)
    expect(rotated.position[1]).toBeGreaterThan(0)
})
