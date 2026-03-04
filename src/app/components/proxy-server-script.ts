/**
 * DesignDead Proxy Server Script
 *
 * The proxy runs on localhost:9876 as a TRANSPARENT REVERSE PROXY.
 * It forwards ALL requests to your dev server (e.g. localhost:3000),
 * injecting the DesignDead bridge script into HTML responses.
 *
 * Architecture:
 *   Browser → iframe src="http://localhost:9876/"
 *                        ↓ (same-origin, no PNA issues)
 *             Proxy (localhost:9876) → forwards to → Dev Server (localhost:3000)
 *                        ↓
 *             Injects bridge script into HTML responses
 *                        ↓
 *             All JS/CSS/images load through proxy (same-origin)
 *
 * This solves Chrome's Private Network Access (PNA) by keeping
 * everything on the proxy's origin. The iframe loads from localhost:9876,
 * and all sub-resources also load from localhost:9876.
 */

export const PROXY_PORT = 9876;

export const PROXY_SERVER_SCRIPT = `#!/usr/bin/env node
/**
 * DesignDead Proxy Server v2
 *
 * Usage:
 *   node designdead-proxy.mjs --target 3000
 *   node designdead-proxy.mjs --target 3000 --port 9876
 *
 * This is a transparent reverse proxy. ALL requests to localhost:9876
 * are forwarded to localhost:3000 (your dev server). HTML responses
 * get the DesignDead bridge script injected automatically.
 *
 * API endpoints (prefixed with /__dd__/):
 *   GET /__dd__/health     → Health check
 *   GET /__dd__/scan       → Scan for running dev servers
 *   POST /__dd__/target    → Change the target port dynamically
 */

import http from 'node:http';
import { URL } from 'node:url';
import { gunzipSync } from 'node:zlib';

// ── CLI args ──
const args = process.argv.slice(2);
let PROXY_PORT = 9876;
let TARGET_PORT = 0; // 0 = not set, will auto-detect

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i+1]) {
    PROXY_PORT = parseInt(args[i+1]); i++;
  }
  if ((args[i] === '--target' || args[i] === '-t') && args[i+1]) {
    TARGET_PORT = parseInt(args[i+1]); i++;
  }
}

const COMMON_PORTS = [3000, 3001, 5173, 5174, 4200, 8080, 8000, 4321, 1234, 3333];

// ── CORS + PNA headers ──
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With, Authorization',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Max-Age': '86400',
};

// ── Bridge script (injected into HTML) ──
const BRIDGE_SCRIPT = \`<script data-designdead="bridge">
(function(){
  if(window.__dd_bridge)return;window.__dd_bridge=true;
  var SP=['display','position','flexDirection','alignItems','justifyContent','flexWrap','gap','overflow','width','height','maxWidth','maxHeight','minWidth','minHeight','fontSize','fontWeight','lineHeight','textAlign','color','letterSpacing','fontFamily','textDecoration','textTransform','background','backgroundColor','border','borderRadius','opacity','boxShadow','zIndex','top','right','bottom','left','gridTemplateColumns','gridTemplateRows','cursor'];
  var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,BR:1,WBR:1,HEAD:1,META:1,LINK:1,TITLE:1,BASE:1};
  var MAX=2000,ec=0;
  function assignIds(el){if(!el||el.nodeType!==1||SKIP[el.tagName]||ec>=MAX)return;if(!el.getAttribute('data-dd-id'))el.setAttribute('data-dd-id','el-'+(ec++));for(var i=0;i<el.children.length;i++)assignIds(el.children[i]);}
  function getSelector(el){var p=[],c=el,d=0;while(c&&c!==document.documentElement&&d<4){var s=c.tagName.toLowerCase();if(c.id&&/^[a-zA-Z]/.test(c.id)&&c.id.indexOf('dd-')!==0){p.unshift('#'+c.id);break;}var cn=c.className;if(cn&&typeof cn==='string'){var cl=cn.trim().split(/\\\\s+/).filter(function(x){return x&&x.length<30;}).slice(0,1);if(cl.length)s+='.'+cl[0];}if(c.parentElement){var si=c.parentElement.children,same=[];for(var i=0;i<si.length;i++)if(si[i].tagName===c.tagName)same.push(si[i]);if(same.length>1)s+=':nth-of-type('+(same.indexOf(c)+1)+')';}p.unshift(s);c=c.parentElement;d++;}return p.join(' > ');}
  function buildTree(el,depth){if(!el||el.nodeType!==1||SKIP[el.tagName]||depth>20)return null;var id=el.getAttribute('data-dd-id');if(!id||el.id==='dd-hover'||el.id==='dd-select'||el.id==='dd-label')return null;var tag=el.tagName.toLowerCase();var cn=el.className;var cls=(cn&&typeof cn==='string')?cn.trim().split(/\\\\s+/).filter(Boolean):[];var txt='';for(var i=0;i<el.childNodes.length;i++){var n=el.childNodes[i];if(n.nodeType===3){var t=(n.textContent||'').trim();if(t)txt+=(txt?' ':'')+t;}}if(txt.length>50)txt=txt.slice(0,47)+'...';var ch=[];if(tag!=='svg'&&tag!=='canvas'&&tag!=='video'&&tag!=='iframe'){for(var j=0;j<el.children.length;j++){var nd=buildTree(el.children[j],depth+1);if(nd)ch.push(nd);}}return{id:id,tag:tag,classes:cls,text:ch.length>0?'':txt,children:ch,selector:getSelector(el),visible:true,locked:false,styles:{}};}
  function getStyles(el){var cs=window.getComputedStyle(el),r={};for(var i=0;i<SP.length;i++){var p=SP[i];var kb=p.replace(/([A-Z])/g,'-\$1').toLowerCase();var v=cs.getPropertyValue(kb);if(!v||v===''||v==='none'||v==='normal'||v==='auto'||v==='0px'||v==='rgba(0, 0, 0, 0)'||v==='transparent'||v==='static'||v==='visible'||v==='row'||v==='nowrap'||v==='start'||v==='baseline'||v==='disc')continue;if(p==='display'||p==='width'||p==='height'||p==='color'||p==='fontSize'||p==='fontFamily'||p==='backgroundColor'||p==='fontWeight')r[p]=v;else r[p]=v;}var w=cs.getPropertyValue('width'),h=cs.getPropertyValue('height');if(w&&w!=='auto'&&w!=='0px')r.width=w;if(h&&h!=='auto'&&h!=='0px')r.height=h;r.display=cs.getPropertyValue('display');var pt=cs.getPropertyValue('padding-top'),pr=cs.getPropertyValue('padding-right'),pb=cs.getPropertyValue('padding-bottom'),pl=cs.getPropertyValue('padding-left');if(pt===pr&&pr===pb&&pb===pl){if(pt&&pt!=='0px')r.padding=pt;}else{if(pt&&pt!=='0px')r.paddingTop=pt;if(pr&&pr!=='0px')r.paddingRight=pr;if(pb&&pb!=='0px')r.paddingBottom=pb;if(pl&&pl!=='0px')r.paddingLeft=pl;}var mt=cs.getPropertyValue('margin-top'),mr=cs.getPropertyValue('margin-right'),mb=cs.getPropertyValue('margin-bottom'),ml=cs.getPropertyValue('margin-left');if(mt===mr&&mr===mb&&mb===ml){if(mt&&mt!=='0px')r.margin=mt;}else{if(mt&&mt!=='0px')r.marginTop=mt;if(mr&&mr!=='0px')r.marginRight=mr;if(mb&&mb!=='0px')r.marginBottom=mb;if(ml&&ml!=='0px')r.marginLeft=ml;}var co=cs.getPropertyValue('color');if(co)r.color=co;var fs=cs.getPropertyValue('font-size');if(fs)r.fontSize=fs;return r;}
  function init(){
    var ho=document.createElement('div');ho.id='dd-hover';ho.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:1.5px dashed rgba(0,112,243,0.6);background:rgba(0,112,243,0.04);display:none;transition:all 60ms ease-out;';document.body.appendChild(ho);
    var so=document.createElement('div');so.id='dd-select';so.style.cssText='position:fixed;pointer-events:none;z-index:2147483645;border:2px solid #0070f3;background:rgba(0,112,243,0.06);display:none;';document.body.appendChild(so);
    var lb=document.createElement('div');lb.id='dd-label';lb.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;background:#0070f3;color:#fff;font:10px ui-monospace,monospace;padding:1px 5px;border-radius:2px;display:none;white-space:nowrap;';document.body.appendChild(lb);
    function pos(o,r){o.style.left=r.left+'px';o.style.top=r.top+'px';o.style.width=r.width+'px';o.style.height=r.height+'px';o.style.display='block';}
    function scan(){ec=0;document.querySelectorAll('[data-dd-id]').forEach(function(e){e.removeAttribute('data-dd-id');});assignIds(document.body);var t=buildTree(document.body,0);window.parent.postMessage({type:'IFRAME_TREE',tree:t?[t]:[]},'*');try{window.parent.postMessage({type:'IFRAME_HEIGHT',height:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,600)},'*');}catch(e){}}
    scan();var sd=null,sc=0;
    var ob=new MutationObserver(function(m){var dom=m.some(function(mu){return mu.addedNodes.length>0||mu.removedNodes.length>0;});if(dom&&sc<40){sc++;clearTimeout(sd);sd=setTimeout(scan,sc<5?400:sc<15?1000:2000);}});
    ob.observe(document.body,{childList:true,subtree:true});
    setTimeout(scan,1500);setTimeout(scan,3000);setTimeout(scan,6000);setTimeout(scan,10000);
    var lh=null;
    document.addEventListener('mousemove',function(e){var el=document.elementFromPoint(e.clientX,e.clientY);if(!el||el.id==='dd-hover'||el.id==='dd-select'||el.id==='dd-label')return;if(el===lh)return;lh=el;var db=el.closest('[data-dd-id]');if(db){var r=db.getBoundingClientRect();pos(ho,r);var tg=db.tagName.toLowerCase(),cn=db.className,cl=(cn&&typeof cn==='string')?cn.trim().split(/\\\\s+/)[0]:'';lb.textContent=tg+(cl?'.'+cl:'');lb.style.left=r.left+'px';lb.style.top=Math.max(0,r.top-18)+'px';lb.style.display='block';window.parent.postMessage({type:'IFRAME_HOVER',id:db.getAttribute('data-dd-id')},'*');}},true);
    document.addEventListener('mouseleave',function(){ho.style.display='none';lb.style.display='none';lh=null;window.parent.postMessage({type:'IFRAME_HOVER',id:null},'*');});
    document.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();var el=e.target.closest?e.target.closest('[data-dd-id]'):null;if(!el)return;var r=el.getBoundingClientRect();pos(so,r);window.parent.postMessage({type:'IFRAME_SELECT',id:el.getAttribute('data-dd-id'),styles:getStyles(el)},'*');},true);
    document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('a'):null;if(a)e.preventDefault();},true);
    window.addEventListener('message',function(e){var d=e.data;if(!d||!d.type)return;
      if(d.type==='PARENT_HOVER'){if(d.id){var el=document.querySelector('[data-dd-id="'+d.id+'"]');if(el){var r=el.getBoundingClientRect();pos(ho,r);lb.textContent=el.tagName.toLowerCase();lb.style.left=r.left+'px';lb.style.top=Math.max(0,r.top-18)+'px';lb.style.display='block';}}else{ho.style.display='none';lb.style.display='none';}}
      if(d.type==='PARENT_SELECT'){if(d.id){var el=document.querySelector('[data-dd-id="'+d.id+'"]');if(el){var r=el.getBoundingClientRect();pos(so,r);el.scrollIntoView({behavior:'smooth',block:'nearest'});window.parent.postMessage({type:'IFRAME_STYLES',id:d.id,styles:getStyles(el)},'*');}}else{so.style.display='none';}}
      if(d.type==='APPLY_STYLE'){var el=document.querySelector('[data-dd-id="'+d.id+'"]');if(el){el.style.setProperty(d.property.replace(/([A-Z])/g,'-\$1').toLowerCase(),d.value);window.parent.postMessage({type:'IFRAME_STYLES',id:d.id,styles:getStyles(el)},'*');}}
      if(d.type==='RESCAN_TREE')scan();
    });
    window.parent.postMessage({type:'IFRAME_READY'},'*');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,200);});
  else setTimeout(init,200);
})();
</script>\`;

// ── Port scanner ──
async function probePort(port) {
  return new Promise(resolve => {
    const req = http.request({hostname:'127.0.0.1',port,method:'HEAD',timeout:1500},res=>{res.resume();resolve(true);});
    req.on('error',()=>resolve(false));
    req.on('timeout',()=>{req.destroy();resolve(false);});
    req.end();
  });
}

async function scanPorts() {
  const results = await Promise.all(COMMON_PORTS.map(async port => {
    if (port === PROXY_PORT) return null;
    const alive = await probePort(port);
    if (!alive) return null;
    const frameworks = {5173:'Vite',5174:'Vite',3000:'Next.js / React',3001:'Next.js / React',4200:'Angular',8080:'Vue / Webpack',4321:'Astro',1234:'Parcel',8000:'Python / Django',3333:'Remix'};
    return { port, framework: frameworks[port] || 'Web App' };
  }));
  return results.filter(Boolean);
}

// ── Transparent reverse proxy ──
function proxyRequest(targetPort, req, res) {
  const targetPath = req.url || '/';

  const proxyOpts = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: targetPath,
    method: req.method || 'GET',
    headers: { ...req.headers, host: 'localhost:' + targetPort },
    timeout: 30000,
  };
  // Remove headers that cause issues
  delete proxyOpts.headers['origin'];
  delete proxyOpts.headers['referer'];
  delete proxyOpts.headers['accept-encoding']; // so we get uncompressed HTML

  const proxyReq = http.request(proxyOpts, proxyRes => {
    const ct = (proxyRes.headers['content-type'] || '').toLowerCase();
    const isHTML = ct.includes('text/html');

    if (isHTML) {
      // Collect entire HTML body, inject bridge, send
      const chunks = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf8');

        // Inject bridge script before </body> or </html> or at end
        if (!body.includes('data-designdead')) {
          if (body.includes('</body>')) {
            body = body.replace('</body>', BRIDGE_SCRIPT + '\\n</body>');
          } else if (body.includes('</html>')) {
            body = body.replace('</html>', BRIDGE_SCRIPT + '\\n</html>');
          } else {
            body += '\\n' + BRIDGE_SCRIPT;
          }
        }

        // Copy headers, fix content-length
        const headers = { ...proxyRes.headers };
        delete headers['content-length'];
        delete headers['content-encoding'];
        delete headers['transfer-encoding'];
        headers['content-type'] = 'text/html; charset=utf-8';
        headers['cache-control'] = 'no-store';
        // Add CORS for cross-origin postMessage
        Object.assign(headers, CORS);

        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(body);
      });
    } else {
      // Non-HTML: stream through directly
      const headers = { ...proxyRes.headers, ...CORS };
      res.writeHead(proxyRes.statusCode || 200, headers);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', err => {
    res.writeHead(502, {'Content-Type':'application/json',...CORS});
    res.end(JSON.stringify({error:'Proxy error: ' + err.message}));
  });
  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.writeHead(504, {'Content-Type':'application/json',...CORS});
    res.end(JSON.stringify({error:'Proxy timeout'}));
  });

  // Forward request body for POST/PUT/PATCH
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

// ── HTTP Server ──
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost:' + PROXY_PORT);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  // ── DesignDead API routes (prefixed with /__dd__/) ──
  if (pathname.startsWith('/__dd__/')) {
    const route = pathname.slice(7); // remove /__dd__/

    if (route === 'health') {
      res.writeHead(200, {'Content-Type':'application/json',...CORS});
      return res.end(JSON.stringify({
        ok: true, name: 'designdead-proxy', version: '2.0.0',
        port: PROXY_PORT, target: TARGET_PORT, timestamp: Date.now()
      }));
    }

    if (route === 'scan') {
      const servers = await scanPorts();
      res.writeHead(200, {'Content-Type':'application/json',...CORS});
      return res.end(JSON.stringify({ servers }));
    }

    if (route === 'target' && method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.port && Number.isInteger(data.port) && data.port > 0) {
            TARGET_PORT = data.port;
            console.log('  Target changed to localhost:' + TARGET_PORT);
            res.writeHead(200, {'Content-Type':'application/json',...CORS});
            res.end(JSON.stringify({ ok: true, target: TARGET_PORT }));
          } else {
            res.writeHead(400, {'Content-Type':'application/json',...CORS});
            res.end(JSON.stringify({ error: 'Invalid port' }));
          }
        } catch {
          res.writeHead(400, {'Content-Type':'application/json',...CORS});
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    res.writeHead(404, {'Content-Type':'application/json',...CORS});
    return res.end(JSON.stringify({ error: 'Unknown API route' }));
  }

  // ── Reverse proxy: forward everything else to the target dev server ──
  if (!TARGET_PORT) {
    // No target configured — show a helpful page
    res.writeHead(200, {'Content-Type':'text/html',...CORS});
    return res.end(\`<!DOCTYPE html><html><head><title>DesignDead Proxy</title>
    <style>body{font-family:system-ui;background:#0a0a0a;color:#ededed;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
    .c{text-align:center;max-width:460px;}.h{font-size:24px;font-weight:700;margin-bottom:12px;letter-spacing:-0.5px;}
    .s{color:#888;font-size:14px;line-height:1.6;margin-bottom:24px;}
    code{background:#1a1a1a;padding:6px 12px;border-radius:6px;font-size:13px;color:#50e3c2;display:inline-block;margin:4px 0;}
    .d{color:#666;font-size:12px;margin-top:16px;}</style></head>
    <body><div class="c"><div class="h">DesignDead Proxy</div>
    <div class="s">No target dev server configured.<br>Restart with a target:</div>
    <code>node designdead-proxy.mjs --target 3000</code>
    <div class="d">Proxy running on port \${PROXY_PORT}</div></div></body></html>\`);
  }

  proxyRequest(TARGET_PORT, req, res);
});

server.listen(PROXY_PORT, () => {
  console.log('');
  console.log('  DesignDead Proxy v2');
  console.log('  ───────────────────────────────────────');
  console.log('  Proxy:  http://localhost:' + PROXY_PORT);
  if (TARGET_PORT) {
    console.log('  Target: http://localhost:' + TARGET_PORT);
    console.log('');
    console.log('  All requests to :' + PROXY_PORT + ' → forwarded to :' + TARGET_PORT);
    console.log('  Bridge script auto-injected into HTML responses');
  } else {
    console.log('  Target: not set (use --target <port>)');
    console.log('');
    console.log('  Scanning for dev servers...');
    scanPorts().then(servers => {
      if (servers.length) {
        servers.forEach(s => console.log('    Found: localhost:' + s.port + ' (' + s.framework + ')'));
        console.log('');
        console.log('  Restart with: node designdead-proxy.mjs --target ' + servers[0].port);
      } else {
        console.log('  No dev servers found. Start yours first.');
      }
      console.log('');
    });
  }
  console.log('  ───────────────────────────────────────');
  console.log('');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') console.error('Port ' + PROXY_PORT + ' in use. Try --port ' + (PROXY_PORT + 1));
  else console.error('Error:', err.message);
  process.exit(1);
});
`;

export const PROXY_SCRIPT_FILENAME = "designdead-proxy.mjs";
