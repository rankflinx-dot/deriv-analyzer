// Shared market-analysis functions. The verified public Deriv endpoint and
// request/stream protocol below are intentionally kept unchanged.
export const DERIV_WS = 'wss://api.derivws.com/trading/v1/options/ws/public';
export const HISTORY_WINDOWS = [50, 100, 250, 500, 1000, 2000, 5000];

export class DerivSocket {
  constructor(onEvent = () => {}) { this.onEvent = onEvent; this.socket = null; this.pending = new Map(); this.seq = 0; this.retries = 0; this.closed = false; }
  connect() {
    this.closed = false;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(DERIV_WS); this.socket = ws;
      const timer = setTimeout(() => reject(new Error('Deriv connection timed out')), 12000);
      ws.onopen = () => { clearTimeout(timer); this.retries = 0; this.onEvent({ type: 'status', status: 'connected' }); resolve(true); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Could not connect to Deriv WebSocket')); };
      ws.onclose = () => { this.onEvent({ type: 'status', status: 'disconnected' }); if (!this.closed && this.retries++ < 4) setTimeout(() => this.connect().catch(()=>{}), Math.min(1000 * 2 ** this.retries, 15000)); };
      ws.onmessage = ({data}) => { let msg; try { msg = JSON.parse(data); } catch { return; } if (msg.req_id && this.pending.has(msg.req_id)) { this.pending.get(msg.req_id)(msg); this.pending.delete(msg.req_id); } this.onEvent({ type: 'message', message: msg }); };
    });
  }
  request(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Connect to Deriv first'));
    const req_id = ++this.seq;
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(req_id); reject(new Error('Deriv request timed out')); }, 10000); this.pending.set(req_id, msg => { clearTimeout(timer); msg.error ? reject(new Error(msg.error.message)) : resolve(msg); }); this.socket.send(JSON.stringify({...payload, req_id})); });
  }
  close() { this.closed = true; this.socket?.close(); this.pending.clear(); }
}

export function precisionFrom(value, pipSize) {
  if (Number.isInteger(pipSize) && pipSize >= 0 && pipSize <= 10) return pipSize;
  const s = String(value); return s.includes('.') ? s.split('.')[1].length : 0;
}
export function extractLastDigit(value, pipSize) {
  const n = Number(value); if (!Number.isFinite(n)) return null;
  const places = precisionFrom(n, pipSize);
  return Number(n.toFixed(places).replace('.', '').slice(-1));
}
export function categorizeSymbol(symbol) {
  const s = `${symbol?.underlying_symbol || ''} ${symbol?.underlying_symbol_name || ''}`.toLowerCase();
  if (/crash|boom/.test(s)) return 'Crash/Boom';
  if (/jump/.test(s)) return 'Jump';
  if (/step/.test(s)) return /multi/.test(s) ? 'Multi Step' : 'Step';
  if (/range.?break/.test(s)) return 'Range Break';
  if (/drift/.test(s)) return 'Drift Switching';
  if (/\bdex\b/.test(s)) return 'DEX';
  if (/hybrid/.test(s)) return 'Hybrid';
  if (/trek/.test(s)) return 'Trek';
  if (/daily.?reset/.test(s)) return 'Daily Reset';
  if (/skew.?step/.test(s)) return 'Skew Step';
  if (/switch/.test(s)) return 'Volatility Switch';
  if (/1.?second|1s\)|1hz/.test(s)) return 'Volatility 1-second';
  if (/volatility/.test(s)) return 'Volatility';
  return symbol?.market || 'Other';
}
export function analyzeDigits(ticks, windowSize = 100, pipSize) {
  const selected = ticks.slice(-windowSize);
  const values = selected.map(t => extractLastDigit(typeof t === 'object' ? t.quote : t, typeof t === 'object' ? t.pip_size ?? pipSize : pipSize)).filter(Number.isInteger);
  const count = Array(10).fill(0); values.forEach(n => count[n]++);
  const total = values.length, max = total ? Math.max(...count) : 0, min = total ? Math.min(...count) : 0, sufficient=total>=20,evenCount=count.reduce((s,n,i)=>s+(i%2===0?n:0),0),oddCount=count.reduce((s,n,i)=>s+(i%2?n:0),0),overCount=count.slice(5).reduce((a,b)=>a+b,0);
  return { count, total, evenCount, oddCount, overCount, underCount:total-overCount, evenRate:total?evenCount/total:0, oddRate:total?oddCount/total:0, overRate:total?overCount/total:0, underRate:total?(total-overCount)/total:0, circle:count.map((n,i)=>{const hot=sufficient&&n===max,cold=sufficient&&n===min;return {digit:i,count:n,rate:total?n/total:0,hot,cold,latest:values.at(-1)===i&&!hot&&!cold};}), last:values.at(-1)??null, values, maxCount:max, minCount:min };
}
export function analyzeOverUnder(digits, barrier=4) {
  const above=digits.filter(d=>d>barrier).length, below=digits.filter(d=>d<barrier).length, equal=digits.filter(d=>d===barrier).length, total=digits.length;
  return {above,below,equal,total,aboveRate:total?above/total:0,belowRate:total?below/total:0,equalRate:total?equal/total:0,recent:digits.slice(-10).map(d=>({digit:d,result:d>barrier?'OVER':d<barrier?'UNDER':'EQUAL'}))};
}
export function analyzeMatches(digits,target=0) {
  const matches=digits.filter(d=>d===target).length,total=digits.length,differs=total-matches;
  return {matches,differs,total,matchRate:total?matches/total:0,differRate:total?differs/total:0,recent:digits.slice(-10).map(d=>({digit:d,result:d===target?'MATCH':'DIFFER'}))};
}
export function indicators(prices, opts={}) {
  const p=prices.map(Number).filter(Number.isFinite), mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const periods={rsi:opts.rsi||14,fast:opts.fast||12,slow:opts.slow||26,signal:opts.signal||9,smaShort:opts.smaShort||20,smaLong:opts.smaLong||50,bollinger:opts.bollinger||20};
  const emaSeries=(a,period)=>{if(!a.length)return[];const k=2/(period+1),out=[a[0]];for(let i=1;i<a.length;i++)out.push(a[i]*k+out[i-1]*(1-k));return out;};
  const sma=n=>p.length>=n?mean(p.slice(-n)):null, rsiPeriod=periods.rsi, changes=p.slice(1).map((v,i)=>v-p[i]), sample=changes.slice(-rsiPeriod);
  const gain=mean(sample.map(x=>Math.max(x,0))),loss=mean(sample.map(x=>Math.max(-x,0)));
  const rsi=p.length>rsiPeriod?(loss===0?(gain===0?50:100):100-100/(1+gain/loss)):null;
  const fast=emaSeries(p,periods.fast),slow=emaSeries(p,periods.slow),macdLine=fast.map((v,i)=>v-(slow[i]??v)),signalLine=emaSeries(macdLine,periods.signal),macd=macdLine.length?macdLine.at(-1):null,macdSignal=signalLine.length?signalLine.at(-1):null;
  const bb=p.slice(-periods.bollinger),bbMean=bb.length===periods.bollinger?mean(bb):null,sd=bbMean===null?null:Math.sqrt(mean(bb.map(x=>(x-bbMean)**2)));
  const n=Math.min(p.length,50),recent=p.slice(-n),support=recent.length?Math.min(...recent):null,resistance=recent.length?Math.max(...recent):null;
  const momentum=p.length>1?p.at(-1)-p.at(-2):null,delta=p.length>1?p.at(-1)-p[Math.max(0,p.length-11)]:null,trendStrength=delta!==null&&p[Math.max(0,p.length-11)]!==0?Math.abs(delta/p[Math.max(0,p.length-11)]):null;
  const direction=delta===null?'Insufficient data':delta>0?'Bullish':delta<0?'Bearish':'Neutral';
  const changesVol=changes.slice(-periods.bollinger),volatility=changesVol.length>1?Math.sqrt(mean(changesVol.map(x=>(x-mean(changesVol))**2))):null;
  return {rsi,macd,macdSignal,macdHistogram:macd!==null&&macdSignal!==null?macd-macdSignal:null,ema12:p.length>=periods.fast?fast.at(-1):null,ema26:p.length>=periods.slow?slow.at(-1):null,sma20:sma(periods.smaShort),sma50:sma(periods.smaLong),smaShort:periods.smaShort,smaLong:periods.smaLong,emaFast:periods.fast,emaSlow:periods.slow,rsiPeriod,bollinger:{period:periods.bollinger,middle:bbMean,upper:sd===null?null:bbMean+2*sd,lower:sd===null?null:bbMean-2*sd},support,resistance,momentum,volatility,direction,trendStrength,insufficient:p.length<Math.max(rsiPeriod+1,periods.slow,periods.smaLong,periods.bollinger)};
}
export function scanSignal(ticks, prices, mode = 'even', windowSize=100, pipSize) {
  const d=analyzeDigits(ticks,windowSize,pipSize), i=indicators(prices); let probability=0.5,side='WAIT',reason=d.total<20?'Collecting market data':`Statistics over ${d.total} observed ticks`;
  if(d.total>=20){if(mode==='even'||mode==='odd'){probability=mode==='even'?d.evenRate:d.oddRate;side=probability>=.55?mode.toUpperCase():'WAIT';reason=`${mode} frequency ${(probability*100).toFixed(1)}% over ${d.total} ticks`;}else if(mode==='over'||mode==='under'){const ou=analyzeOverUnder(d.values,4);probability=mode==='over'?ou.aboveRate:ou.belowRate;side=probability>=.55?mode.toUpperCase():'WAIT';reason=`${mode} barrier 4 frequency ${(probability*100).toFixed(1)}%`;}else if(mode==='matches'||mode==='differs'){const hot=d.circle.find(x=>x.hot),stats=analyzeMatches(d.values,hot?.digit??0);probability=mode==='matches'?stats.matchRate:stats.differRate;side=`${mode.toUpperCase()} ${hot?.digit}`;reason=`Digit ${hot?.digit}: ${(stats.matchRate*100).toFixed(1)}% matched over ${d.total} ticks`;}else if(mode==='dcircle'){const hot=d.circle.find(x=>x.hot),cold=d.circle.find(x=>x.cold);side=`${hot?.digit??'—'} / ${cold?.digit??'—'}`;probability=hot?.rate??0;reason=`D-Circle hot ${hot?.digit??'—'}, cold ${cold?.digit??'—'} over ${d.total} ticks`;}}
  return {side,probability,reason,indicators:i,digits:d,generatedAt:Date.now()};
}
