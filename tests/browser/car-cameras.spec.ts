import { test, expect } from '@playwright/test'

test('followed-car cameras cycle with isolated nearby transparency and preserve the external view',async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    await page.goto('/3d/')
    await expect(page.getByRole('button',{name:'Start',exact:true})).toBeVisible()
    await expect(page.locator('#car-camera-toggle')).toBeHidden()
    const save=await page.evaluate(()=>{
        const g=(window as any).game
        g.track=g.createTrack({closed:false,startingPoint:{x:0,y:0},startingDirection:0,
            pieces:[{type:'Spline',start:{x:-400,y:0},control1:{x:0,y:0},control2:{x:1000,y:0},end:{x:2000,y:0},width:120}],
            heightmap:{version:1,width:2,height:2,widthMeters:100,heightMeters:100,originX:0,originY:0,datumMeters:700,elevationsMeters:[700,710,730,740]}})
        g.setupPopulation(4);g.maxTicks=100000;return g.exportState()
    })
    const chooser=page.waitForEvent('filechooser')
    await page.getByRole('button',{name:'Load game',exact:true}).click()
    await (await chooser).setFiles({name:'camera-game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))})
    await expect(page.getByRole('button',{name:'Display: None'})).toBeVisible()
    await page.evaluate(()=>{const g=(window as any).game;g.advance=()=>{};g.controls.enableDamping=false})
    await page.getByRole('button',{name:'>',exact:true}).click()
    await expect(page.getByRole('button',{name:'Camera: External',exact:true})).toBeVisible()
    await page.evaluate(()=>{
        const g=(window as any).game,host=g.getFollowedCar();host.pos.x=0;host.pos.y=0;host.direction=0
        const others=g.population.filter((car:any)=>car!==host)
        others[0].pos.x=80;others[0].pos.y=0;others[1].pos.x=500;others[1].pos.y=0;others[2].pos.x=-80;others[2].pos.y=0
    })
    const state=()=>page.evaluate(()=>{
        const g=(window as any).game,host=g.getFollowedCar(),others=g.population.filter((car:any)=>car!==host)
        const opacities=(car:any)=>{const values:number[]=[];car.object.traverse((object:any)=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])values.push(material.opacity)});return values}
        const direction=g.activeCamera.getWorldDirection(g.activeCamera.position.clone())
        return {external:g.activeCamera===g.camera,orbit:g.controls.enabled,position:g.camera.position.toArray(),rotation:g.camera.quaternion.toArray(),
            viewPosition:g.activeCamera.position.toArray(),direction:direction.toArray(),hostVisible:host.object.visible,
            near:opacities(others[0]),far:opacities(others[1]),ground:g.track.getWorldHeight(host.pos.x,host.pos.y)}
    })
    await expect.poll(async()=>(await state()).hostVisible).toBe(true)
    // Allow the external follow translation to reach the newly placed host.
    await expect.poll(async()=>(await state()).position[0]).toBe(0)
    const external=await state()
    await page.getByRole('button',{name:'Camera: External',exact:true}).click()
    await expect(page.getByRole('button',{name:'Camera: Onboard',exact:true})).toBeVisible()
    await expect.poll(async()=>(await state()).near.every(value=>value===.25)).toBe(true)
    const onboard=await state()
    expect(onboard.external).toBe(false);expect(onboard.orbit).toBe(false);expect(onboard.hostVisible).toBe(false)
    expect(onboard.far.every(value=>value===1)).toBe(true)
    expect(onboard.viewPosition[1]).toBeCloseTo(onboard.ground+10.5)
    expect(onboard.direction[0]).toBeGreaterThan(0)
    await page.screenshot({path:'.vite/browser-results/car-onboard.png'})
    await page.getByRole('button',{name:'Camera: Onboard',exact:true}).click()
    await expect(page.getByRole('button',{name:'Camera: Back camera',exact:true})).toBeVisible()
    const back=await state()
    expect(back.viewPosition).toEqual(onboard.viewPosition);expect(back.direction[0]).toBeLessThan(0)
    expect(back.near.every(value=>value===.25)).toBe(true)
    await page.screenshot({path:'.vite/browser-results/car-back.png'})
    await page.getByRole('button',{name:'Camera: Back camera',exact:true}).click()
    await expect.poll(async()=>(await state()).external).toBe(true)
    await expect.poll(async()=>(await state()).hostVisible).toBe(true)
    const restored=await state()
    expect(restored.hostVisible).toBe(true);expect(restored.near.every(value=>value===1)).toBe(true)
    expect(restored.position).toEqual(external.position);expect(restored.rotation).toEqual(external.rotation)
    await page.getByRole('button',{name:'Camera: External',exact:true}).click()
    await page.getByRole('button',{name:/^Follow: /}).click()
    await page.getByRole('button',{name:'Follow best: best',exact:true}).click()
    await page.getByRole('button',{name:'Follow best: bestActive',exact:true}).click()
    await expect(page.getByRole('button',{name:'Helicopter 1 camera',exact:true})).toBeVisible()
    await expect(page.locator('#car-camera-toggle')).toBeHidden()
    await expect.poll(()=>page.evaluate(()=>{
        const g=(window as any).game;return g.population.every((car:any)=>car.object.visible && car.viewOpacity===1)
    })).toBe(true)
    expect(errors).toEqual([])
})
