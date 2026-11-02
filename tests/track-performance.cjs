// Run with: node tests/track-performance.cjs
require('./splines.cjs'); // Installs the in-memory TypeScript loader and runs editor regressions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {default: Track, TrackPieceType} = require('../src/Track.ts');
const {Vector} = require('../src/Vector.ts');
const {queryTrack, closestPointOnLineSegment} = require('../src/utils/track.ts');
const v=(x,y)=>new Vector(x,y);
const bez=(s,t)=>{const u=1-t;return {x:u*u*u*s.start.x+3*u*u*t*s.control1.x+3*u*t*t*s.control2.x+t*t*t*s.end.x,y:u*u*u*s.start.y+3*u*u*t*s.control1.y+3*u*t*t*s.control2.y+t*t*t*s.end.y}};
const segment=p=>({kind:'line',start:p.start,end:p.end});
function make(points) {
    const track=new Track();
    track.addSpline(...points.map(p=>v(...p)),40);
    track.generateAnalyticPieces();
    return track;
}
function checkError(track) {
    for(let i=0;i<=2000;i++) {
        const q=bez(track.pieces[0],i/2000);
        const error=Math.min(...track.analyticPieces.map(p=>closestPointOnLineSegment(segment(p),q).distance));
        assert.ok(error<=.250001, `error ${error} exceeds tolerance`);
    }
}
const straight=make([[0,0],[1000,0],[2000,0],[3000,0]]);
assert.equal(straight.analyticPieces.length,1,'Long straight spline needs one chord');
const snake=make([[0,0],[100,200],[200,-200],[300,0]]);
assert.equal(bez(snake.pieces[0],.5).y,0);
assert.ok(snake.analyticPieces.length>2,'Midpoint on chord must not hide an S-curve');
checkError(snake);
for(const points of [ [[0,0],[300,0],[-300,0],[10,0]], [[0,0],[100,200],[-100,200],[0,0]] ]) checkError(make(points));
const parity=make([[0,0],[0,100],[100,200],[100,300]]);
console.log(`Parity: ${parity.analyticPieces.length} chords, length ${parity.cumulativeLengths.at(-1)}`);
assert.ok(parity.analyticPieces.length<64);
const total=straight.cumulativeLengths.at(-1);
assert.equal(straight.getPointAhead(0,0,total*100+200).point.x,3000,'Open track clamps');
straight.closed=true;
assert.equal(straight.getPointAhead(0,0,total*100+200).point.x,200,'Closed track wraps multiple laps');
assert.equal(straight.getPointAhead(0,50,-100).point.x,2950,'Closed reverse wrap');
straight.closed=false;
assert.equal(straight.getPointAhead(0,50,-100).point.x,0,'Open reverse clamps');
const oldTable=straight.cumulativeLengths;
straight.pieces[0].end.x=6000;
straight.generateAnalyticPieces();
assert.notEqual(straight.cumulativeLengths,oldTable);
assert.equal(straight.cumulativeLengths.at(-1),6000,'Rebuild invalidates distance table');
// Unequal segment lengths, exact boundaries, and a zero-length piece.
const mixed=new Track();
mixed.analyticPieces=[0,10,10,40].map((x,i,a)=>({type:TrackPieceType.Straight,start:v(x,0),end:v(a[i+1]??100,0),width:40}));
for(const x of [0,5,10,20,40,99,100]) assert.equal(mixed.getPointAhead(0,0,x).point.x,x);
// Compare binary search to a simple reference walk over the same geometry.
const lengths=snake.cumulativeLengths;
for(let k=0;k<300;k++) {
    const distance=lengths.at(-1)*k/299;
    let i=0; while(i<snake.analyticPieces.length-1 && lengths[i+1]<=distance)i++;
    const p=snake.analyticPieces[i],t=(distance-lengths[i])/(lengths[i+1]-lengths[i]);
    const actual=snake.getPointAhead(0,0,distance).point;
    assert.ok(Math.hypot(actual.x-(p.start.x+t*(p.end.x-p.start.x)),actual.y-(p.start.y+t*(p.end.y-p.start.y)))<1e-8);
}
// Variable-size neighbourhood crosses many tiny pieces; open tracks do not wrap.
const dense=Array.from({length:200},(_,i)=>({kind:'line',start:{x:i,y:0},end:{x:i+1,y:0}}));
const cumulative=Array.from({length:201},(_,i)=>i);
const queried=queryTrack(dense,{x:70.5,y:0},0,1,{cumulativeLengths:cumulative,closed:false,searchDistance:150});
assert.equal(queried.segmentIndex,70);
const teleported=queryTrack(dense,{x:150.5,y:0},0,1,{cumulativeLengths:cumulative,closed:false,searchDistance:1});
assert.equal(teleported.segmentIndex,150,'Distant hint falls back to full search');
const data=JSON.parse(fs.readFileSync('tracks/interlagos_splines.json','utf8'));
const circuit=Track.fromData(data.track??data);
function oldCount(a,b,c,d,depth=0) {
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const chord=dist(a,d),polygon=dist(a,b)+dist(b,c)+dist(c,d);
    if(depth>=16 || (polygon-chord<.02 && polygon<=8))return chord>1e-6?1:0;
    const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
    return oldCount(a,ab,abc,m,depth+1)+oldCount(m,bcd,cd,d,depth+1);
}
const previousCount=circuit.pieces.reduce((n,p)=>n+oldCount(p.start,p.control1,p.control2,p.end),0);
assert.ok(circuit.analyticPieces.length<previousCount);
console.log(`Interlagos: ${previousCount} -> ${circuit.analyticPieces.length} simulation chords (${(100*(1-circuit.analyticPieces.length/previousCount)).toFixed(1)}% fewer)`);
const Car=require('../src/Car.ts').default;
const car=new Car(0,0,0);car.speed=20;
const start={segmentIndex:0,distanceFromTrackPieceStart:1};
const end={segmentIndex:3,distanceFromTrackPieceStart:2};
const reward=snake.cumulativeLengths[3]+1;
assert.equal(car.calculateFitnessReward(snake,start,end),reward);
assert.equal(car.calculateFitnessReward(snake,end,start),-reward);
mixed.closed=true;
assert.equal(car.calculateFitnessReward(mixed,{segmentIndex:3,distanceFromTrackPieceStart:59},{segmentIndex:0,distanceFromTrackPieceStart:2}),3);
assert.ok(car.getLookaheadInputs(circuit).every(Number.isFinite),'Sensors remain finite');
console.log('Passed: error bounds, S-curves, overshoot, loops, distance indexing, cache rebuilds, open/closed traversal, adaptive neighbourhood and teleport fallback.');
