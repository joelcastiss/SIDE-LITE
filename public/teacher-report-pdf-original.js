/* Browser PDF renderer based on the supplied SIDE Word/PDF template. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SIDE_TEACHER_PDF=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const BLUE='#17365D',LIGHT='#D9EAF7',GRAY='#F2F2F2',BORDER='#D9D9D9';
  const numeric=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
  const text=value=>String(value??'').replace(/[\u0000-\u001f]/g,' ').trim();
  const SIDE_NAME='Simulador Interactivo de Decisiones Empresariales';
  function cycleLabel(report,config={}){
    const current=numeric(report.ronda??config.round),total=numeric(config.cycles);
    return `${current>0?Math.trunc(current):1}/${total>0?Math.trunc(total):'—'}`;
  }
  function money(value){
    const n=numeric(value);
    if(n===null)return 'Sin datos';
    const amount='S/ '+Math.abs(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
    return n<0?'('+amount+')':amount;
  }
  const expense=value=>numeric(value)===null?null:-Math.abs(Number(value));
  function combined(a,b){
    return numeric(a)===null&&numeric(b)===null?null:(numeric(a)??0)+(numeric(b)??0);
  }
  function decisionStatus(report){
    const sections=Object.values(report.apartados||{}).filter(s=>numeric(s.total)!==null);
    const total=sections.reduce((n,s)=>n+Math.max(0,Number(s.total)),0);
    const done=sections.reduce((n,s)=>n+Math.min(Math.max(0,Number(s.done)||0),Math.max(0,Number(s.total))),0);
    if(total)return `${done} de ${total} decisiones obligatorias completadas`;
    return numeric(report.progreso)!==null?`${report.progreso}% de avance de decisiones obligatorias`:'Sin datos de decisiones obligatorias';
  }
  function reportData(r,grade){
    const er=r.estadoResultados||{},bc=r.balanceCaja||{},fc=r.flujoCaja||{},bg=r.balanceGeneral||bc.balanceGeneral||{};
    const values={
      sales:er.ventasNetas??er.ingresos??r.ingresos,profit:er.utilidad??r.utilidad,
      cash:bc.cajaFinal??fc.cajaFinal??r.caja,assets:bg.activos,debt:bg.deuda,equity:bg.patrimonio
    };
    const score=numeric(grade);
    return {
      ...values,grade:score===null?'Sin calificar':score.toLocaleString('es-PE')+' / 20',
      decisions:decisionStatus(r),
      statements:[
        ['3. Estado de resultados',[
          ['Ventas netas',values.sales],['(-) Costo de ventas',er.costoVentas],
          ['(=) Utilidad bruta',er.utilidadBruta,true],['(-) Gastos de operación',er.gastosOperacion],
          ['a. Gastos administrativos',er.gastosAdministrativos],['b. Gastos de ventas',er.gastosVentas],
          ['(=) Utilidad operativa',er.utilidadOperativa,true],['(+) Ingresos financieros',er.ingresosFinancieros],
          ['(-) Gastos financieros',er.gastosFinancieros],['(=) Utilidad antes de impuestos',er.utilidadAntesImpuestos,true],
          ['(-) Impuesto a la renta',er.impuestoRenta],['(=) Utilidad neta',er.utilidadNeta??er.utilidad??r.utilidad,true]
        ]],
        ['4. Balance de caja',[
          ['Caja inicial',bc.cajaInicial??fc.cajaInicial??r.capital],['Entradas',bc.entradas],
          ['Salidas',expense(bc.salidas)],['Caja final',values.cash,true]
        ],'Caja inicial + entradas - salidas = caja final.'],
        ['5. Flujo de caja',[
          ['Flujo de operación',fc.operacion],['Flujo de inversión',fc.inversion],
          ['Flujo de financiamiento',fc.financiamiento],['Flujo neto',fc.flujoNeto,true]
        ],'Flujo neto = variación de caja del ciclo.'],
        ['6. Balance general',[
          ['Efectivo',bg.efectivo??values.cash],['Cuentas por cobrar',bg.cuentasPorCobrar],['Inventarios',bg.inventarios],['Activos fijos',bg.activosFijos],
          ['Total de activos',values.assets,true],['Deuda',values.debt],['Impuestos por pagar',bg.impuestosPorPagar],['Intereses por pagar',bg.interesesPorPagar],['Provisión por garantías',bg.provisionGarantias],['Patrimonio',values.equity],
          ['Total de pasivo más patrimonio',bg.pasivoPatrimonio,true]
        ],'Total de activos = total de pasivo más patrimonio.']
      ]
    };
  }
  function create({jsPDF,reports,config={},gradeValue=r=>r.teacherScore,logo=null,generatedAt=new Date()}){
    const active=(reports||[]).filter(r=>r.estado!=='eliminada');
    if(!active.length)throw new Error('No hay empresas activas con resultados para descargar.');
    if(typeof jsPDF!=='function')throw new Error('No se pudo cargar el generador PDF. Recarga la página e inténtalo de nuevo.');
    const doc=new jsPDF({unit:'pt',format:'a4',orientation:'portrait'});
    doc.setProperties({title:'SIDE - Informe financiero y académico',subject:text(config.nombre),author:'SIDE',creator:'SIDE'});
    const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
    const left=51,tableWidth=width-102,bottom=height-66,top=64,pages=[];
    let y=top,currentReport=null;
    const date=new Date(generatedAt).toLocaleDateString('es-PE',{timeZone:'America/Lima'});
    function font(size=10,bold=false,color='#222222'){
      doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);
    }
    function registerPage(){pages.push({cycle:cycleLabel(currentReport,config)});}
    function newPage(){doc.addPage();y=top;registerPage();}
    function ensure(space){if(y+space>bottom)newPage();}
    function heading(title){font(12,true,BLUE);doc.text(title,left,y+12);y+=20;}
    function note(value){
      font(8,false,'#666666');const lines=doc.splitTextToSize(text(value),tableWidth);
      ensure(lines.length*10+4);doc.text(lines,left,y+9);y+=lines.length*10+4;
    }
    function wrapped(value,cellWidth,size,bold){font(size,bold);return doc.splitTextToSize(text(value)||'—',cellWidth-12);}
    // Titles and headers accompany the first row; every continuation repeats both.
    // Ordinary rows move intact. An exceptionally long cell continues in bounded chunks.
    function table(title,headers,widths,rows,{size=10,minHeight=19}={}){
      const headerLines=(headers||[]).map((h,i)=>wrapped(h,widths[i],size,true));
      const headerHeight=headers?Math.max(minHeight,Math.max(...headerLines.map(a=>a.length))*size*1.15+8):0;
      function prepare(row){
        const cells=row.cells.map((c,i)=>wrapped(c,widths[i],size,row.bold||row.labels?.includes(i)));
        return {row,cells,height:Math.max(minHeight,Math.max(...cells.map(a=>a.length))*size*1.15+8)};
      }
      function draw(cells,h,row,isHeader=false){
        let x=left;
        for(let i=0;i<widths.length;i++){
          const fill=isHeader?BLUE:row.total?LIGHT:row.labels?.includes(i)?GRAY:row.shade||'#FFFFFF';
          doc.setFillColor(fill);doc.setDrawColor(BORDER);doc.setLineWidth(0.35);doc.rect(x,y,widths[i],h,'FD');
          const negative=row.negative?.includes(i);
          font(size,isHeader||row.bold||row.labels?.includes(i),isHeader?'#FFFFFF':negative?'#A92318':row.labels?.includes(i)?BLUE:'#222222');
          const right=row.right?.includes(i),center=isHeader&&headers.length>2||row.center?.includes(i);
          const tx=right?x+widths[i]-6:center?x+widths[i]/2:x+6;
          const ty=y+(h-cells[i].length*size*1.15)/2+size*.9;
          doc.text(cells[i],tx,ty,{align:right?'right':center?'center':'left',lineHeightFactor:1.15});
          x+=widths[i];
        }
        y+=h;
      }
      const prepared=rows.map(prepare);
      ensure(22+headerHeight+Math.min(prepared[0]?.height||minHeight,bottom-top-22-headerHeight));
      heading(title);
      if(headers)draw(headerLines,headerHeight,{},true);
      for(const item of prepared){
        if(y+item.height>bottom){newPage();heading(title+' (continuación)');if(headers)draw(headerLines,headerHeight,{},true);}
        let cells=item.cells;
        while(true){
          const maxLines=Math.floor((bottom-y-8)/(size*1.15));
          const lineCount=Math.max(...cells.map(a=>a.length));
          const take=Math.min(lineCount,maxLines);
          const part=cells.map(a=>a.slice(0,take));
          draw(part,Math.max(minHeight,take*size*1.15+8),item.row);
          if(take>=lineCount)break;
          cells=cells.map(a=>a.slice(take));newPage();heading(title+' (continuación)');if(headers)draw(headerLines,headerHeight,{},true);
        }
      }
      y+=6;
    }
    function financial(section){
      const [title,entries,formula]=section;
      // Compact statements stay together, including their explanatory formula.
      ensure(20+19.5*(entries.length+1)+6+(formula?14:0));
      table(title,['Concepto','Importe'],[tableWidth*.72,tableWidth*.28],entries.map(([label,value,total])=>({
        cells:[label,money(value)],total,bold:!!total,right:[1],negative:numeric(value)<0?[1]:[]
      })));
      if(formula)note('Relación contable: '+formula);
    }
    for(const [index,r] of active.entries()){
      currentReport=r;
      if(index)newPage();else registerPage();
      const firstPage=doc.getNumberOfPages();
      const data=reportData(r,gradeValue(r));
      // Same title block and institutional palette as the supplied template.
      if(logo){
        const properties=doc.getImageProperties(logo),boxW=90,boxH=50;
        const scale=Math.min(boxW/properties.width,boxH/properties.height);
        doc.addImage(logo,'PNG',left+(boxW-properties.width*scale)/2,y,properties.width*scale,properties.height*scale);
      }else{font(22,true,BLUE);doc.text('SIDE',left,y+29);}
      font(17,true,BLUE);
      const title=doc.splitTextToSize('INFORME FINANCIERO Y ACADÉMICO',tableWidth-105);
      doc.text(title,width-left,y+14,{align:'right',lineHeightFactor:1.15});
      y+=Math.max(40,title.length*20+3);
      font(10,false,BLUE);doc.text('Proyecto Side - '+SIDE_NAME,width-left,y+7,{align:'right'});
      y+=18;
      const identity=[];
      identity.push(
        {cells:['Nombre comercial',r.empresa||'Sin datos','Razón social',r.legalName||'Sin datos'],labels:[0,2]},
        {cells:['Código de partida',config.codigo||r.partida||'—','Ciclo evaluado',cycleLabel(r,config)],labels:[0,2]},
        {cells:['Fecha de generación',date,'Nota del docente',data.grade],labels:[0,2]}
      );
      table('1. Identificación',null,[112,tableWidth/2-112,100,tableWidth/2-100],identity,{size:9,minHeight:23});
      if(text(config.docente))note('Docente: '+text(config.docente));
      if(text(config.nombre)||text(config.curso))note([text(config.nombre),text(config.curso)].filter(Boolean).join(' · '));
      if(r.provisional)note('Estimación individual del ciclo en juego. El reparto definitivo de ventas se consolida al cierre.');
      const summary=[data.sales,data.profit,data.cash,data.assets,data.debt,data.equity];
      table('2. Resumen de resultados',['Ventas netas','Utilidad del ciclo','Caja final','Total de activos','Deuda','Patrimonio'],Array(6).fill(tableWidth/6),[
        {cells:summary.map(money),bold:true,center:[0,1,2,3,4,5],negative:summary.map((n,i)=>numeric(n)<0?i:-1).filter(i=>i>=0)}
      ],{size:8,minHeight:23});
      data.statements.slice(0,3).forEach(financial);
      if(doc.getNumberOfPages()===firstPage)newPage();
      financial(data.statements[3]);
      const events=Array.isArray(r.eventos)?r.eventos:[];
      const eventRows=events.length?events.map((e,i)=>({cells:[
        [text(e.titulo),text(e.descripcion)].filter(Boolean).join(': ')||'Evento',e.afectados||'—',
        e.cicloAfecta??e.ciclos??'—',e.implicancia||'—',numeric(e.ocurrencia)===null?'Sin datos':e.ocurrencia+'%'
      ],shade:i%2?GRAY:'#FFFFFF',center:[2,4]})):[{cells:['Sin eventos reportados','—','—','—','—'],shade:GRAY}];
      table('7. Eventos de la simulación',['Descripción','Afectados','Ciclos afectados','Implicancia','Probabilidad'],[tableWidth*.29,tableWidth*.17,tableWidth*.13,tableWidth*.26,tableWidth*.15],eventRows,{size:8.5,minHeight:23});
      const academic=[{cells:['Estado de decisiones obligatorias',data.decisions],labels:[0]},{cells:['Nota del docente',data.grade],labels:[0]}];
      if(text(r.observacionesDocente))academic.push({cells:['Observaciones del profesor',r.observacionesDocente],labels:[0]});
      table('8. Evaluación académica',null,[tableWidth/2,tableWidth/2],academic,{size:9,minHeight:23});
    }
    const count=doc.getNumberOfPages();
    for(let i=1;i<=count;i++){
      doc.setPage(i);font(8,true,BLUE);doc.text('SIDE | Informe financiero y académico',left,36);
      font(8,false,'#666666');doc.text(`${text(config.codigo)||'SIDE'} · Ciclo ${pages[i-1].cycle}`,width-left,36,{align:'right'});
      doc.setDrawColor(BORDER);doc.setLineWidth(.5);doc.line(left,43,width-left,43);doc.line(left,height-43,width-left,height-43);
      font(7.5,false,'#666666');doc.text('SIDE - '+SIDE_NAME,left,height-31);
      doc.text('Documento generado por la plataforma',width/2,height-20,{align:'center'});
      doc.text(`Página ${i} de ${count}`,width-left,height-31,{align:'right'});
    }
    return doc;
  }
  return Object.freeze({create,money,reportData,decisionStatus,cycleLabel});
});
