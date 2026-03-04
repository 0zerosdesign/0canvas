import React, { useState, useEffect, useRef, useCallback } from "react";
import { useWorkspace } from "../store";
import {
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Monitor,
  ExternalLink,
  X,
} from "lucide-react";
import { PROXY_PORT } from "./proxy-server-script";

// ──────────────────────────────────────────────────────────
// Bridge script (for same-origin injection fallback)
// When using the proxy, the proxy injects this server-side.
// This is kept as a fallback for same-origin iframes.
// ──────────────────────────────────────────────────────────
const BRIDGE_SCRIPT = `
(function() {
  'use strict';
  if (window.__dd_bridge_ready) return;
  window.__dd_bridge_ready = true;

  var STYLE_PROPS = [
    'display','position','flexDirection','alignItems','justifyContent',
    'flexWrap','gap','overflow','float','clear',
    'width','height','maxWidth','maxHeight','minWidth','minHeight',
    'fontSize','fontWeight','lineHeight','textAlign','color',
    'letterSpacing','fontFamily','textDecoration','textTransform',
    'background','backgroundColor','border','borderTop','borderBottom',
    'borderLeft','borderRight','borderRadius','opacity','boxShadow',
    'zIndex','top','right','bottom','left',
    'gridTemplateColumns','gridTemplateRows',
    'cursor','whiteSpace','verticalAlign','listStyleType'
  ];
  var SKIP = {SCRIPT:1,STYLE:1,NOSCRIPT:1,BR:1,WBR:1,HEAD:1,META:1,LINK:1,TITLE:1,BASE:1};
  var MAX = 2000, ec = 0;

  function ids(el) {
    if (!el || el.nodeType !== 1 || SKIP[el.tagName] || ec >= MAX) return;
    if (!el.getAttribute('data-dd-id')) el.setAttribute('data-dd-id', 'el-'+(ec++));
    for (var i = 0; i < el.children.length; i++) ids(el.children[i]);
  }

  function sel(el) {
    var p = [], c = el, d = 0;
    while (c && c !== document.documentElement && d < 4) {
      var s = c.tagName.toLowerCase();
      if (c.id && /^[a-zA-Z]/.test(c.id) && c.id.indexOf('dd-') !== 0) { p.unshift('#'+c.id); break; }
      var cn = c.className;
      if (cn && typeof cn === 'string') {
        var cl = cn.trim().split(/\\s+/).filter(function(x){return x&&x.indexOf('data-')!==0;}).slice(0,1);
        if (cl.length) s += '.'+cl[0];
      }
      if (c.parentElement) {
        var si = c.parentElement.children, st = [];
        for (var i = 0; i < si.length; i++) if (si[i].tagName===c.tagName) st.push(si[i]);
        if (st.length > 1) s += ':nth-of-type('+(st.indexOf(c)+1)+')';
      }
      p.unshift(s); c = c.parentElement; d++;
    }
    return p.join(' > ');
  }

  function tree(el, depth) {
    if (!el || el.nodeType !== 1 || SKIP[el.tagName] || depth > 18) return null;
    var id = el.getAttribute('data-dd-id');
    if (!id || el.id==='dd-hover'||el.id==='dd-select'||el.id==='dd-label') return null;
    var tag = el.tagName.toLowerCase();
    var cn = el.className;
    var cls = (cn && typeof cn === 'string') ? cn.trim().split(/\\s+/).filter(Boolean) : [];
    var txt = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) { var t = (n.textContent||'').trim(); if (t) txt += (txt?' ':'')+t; }
    }
    if (txt.length > 50) txt = txt.slice(0,47)+'...';
    var ch = [];
    if (tag!=='svg'&&tag!=='canvas'&&tag!=='video'&&tag!=='iframe') {
      for (var j = 0; j < el.children.length; j++) { var nd = tree(el.children[j],depth+1); if (nd) ch.push(nd); }
    }
    return {id:id,tag:tag,classes:cls,text:ch.length>0?'':txt,children:ch,selector:sel(el),visible:true,locked:false,styles:{}};
  }

  function gs(el) {
    var cs = window.getComputedStyle(el), r = {};
    var pt=cs.getPropertyValue('padding-top'),pr2=cs.getPropertyValue('padding-right'),
        pb=cs.getPropertyValue('padding-bottom'),pl=cs.getPropertyValue('padding-left');
    if(pt===pr2&&pr2===pb&&pb===pl){if(pt&&pt!=='0px')r.padding=pt;}
    else{if(pt&&pt!=='0px')r.paddingTop=pt;if(pr2&&pr2!=='0px')r.paddingRight=pr2;
      if(pb&&pb!=='0px')r.paddingBottom=pb;if(pl&&pl!=='0px')r.paddingLeft=pl;}
    var mt=cs.getPropertyValue('margin-top'),mr2=cs.getPropertyValue('margin-right'),
        mb=cs.getPropertyValue('margin-bottom'),ml=cs.getPropertyValue('margin-left');
    if(mt===mr2&&mr2===mb&&mb===ml){if(mt&&mt!=='0px')r.margin=mt;}
    else{if(mt&&mt!=='0px')r.marginTop=mt;if(mr2&&mr2!=='0px')r.marginRight=mr2;
      if(mb&&mb!=='0px')r.marginBottom=mb;if(ml&&ml!=='0px')r.marginLeft=ml;}
    var df={display:'block',position:'static',flexDirection:'row',alignItems:'normal',
      justifyContent:'normal',flexWrap:'nowrap',gap:'normal',overflow:'visible',opacity:'1',
      zIndex:'auto',textAlign:'start',textTransform:'none',whiteSpace:'normal',cursor:'auto',
      top:'auto',right:'auto',bottom:'auto',left:'auto',maxWidth:'none',maxHeight:'none',
      minWidth:'0px',minHeight:'0px',boxShadow:'none',borderRadius:'0px',letterSpacing:'normal',
      gridTemplateColumns:'none',gridTemplateRows:'none',float:'none',clear:'none',
      verticalAlign:'baseline',listStyleType:'disc'};
    var sk={padding:1,paddingTop:1,paddingRight:1,paddingBottom:1,paddingLeft:1,
      margin:1,marginTop:1,marginRight:1,marginBottom:1,marginLeft:1};
    for(var i=0;i<STYLE_PROPS.length;i++){
      var p=STYLE_PROPS[i];if(sk[p])continue;
      var kb=p.replace(/([A-Z])/g,'-$1').toLowerCase(),v=cs.getPropertyValue(kb);
      if(!v||v==='')continue;if(df[p]!==undefined&&v===df[p])continue;
      if((p==='width'||p==='height')&&v==='auto')continue;
      if((p==='background'||p==='backgroundColor')&&(v==='rgba(0, 0, 0, 0)'||v==='transparent'))continue;
      if(p.indexOf('border')===0&&p!=='borderRadius'&&(v==='none'||v==='0px none rgb(0, 0, 0)'||v==='0px'))continue;
      if(p==='textDecoration'&&(v==='none'||v.indexOf('none')===0))continue;
      if(p==='fontFamily'&&v.length>80){r[p]=v.split(',')[0].trim().replace(/['"]/g,'');continue;}
      if(p==='lineHeight'&&v==='normal')continue;if(p==='fontWeight'&&v==='400')continue;
      r[p]=v;
    }
    var d2=cs.getPropertyValue('display');if(d2)r.display=d2;
    var w=cs.getPropertyValue('width'),h=cs.getPropertyValue('height');
    if(w&&w!=='auto'&&w!=='0px')r.width=w;if(h&&h!=='auto'&&h!=='0px')r.height=h;
    var tt={SPAN:1,P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,A:1,LI:1,TD:1,TH:1,LABEL:1,BUTTON:1,STRONG:1,EM:1,B:1,I:1,SMALL:1};
    if(tt[el.tagName]){var co=cs.getPropertyValue('color');if(co)r.color=co;
      var fs=cs.getPropertyValue('font-size');if(fs)r.fontSize=fs;}
    return r;
  }

  function init() {
    var ho = document.createElement('div'); ho.id='dd-hover';
    ho.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:1.5px dashed rgba(0,112,243,0.6);background:rgba(0,112,243,0.04);display:none;transition:all 0.06s ease-out;';
    document.body.appendChild(ho);
    var so = document.createElement('div'); so.id='dd-select';
    so.style.cssText='position:fixed;pointer-events:none;z-index:2147483645;border:2px solid #0070f3;background:rgba(0,112,243,0.06);display:none;';
    document.body.appendChild(so);
    var lb = document.createElement('div'); lb.id='dd-label';
    lb.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;background:#0070f3;color:white;font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 5px;border-radius:2px;display:none;white-space:nowrap;';
    document.body.appendChild(lb);

    function pos(o,r){o.style.left=r.left+'px';o.style.top=r.top+'px';o.style.width=r.width+'px';o.style.height=r.height+'px';o.style.display='block';}
    function scan(){
      ec=0;
      document.querySelectorAll('[data-dd-id]').forEach(function(e){e.removeAttribute('data-dd-id');});
      ids(document.body);
      var t=tree(document.body,0);
      window.parent.postMessage({type:'IFRAME_TREE',tree:t?[t]:[]},'*');
      try{var bh=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,600);
        window.parent.postMessage({type:'IFRAME_HEIGHT',height:bh},'*');}catch(e){}
    }
    scan();
    var sd=null,sc=0;
    var ob=new MutationObserver(function(m){
      var dom=false;
      for(var i=0;i<m.length;i++){if(m[i].addedNodes.length>0){for(var j=0;j<m[i].addedNodes.length;j++){
        var n=m[i].addedNodes[j];if(n.nodeType===1&&!SKIP[n.tagName]&&n.id!=='dd-hover'&&n.id!=='dd-select'&&n.id!=='dd-label'){dom=true;break;}}}}
      if(dom&&sc<40){sc++;if(sd)clearTimeout(sd);sd=setTimeout(scan,sc<5?400:sc<15?1000:2000);}
    });
    ob.observe(document.body,{childList:true,subtree:true});
    setTimeout(scan,1500);setTimeout(scan,3000);setTimeout(scan,6000);setTimeout(scan,10000);

    var lh=null;
    document.addEventListener('mousemove',function(e){
      var el=document.elementFromPoint(e.clientX,e.clientY);
      if(!el||el.id==='dd-hover'||el.id==='dd-select'||el.id==='dd-label')return;
      if(el===lh)return;lh=el;
      var db=el.closest('[data-dd-id]');
      if(db){var r=db.getBoundingClientRect();pos(ho,r);
        var tg=db.tagName.toLowerCase(),cn=db.className,cl=(cn&&typeof cn==='string')?cn.trim().split(/\\s+/)[0]:'';
        lb.textContent=tg+(cl?'.'+cl:'');lb.style.left=r.left+'px';lb.style.top=Math.max(0,r.top-18)+'px';lb.style.display='block';
        window.parent.postMessage({type:'IFRAME_HOVER',id:db.getAttribute('data-dd-id')},'*');}
    },true);
    document.addEventListener('mouseleave',function(){ho.style.display='none';lb.style.display='none';lh=null;
      window.parent.postMessage({type:'IFRAME_HOVER',id:null},'*');});
    document.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      var el=e.target,db=el.closest?el.closest('[data-dd-id]'):null;
      if(!db)return;var id=db.getAttribute('data-dd-id'),r=db.getBoundingClientRect();
      pos(so,r);var st=gs(db);
      window.parent.postMessage({type:'IFRAME_SELECT',id:id,styles:st},'*');
    },true);
    document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('a'):null;if(a){e.preventDefault();e.stopPropagation();}},true);
    window.addEventListener('message',function(e){
      var d=e.data;if(!d||!d.type)return;
      if(d.type==='PARENT_HOVER'){if(d.id){var el=document.querySelector('[data-dd-id="'+d.id+'"]');
        if(el){var r=el.getBoundingClientRect();pos(ho,r);lb.textContent=el.tagName.toLowerCase();
          lb.style.left=r.left+'px';lb.style.top=Math.max(0,r.top-18)+'px';lb.style.display='block';}}
        else{ho.style.display='none';lb.style.display='none';}}
      if(d.type==='PARENT_SELECT'){if(d.id){var el=document.querySelector('[data-dd-id="'+d.id+'"]');
        if(el){var r=el.getBoundingClientRect();pos(so,r);el.scrollIntoView({behavior:'smooth',block:'nearest'});
          var st=gs(el);window.parent.postMessage({type:'IFRAME_STYLES',id:d.id,styles:st},'*');}}
        else{so.style.display='none';}}
      if(d.type==='APPLY_STYLE'){var el=document.querySelector('[data-dd-id="'+d.id+'"]');
        if(el){var kb=d.property.replace(/([A-Z])/g,'-$1').toLowerCase();el.style.setProperty(kb,d.value);
          var st=gs(el);window.parent.postMessage({type:'IFRAME_STYLES',id:d.id,styles:st},'*');}}
      if(d.type==='RESCAN_TREE'){scan();}
    });
    window.parent.postMessage({type:'IFRAME_READY'},'*');
  }
  if(document.readyState==='complete')setTimeout(init,300);
  else{window.addEventListener('load',function(){setTimeout(init,500);});
    setTimeout(function(){if(!window.__dd_bridge_ready)return;init();},8000);}
})();
`;

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/**
 * Extract port number from a URL like http://localhost:3000
 */
function extractPort(url: string): number | null {
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return parseInt(u.port) || (u.protocol === "https:" ? 443 : 80);
    }
  } catch { /* */ }
  return null;
}

// ──────────────────────────────────────────────────────────
// PreviewCanvas Component
//
// Architecture: We NEVER use fetch() to reach localhost because
// Chrome's Private Network Access (PNA) policy blocks all fetch
// requests from public origins (like figma.com) to private
// networks (like localhost). Instead, we use <iframe src="...">
// directly, which Chrome still allows for navigation.
//
// The DesignDead proxy (localhost:9876) is a transparent reverse
// proxy. When the iframe loads from the proxy, it:
//   1. Forwards the request to the target dev server
//   2. Injects the bridge script into the HTML response
//   3. Returns the modified HTML with bridge embedded
//   4. All subsequent resource requests (JS, CSS, images)
//      go through the proxy too (same-origin to iframe)
//
// The bridge communicates with the parent via postMessage,
// which works cross-origin (using '*' as targetOrigin).
// ──────────────────────────────────────────────────────────
export function PreviewCanvas() {
  const { state, dispatch } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [iframeReady, setIframeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ w: 1280, h: 800 });
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<
    "proxy" | "direct" | null
  >(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectionSourceRef = useRef<"iframe" | "layers" | null>(null);
  const hoverSourceRef = useRef<"iframe" | "layers" | null>(null);
  const prevStyleChangesCount = useRef(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proxyFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectUrl = state.project?.devServerUrl || "";
  const isProxyUrl = (() => {
    try {
      const u = new URL(projectUrl);
      return (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
             parseInt(u.port) === PROXY_PORT;
    } catch { return false; }
  })();

  // ── Load preview ──
  // This ONLY sets iframe src — no fetch() calls.
  // The proxy injects the bridge server-side.
  const loadPreview = useCallback(
    (url: string) => {
      if (!url) return;

      setLoading(true);
      setError(null);
      setIframeReady(false);
      setIframeSrc(null);
      setPreviewMode(null);
      dispatch({ type: "CLEAR_PAGE" });
      dispatch({ type: "SET_LOADING", loading: true });

      const port = extractPort(url);

      // If URL is the proxy root (http://localhost:9876), use it directly
      if (port === PROXY_PORT) {
        setIframeSrc(`http://localhost:${PROXY_PORT}/`);
        setPreviewMode("proxy");
        startBridgeTimeout();
        return;
      }

      // For any localhost URL, try loading through the proxy first.
      // The proxy transparently forwards to the target dev server
      // and injects the bridge script into HTML responses.
      // The user must have started the proxy with: node designdead-proxy.mjs --target <port>
      if (port) {
        // Try proxy first — set iframe src to proxy
        setIframeSrc(`http://localhost:${PROXY_PORT}/`);
        setPreviewMode("proxy");
        startBridgeTimeout();

        // If no IFRAME_READY after 6s, fall back to direct iframe
        proxyFallbackRef.current = setTimeout(() => {
          if (!iframeReady) {
            setIframeSrc(url);
            setPreviewMode("direct");
            // Give direct load another 8s
            startLoadTimeout(8000,
              `The DesignDead proxy didn't respond. The page loaded without the inspection bridge.\n\nTo enable full inspection, run:\n  node designdead-proxy.mjs --target ${port}\n\nThen reload.`
            );
          }
        }, 6000);
        return;
      }

      // Non-localhost URL (production) — load directly
      setIframeSrc(url);
      setPreviewMode("direct");
      startLoadTimeout(10000,
        "Could not load the page. Check the URL and try again."
      );
    },
    [dispatch]
  );

  function startBridgeTimeout() {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      if (!iframeReady) {
        setLoading(false);
        dispatch({ type: "SET_LOADING", loading: false });
        // Don't set error yet — the proxy fallback will handle it
      }
    }, 12000);
  }

  function startLoadTimeout(ms = 12000, fallbackError?: string) {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      dispatch({ type: "SET_LOADING", loading: false });
      if (!iframeReady && fallbackError) {
        setError(fallbackError);
      }
    }, ms);
  }

  // Load on project change
  useEffect(() => {
    if (projectUrl) {
      loadPreview(projectUrl);
    }
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (proxyFallbackRef.current) clearTimeout(proxyFallbackRef.current);
    };
  }, [projectUrl]);

  // Try to inject bridge for same-origin iframes (direct mode)
  const injectBridgeScript = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument?.body) return;
      const doc = iframe.contentDocument;
      if (doc.querySelector("[data-designdead]")) return;
      const script = doc.createElement("script");
      script.setAttribute("data-designdead", "true");
      script.textContent = BRIDGE_SCRIPT;
      doc.body.appendChild(script);
    } catch {
      // Cross-origin — can't inject
    }
  }, []);

  // ── Message handler ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (!data?.type?.startsWith("IFRAME_")) return;

      if (data.type === "IFRAME_READY") {
        setIframeReady(true);
        setLoading(false);
        setError(null);
        dispatch({ type: "SET_LOADING", loading: false });
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        if (proxyFallbackRef.current) {
          clearTimeout(proxyFallbackRef.current);
          proxyFallbackRef.current = null;
        }
      }
      if (data.type === "IFRAME_TREE") {
        dispatch({ type: "SET_ELEMENTS", elements: data.tree || [] });
      }
      if (data.type === "IFRAME_HEIGHT") {
        if (data.height && typeof data.height === "number") {
          setDimensions((d) => ({ ...d, h: Math.max(data.height, 600) }));
        }
      }
      if (data.type === "IFRAME_HOVER") {
        hoverSourceRef.current = "iframe";
        dispatch({ type: "HOVER_ELEMENT", id: data.id });
      }
      if (data.type === "IFRAME_SELECT") {
        selectionSourceRef.current = "iframe";
        dispatch({ type: "SELECT_ELEMENT", id: data.id });
        if (data.styles && data.id) {
          dispatch({ type: "SET_ELEMENT_STYLES", id: data.id, styles: data.styles });
        }
      }
      if (data.type === "IFRAME_STYLES") {
        if (data.id && data.styles) {
          dispatch({ type: "SET_ELEMENT_STYLES", id: data.id, styles: data.styles });
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [dispatch]);

  // Relay selection
  useEffect(() => {
    if (selectionSourceRef.current === "iframe") {
      selectionSourceRef.current = null;
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: "PARENT_SELECT", id: state.selectedElementId },
      "*"
    );
  }, [state.selectedElementId]);

  // Relay hover
  useEffect(() => {
    if (hoverSourceRef.current === "iframe") {
      hoverSourceRef.current = null;
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: "PARENT_HOVER", id: state.hoveredElementId },
      "*"
    );
  }, [state.hoveredElementId]);

  // Relay style changes
  useEffect(() => {
    if (
      state.styleChanges.length > prevStyleChangesCount.current &&
      state.styleChanges.length > 0
    ) {
      const latest = state.styleChanges[state.styleChanges.length - 1];
      if (latest) {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "APPLY_STYLE",
            id: latest.elementId,
            property: latest.property,
            value: latest.newValue,
          },
          "*"
        );
      }
    }
    prevStyleChangesCount.current = state.styleChanges.length;
  }, [state.styleChanges]);

  const handleReload = () => {
    if (projectUrl) loadPreview(projectUrl);
  };

  const connectedIDE = state.ides.find((i) => i.status === "connected");
  const modeLabel =
    previewMode === "proxy"
      ? "Proxy"
      : previewMode === "direct"
      ? "Direct"
      : "";

  return (
    <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center gap-2 px-3 bg-[#0a0a0a]">
        <button
          className={`p-1.5 rounded transition-colors shrink-0 ${
            state.inspectorMode
              ? "bg-[#0070f3]/15 text-[#0070f3]"
              : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_INSPECTOR" })}
          title="Inspector Mode"
        >
          <MousePointer2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border shrink-0" />

        {/* URL bar */}
        <div className="flex-1 flex items-center bg-[#111111] border border-[#1a1a1a] rounded-md h-[28px] px-2.5 gap-2">
          {loading ? (
            <Loader2 className="w-3 h-3 text-[#0070f3] animate-spin shrink-0" />
          ) : iframeReady ? (
            <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2] shrink-0" />
          ) : error ? (
            <AlertCircle className="w-3 h-3 text-[#f5a623] shrink-0" />
          ) : (
            <Monitor className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <span
            className="flex-1 text-[12px] text-muted-foreground truncate"
            style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace" }}
          >
            {isProxyUrl
              ? `proxy:${PROXY_PORT} → target dev server`
              : projectUrl || "No project connected"}
          </span>

          {previewMode && iframeReady && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                previewMode === "proxy"
                  ? "text-[#0070f3] bg-[#0070f3]/10"
                  : "text-[#f5a623] bg-[#f5a623]/10"
              }`}
            >
              {modeLabel}
            </span>
          )}

          {projectUrl && (
            <button
              onClick={handleReload}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Reload"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="w-px h-4 bg-border shrink-0" />

        {/* Zoom */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1 rounded hover:bg-[#1a1a1a] text-muted-foreground transition-colors"
            onClick={() => setZoom(Math.max(25, zoom - 10))}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-muted-foreground w-10 text-center">
            {zoom}%
          </span>
          <button
            className="p-1 rounded hover:bg-[#1a1a1a] text-muted-foreground transition-colors"
            onClick={() => setZoom(Math.min(200, zoom + 10))}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-[#1a1a1a] text-muted-foreground transition-colors ml-0.5"
            onClick={() => setZoom(100)}
            title="Reset zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto relative">
        {!projectUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Monitor className="w-12 h-12 text-[#1a1a1a] mx-auto mb-4" />
              <p className="text-[14px] text-muted-foreground mb-1">
                No project connected
              </p>
              <p className="text-[12px] text-[#444444]">
                Connect a project to start inspecting
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#050505]/80">
            <div className="text-center">
              <Loader2 className="w-6 h-6 text-[#0070f3] animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground">
                Loading preview...
              </p>
              <p className="text-[11px] text-[#444444] mt-1">
                {previewMode === "proxy"
                  ? "Connecting through proxy..."
                  : "Connecting to dev server..."}
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && !loading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[520px] w-full px-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#1a1a0a] border border-[#f5a623]/30 text-[#f5a623]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[12px] mb-2 whitespace-pre-line">{error}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReload}
                    className="text-[11px] text-[#0070f3] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                  {!isProxyUrl && projectUrl && (
                    <button
                      onClick={() => window.open(projectUrl, "_blank")}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open in browser
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="shrink-0 p-0.5 hover:bg-[#ffffff10] rounded"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}

        {/* Iframe — always use src, never srcdoc */}
        {projectUrl && iframeSrc && (
          <div
            className="flex items-start justify-center p-6"
            style={{ minHeight: "100%" }}
          >
            <div
              className="bg-white rounded-lg shadow-2xl overflow-hidden relative"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                width: `${dimensions.w}px`,
              }}
            >
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                className="w-full border-0"
                style={{ height: `${dimensions.h}px`, minHeight: "600px" }}
                title="Project Preview"
                onLoad={() => {
                  // For direct mode, try same-origin bridge injection
                  if (previewMode === "direct") {
                    setTimeout(injectBridgeScript, 800);
                    setTimeout(injectBridgeScript, 2500);
                    setTimeout(injectBridgeScript, 5000);
                  }
                  // Fallback: stop loading after iframe loads even if bridge doesn't fire
                  setTimeout(() => {
                    if (!iframeReady) {
                      setLoading(false);
                      dispatch({ type: "SET_LOADING", loading: false });
                    }
                  }, 3000);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-6 border-t border-border flex items-center justify-between px-3 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          {state.project && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  state.project.status === "connected"
                    ? "bg-[#50e3c2]"
                    : state.project.status === "connecting"
                    ? "bg-[#f5a623] animate-pulse"
                    : "bg-[#444444]"
                }`}
              />
              {state.project.name}
            </span>
          )}
          {state.selectedElementId &&
            (() => {
              const el = findEl(state.elements, state.selectedElementId);
              return el ? (
                <span
                  className="text-[10px] text-[#0070f3]"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  {el.selector}
                </span>
              ) : null;
            })()}
        </div>
        <div className="flex items-center gap-3">
          {connectedIDE && (
            <span
              className="flex items-center gap-1 text-[10px]"
              style={{ color: connectedIDE.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: connectedIDE.color }}
              />
              {connectedIDE.name}
            </span>
          )}
          {previewMode && (
            <span
              className={`flex items-center gap-1 text-[10px] ${
                previewMode === "proxy"
                  ? "text-[#0070f3]"
                  : "text-[#f5a623]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  previewMode === "proxy"
                    ? "bg-[#0070f3]"
                    : "bg-[#f5a623]"
                }`}
              />
              {modeLabel}
            </span>
          )}
          {iframeReady && (
            <span className="flex items-center gap-1 text-[10px] text-[#50e3c2]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2]" />
              Live
            </span>
          )}
          {state.styleChanges.length > 0 && (
            <span className="text-[10px] text-[#f5a623]">
              {state.styleChanges.length} changes
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {dimensions.w} x {dimensions.h}
          </span>
        </div>
      </div>
    </div>
  );
}

function findEl(elements: any[], id: string): any | null {
  for (const el of elements) {
    if (el.id === id) return el;
    const found = findEl(el.children || [], id);
    if (found) return found;
  }
  return null;
}
