import { test, expect } from '@playwright/test'

test('3D helicopter cameras cycle on the main follow button and track their targets',async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    await page.goto('/3d/')
    await expect(page.getByRole('button',{name:'Start',exact:true})).toBeVisible()
    const save=await page.evaluate(()=>{
        const g=(window as any).game
        g.track.addStraight({x:0,y:0},{x:3000,y:0},120)
        g.maxTicks=100000;g.setupPopulation(8)
        return g.exportState()
    })
    const chooser=page.waitForEvent('filechooser')
    await page.getByRole('button',{name:'Load game',exact:true}).click()
    await (await chooser).setFiles({name:'helicopters.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))})
    await expect(page.getByRole('button',{name:'Display: None'})).toBeVisible()
    for(const label of ['Follow best: off','Follow best: best','Follow best: bestActive'])await page.getByRole('button',{name:label,exact:true}).click()
    await expect(page.getByRole('button',{name:'Helicopter 1 camera',exact:true})).toBeVisible()
    await expect.poll(()=>page.evaluate(()=>{
        const g=(window as any).game;return g.activeCamera!==g.camera && !g.controls.enabled
    })).toBe(true)
    const checkCamera=()=>page.evaluate(()=>{
        const g=(window as any).game,camera=g.activeCamera,state=g.effects.helicopters[g.helicopterCamera]
        const direction=camera.getWorldDirection(camera.position.clone())
        const origin=camera.getWorldPosition(camera.position.clone())
        const target=origin.clone().set(state.targetX,4,state.targetY).sub(origin).normalize()
        return {alignment:direction.dot(target),altitude:state.altitude}
    })
    let camera=await checkCamera();expect(camera.alignment).toBeGreaterThan(.9999)
    expect(camera.altitude).toBeGreaterThanOrEqual(1800);expect(camera.altitude).toBeLessThanOrEqual(2200)
    await page.screenshot({path:'.vite/browser-results/helicopter-1-camera.png'})
    await page.getByRole('button',{name:'Helicopter 1 camera',exact:true}).click()
    await expect(page.getByRole('button',{name:'Helicopter 2 camera',exact:true})).toBeVisible()
    await expect.poll(async()=>(await checkCamera()).alignment).toBeGreaterThan(.9999)
    camera=await checkCamera();expect(camera.altitude).toBeGreaterThanOrEqual(2800)
    await page.getByRole('button',{name:'Helicopter 2 camera',exact:true}).click()
    await expect(page.getByRole('button',{name:'Follow best: off',exact:true})).toBeVisible()
    await expect.poll(()=>page.evaluate(()=>{const g=(window as any).game;return g.activeCamera===g.camera && g.controls.enabled})).toBe(true)
    for(const label of ['Follow best: off','Follow best: best','Follow best: bestActive'])await page.getByRole('button',{name:label,exact:true}).click()
    await page.getByRole('button',{name:'>',exact:true}).click()
    expect(await page.evaluate(()=>(window as any).game.helicopterCamera)).toBeNull()
    await expect(page.getByRole('button',{name:/^Follow: /})).toBeVisible()
    await page.evaluate(()=>{
        const g=(window as any).game;g.renderer.setAnimationLoop(null)
        const heli=g.scene.getObjectByName('Helicopter 1')
        g.camera.position.copy(heli.position).add(g.camera.position.clone().set(190,100,150))
        g.camera.lookAt(heli.position);g.camera.fov=38;g.camera.updateProjectionMatrix()
        g.renderer.render(g.scene,g.camera)
    })
    await page.screenshot({path:'.vite/browser-results/helicopter-model.png'})
    expect(errors).toEqual([])
})
