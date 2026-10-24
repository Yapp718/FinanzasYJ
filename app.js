import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,setPersistence,browserLocalPersistence,browserSessionPersistence,sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,addDoc,deleteDoc,updateDoc,doc,query,where,onSnapshot,serverTimestamp,writeBatch} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app=initializeApp({apiKey:"AIzaSyC3I5cu-iP8rWFX2UM4n2PSZJIoIzglChA",authDomain:"finanzas-yj.firebaseapp.com",projectId:"finanzas-yj",storageBucket:"finanzas-yj.firebasestorage.app",messagingSenderId:"597103618710",appId:"1:597103618710:web:b3090f10ca1e7fff59b0b7"}), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const SEC=[{k:"ingreso",n:"Ingresos"},{k:"factura",n:"Facturas",g:1},{k:"fijo",n:"Gastos fijos",g:1},
 {k:"variable",n:"Gastos variables",g:1},{k:"deuda",n:"Pago de deuda",g:1},{k:"ahorro",n:"Ahorros"},{k:"inversion",n:"Inversiones / Donaciones"}];
const GASTOS=["factura","fijo","variable","deuda"];
const money=n=>$("mon").value+(n||0).toLocaleString("es-CO",{maximumFractionDigits:2});
const sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let uid=null,unsub=null,rows=[],all=[],charts={},editId=null,editSec=null,ANUAL=null,metas=[],unsubM=null;

function applyPres(){
  const on=$("usePres").checked;
  $("ffp").classList.toggle("no-pres",!on);
  try{localStorage.setItem("usePres",on?"1":"0");}catch(e){}
}
try{$("usePres").checked=localStorage.getItem("usePres")!=="0";}catch(e){}
$("usePres").onchange=applyPres;applyPres();

$("mes").innerHTML=MESES.map((m,i)=>`<option value="${i+1}">${m}</option>`).join("");
$("mes").value=new Date().getMonth()+1;

$("grid").innerHTML=SEC.map(s=>`<div class="card" id="s_${s.k}"><h3>${s.n}</h3>
 <table><thead><tr><th>Concepto</th><th class="cp">Presup.</th><th>Actual</th>${s.g?"<th>Tipo</th>":""}${s.k!="ingreso"?"<th>Fecha</th><th>✔</th>":""}<th></th></tr></thead>
 <tbody></tbody><tfoot></tfoot></table>
 <div class="add"><input type="text" data-f="concepto" placeholder="Concepto">
 <input type="number" step="0.01" data-f="presupuesto" class="cp" placeholder="Presup.">
 <input type="number" step="0.01" data-f="actual" placeholder="Actual">
 ${s.g?'<select data-f="categoria"><option>Necesidades</option><option>Deseos</option></select>':""}
 ${s.k!="ingreso"?'<input type="date" data-f="fecha">':""}
 <button data-add="${s.k}">Agregar</button><button class="sec" data-cancel="${s.k}" style="display:none">Cancelar</button></div></div>`).join("");

const msg=e=>({"auth/invalid-credential":"Correo o contraseña incorrectos","auth/email-already-in-use":"Ese correo ya está registrado","auth/weak-password":"Contraseña muy corta (mín. 6)","auth/invalid-email":"Correo no válido","auth/missing-password":"Escribe tu contraseña","auth/user-not-found":"No existe una cuenta con ese correo"}[e.code]||e.message);
const persist=()=>setPersistence(auth,$("remember").checked?browserLocalPersistence:browserSessionPersistence);
const say=t=>$("authErr").textContent=t;
$("btnLogin").onclick=async()=>{say("");try{await persist();await signInWithEmailAndPassword(auth,$("email").value,$("pass").value);}catch(e){say(msg(e));}};
$("btnReg").onclick=async e=>{e.preventDefault();say("");try{await persist();await createUserWithEmailAndPassword(auth,$("email").value,$("pass").value);}catch(x){say(msg(x));}};
$("forgot").onclick=async e=>{e.preventDefault();if(!$("email").value){say("Escribe tu correo y vuelve a pulsar");return;}
  try{await sendPasswordResetEmail(auth,$("email").value);say("Te enviamos un correo para restablecer tu contraseña");}catch(x){say(msg(x));}};
$("pass").onkeydown=e=>{if(e.key==="Enter")$("btnLogin").click();};
$("btnOut").onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{uid=u?u.uid:null;$("auth").style.display=u?"none":"flex";$("app").style.display=u?"block":"none";
  if(u){$("who").textContent=u.email;suscribir();suscribirMetas();}else{if(unsub)unsub();if(unsubM)unsubM();}});
$("anio").onchange=()=>{cancelEdit();if(uid)suscribir();};
$("mes").onchange=()=>{setSrc();cancelEdit();};
$("mon").oninput=()=>render();

function suscribir(){
  if(unsub)unsub();
  const q=query(collection(db,"users",uid,"movimientos"),where("anio","==",+$("anio").value));
  unsub=onSnapshot(q,s=>{all=s.docs.map(d=>({id:d.id,...d.data()}));render();},e=>$("err").textContent=e.message);
}
const ref=id=>doc(db,"users",uid,"movimientos",id);

const form=k=>$("s_"+k);
function resetForm(k){
  const c=form(k); if(!c)return;
  c.querySelectorAll("input").forEach(i=>i.value="");
  c.querySelectorAll("select").forEach(i=>i.selectedIndex=0);
  c.querySelector("[data-add]").textContent="Agregar";
  c.querySelector("[data-cancel]").style.display="none";
}
function cancelEdit(){if(editSec)resetForm(editSec);editId=null;editSec=null;render();}

$("grid").onclick=async e=>{
  const t=e.target.closest("button,input"); if(!t)return;
  const d=t.dataset;
  if(d.add){
    const k=d.add,c=form(k),v=f=>{const i=c.querySelector(`[data-f=${f}]`);return i?i.value:""};
    if(!v("concepto").trim()){$("err").textContent="Escribe un concepto";return;}
    $("err").textContent="";
    const data={concepto:v("concepto").trim(),presupuesto:+v("presupuesto")||0,actual:+v("actual")||0,fecha:v("fecha")||null};
    if(c.querySelector("[data-f=categoria]"))data.categoria=v("categoria");
    try{
      if(editId&&editSec===k){await updateDoc(ref(editId),data);editId=null;editSec=null;}
      else await addDoc(collection(db,"users",uid,"movimientos"),{seccion:k,...data,
        categoria:data.categoria||((k==="ahorro"||k==="inversion")?"Ahorros":"Necesidades"),
        pagado:false,anio:+$("anio").value,mes:+$("mes").value,creado:serverTimestamp()});
      resetForm(k);render();
    }catch(x){$("err").textContent=x.message;}
  }
  if(d.edit){
    const r=all.find(x=>x.id===d.edit); if(!r)return;
    if(editSec&&editSec!==r.seccion)resetForm(editSec);
    editId=r.id;editSec=r.seccion;
    const c=form(r.seccion),set=(f,val)=>{const i=c.querySelector(`[data-f=${f}]`);if(i)i.value=val};
    set("concepto",r.concepto);set("presupuesto",r.presupuesto||"");set("actual",r.actual||"");
    set("categoria",r.categoria);set("fecha",r.fecha||"");
    c.querySelector("[data-add]").textContent="Guardar cambios";
    c.querySelector("[data-cancel]").style.display="";
    c.querySelector("[data-f=concepto]").focus();
    render();
  }
  if(d.cancel)cancelEdit();
  if(d.del&&confirm("¿Eliminar?")){if(editId===d.del)cancelEdit();await deleteDoc(ref(d.del));}
  if(d.pay)await updateDoc(ref(d.pay),{pagado:t.checked});
};


function chart(id,type,labels,data,colors,title){
  if(!window.Chart)return;
  if(charts[id]){charts[id].data.labels=labels;charts[id].data.datasets[0].data=data;charts[id].update();return;}
  charts[id]=new Chart($(id),{type,data:{labels,datasets:[{data,backgroundColor:colors}]},
    options:{plugins:{legend:{display:type==="doughnut"},title:{display:true,text:title}}}});
}

function render(){
  rows=all.filter(r=>r.mes===+$("mes").value);
  $("cpDest").textContent=MESES[+$("mes").value-1];
  const by=k=>rows.filter(r=>r.seccion===k);
  SEC.forEach(s=>{
    const c=$("s_"+s.k), list=by(s.k).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));
    c.querySelector("tbody").innerHTML=list.map(r=>`<tr class="${r.id===editId?"editing":""}"><td>${esc(r.concepto)}</td><td class="cp">${money(r.presupuesto)}</td><td>${money(r.actual)}</td>
      ${s.g?`<td>${r.categoria}</td>`:""}${s.k!="ingreso"?`<td>${r.fecha||""}</td><td><input type="checkbox" data-pay="${r.id}" ${r.pagado?"checked":""}></td>`:""}
      <td style="white-space:nowrap"><button class="x ok" data-edit="${r.id}" title="Editar">✎</button><button class="x" data-del="${r.id}" title="Eliminar">✕</button></td></tr>`).join("");
    c.querySelector("tfoot").innerHTML=`<tr><td>TOTAL</td><td class="cp">${money(sum(list,"presupuesto"))}</td><td>${money(sum(list,"actual"))}</td><td colspan="4"></td></tr>`;
  });
  const gastos=rows.filter(r=>GASTOS.includes(r.seccion));
  const ingreso=sum(by("ingreso"),"actual"), gastado=sum(gastos,"actual"), ahorrado=sum(by("ahorro"),"actual")+sum(by("inversion"),"actual");
  const asignado=sum(rows.filter(r=>r.seccion!=="ingreso"),"presupuesto");
  const presIng=sum(by("ingreso"),"presupuesto"), restante=ingreso-gastado-ahorrado;
  $("kpis").innerHTML=[["Ingreso total",ingreso],["Total gastado",gastado],["Total ahorrado",ahorrado],
    ["Dinero restante",restante],["Presupuesto x asignar",presIng-asignado]]
    .map(([t,v])=>`<div class="kpi${t.startsWith("Presupuesto")?" cp":""}">${t}<b>${money(v)}</b></div>`).join("");

  const real={Necesidades:sum(gastos.filter(r=>r.categoria==="Necesidades"),"actual"),Deseos:sum(gastos.filter(r=>r.categoria==="Deseos"),"actual"),Ahorros:ahorrado};
  const ideal={Necesidades:.5,Deseos:.3,Ahorros:.2};
  $("rule").innerHTML="<table><tr><th>Categoría</th><th>% ideal</th><th>% real</th><th>Monto ideal</th></tr>"+Object.keys(ideal).map(k=>{
    const p=ingreso?real[k]/ingreso:0;
    return `<tr><td>${k}<div class="bar"><i style="width:${Math.min(100,p/ideal[k]*100)}%"></i></div></td><td>${ideal[k]*100}%</td><td>${(p*100).toFixed(1)}%</td><td>${money(ingreso*ideal[k])}</td></tr>`}).join("")+"</table>";

  $("resumen").innerHTML="<tr><th>Rubro</th><th class='cp'>Meta / ideal</th><th>Actual</th></tr>"+SEC.map(s=>
    `<tr><td>${s.n}</td><td class="cp">${money(sum(by(s.k),"presupuesto"))}</td><td>${money(sum(by(s.k),"actual"))}</td></tr>`).join("");

  chart("c1","bar",["Ingresos","Gastos"],[ingreso,gastado],["#2f855a","#c53030"],"Ingresos vs Gastos");
  chart("c2","doughnut",["Necesidades","Deseos","Ahorros"],[real.Necesidades,real.Deseos,real.Ahorros],["#1f4e79","#dd6b20","#2f855a"],"Gasto por categoría");
  chart("c3","bar",["Dinero restante","Asignado"],[restante,asignado],["#2f855a","#1f4e79"],"Estado del mes");
  anual();
}

function anual(){
  const lines=[],ing=[],gas=[];
  MESES.forEach((m,i)=>{
    const R=all.filter(r=>r.mes===i+1), sm=k=>sum(R.filter(r=>r.seccion===k),"actual");
    const v=[sm("ingreso"),sm("factura"),sm("fijo"),sm("variable"),sm("deuda"),sm("ahorro")+sm("inversion")];
    v.push(v[0]-v[1]-v[2]-v[3]-v[4]-v[5]);
    lines.push([m,...v]); ing.push(v[0]); gas.push(v[1]+v[2]+v[3]+v[4]);
  });
  const t=[1,2,3,4,5,6,7].map(j=>lines.reduce((a,l)=>a+l[j],0));
  ANUAL={lines,t};
  const aho=lines.map(l=>l[6]); let ac=0; const acum=aho.map(v=>ac+=v);
  lineChart("c5",MESES.map(m=>m.slice(0,3)),[{label:"Ahorrado en el mes",data:aho,color:"#2f855a"},{label:"Acumulado",data:acum,color:"#1f4e79"}],"Tendencia del ahorro");
  $("anual").innerHTML="<tr><th>Mes</th><th>Ingreso total</th><th>Facturas</th><th>Gastos fijos</th><th>Gastos variables</th><th>Pago de deuda</th><th>Ahorro / Inv.</th><th>Dinero restante</th></tr>"
    +lines.map(l=>`<tr><td>${l[0]}</td>${l.slice(1).map(x=>`<td>${money(x)}</td>`).join("")}</tr>`).join("")
    +`<tr><th>TOTAL ANUAL</th>${t.map(x=>`<th>${money(x)}</th>`).join("")}</tr>`;
  if(!window.Chart)return;
  if(charts.c4){charts.c4.data.datasets[0].data=ing;charts.c4.data.datasets[1].data=gas;charts.c4.update();return;}
  charts.c4=new Chart($("c4"),{type:"bar",data:{labels:MESES,datasets:[{label:"Ingresos",data:ing,backgroundColor:"#2f855a"},{label:"Gastos",data:gas,backgroundColor:"#c53030"}]},
    options:{plugins:{title:{display:true,text:"Ingresos vs Gastos por mes"}}}});
}

/* ---- Exportar a Excel (respeta el interruptor "Usar presupuesto") ---- */
$("btnXls").onclick=()=>{
  if(!window.XLSX){alert("No se pudo cargar la librería de Excel. Revisa tu conexión.");return;}
  const pres=$("usePres").checked, wb=XLSX.utils.book_new(), nom=Object.fromEntries(SEC.map(x=>[x.k,x.n]));
  const hoja=(d,n)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.length?d:[{"Sin datos":""}]),n);
  hoja(all.slice().sort((a,b)=>a.mes-b.mes||(a.fecha||"").localeCompare(b.fecha||"")).map(r=>{
    const o={"Año":r.anio,"Mes":MESES[r.mes-1],"Sección":nom[r.seccion]||r.seccion,"Concepto":r.concepto};
    if(pres)o["Presupuesto"]=r.presupuesto;
    o["Actual"]=r.actual;o["Categoría"]=r.categoria;o["Fecha"]=r.fecha||"";o["Pagado"]=r.pagado?"Sí":"No";
    return o;}),"Movimientos");
  hoja(SEC.map(x=>{
    const l=rows.filter(r=>r.seccion===x.k), o={"Rubro":x.n};
    if(pres)o["Meta"]=sum(l,"presupuesto");
    o["Actual"]=sum(l,"actual");return o;}),"Resumen "+MESES[+$("mes").value-1]);
  if(ANUAL){
    const col=["Mes","Ingreso total","Facturas","Gastos fijos","Gastos variables","Pago de deuda","Ahorro / Inv.","Dinero restante"];
    hoja([...ANUAL.lines,["TOTAL ANUAL",...ANUAL.t]].map(l=>Object.fromEntries(col.map((c,i)=>[c,l[i]]))),"Resumen anual");
  }
  if(metas.length)hoja(metas.map(m=>({"Meta":m.nombre,"Objetivo":m.objetivo,"Aportado":m.aportado||0,
    "Falta":Math.max(0,(m.objetivo||0)-(m.aportado||0)),"% avance":m.objetivo?Math.round((m.aportado||0)/m.objetivo*100)+"%":""})),"Metas");
  XLSX.writeFile(wb,`Finanzas_${$("anio").value}.xlsx`);
};

/* ---- Gráfico de líneas (tendencia del ahorro) ---- */
function lineChart(id,labels,sets,title){
  if(!window.Chart)return;
  if(charts[id]){charts[id].data.labels=labels;sets.forEach((s,i)=>charts[id].data.datasets[i].data=s.data);charts[id].update();return;}
  charts[id]=new Chart($(id),{type:"line",data:{labels,datasets:sets.map(s=>({label:s.label,data:s.data,borderColor:s.color,backgroundColor:s.color,tension:.3,fill:false}))},
    options:{plugins:{title:{display:true,text:title}}}});
}

/* ---- Metas de ahorro (colección users/{uid}/metas) ---- */
const mref=id=>doc(db,"users",uid,"metas",id);
function suscribirMetas(){
  if(unsubM)unsubM();
  unsubM=onSnapshot(collection(db,"users",uid,"metas"),s=>{metas=s.docs.map(d=>({id:d.id,...d.data()}));renderMetas();},
    e=>$("metaErr").textContent=e.message);
}
function renderMetas(){
  $("metas").innerHTML=metas.length?metas.slice().sort((a,b)=>((a.creado&&a.creado.seconds)||0)-((b.creado&&b.creado.seconds)||0)).map(m=>{
    const ap=m.aportado||0, p=m.objetivo?Math.min(100,ap/m.objetivo*100):0, falta=Math.max(0,(m.objetivo||0)-ap);
    return `<div class="meta"><div class="mh"><b>${esc(m.nombre)}</b><span>${money(ap)} / ${money(m.objetivo)} · ${p.toFixed(0)}%</span></div>
    <div class="bar"><i style="width:${p}%"></i></div>
    <div class="mh"><small>${p>=100?"¡Meta cumplida! 🎉":"Faltan "+money(falta)}</small>
    <span style="white-space:nowrap"><button class="x ok" data-aporta="${m.id}">+ Aportar</button><button class="x" data-delm="${m.id}" title="Eliminar">✕</button></span></div></div>`;
  }).join(""):"<p>Aún no tienes metas. Crea la primera abajo.</p>";
}
$("btnMeta").onclick=async()=>{
  const nombre=$("m_nombre").value.trim(), objetivo=+$("m_obj").value, aportado=+$("m_ini").value||0;
  if(!nombre||!(objetivo>0)){$("metaErr").textContent="Escribe el nombre y un objetivo mayor a 0";return;}
  $("metaErr").textContent="";
  try{await addDoc(collection(db,"users",uid,"metas"),{nombre,objetivo,aportado,creado:serverTimestamp()});
    ["m_nombre","m_obj","m_ini"].forEach(i=>$(i).value="");}
  catch(x){$("metaErr").textContent=x.message;}
};
$("metas").onclick=async e=>{
  const t=e.target.closest("button"); if(!t)return; const d=t.dataset;
  try{
    if(d.aporta){
      const m=metas.find(x=>x.id===d.aporta); if(!m)return;
      const v=parseFloat(String(prompt("¿Cuánto vas a aportar a «"+m.nombre+"»? (usa un número negativo para retirar)")||"").replace(",","."));
      if(!isNaN(v)&&v!==0)await updateDoc(mref(d.aporta),{aportado:Math.max(0,(m.aportado||0)+v)});
    }
    if(d.delm&&confirm("¿Eliminar esta meta?"))await deleteDoc(mref(d.delm));
  }catch(x){$("metaErr").textContent=x.message;}
};

/* ---- Copiar movimientos de un mes a otro ---- */
$("cpSrc").innerHTML=$("mes").innerHTML;
const setSrc=()=>{$("cpSrc").value=((+$("mes").value+10)%12)+1;};
setSrc();
$("cpSecs").innerHTML=SEC.map(s=>`<label class="sw"><input type="checkbox" data-cpsec="${s.k}" ${["ingreso","factura","fijo","deuda"].includes(s.k)?"checked":""}> ${s.n}</label>`).join(" ");
$("btnCopy").onclick=async()=>{
  const out=$("cpMsg"), fail=t=>{out.className="err";out.textContent=t;};
  out.className="";out.textContent="";
  const src=+$("cpSrc").value, dst=+$("mes").value, anio=+$("anio").value;
  if(src===dst)return fail("Elige un mes de origen distinto al mes seleccionado arriba.");
  const secs=[...document.querySelectorAll("[data-cpsec]:checked")].map(i=>i.dataset.cpsec);
  if(!secs.length)return fail("Marca al menos una sección.");
  const origen=all.filter(r=>r.mes===src&&secs.includes(r.seccion));
  if(!origen.length)return fail(`No hay movimientos en ${MESES[src-1]} para esas secciones.`);
  const key=r=>r.seccion+"|"+String(r.concepto).trim().toLowerCase();
  const ya=new Set(all.filter(r=>r.mes===dst).map(key));
  const nuevos=origen.filter(r=>!ya.has(key(r)));
  if(!nuevos.length)return fail(`Todo eso ya existe en ${MESES[dst-1]}; no se copió nada.`);
  if(!confirm(`Se copiarán ${nuevos.length} movimientos de ${MESES[src-1]} a ${MESES[dst-1]} ${anio}. ¿Continuar?`))return;
  const copiarActual=$("cpActual").checked;
  try{
    const b=writeBatch(db), col=collection(db,"users",uid,"movimientos");
    nuevos.forEach(r=>{
      let f=null;
      if(r.fecha){const dia=+r.fecha.slice(8,10)||1, max=new Date(anio,dst,0).getDate();
        f=`${anio}-${String(dst).padStart(2,"0")}-${String(Math.min(dia,max)).padStart(2,"0")}`;}
      b.set(doc(col),{seccion:r.seccion,concepto:r.concepto,presupuesto:r.presupuesto||0,actual:copiarActual?(r.actual||0):0,
        categoria:r.categoria||"Necesidades",fecha:f,pagado:false,anio,mes:dst,creado:serverTimestamp()});
    });
    await b.commit();
    out.className="okmsg";
    out.textContent=`✔ Copiados ${nuevos.length} movimientos`+(origen.length>nuevos.length?` (${origen.length-nuevos.length} omitidos por ya existir)`:"")+".";
  }catch(x){fail(x.message);}
};
