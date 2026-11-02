// Run with: node tests/splines.cjs
// Transpile TypeScript in memory so geometry checks need no browser or native bundler.
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
    return resolve.call(this, name.startsWith('@/') ? path.join(__dirname, '../src', name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, file);
const assert = require('node:assert/strict');
const {default: Track, TrackPieceType} = require('../src/Track.ts');
const {Vector} = require('../src/Vector.ts');
const {editorClick,editorPressed,editorDragged,editorReleased} = require('../src/ui/trackBuilder.ts');
const v=(x,y)=>new Vector(x,y);
const t=new Track(); t.addSpline(v(0,0),v(100,0),v(200,100),v(300,100),40); t.generateAnalyticPieces();
const game={track:t,start:v(0,0),direction:0};
const bez=(s,t)=>{const u=1-t;return v(u*u*u*s.start.x+3*u*u*t*s.control1.x+3*u*t*t*s.control2.x+t*t*t*s.end.x,u*u*u*s.start.y+3*u*u*t*s.control1.y+3*u*t*t*s.control2.y+t*t*t*s.end.y)};
const original=t.pieces[0]; const middle=bez(original,.5);
editorClick(game,middle,1); assert.equal(t.pieces.length,2);
for(let i=0;i<=100;i++){const u=i/100,a=bez(original,u),b=bez(t.pieces[u<=.5?0:1],u<=.5?u*2:u*2-1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.001)}
assert.equal(t.pieces[0].end,t.pieces[1].start);
const shared=t.pieces[0].end, h1={...t.pieces[0].control2},h2={...t.pieces[1].control1};
editorPressed(t,v(shared.x,shared.y),1); editorDragged(game,v(shared.x+20,shared.y+30),1); editorReleased();
assert.equal(t.pieces[0].control2.x,h1.x+20);assert.equal(t.pieces[1].control1.y,h2.y+30);
// Consume the drag click without deleting an endpoint.
editorClick(game,shared,1);assert.equal(t.pieces.length,2);
const c=t.pieces[0].control2, other=t.pieces[1].control1,len=Math.hypot(other.x-shared.x,other.y-shared.y);
editorPressed(t,v(c.x,c.y),1);editorDragged(game,v(shared.x-50,shared.y+40),1);editorReleased();editorClick(game,c,1);
assert.ok(Math.abs(Math.hypot(other.x-shared.x,other.y-shared.y)-len)<1e-8);
assert.ok(Math.abs((c.x-shared.x)*(other.y-shared.y)-(c.y-shared.y)*(other.x-shared.x))<1e-6);
editorClick(game,v(500,300),1);assert.equal(t.pieces.length,3);
const start=t.pieces[0].start,icon=v(start.x,start.y-44);
editorClick(game,icon,1);assert.ok(t.closed);assert.equal(t.pieces.at(-1).end,start);
const n=t.pieces.length;editorClick(game,v(800,800),1);assert.equal(t.pieces.length,n);
const restored=Track.fromData(t.exportData());assert.ok(restored.closed);assert.equal(restored.pieces.at(-1).end,restored.pieces[0].start);
editorClick(game,icon,1);assert.ok(!t.closed);assert.equal(t.pieces.length,n-1);
editorClick(game,t.pieces[1].start,1);assert.equal(t.pieces.length,n-2);
assert.ok(t.analyticPieces.length>0);assert.ok(t.analyticPieces.every(s=>s.type===TrackPieceType.Straight));
assert.ok(t.isInsideTrack(0,0));assert.ok(!t.isInsideTrack(-1000,-1000));
const legacy=Track.fromData({startingPoint:{x:0,y:0},startingDirection:0,pieces:[{type:'Straight',start:{x:0,y:0},end:{x:100,y:0},width:40},{type:'Arc',start:{x:100,y:0},center:{x:100,y:100},end:{x:200,y:100},clockwise:true,width:40}]});
assert.ok(legacy.pieces.every(s=>s.type===TrackPieceType.Spline));assert.equal(legacy.pieces[0].end,legacy.pieces[1].start);
assert.ok(legacy.isInsideTrack(50,0));
console.log('Passed: splitting, shared endpoint and handle drags, append, close/reopen, save/load, merge, legacy conversion, collision geometry.');

const splineLength=Track.getTrackPieceLength(original);
assert.ok(splineLength>300);
const walked=Track.getPointAtDistance([original],0,0,splineLength/2);
assert.ok(Number.isFinite(walked.direction));
assert.ok(Math.hypot(walked.point.x-middle.x,walked.point.y-middle.y)<.01);
console.log('Passed: direct spline length and distance sampling.');
