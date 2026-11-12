import { test, expect } from '@playwright/test';
import path from 'node:path';

async function fixture(page, supported = true) {
  await page.setContent(`<div id="screen" class="hidden"><div id="cards"><div data-panel="quality"><button data-value="basic"><span class="bag-stage no-webgl" data-bag="basica"><canvas></canvas><span class="bag-fallback">▱</span></span></button><button data-value="standard"><span class="bag-stage no-webgl" data-bag="media"><canvas></canvas><span class="bag-fallback">▱</span></span></button><button data-value="premium"><span class="bag-stage no-webgl" data-bag="premium"><canvas></canvas><span class="bag-fallback">▱</span></span></button></div></div></div>`);
  await page.evaluate(supported => {
    window.stats = {mounted:0, disposed:0, active:0};
    window.SideBags = {supported: () => supported, mount: () => { window.stats.mounted++; window.stats.active++; return {setActive(){}, resize(){}, spin(){}, dispose(){window.stats.disposed++; window.stats.active--;}}; }};
  }, supported);
  await page.addScriptTag({path:path.resolve('public/js/lite-bag-views.js')});
  await page.evaluate(() => { window.bags = SIDELiteBagViews.create(document.querySelector('#screen'),document.querySelector('#cards')); });
}

test('libera todos los visores al cambiar de pestaña 30 veces', async ({page}) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const screen=document.querySelector('#screen'), panel=document.querySelector('[data-panel=quality]');
    screen.classList.remove('hidden');
    for(let i=0;i<30;i++){ panel.hidden=false; bags.sync(); panel.hidden=true; bags.sync(); }
    bags.dispose(); return stats;
  });
  expect(result).toEqual({mounted:90, disposed:90, active:0});
});

test('muestra el respaldo cuando WebGL no está disponible', async ({page}) => {
  await fixture(page, false);
  await page.evaluate(() => {document.querySelector('#screen').classList.remove('hidden');bags.sync();});
  await expect(page.locator('.bag-stage.no-webgl')).toHaveCount(3);
  expect(await page.evaluate(() => stats.mounted)).toBe(0);
});

test('WebGL real libera los contextos tras 30 cambios', async ({page}) => {
  test.setTimeout(180000);
  await fixture(page);
  await page.addScriptTag({path:path.resolve('public/vendor/side-bags/three.min.js')});
  await page.addScriptTag({path:path.resolve('public/js/bag-viewer.js')});
  const supported = await page.evaluate(() => SideBags.supported());
  test.skip(!supported, 'WebGL no está disponible en este navegador');
  const warnings=[]; page.on('console', message => { if (/Too many active WebGL contexts/i.test(message.text())) warnings.push(message.text()); });
  const result = await page.evaluate(async () => {
    const original=SideBags.mount;
    const stats={created:0,disposed:0,active:0};
    const contexts=[];
    SideBags.mount=(canvas,key,opts)=>{
      const view=original(canvas,key,opts), context=canvas.getContext('webgl2') || canvas.getContext('webgl');
      contexts.push(context);stats.created++;stats.active++;
      return {...view, dispose(){view.dispose();stats.disposed++;stats.active--;}};
    };
    const screen=document.querySelector('#screen'), panel=document.querySelector('[data-panel=quality]');
    screen.classList.remove('hidden');
    for(let i=0;i<30;i++){
      panel.hidden=false;bags.sync();panel.hidden=true;bags.sync();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    bags.dispose();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {...stats,lost:contexts.filter(context=>context.isContextLost()).length};
  });
  expect(result).toEqual({created:90,disposed:90,active:0,lost:90});
  await page.evaluate(() => {
    document.querySelectorAll('.bag-stage').forEach(stage => Object.assign(stage.style,{display:'inline-block',width:'120px',height:'140px'}));
    window.renderedBags = new Set();
    THREE.WebGLRenderer = new Proxy(THREE.WebGLRenderer, {construct(target,args) {
      const renderer=Reflect.construct(target,args), render=renderer.render.bind(renderer), canvas=renderer.domElement;
      renderer.render=(...renderArgs)=>{
        render(...renderArgs);
        if (window.renderedBags.has(canvas)) return;
        const gl=renderer.getContext(), pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        if (pixels.some((value,index)=>index%4===3 && value>0)) window.renderedBags.add(canvas);
      };
      return renderer;
    }});
    bags=SIDELiteBagViews.create(document.querySelector('#screen'),document.querySelector('#cards'));
    document.querySelector('[data-panel=quality]').hidden=false; bags.sync();
  });
  await expect.poll(() => page.evaluate(() => window.renderedBags.size),{timeout:15000}).toBe(3);
  await page.evaluate(() => bags.dispose());
  expect(warnings).toEqual([]);
});

