require('./splines.cjs');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const {INTERLAGOS,mapDimensions,staticMapURL,pixelLocation,northSouthDistance,validateBounds}=require('../src/maps/mapGeometry.ts');
const {heightmapPNG,addPNGMetadata}=require('../src/maps/png.ts');
const {createNcMap,readNcMap}=require('../src/maps/ncmap.ts');
const {unzipSync,zipSync,strToU8}=require('fflate');
const {mapboxErrorMessage}=require('../src/maps/mapboxErrors.ts');
const {Heightmap}=require('../src/maps/Heightmap.ts');

function chunks(buffer) {
    const result=[];
    for(let offset=8;offset<buffer.length;) {
        const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8);
        result.push({type,data:buffer.subarray(offset+8,offset+8+length)});offset+=length+12;
    }
    return result;
}
(async()=>{
    assert.match(mapboxErrorMessage({status:429},'map tiles'),/rate-limiting.*HTTP 429/);
    assert.doesNotMatch(mapboxErrorMessage({status:429},'map tiles'),/token.*valid/);
    assert.match(mapboxErrorMessage({status:401},'map tiles'),/token is valid/);
    assert.match(mapboxErrorMessage({status:403},'map tiles'),/permissions/);
    const safeError=mapboxErrorMessage({message:'Failed https://api.mapbox.com/a?access_token=pk.private-token using pk.other-token'},'map tiles');
    assert.doesNotMatch(safeError,/pk\.|access_token/);
    const dimensions=mapDimensions(INTERLAGOS);
    assert.equal(Math.max(dimensions.width,dimensions.height),1280);
    assert.equal(dimensions.width,1280);assert.equal(dimensions.height,1276);
    assert.ok(Math.abs(northSouthDistance(INTERLAGOS.south,INTERLAGOS.north)-1395.49953855)<.001);
    assert.ok(Math.abs(dimensions.heightMeters-1395.49953855)<.001);
    assert.ok(dimensions.imageBounds.west<=INTERLAGOS.west && dimensions.imageBounds.east>=INTERLAGOS.east);
    for(const bounds of [INTERLAGOS,{west:-1,east:1,south:0,north:20},{west:-10,east:10,south:0,north:1}]) {
        const size=mapDimensions(bounds);
        assert.equal(Math.max(size.width,size.height),1280);assert.ok(Math.min(size.width,size.height)>0);
        assert.ok(pixelLocation(size.imageBounds,0,0,size.width,size.height)[1]>pixelLocation(size.imageBounds,0,size.height-1,size.width,size.height)[1],'Heightmaps are north up');
    }
    const url=new URL(staticMapURL(INTERLAGOS,'pk.test-token'));
    assert.ok(decodeURIComponent(url.pathname).includes('[-46.7039,-23.708,-46.6901,-23.6954]/1280x1276@2x.png'));
    assert.equal(url.searchParams.get('padding'),'0');assert.equal(url.searchParams.get('access_token'),'pk.test-token');
    assert.throws(()=>validateBounds({...INTERLAGOS,west:INTERLAGOS.east}),/valid rectangle/);
    assert.throws(()=>validateBounds({...INTERLAGOS,north:90}),/valid rectangle/);
    const output=await heightmapPNG(new Float32Array([-10,0,100,200]),2,2,{bounds:INTERLAGOS});
    const encoded=chunks(Buffer.from(await output.blob.arrayBuffer()));
    const header=encoded.find(c=>c.type==='IHDR').data;
    assert.equal(header[8],16);assert.equal(header[9],0,'Heightmap uses grayscale rather than a display-only color ramp');
    const raw=zlib.inflateSync(Buffer.concat(encoded.filter(c=>c.type==='IDAT').map(c=>c.data)));
    assert.equal(raw.readUInt16BE(1),0);assert.equal(raw.readUInt16BE(8),65535);
    const metadata=JSON.parse(encoded.find(c=>c.type==='tEXt').data.toString().split('\0')[1]);
    assert.equal(metadata.minElevationMeters,-10);assert.equal(metadata.maxElevationMeters,200);
    assert.deepEqual(metadata.bounds,INTERLAGOS);
    const flat=await heightmapPNG(new Float32Array([42,42]),2,1,{});
    assert.equal(flat.min,42);assert.equal(flat.max,42);
    await assert.rejects(()=>heightmapPNG(new Float32Array([NaN]),1,1,{}),/incomplete/);
    const tagged=await addPNGMetadata(output.blob,{heightMeters:1395.5});
    assert.ok(chunks(Buffer.from(await tagged.arrayBuffer())).some(c=>c.type==='tEXt'&&c.data.toString().includes('1395.5')));
    const data={format:'ncmap',version:1,createdAt:new Date().toISOString(),projection:'EPSG:3857',northUp:true,unitsPerMeter:10,
        selectedBounds:INTERLAGOS,bounds:INTERLAGOS,attribution:'Mapbox',
        map:{file:'map.png',width:2,height:2,widthMeters:1395.49953855,heightMeters:1395.49953855,source:'mapbox/satellite-v9',pixelRatio:2},
        heightmap:{file:'heightmap.png',width:2,height:2,bitDepth:16,encoding:'normalized-grayscale',minElevationMeters:-10,maxElevationMeters:200,source:'mapbox.mapbox-terrain-dem-v1'}};
    const archive=await createNcMap({map:tagged,heightmap:output.blob,data});
    const files=unzipSync(new Uint8Array(await archive.arrayBuffer()));
    assert.deepEqual(Object.keys(files).sort(),['data.json','heightmap.png','map.png']);
    const restored=await readNcMap(archive);
    assert.deepEqual(restored.data,data);
    assert.deepEqual(Buffer.from(await restored.map.arrayBuffer()),Buffer.from(await tagged.arrayBuffer()));
    assert.deepEqual(Buffer.from(await restored.heightmap.arrayBuffer()),Buffer.from(await output.blob.arrayBuffer()),'ZIP preserves original 16-bit height data');
    const field=await Heightmap.fromNcMap(restored),halfPixelWorld=data.map.widthMeters*10/4;
    assert.equal(field.worldHeight(-halfPixelWorld,-halfPixelWorld),0,'The lowest map pixel is displayed at world Y=0');
    assert.equal(field.worldHeight(halfPixelWorld,halfPixelWorld),2100,'Elevation differences use ten units per meter');
    assert.ok(Math.abs(field.sampleMeters(0,0)-72.5)<.005,'16-bit heights are decoded before bilinear interpolation');
    assert.ok(field.sampleMeters(-halfPixelWorld,halfPixelWorld)>field.sampleMeters(-halfPixelWorld,-halfPixelWorld),'North-up PNG rows map to increasing world y southward');
    assert.deepEqual(Heightmap.fromData(field.toData()).toData(),field.toData());
    await assert.rejects(()=>readNcMap(new Blob([strToU8('not a ZIP')])),/ZIP archive/);
    await assert.rejects(()=>readNcMap(new Blob([zipSync({'data.json':strToU8('{}')})])),/must contain/);
    await assert.rejects(()=>createNcMap({map:tagged,heightmap:output.blob,data:{...data,version:2}}),/Unsupported/);
    await assert.rejects(()=>createNcMap({map:tagged,heightmap:output.blob,data:{...data,map:{...data.map,heightMeters:0}}}),/invalid dimensions/);
    await assert.rejects(()=>createNcMap({map:tagged,heightmap:output.blob,data:{...data,heightmap:{...data.heightmap,width:3}}}),/do not match/);
    console.log('Passed Mapbox bbox sizing, @2x URLs, WGS84 reference distance, north-up sampling, and 16-bit heightmap encoding/metadata.');
    console.log('Passed .ncmap ZIP round trips, exact PNG preservation, metadata scale, and invalid package handling.');
})().catch(error=>{console.error(error);process.exitCode=1});
