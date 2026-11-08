import { test, expect } from '@playwright/test'

test('dragging a 3D track node holds the camera still while Ctrl drag pans', async ({page}) => {
    await page.goto('/3d/')
    await page.getByRole('button',{name:'Start',exact:true}).click()
    const canvas=page.locator('#scene-3d')
    await canvas.click({position:{x:550,y:450}})
    await canvas.click({position:{x:700,y:450}})
    await expect(page.getByRole('button',{name:'Done',exact:true})).toBeVisible()
    const snapshot=()=>page.evaluate(()=>{
        const g=(window as any).game
        return {position:g.camera.position.toArray(),rotation:g.camera.quaternion.toArray(),target:g.controls.target.toArray(),node:{...g.track.pieces[0].end},enabled:g.controls.enabled}
    })
    const point=await page.evaluate(()=>{
        const g=(window as any).game,end=g.track.pieces[0].end
        const screen=g.camera.position.clone().set(end.x,0,end.y).project(g.camera)
        return {x:(screen.x+1)*innerWidth/2,y:(1-screen.y)*innerHeight/2}
    })
    const before=await snapshot()
    await page.mouse.move(point.x,point.y)
    await page.mouse.down()
    // Cross animation frames to catch controls being re-enabled during the drag.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(null)))))
    expect((await snapshot()).enabled).toBe(false)
    await page.mouse.move(point.x+70,point.y+40,{steps:12})
    const during=await snapshot()
    expect(during.node).not.toEqual(before.node)
    expect(during.position).toEqual(before.position)
    expect(during.rotation).toEqual(before.rotation)
    expect(during.target).toEqual(before.target)
    await page.mouse.up()
    await expect.poll(async()=>(await snapshot()).enabled).toBe(true)
    const beforePan=await snapshot()
    await page.keyboard.down('Control')
    await page.mouse.move(900,500)
    await page.mouse.down()
    await page.mouse.move(970,540,{steps:12})
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(async()=>(await snapshot()).position).not.toEqual(beforePan.position)
    expect((await snapshot()).node).toEqual(beforePan.node)
    const emptyBefore=await snapshot()
    const countBefore=await page.evaluate(()=>(window as any).game.track.pieces.length)
    await page.mouse.move(1050,650)
    await page.mouse.down()
    await page.mouse.move(1130,700,{steps:12})
    await page.mouse.up()
    await expect.poll(async()=>(await snapshot()).position).not.toEqual(emptyBefore.position)
    expect((await snapshot()).node).toEqual(emptyBefore.node)
    expect(await page.evaluate(()=>(window as any).game.track.pieces.length)).toBe(countBefore)
})
