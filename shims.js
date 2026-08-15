/* Minimal browser-API stand-ins so the GuldSlayer game script can run inside Node.
   The simulation only touches data structures; everything visual no-ops through these. */
'use strict';

function makeCtx(){                       // a 2D context where every method is a harmless no-op
  const ctx={
    canvas:null,
    fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'10px x',
    textAlign:'left', textBaseline:'top', globalAlpha:1, lineCap:'butt', lineJoin:'miter',
    shadowBlur:0, shadowColor:'#000', imageSmoothingEnabled:true, globalCompositeOperation:'source-over',
    measureText:()=>({width:0}),
    createLinearGradient:()=>({addColorStop(){}}),
    createRadialGradient:()=>({addColorStop(){}}),
    createPattern:()=>null,
    getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(4,(w|0)*(h|0)*4)), width:w|0, height:h|0}),
    putImageData(){},
  };
  const NOOP=()=>{};
  return new Proxy(ctx,{
    get(t,p){ if(p in t) return t[p]; return NOOP; },      // any unknown method: no-op
    set(t,p,v){ t[p]=v; return true; },
  });
}

function makeElement(tag){
  const el={
    tagName:String(tag||'div').toUpperCase(),
    style:{}, dataset:{}, children:[], innerHTML:'', textContent:'', value:'', id:'',
    classList:{ add(){}, remove(){}, toggle(){}, contains:()=>false },
    appendChild(c){ el.children.push(c); return c; },
    removeChild(){}, remove(){}, insertBefore(c){ el.children.push(c); return c; },
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeElement('div'); }, querySelectorAll(){ return []; },
    focus(){}, blur(){}, click(){},
    getBoundingClientRect(){ return {left:0, top:0, width:el.width||800, height:el.height||600, right:el.width||800, bottom:el.height||600}; },
    setPointerCapture(){}, releasePointerCapture(){},
  };
  if(String(tag).toLowerCase()==='canvas'){
    el.width=800; el.height=600;
    const ctx=makeCtx(); ctx.canvas=el;
    el.getContext=()=>ctx;
  }
  if(String(tag).toLowerCase()==='script'){
    // scripts never load server-side (PeerJS isn't needed); onerror fires so loaders fail fast & clean
    Object.defineProperty(el,'src',{ set(){ setImmediate(()=>{ if(el.onerror) el.onerror(new Error('no network in dedicated mode')); }); }, get(){ return ''; } });
  }
  return el;
}

function buildSandbox(){
  const byId=new Map();
  const document={
    getElementById(id){ if(!byId.has(id)) byId.set(id, makeElement(id==='c'?'canvas':'div')); return byId.get(id); },
    createElement:makeElement,
    createTextNode:t=>({textContent:t}),
    querySelector(){ return makeElement('div'); }, querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){},
    head:makeElement('head'), body:makeElement('body'),
    documentElement:makeElement('html'),
  };
  class FakeImage{
    constructor(){ this.complete=false; this.naturalWidth=0; this.naturalHeight=0; this.onload=null; this.onerror=null; }
    set src(v){ this._src=v; this.complete=true; this.naturalWidth=1; this.naturalHeight=1;
      if(this.onload) setImmediate(()=>this.onload()); }
    get src(){ return this._src||''; }
  }
  const sandbox={
    console, setTimeout, setInterval, clearTimeout, clearInterval, setImmediate,
    queueMicrotask, performance, Date, Math, JSON,
    document,
    Image:FakeImage,
    requestAnimationFrame:fn=>setTimeout(()=>fn(performance.now()), 33),   // ~30 ticks/s is plenty of simulation
    cancelAnimationFrame:clearTimeout,
    devicePixelRatio:1, innerWidth:800, innerHeight:600,
    addEventListener(){}, removeEventListener(){},
    location:{ href:'dedicated://guldslayer', protocol:'dedicated:' },
    navigator:{ userAgent:'GuldSlayerDedicated/1.0' },
    localStorage:{ getItem:()=>null, setItem(){}, removeItem(){}, clear(){} },
    alert(){}, confirm(){ return false; }, prompt(){ return null; },
    fetch:()=>Promise.reject(new Error('no fetch in dedicated mode')),
    WebSocket:undefined, Peer:undefined,
    crypto:globalThis.crypto,
    TextEncoder, TextDecoder,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),
    atob:s=>Buffer.from(s,'base64').toString('binary'),
    __DEDICATED__:true,
  };
  sandbox.window=sandbox; sandbox.globalThis=sandbox; sandbox.self=sandbox;
  return sandbox;
}

module.exports={ buildSandbox };
