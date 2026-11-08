import { test, expect } from '@playwright/test'
import { deflateSync, inflateSync } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'

function png(width:number,height:number,terrain=false) {
    const raw=Buffer.alloc((width*4+1)*height)
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
        const offset=y*(width*4+1)+1+x*4
        if(terrain) {
            const encoded=Math.round((10000+700+y/height*40+x/width*20)*10)
            raw[offset]=(encoded>>>16)&255;raw[offset+1]=(encoded>>>8)&255;raw[offset+2]=encoded&255
        } else {raw[offset]=65;raw[offset+1]=115+y/height*50;raw[offset+2]=70}
        raw[offset+3]=255
    }
    const chunk=(type:string,data:Buffer)=>{
        const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);result.write(type,4);data.copy(result,8)
        let crc=0xffffffff
        for(const byte of result.subarray(4,-4)){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
        result.writeUInt32BE((crc^0xffffffff)>>>0,result.length-4);return result
    }
    const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])
}
function readPNG(buffer:Buffer) {
    const chunks:{type:string,data:Buffer}[]=[]
    for(let offset=8;offset<buffer.length;) {
        const length=buffer.readUInt32BE(offset);chunks.push({type:buffer.toString('ascii',offset+4,offset+8),data:buffer.subarray(offset+8,offset+8+length)});offset+=12+length
    }
    return chunks
}

for(const route of ['/3d/','/'])test(`${route} picks Mapbox bounds, saves georeferenced PNGs, and loads a correctly scaled reference`,async({page})=>{
    test.setTimeout(120000)
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    const tile=png(256,256),dem=png(512,512,true),requests:string[]=[]
    await page.route('https://events.mapbox.com/**',route=>route.fulfill({status:204}))
    await page.route('https://api.mapbox.com/**',async route=>{
        const url=new URL(route.request().url()),path=url.pathname;requests.push(path)
        if(path.includes('/static/')) {
            const size=path.match(/\/(\d+)x(\d+)@2x\.png$/)!
            await route.fulfill({contentType:'image/png',body:png(Number(size[1])*2,Number(size[2])*2)});return
        }
        if(path.includes('/styles/')) {
            await route.fulfill({json:{version:8,sources:{satellite:{type:'raster',tiles:['https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png'],tileSize:256}},
                layers:[{id:'satellite',type:'raster',source:'satellite'}]}});return
        }
        if(path.endsWith('.json')&&path.includes('terrain-dem')) {
            await route.fulfill({json:{tilejson:'2.2.0',tiles:['https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw'],minzoom:0,maxzoom:14}});return
        }
        await route.fulfill({contentType:'image/png',body:path.includes('terrain-dem')?dem:tile})
    })
    await page.goto(route)
    await page.getByRole('button',{name:'Pick a location on map',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel('Min longitude')).toHaveValue('-46.7039')
    await expect(page.getByLabel('Max latitude')).toHaveValue('-23.6954')
    await page.getByLabel('Mapbox public token').fill('pk.fixture-token')
    await page.getByRole('button',{name:'Open map',exact:true}).click()
    await expect(page.getByRole('button',{name:'Generate map and heightmap',exact:true})).toBeEnabled({timeout:30000})
    expect(await page.evaluate(()=>localStorage.getItem('smart-race.mapbox-token'))).toBe('pk.fixture-token')
    // Drawing on the actual Mapbox canvas updates the geographic rectangle.
    await page.getByRole('button',{name:'Draw rectangle',exact:true}).click()
    const box=await page.locator('#mapbox-map').boundingBox()
    await page.mouse.move(box!.x+120,box!.y+120);await page.mouse.down()
    await page.mouse.move(box!.x+320,box!.y+300,{steps:5});await page.mouse.up()
    await expect(page.getByLabel('Min longitude')).not.toHaveValue('-46.7039')
    await page.getByRole('button',{name:'Interlagos',exact:true}).click()
    await expect(page.locator('#mapbox-size')).toContainText('2560 × 2552')
    await expect(page.locator('#mapbox-size')).toContainText('1395.5 m')
    await page.getByRole('button',{name:'Generate map and heightmap',exact:true}).click()
    await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeVisible({timeout:60000})
    for(const [label,name] of [['Save map','map 1395.png'],['Save heightmap','heightmap 1395.png']]) {
        const pending=page.waitForEvent('download')
        await page.getByRole('button',{name:label,exact:true}).click()
        const download=await pending;expect(download.suggestedFilename()).toBe(name)
        const stream=await download.createReadStream(),parts:Buffer[]=[]
        for await(const part of stream!)parts.push(part)
        const chunks=readPNG(Buffer.concat(parts)),header=chunks.find(chunk=>chunk.type==='IHDR')!.data
        const metadata=JSON.parse(chunks.find(chunk=>chunk.type==='tEXt')!.data.toString().split('\0')[1])
        expect(metadata.heightMeters).toBeCloseTo(1395.4995,3)
        expect(metadata.bounds.north).toBeCloseTo(-23.6954,6)
        if(label==='Save heightmap') {
            expect(header[8]).toBe(16);expect(header[9]).toBe(0)
            expect(metadata.maxElevationMeters).toBeGreaterThan(metadata.minElevationMeters)
            const values=inflateSync(Buffer.concat(chunks.filter(chunk=>chunk.type==='IDAT').map(chunk=>chunk.data)))
            expect(values.length).toBe((512*2+1)*510)
        } else {expect(header.readUInt32BE(0)).toBe(2560);expect(header.readUInt32BE(4)).toBe(2552)}
    }
    const packagePending=page.waitForEvent('download')
    await page.getByRole('button',{name:'Save .ncmap',exact:true}).click()
    const packageDownload=await packagePending
    expect(packageDownload.suggestedFilename()).toBe('map 1395.ncmap')
    const packageParts:Buffer[]=[]
    for await(const part of (await packageDownload.createReadStream())!)packageParts.push(part)
    const archive=Buffer.concat(packageParts),files=unzipSync(archive)
    expect(Object.keys(files).sort()).toEqual(['data.json','heightmap.png','map.png'])
    const data=JSON.parse(strFromU8(files['data.json']))
    expect(data.map.heightMeters).toBeCloseTo(1395.4995,3)
    expect(data.map.width).toBe(2560);expect(data.map.height).toBe(2552)
    expect(data.heightmap.bitDepth).toBe(16)
    expect(strFromU8(files['data.json'])).not.toContain('pk.fixture-token')
    await page.screenshot({path:`.vite/browser-results/map-picker-${route==='/3d/'?'3d':'2d'}.png`})
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await expect(dialog).not.toBeVisible()
    const reference=await page.evaluate(()=>{
        const game=(window as any).game
        return {phase:game.phase,height:game.reference?.geometry.parameters.height??game.referenceImage.height*game.referenceImageScale}
    })
    expect(reference.phase).toBe('setStart');expect(reference.height).toBeCloseTo(13954.995,2)
    // Reopen the saved package through the main menu; no token or scale prompt is needed.
    await page.goto(route)
    const chooser=page.waitForEvent('filechooser')
    await page.getByRole('button',{name:'Load map (.ncmap)',exact:true}).click()
    await (await chooser).setFiles({name:'map 1395.ncmap',mimeType:'application/zip',buffer:archive})
    await expect.poll(()=>page.evaluate(()=>(window as any).game.phase)).toBe('setStart')
    const reloadedHeight=await page.evaluate(()=>{
        const g=(window as any).game
        return g.reference?.geometry.parameters.height??g.referenceImage.height*g.referenceImageScale
    })
    expect(reloadedHeight).toBeCloseTo(13954.995,2)
    expect(requests.some(path=>path.includes('1280x1276@2x.png'))).toBe(true)
    expect(requests.some(path=>path.includes('terrain-dem-v1'))).toBe(true)
    expect(requests.some(path=>path.includes('/mapbox.satellite/4/'))).toBe(false)
    expect(errors).toEqual([])
})

test('map picker validates tokens and closes without altering the game',async({page})=>{
    await page.goto('/')
    await page.evaluate(()=>localStorage.setItem('smart-race.mapbox-token','pk.saved-token'))
    await page.getByRole('button',{name:'Pick a location on map',exact:true}).click()
    await expect(page.getByLabel('Mapbox public token')).toHaveValue('pk.saved-token')
    await page.getByLabel('Mapbox public token').fill('sk.secret')
    await page.getByRole('button',{name:'Open map',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('public token')
    await page.getByRole('button',{name:'Cancel',exact:true}).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    expect(await page.evaluate(()=>(window as any).game.phase)).toBe('menu')
})

test('map picker reports HTTP 429 tile limits without blaming the token',async({page})=>{
    await page.route('https://events.mapbox.com/**',route=>route.fulfill({status:204}))
    await page.route('https://api.mapbox.com/**',route=>{
        if(new URL(route.request().url()).pathname.includes('/styles/'))return route.fulfill({json:{version:8,
            sources:{satellite:{type:'raster',tiles:['https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png'],tileSize:256}},
            layers:[{id:'satellite',type:'raster',source:'satellite'}]}})
        return route.fulfill({status:429,json:{message:'Too Many Requests'}})
    })
    await page.goto('/3d/')
    await page.getByRole('button',{name:'Pick a location on map',exact:true}).click()
    await page.getByLabel('Mapbox public token').fill('pk.fixture-token')
    await page.getByRole('button',{name:'Open map',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('HTTP 429')
    await expect(page.getByRole('status')).toContainText('rate-limiting')
    await expect(page.getByRole('status')).not.toContainText('pk.fixture-token')
    await page.getByRole('button',{name:'Cancel',exact:true}).click()
})
