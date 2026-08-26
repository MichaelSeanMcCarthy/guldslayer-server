/* GuldSlayer dedicated server.
   Runs the exact same simulation code as the browser game — extracted from guldslayer.html
   and executed headlessly — as a permanent, invisible host. Players connect over WebSockets;
   each socket is wrapped in a PeerJS-conn-shaped shim and handed to the game's own wireClient().

   Deploy anywhere that runs Node and hands you a PORT (Railway, a VPS, …):
     npm install && npm start
*/
'use strict';
const fs=require('fs');
const path=require('path');
const http=require('http');
const vm=require('vm');
const { WebSocketServer }=require('ws');
const { buildSandbox }=require('./shims');

const PORT=process.env.PORT || 3000;
const HTML_PATH=path.join(__dirname, 'guldslayer.html');

/* --- 1. load the game --- */
const html=fs.readFileSync(HTML_PATH,'utf8');
const m=/<script>([\s\S]*?)<\/script>/.exec(html);
if(!m){ console.error('Could not find the game script inside guldslayer.html'); process.exit(1); }

// epilogue: reach into the script's lexical scope and hand the server what it needs
const EPILOGUE=`
;globalThis.__GAME={
  boot(){ scene='game'; net.mode='host'; },
  wire(conn){ wireClient(conn); },
  stats(){ return {
    players: net.clients.filter(c=>c.open&&c.p.active).length,
    sockets: net.clients.filter(c=>c.open).length,
    map: mapMode, seed: worldSeed,
    goblins: goblins.filter(g=>!g.dead&&!g.gone).length,
    deer: allDeer.filter(d=>!d.dead&&!d.gone).length,
    caveOpen: cave.unlocked }; },
};`;

const sandbox=buildSandbox();
vm.createContext(sandbox);
try{
  new vm.Script(m[1]+EPILOGUE, {filename:'guldslayer.js'}).runInContext(sandbox);
}catch(err){
  console.error('Game script failed to start:', err); process.exit(1);
}
const GAME=sandbox.__GAME;
GAME.boot();
console.log('[guldslayer] world is up — seed', GAME.stats().seed);

/* --- 2. accept players --- */
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){ res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(GAME.stats())); return; }
  res.writeHead(200,{'Content-Type':'text/plain'});
  res.end('GuldSlayer dedicated server. Connect with the game client (Play Online / a wss:// address in the Join box).\n');
});
const wss=new WebSocketServer({ server, maxPayload:1<<20 });

wss.on('connection',(ws,req)=>{
  const who=(req.socket.remoteAddress||'?');
  const handlers={};
  const conn={ open:false,
    send(msg){ if(ws.readyState===1) ws.send(JSON.stringify(msg)); },
    on(ev,cb){ handlers[ev]=cb; },
    close(){ try{ ws.close(); }catch(_){} } };
  ws.on('message',data=>{
    let msg=null; try{ msg=JSON.parse(data); }catch(_){ return; }
    if(handlers.data) handlers.data(msg);
  });
  ws.on('close',()=>{ conn.open=false; if(handlers.close) handlers.close(); console.log('[guldslayer] leave', who, GAME.stats()); });
  ws.on('error',()=>{});
  ws.isAlive=true; ws.on('pong',()=>{ ws.isAlive=true; });
  GAME.wire(conn);                       // registers the open/data/close handlers…
  conn.open=true; if(handlers.open) handlers.open();   // …then the socket is already open: greet the player
  console.log('[guldslayer] join', who, GAME.stats());
});

setInterval(()=>{                        // drop half-dead phone connections so seats free up
  for(const ws of wss.clients){
    if(!ws.isAlive){ try{ ws.terminate(); }catch(_){} continue; }
    ws.isAlive=false; try{ ws.ping(); }catch(_){}
  }
}, 30000);

setInterval(()=>{ const s=GAME.stats(); if(s.sockets) console.log('[guldslayer]', JSON.stringify(s)); }, 60000);

/* --- graceful shutdown: on redeploy/restart, CLOSE every player socket immediately so their
       clients auto-reconnect to the NEW instance instead of lingering in this dying world. --- */
function shutdown(sig){
  console.log('[guldslayer]', sig, '— closing', wss.clients.size, 'player socket(s) and exiting');
  try{ for(const ws of wss.clients){ try{ ws.close(1001, 'server restarting'); }catch(_){} } }catch(_){}
  try{ server.close(); }catch(_){}
  setTimeout(()=>process.exit(0), 600);
}
process.on('SIGTERM', ()=>shutdown('SIGTERM'));
process.on('SIGINT',  ()=>shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', ()=>console.log('[guldslayer] listening on port', PORT));
