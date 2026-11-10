(function(){
  const cleanups=new WeakMap();
  window.stopSIDETutorial=function(root){if(root)cleanups.get(root)?.()};
  window.initSIDETutorial=function(onFinish,options={}){
    const root=options.root||document.querySelector('.tutorial-shell');
    if(!root)return;
    const find=name=>root.querySelector(`[id$="${name}"]`),track=find('tutorialTrack'),slides=Array.from(root.querySelectorAll('.tutorial-slide')),prev=find('tutorialPrev'),next=find('tutorialNext'),dots=find('tutorialDots'),progress=find('tutorialProgressFill'),current=find('tutorialCurrent'),continueBtn=find('tutorialContinue');
    if(!track||!slides.length||!prev||!next||!dots)return;
    window.stopSIDETutorial(root);
    let index=0,timer=null,finishTimer=null,touchPaused=false;const AUTO_DELAY=7000,loop=Boolean(options.loop);
    dots.innerHTML=slides.map((_,i)=>`<button type="button" class="tutorial-dot${i===0?' active':''}" aria-label="Ir a la diapositiva ${i+1}" data-slide="${i}"></button>`).join('');const dotButtons=Array.from(dots.querySelectorAll('.tutorial-dot'));
    function render(){track.style.transform=`translate3d(-${index*100}%,0,0)`;slides.forEach((s,i)=>s.classList.toggle('active',i===index));dotButtons.forEach((d,i)=>{d.classList.toggle('active',i===index);d.setAttribute('aria-current',i===index?'step':'false')});if(current)current.textContent=String(index+1);if(progress)progress.style.width=`${((index+1)/slides.length)*100}%`;prev.disabled=!loop&&index===0;next.disabled=!loop&&index===slides.length-1;continueBtn?.classList.toggle('hidden',loop||index!==slides.length-1)}
    function stop(){if(timer!==null){clearTimeout(timer);timer=null}}
    function schedule(){stop();if(touchPaused||(!loop&&index>=slides.length-1))return;timer=setTimeout(()=>{index=(index+1)%slides.length;render();schedule()},AUTO_DELAY)}
    function go(value){index=loop?(value+slides.length)%slides.length:Math.max(0,Math.min(slides.length-1,value));render();schedule()}
    function finish(){if(loop||index!==slides.length-1)return;stop();root.classList.add('tutorial-leaving');finishTimer=setTimeout(()=>{root.classList.remove('tutorial-leaving');if(typeof onFinish==='function')onFinish()},260)}
    const onPrev=()=>go(index-1),onNext=()=>go(index+1),onContinue=()=>finish();prev.addEventListener('click',onPrev);next.addEventListener('click',onNext);continueBtn?.addEventListener('click',onContinue);const onDot=e=>{const button=e.target.closest('.tutorial-dot');if(button&&dots.contains(button))go(Number(button.dataset.slide))};dots.addEventListener('click',onDot);
    const onKey=e=>{if(root.closest('.screen')?.classList.contains('hidden'))return;if(e.target.closest('input,textarea,select'))return;if(e.key==='ArrowLeft'){e.preventDefault();onPrev()}if(e.key==='ArrowRight'){e.preventDefault();onNext()}};document.addEventListener('keydown',onKey);let touchStartX=0;const onTouchStart=e=>{touchStartX=e.changedTouches[0].screenX;touchPaused=true;stop()},onTouchEnd=e=>{const diff=e.changedTouches[0].screenX-touchStartX;if(Math.abs(diff)>45)go(diff>0?index-1:index+1);touchPaused=false;schedule()},onTouchCancel=()=>{touchPaused=false;schedule()};root.addEventListener('touchstart',onTouchStart,{passive:true});root.addEventListener('touchend',onTouchEnd,{passive:true});root.addEventListener('touchcancel',onTouchCancel,{passive:true});
    const cleanup=()=>{stop();clearTimeout(finishTimer);root.classList.remove('tutorial-leaving');prev.removeEventListener('click',onPrev);next.removeEventListener('click',onNext);continueBtn?.removeEventListener('click',onContinue);dots.removeEventListener('click',onDot);document.removeEventListener('keydown',onKey);root.removeEventListener('touchstart',onTouchStart);root.removeEventListener('touchend',onTouchEnd);root.removeEventListener('touchcancel',onTouchCancel);cleanups.delete(root)};cleanups.set(root,cleanup);render();schedule();return cleanup;
  };
})();
