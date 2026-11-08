import {test,expect} from '@playwright/test'

test('a loaded heightmap elevates the 3D road, cars, helicopter and camera targets',async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    await page.goto('/3d/')
    await expect(page.getByRole('button',{name:'Start',exact:true})).toBeVisible()
    const save=await page.evaluate(()=>{
        const g=(window as any).game
        g.track=g.createTrack({closed:false,startingPoint:{x:-400,y:0},startingDirection:0,
            pieces:[{type:'Spline',start:{x:-400,y:0},control1:{x:-150,y:0},control2:{x:150,y:0},end:{x:400,y:0},width:100}],
            heightmap:{version:1,width:2,height:2,widthMeters:100,heightMeters:100,originX:0,originY:0,datumMeters:700,elevationsMeters:[700,710,730,740]}})
        g.start.x=-400;g.setupPopulation(4);g.maxTicks=100000
        return g.exportState()
    })
    // Exercise the actual game-file load path, rather than retaining the original field.
    await page.reload()
    const pending=page.waitForEvent('filechooser')
    await page.getByRole('button',{name:'Load game',exact:true}).click()
    await (await pending).setFiles({name:'elevated-game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))})
    await expect(page.getByRole('button',{name:'Display: None'})).toBeVisible()
    await expect.poll(()=>page.evaluate(()=>{
        const g=(window as any).game,car=g.population[0]
        return Math.abs(car.object.position.y-g.track.getWorldHeight(car.pos.x,car.pos.y))<1e-6 && car.object.position.y>0
    })).toBe(true)
    const height=await page.evaluate(()=>{
        const g=(window as any).game,heli=g.helicopters[0],state=g.effects.helicopters[0]
        return {minimum:g.track.heightmap.worldHeight(-250,-250),car:g.population[0].object.position.y,
            altitude:heli.object.position.y-ground(state.x,state.y),expected:state.altitude,
            node:g.track.pieces[0].start.elevation,terrain:!!g.scene.getObjectByName('heightmap-terrain'),saved:!!g.exportState().track.heightmap}
        function ground(x:number,y:number){return g.track.getWorldHeight(x,y)}
    })
    expect(height.minimum).toBe(0);expect(height.node).toBe(715);expect(height.terrain).toBe(true);expect(height.saved).toBe(true)
    expect(height.altitude).toBeCloseTo(height.expected,6)
    await page.screenshot({path:'.vite/browser-results/elevated-road.png'})
    for(const label of ['Follow best: off','Follow best: best','Follow best: bestActive'])await page.getByRole('button',{name:label,exact:true}).click()
    await expect.poll(()=>page.evaluate(()=>{
        const g=(window as any).game,state=g.effects.helicopters[0],camera=g.activeCamera
        const origin=camera.getWorldPosition(camera.position.clone()),direction=camera.getWorldDirection(camera.position.clone())
        return direction.dot(origin.clone().set(state.targetX,g.track.getWorldHeight(state.targetX,state.targetY)+4,state.targetY).sub(origin).normalize())
    })).toBeGreaterThan(.9999)
    expect(errors).toEqual([])
})
