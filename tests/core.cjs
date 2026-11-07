// Node-only checks: no DOM, WebGL context, or p5 instance is needed.
require('./splines.cjs'); // Installs the TypeScript loader and checks the shared editor.
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const {default:Game}=require('../src/core/Game.ts');
const {default:Car}=require('../src/Car.ts');
const {default:Track}=require('../src/Track.ts');
const {default:Car2d}=require('../src/renderers/2d/Car2d.ts');
const {default:Car3d}=require('../src/renderers/3d/Car3d.ts');
const {default:Track2d}=require('../src/renderers/2d/Track2d.ts');
const {default:Track3d}=require('../src/renderers/3d/Track3d.ts');
const THREE=require('three');
const {Effects}=require('../src/core/Effects.ts');

assert.equal(Car.prototype.show,undefined,'Car must not draw');
assert.equal(Track.prototype.draw,undefined,'Track must not draw');
assert.equal(global.document,undefined,'The core runs without a browser');
const data={startingPoint:{x:0,y:0},startingDirection:0,closed:false,pieces:[{
    type:'Spline',start:{x:0,y:0},control1:{x:1000,y:0},control2:{x:2000,y:200},end:{x:3000,y:200},width:200,
}]};

function variant(CarType,TrackType) {
    return new class extends Game {
        createCar(...args){return new CarType(...args,this.random)}
        createTrack(data){return data?TrackType.fromData(data):new TrackType()}
    }(42);
}
function seeded(seed,action) {
    const original=Math.random;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    try{return action()}finally{Math.random=original}
}
function state(game) {
    const exported=game.exportState();delete exported.timestamp;
    return exported;
}
function exercise(CarType,TrackType) {
    return seeded(42,()=>{
        const game=variant(CarType,TrackType);
        game.track=game.createTrack(data);game.cycleStartPoint='off';game.maxTicks=20;
        game.increaseMaxTicksIfBestCarIsRunning=false;game.setupPopulation(8);
        let changes=0;game.events.addEventListener('maxTicksChanged',()=>changes++);
        game.maxTicks=21;game.maxTicks=21;assert.equal(changes,1);
        const scene=new THREE.Scene(),visuals=new Set();
        for(let i=0;i<75;i++) {
            if(CarType===Car3d)for(const car of game.population) {
                car.render(scene,undefined,i%2===0);visuals.add(car);
            }
            game.step();
        }
        for(const car of visuals)car.dispose();
        assert.ok(game.generation>=2,'Shared generation lifecycle runs');
        assert.ok(game.population.every(car=>Number.isFinite(car.pos.x)&&Number.isFinite(car.neuralNet.fitness)));
        return state(game);
    });
}
const base=exercise(Car,Track);
assert.equal(hash(exercise(Car2d,Track2d)),hash(base),'2D subclass must preserve simulation results');
assert.equal(hash(exercise(Car3d,Track3d)),hash(base),'3D subclass must preserve simulation results');

// Identical inputs produce identical grip, motion, track progress and reward.
const track=Track.fromData(data);
const left=seeded(1,()=>new Car2d(0,0,0));
const right=seeded(1,()=>new Car3d(0,0,0));
for(let i=0;i<180;i++) {
    const input=[i<100?.6:-.25,Math.sin(i/30)*.2];
    left.drive(input);right.drive(input);left.update(track,false,i);right.update(track,false,i);
    assert.deepEqual(right.pos,left.pos);assert.equal(right.speed,left.speed);
    assert.deepEqual(right.gripState,left.gripState);
    assert.equal(right.neuralNet.fitness,left.neuralNet.fitness);
}

// Saves cross renderer boundaries while instantiating the receiving subclass.
const three=variant(Car3d,Track3d);three.restoreGameState(base);
assert.ok(three.population.every(car=>car instanceof Car3d));assert.ok(three.track instanceof Track3d);
const two=variant(Car2d,Track2d);two.restoreGameState(three.exportState());
assert.ok(two.population.every(car=>car instanceof Car2d));assert.ok(two.track instanceof Track2d);
assert.deepEqual(two.population.map(c=>c.neuralNet.exportData()),three.population.map(c=>c.neuralNet.exportData()));
const clock=variant(Car,Track);clock.track=clock.createTrack(data);clock.setupPopulation(1);clock.maxTicks=1000;
for(let i=0;i<30;i++)clock.advance(1/30);
assert.equal(clock.ticks,60,'Rendering at 30 FPS still advances physics at 60 Hz');
const effects=new Effects();effects.spawn(1,2);
assert.equal(effects.explosions.length,1);
for(let i=0;i<24;i++)effects.update([],undefined,true,false);
assert.equal(effects.explosions.length,0,'Particles expire without a renderer');
effects.spawn(1,2);effects.update([],undefined,false,false);
assert.equal(effects.explosions.length,0,'Disabled explosions are cleared');
effects.update(clock.population,undefined,false,true);
const [a,b]=effects.helicopters;
assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=140-1e-8,'Helicopters keep their shared safe distance');
const previous=JSON.stringify(effects.helicopters);
effects.update(clock.population,undefined,false,false);
assert.equal(JSON.stringify(effects.helicopters),previous,'Disabled helicopters stop updating');

// Moving world-space sensor vertices must also move Three.js's culling bounds.
const sensorCar=new Car3d(0,0,0),sensorScene=new THREE.Scene();
sensorCar.lastLookAheadPoints=[{x:100,y:0},{x:200,y:0}];
sensorCar.render(sensorScene,undefined,true);
const sensors=sensorScene.children.find(object=>object instanceof THREE.LineSegments);
sensors.geometry.computeBoundingSphere(); // The renderer computes this on its first draw.
const oldBounds=sensors.geometry.boundingSphere.clone();
const buffer=sensors.geometry.getAttribute('position');
sensorCar.pos.x=10000;sensorCar.pos.y=20000;
sensorCar.lastLookAheadPoints=[{x:10100,y:20000},{x:10200,y:20000}];
sensorCar.render(sensorScene,undefined,true);sensorScene.updateMatrixWorld(true);
assert.equal(sensors.geometry.getAttribute('position'),buffer,'Sensor updates reuse the vertex buffer');
const camera=new THREE.PerspectiveCamera(60,1,1,2000);
camera.position.set(10100,300,20300);camera.lookAt(10100,4,20000);camera.updateMatrixWorld(true);
const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
assert.equal(frustum.intersectsSphere(oldBounds),false,'The original bounds would incorrectly cull the moved sensors');
assert.equal(frustum.intersectsObject(sensors),true,'Sensors stay visible when the camera follows the moved car');
sensorCar.render(sensorScene,undefined,false);assert.equal(sensors.visible,false);
sensorCar.render(sensorScene,undefined,true);assert.equal(sensors.visible,true);
sensorCar.dispose();

// Preset-specific shapes, axle dimensions, steering, and legacy configuration.
const presets=require('../src/cars/carPresets.ts');
for(const [preset,part] of [[presets.supercarPreset,'coupe-glass'],[presets.f1CarPreset,'cockpit-halo'],[presets.unoWithLadderPreset,'ladder-rail']]) {
    const car=new Car3d(0,0,0,0,preset),scene=new THREE.Scene();car.steeringAngle=.2;car.render(scene);
    const parts=[],front=[],rear=[];let meshCount=0;
    car.object.traverse(object=>{
        parts.push(...(object.userData.parts??[]));if(object.isMesh)meshCount++;
        if(object.name==='front-wheel-pivot')front.push(object);
        if(object.name==='rear-wheel-pivot')rear.push(object);
    });
    assert.ok(parts.includes(part),`${preset.modelKey} retains its distinctive details`);
    assert.ok(Math.abs(front[0].position.x-rear[0].position.x-preset.wheelbase*10)<1e-8);
    assert.equal(front[0].rotation.y,-.2);assert.equal(rear[0].rotation.y,0);
    assert.ok(meshCount<30,'Static details are batched to reduce draw calls');
    const oldModel=car.object.children[0];car.setCarConfig({spriteKey:'uno'});car.render(scene);
    assert.equal(car.modelKey,'uno');assert.equal(car.object.children[0].name,'model:uno');
    if(preset.modelKey!=='uno')assert.notEqual(car.object.children[0],oldModel);
    car.dispose();
}
console.log('Passed renderer-free core, 2D/3D numerical parity, shared breeding, grip/fitness, cross-renderer saves and fixed-step timing.');
