/* ============================================================
   Horizontal scroll SPA engine
   ============================================================ */
(function(){
  const track   = document.getElementById('track');
  const panels  = Array.from(document.querySelectorAll('.panel'));
  const N        = panels.length;
  const pageNum = document.getElementById('pagenum');
  const arrow   = document.querySelector('.next-arrow');
  const isTouch = matchMedia('(hover:none),(pointer:coarse)').matches;
  if(isTouch) document.body.classList.add('touch');

  /* build pagination dots */
  const dotsWrap = document.getElementById('dots');
  let dots = [];
  if(dotsWrap){
    dots = panels.map((p,idx)=>{
      const b=document.createElement('button');
      b.type='button';
      b.setAttribute('aria-label','Trang '+(idx+1));
      b.addEventListener('click',()=>{ goTo(idx); });
      dotsWrap.appendChild(b);
      return b;
    });
  }

  let vw = window.innerWidth;
  let current = 0;       // px (smoothed)
  let target  = 0;       // px
  const maxT  = () => (N-1)*vw;

  /* ---------- active panel handling ---------- */
  let activeIdx = -1;
  function setActive(i){
    if(i===activeIdx) return;
    activeIdx = i;
    panels.forEach((p,idx)=>p.classList.toggle('is-active', idx===i));
    if(pageNum) pageNum.textContent = String(i+1).padStart(2,'0');
    dots.forEach((d,idx)=>d.classList.toggle('on', idx===i));
  }

  /* ---------- render loop ---------- */
  const cx = window.innerWidth/2;
  function render(){
    current += (target-current)*0.085;
    if(Math.abs(target-current)<0.4) current=target;
    track.style.transform = `translate3d(${-current}px,0,0)`;

    // parallax of inner layers + subtle outgoing transform
    panels.forEach((p,idx)=>{
      const panelCenter = idx*vw - current + vw/2;
      const off = (panelCenter - vw/2);          // px from viewport center
      const norm = off / vw;                      // -1..1 per panel away
      const inner = p.querySelector('.panel__inner');
      if(inner){
        inner.style.transform = `translateX(${ -norm*34 }px)`;
        inner.style.opacity = String(Math.max(0, 1 - Math.abs(norm)*0.55));
      }
      p.querySelectorAll('[data-depth]').forEach(el=>{
        const d = parseFloat(el.dataset.depth);
        el.style.transform = `translate3d(${ -norm*d*60 }px,0,0)`;
      });
    });

    setActive(Math.round(current/vw));
    requestAnimationFrame(render);
  }

  /* ---------- navigation ---------- */
  function clamp(v){return Math.max(0,Math.min(maxT(),v));}
  function goTo(i){ target = clamp(i*vw); }
  function pageOf(px){ return Math.round(px/vw); }   // committed page index
  function next(){ goTo(pageOf(target)+1); }
  function prev(){ goTo(pageOf(target)-1); }

  /* wheel / trackpad: commit exactly one page per gesture, immune to momentum.
     A trackpad swipe makes the OS emit a ~1s tail of decaying wheel events.
     Accumulating that tail into a free target overshot the page, then the
     late re-snap yanked it back — the visible stutter. We step once, then
     swallow the rest of the tail until the wheel goes quiet. */
  let wheelLock=false, wheelAccum=0, wheelIdle=null;
  const STEP=40;                                     // px of intent per step
  window.addEventListener('wheel',(e)=>{
    e.preventDefault();
    const d = Math.abs(e.deltaY)>Math.abs(e.deltaX)? e.deltaY : e.deltaX;
    clearTimeout(wheelIdle);
    wheelIdle=setTimeout(()=>{ wheelLock=false; wheelAccum=0; },120); // gesture end
    if(wheelLock) return;                            // ignore momentum tail
    wheelAccum+=d;
    if(Math.abs(wheelAccum)>=STEP){
      const dir = wheelAccum>0 ? 1 : -1;
      wheelLock=true; wheelAccum=0;
      dir>0 ? next() : prev();
    }
  },{passive:false});

  /* keyboard */
  window.addEventListener('keydown',(e)=>{
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();next();}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();prev();}
    else if(e.key==='Home'){goTo(0);} else if(e.key==='End'){goTo(N-1);}
  });

  /* mouse drag-to-scrub (desktop only). Touch devices use the touch handlers
     below — binding both made pointer + touch fight over `target` and jitter. */
  const ring=document.getElementById('cur-ring');
  if(!isTouch){
    let dragging=false,startX=0,startT=0;
    window.addEventListener('pointerdown',(e)=>{
      if(e.target.closest('a,button,.next-arrow')) return;
      dragging=true;startX=e.clientX;startT=target;
      if(ring) ring.classList.add('drag');
    });
    window.addEventListener('pointermove',(e)=>{
      if(!dragging) return;
      target=clamp(startT - (e.clientX-startX)*1.6);
    });
    const endDrag=()=>{
      if(!dragging) return;
      dragging=false;
      if(ring) ring.classList.remove('drag');
      target = clamp(Math.round(target/vw)*vw);
    };
    window.addEventListener('pointerup',endDrag);
    window.addEventListener('pointercancel',endDrag);
  }

  /* touch swipe (mobile / tablet) */
  if(isTouch){
    let tsX=0,tsT=0;
    window.addEventListener('touchstart',(e)=>{tsX=e.touches[0].clientX;tsT=target;},{passive:true});
    window.addEventListener('touchmove',(e)=>{
      const dx=e.touches[0].clientX-tsX;target=clamp(tsT-dx*1.4);
    },{passive:true});
    window.addEventListener('touchend',()=>{target=clamp(Math.round(target/vw)*vw);});
  }

  /* arrow + nav + page pill clicks */
  arrow && arrow.addEventListener('click',()=>{ activeIdx>=N-1?goTo(0):next(); });
  document.querySelectorAll('[data-goto]').forEach(el=>{
    el.addEventListener('click',(e)=>{e.preventDefault();goTo(parseInt(el.dataset.goto,10));});
  });

  /* gallery lightbox */
  const lb=document.getElementById('lightbox');
  const lbImg=lb&&lb.querySelector('img');
  function closeLb(){ if(lb){lb.classList.remove('on');lb.setAttribute('aria-hidden','true');} }
  if(lb){
    document.querySelectorAll('.gal .cover-img, .case__media .cover-img, .evwall .cover-img').forEach(img=>{
      img.style.cursor='none';
      img.addEventListener('click',(e)=>{e.stopPropagation();lbImg.src=img.currentSrc||img.src;lb.classList.add('on');lb.setAttribute('aria-hidden','false');});
    });
    lb.addEventListener('click',closeLb);
    document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeLb(); });
  }

  /* video player modal */
  const vlb=document.getElementById('vlightbox');
  const vframe=vlb&&vlb.querySelector('.vframe');
  let ytPlayer=null;

  /* YouTube IFrame API (lets us request 1080p up front) */
  let ytReady=false; const ytQueue=[];
  window.onYouTubeIframeAPIReady=function(){ ytReady=true; ytQueue.splice(0).forEach(fn=>fn()); };
  (function(){ const s=document.createElement('script'); s.src='https://www.youtube.com/iframe_api'; document.head.appendChild(s); })();

  function forceHD(p){ try{ p.setPlaybackQuality('hd1080'); }catch(_){} }
  function destroyYT(){ if(ytPlayer){ try{ ytPlayer.destroy(); }catch(_){} ytPlayer=null; } }

  function closeVlb(){
    if(!vlb) return;
    vlb.classList.remove('on');
    vlb.setAttribute('aria-hidden','true');
    destroyYT();
    vframe.innerHTML='';            // stop playback
  }
  function openYT(id){
    destroyYT();
    vframe.innerHTML='<div id="ytmount"></div>';
    vlb.classList.add('on'); vlb.setAttribute('aria-hidden','false');
    const make=()=>{
      ytPlayer=new YT.Player('ytmount',{
        width:'100%',height:'100%',videoId:id,
        playerVars:{autoplay:1,rel:0,modestbranding:1,playsinline:1},
        events:{
          onReady:e=>{ forceHD(e.target); e.target.playVideo(); },
          onStateChange:e=>{ if(e.data===YT.PlayerState.PLAYING) forceHD(e.target); }
        }
      });
    };
    if(ytReady) make(); else ytQueue.push(make);
  }
  function openVlb(url){
    if(!vlb||!url) return;
    const yt=url.match(/youtube\.com\/embed\/([^?&]+)/);
    if(yt){ openYT(yt[1]); return; }
    destroyYT();
    vframe.innerHTML='<iframe src="'+url+'" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
    vlb.classList.add('on');
    vlb.setAttribute('aria-hidden','false');
  }
  if(vlb){
    document.querySelectorAll('.vidcard[data-embed]').forEach(card=>{
      const url=card.getAttribute('data-embed');
      card.querySelectorAll('a').forEach(a=>{
        a.addEventListener('click',(e)=>{ e.preventDefault(); openVlb(url); });
      });
    });
    vlb.addEventListener('click',(e)=>{ if(e.target===vlb||e.target.classList.contains('lb-close')||e.target.classList.contains('vplayer')) closeVlb(); });
    document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeVlb(); });
  }

  window.addEventListener('resize',()=>{
    vw=window.innerWidth;
    target=clamp(Math.round(activeIdx)*vw);
    current=target;
  });

  /* ============================================================
     Custom cursor
     ============================================================ */
  if(!isTouch){
    const dot=document.getElementById('cur-dot');
    let mx=cx,my=window.innerHeight/2,rx=mx,ry=my;
    window.addEventListener('pointermove',(e)=>{mx=e.clientX;my=e.clientY;
      dot.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`;});
    (function cur(){rx+=(mx-rx)*0.18;ry+=(my-ry)*0.18;
      ring.style.transform=`translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(cur);})();
    document.addEventListener('pointerover',(e)=>{
      if(e.target.closest('a,button,.next-arrow,[data-cursor],.frame,.pcircle'))
        ring.classList.add('hot'); 
    });
    document.addEventListener('pointerout',(e)=>{
      if(e.target.closest('a,button,.next-arrow,[data-cursor],.frame,.pcircle'))
        ring.classList.remove('hot');
    });
  }

  /* ============================================================
     Intro loader  →  curtain reveal  →  start
     ============================================================ */
  function startSite(){
    setActive(0);
    requestAnimationFrame(render);
  }
  function bootReveal(){
    document.body.classList.add('booting');
    startSite();              // reveals hero text (is-active), starts render loop
    // after the text has settled, bloom the surroundings open
    setTimeout(()=>{
      document.body.classList.remove('booting');   // images + chrome ease in
    },1750);
  }

  function boot(){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){
      document.body.classList.remove('booting');
      startSite();
    } else {
      setTimeout(bootReveal,140);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

  /* debug / programmatic hooks */
  window.__spa = {
    goTo,
    jump:(i)=>{ target=clamp(i*vw); current=target; },
    next, prev,
    get index(){ return activeIdx; }
  };
})();
