import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDigits,analyzeOverUnder,analyzeMatches,categorizeSymbol,extractLastDigit,indicators,scanSignal} from '../src/engine.js';

test('digit analysis counts parity and over/under consistently',()=>{
  const d=analyzeDigits([0,1,5,6,9]);
  assert.equal(d.total,5); assert.deepEqual(d.count,[1,1,0,0,0,1,1,0,0,1]);
  assert.equal(d.evenRate,0.4); assert.equal(d.oddRate,0.6); assert.equal(d.overRate,0.6); assert.equal(d.underRate,0.4);
});
test('empty samples do not claim a directional frequency',()=>{
  const d=analyzeDigits([]); assert.equal(d.total,0); assert.equal(d.oddRate,0); assert.equal(d.underRate,0);
});
test('indicators return finite values for monotonic prices',()=>{
  const i=indicators(Array.from({length:60},(_,n)=>100+n));
  for(const key of ['sma20','sma50','ema12','ema26','rsi','macd','momentum','macdSignal','macdHistogram','support','resistance','volatility']) assert.ok(Number.isFinite(i[key]));
  assert.equal(i.rsi,100); assert.ok(i.ema12>i.ema26);
});
test('scanner waits for an adequately sized sample and describes frequency',()=>{
  assert.equal(scanSignal([1,2],[100,101],'even').side,'WAIT');
  const ticks=Array.from({length:40},(_,n)=>n%4===0?1:0);
  const result=scanSignal(ticks,Array.from({length:40},(_,n)=>100+n),'even');
  assert.equal(result.side,'EVEN'); assert.equal(result.probability,0.75); assert.match(result.reason,/40 ticks/);
});
test('last digit extraction honors the market precision from Deriv',()=>{
  assert.equal(extractLastDigit(506.7,2),0);
  assert.equal(extractLastDigit(506.75,2),5);
  assert.equal(extractLastDigit(506,0),6);
});
test('D-Circle suppresses hot/cold flags before a sufficient sample and keeps ties',()=>{
  assert.ok(analyzeDigits([1,2,3],50).circle.every(x=>!x.hot&&!x.cold));
  const d=analyzeDigits(Array.from({length:20},(_,i)=>i%10),20);
  assert.ok(d.circle.every(x=>x.hot&&x.cold));
});
test('over/under excludes digits equal to the barrier',()=>{
  const r=analyzeOverUnder([2,4,5,9],4);
  assert.deepEqual([r.above,r.below,r.equal],[2,1,1]);
});
test('matches and differs use the selected digit',()=>{
  const r=analyzeMatches([2,2,3,4,2],2);
  assert.deepEqual([r.matches,r.differs,r.matchRate],[3,2,.6]);
});
test('category names come from returned instrument information',()=>{
  assert.equal(categorizeSymbol({underlying_symbol:'1HZ100V',underlying_symbol_name:'Volatility 100 (1s) Index'}),'Volatility 1-second');
  assert.equal(categorizeSymbol({underlying_symbol:'CRASH500',underlying_symbol_name:'Crash 500 Index'}),'Crash/Boom');
});
test('technical analysis reports insufficient samples and Bollinger levels',()=>{
  const short=indicators([10,11,12]); assert.equal(short.insufficient,true); assert.equal(short.sma50,null);
  const series=Array.from({length:60},(_,i)=>100+Math.sin(i)); const full=indicators(series);
  assert.equal(full.insufficient,false); assert.ok(full.bollinger.upper>full.bollinger.middle); assert.ok(full.bollinger.lower<full.bollinger.middle);
});
