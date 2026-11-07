export const CAMPAIGNS = Object.freeze([
  {min:0,max:0,icon:'○',name:'Sin publicidad',range:'S/ 0',description:'Este ciclo venderás sin invertir en anuncios.',message:'Tu tienda sigue abierta.'},
  {min:200,max:1000,icon:'✦',name:'Publicaciones en redes',range:'S/ 200–1.000',description:'Da a conocer tus bolsos con publicaciones en Instagram y Facebook.',message:'Empieza a mostrar tu tienda.'},
  {min:1001,max:1999,icon:'▶',name:'Publicaciones y videos cortos',range:'S/ 1.001–1.999',description:'Publica historias y videos breves para llegar a más clientes.',message:'Cuenta más sobre tus bolsos.'},
  {min:2000,max:4999,icon:'▷',name:'Campaña con videos',range:'S/ 2.000–4.999',description:'Promociona tus bolsos con videos y anuncios dirigidos a clientes potenciales.',message:'Muestra lo que hace especial a tu tienda.'},
  {min:5000,max:7999,icon:'◎',name:'Campaña de mayor alcance',range:'S/ 5.000–7.999',description:'Difunde tu tienda en varias redes sociales para atraer más compradores.',message:'Llega a nuevas personas.'},
  {min:8000,max:10000,icon:'✺',name:'Campaña digital intensiva',range:'S/ 8.000–10.000',description:'Combina videos, anuncios y difusión amplia para posicionar tu tienda.',message:'Haz visible tu marca.'}
]);
export function campaignFor(amount){return Number.isSafeInteger(amount)?CAMPAIGNS.find(c=>amount>=c.min&&amount<=c.max)??null:null}
export function eventDescription(event){if(!event)return 'Este ciclo no tiene un evento especial.';if(event.purchase)return event.purchase<1?`Comprar bolsos cuesta ${Math.round((1-event.purchase)*100)} % menos este ciclo.`:`Comprar bolsos cuesta ${Math.round((event.purchase-1)*100)} % más este ciclo.`;return event.demand<1?`La demanda potencial baja ${Math.round((1-event.demand)*100)} % este ciclo.`:`La demanda potencial sube ${Math.round((event.demand-1)*100)} % este ciclo.`}
