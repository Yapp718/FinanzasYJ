import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,addDoc,deleteDoc,updateDoc,doc,query,where,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app=initializeApp({apiKey:"AIzaSyC3I5cu-iP8rWFX2UM4n2PSZJIoIzglChA",authDomain:"finanzas-yj.firebaseapp.com",projectId:"finanzas-yj",storageBucket:"finanzas-yj.firebasestorage.app",messagingSenderId:"597103618710",appId:"1:597103618710:web:b3090f10ca1e7fff59b0b7"}), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const SEC=[{k:"ingreso",n:"Ingresos"},{k:"factura",n:"Facturas",g:1},{k:"fijo",n:"Gastos fijos",g:1},
 {k:"variable",n:"Gastos variables",g:1},{k:"deuda",n:"Pago de deuda",g:1},{k:"ahorro",n:"Ahorros"},{k:"inversion",n:"Inversiones / Donaciones",g:1}];
const money=n=>$("mon").value+(n||0).toLocaleString("es-CO",{maximumFractionDigits:2});
const sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let uid=null,unsub=null,rows=[],charts={};

$("mes").innerHTML=MESES.map((m,i)=>`<option value="${i+1}">${m}</option>`).join("");
$("mes").value=new Date().getMonth()+1;

$("grid").innerHTML=SEC.map(s=>`<div class="card" id="s_${s.k}"><h3>${s.n}</h3>
 <table><thead><tr><th>Concepto</th><th>Presup.</th><th>Actual</th>${s.g?"<th>Tipo</th>":""}${s.k!="ingreso"?"<th>Fecha</th><th>✔</th>":""}<th></th></tr></thead>
 <tbody></tbody><tfoot></tfoot></table>
 <div class="add"><input type="text" data-f="concepto" placeholder="Concepto">
 <input type="number" step="0.01" data-f="presupuesto" placeholder="Presup.">
 <input type="number" step="0.01" data-f="actual" placeholder="Actual">
 ${s.g?'<select data-f="categoria"><option>Necesidades</option><option>Deseos</option></select>':""}
 ${s.k!="ingreso"?'<input type="date" data-f="fecha">':""}
 <button data-add="${s.k}">Agregar</button></div></div>`).join("");

const msg=e=>({"auth/invalid-credential":"Correo o contraseña incorrectos","auth/email-already-in-use":"Ese correo ya está registrado","auth/weak-password":"Contraseña muy corta"}[e.code]||e.message);
$("btnLogin").onclick=()=>signInWithEmailAndPassword(auth,$("email").value,$("pass").value).catch(e=>$("authErr").textContent=msg(e));
$("btnReg").onclick=()=>createUserWithEmailAndPassword(auth,$("email").value,$("pass").value).catch(e=>$("authErr").textContent=msg(e));
$("btnOut").onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{uid=u?u.uid:null;$("auth").style.display=u?"none":"block";$("app").style.display=u?"block":"none";
  if(u){$("who").textContent=u.email;suscribir();}else if(unsub)unsub();});
$("anio").onchange=$("mes").onchange=()=>uid&&suscribir();
$("mon").oninput=()=>render();

function suscribir(){
  if(unsub)unsub();
  const q=query(collection(db,"users",uid,"movimientos"),where("anio","==",+$("anio").value),where("mes","==",+$("mes").value));
  unsub=onSnapshot(q,s=>{rows=s.docs.map(d=>({id:d.id,...d.data()}));render();},e=>$("err").textContent=e.message);
}
const ref=id=>doc(db,"users",uid,"movimientos",id);

$("grid").onclick=async e=>{
  const t=e.target;
  if(t.dataset.add){
    const c=$("s_"+t.dataset.add), v=f=>{const i=c.querySelector(`[data-f=${f}]`);return i?i.value:""};
    if(!v("concepto").trim()){$("err").textContent="Escribe un concepto";return;}
    $("err").textContent="";
    const k=t.dataset.add;
    try{await addDoc(collection(db,"users",uid,"movimientos"),{seccion:k,concepto:v("concepto").trim(),
      presupuesto:+v("presupuesto")||0,actual:+v("actual")||0,categoria:k==="ahorro"?"Ahorros":(v("categoria")||"Necesidades"),
      fecha:v("fecha")||null,pagado:false,anio:+$("anio").value,mes:+$("mes").value,creado:serverTimestamp()});
      c.querySelectorAll("input").forEach(i=>i.value="");
    }catch(x){$("err").textContent=x.message;}
  }
  if(t.dataset.del&&confirm("¿Eliminar?"))await deleteDoc(ref(t.dataset.del));
  if(t.dataset.pay)await updateDoc(ref(t.dataset.pay),{pagado:t.checked});
};

function chart(id,type,labels,data,colors,title){
  if(!window.Chart)return;
  if(charts[id]){charts[id].data.labels=labels;charts[id].data.datasets[0].data=data;charts[id].update();return;}
  charts[id]=new Chart($(id),{type,data:{labels,datasets:[{data,backgroundColor:colors}]},
    options:{plugins:{legend:{display:type==="doughnut"},title:{display:true,text:title}}}});
}

function render(){
  const by=k=>rows.filter(r=>r.seccion===k);
  SEC.forEach(s=>{
    const c=$("s_"+s.k), list=by(s.k).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));
    c.querySelector("tbody").innerHTML=list.map(r=>`<tr><td>${esc(r.concepto)}</td><td>${money(r.presupuesto)}</td><td>${money(r.actual)}</td>
      ${s.g?`<td>${r.categoria}</td>`:""}${s.k!="ingreso"?`<td>${r.fecha||""}</td><td><input type="checkbox" data-pay="${r.id}" ${r.pagado?"checked":""}></td>`:""}
      <td><button class="x" data-del="${r.id}">✕</button></td></tr>`).join("");
    c.querySelector("tfoot").innerHTML=`<tr><td>TOTAL</td><td>${money(sum(list,"presupuesto"))}</td><td>${money(sum(list,"actual"))}</td><td colspan="4"></td></tr>`;
  });
  const gastos=rows.filter(r=>SEC.some(s=>s.g&&s.k===r.seccion));
  const ingreso=sum(by("ingreso"),"actual"), gastado=sum(gastos,"actual"), ahorrado=sum(by("ahorro"),"actual");
  const asignado=sum(rows.filter(r=>r.seccion!=="ingreso"),"presupuesto");
  const presIng=sum(by("ingreso"),"presupuesto"), restante=ingreso-gastado-ahorrado;
  $("kpis").innerHTML=[["Ingreso total",ingreso],["Total gastado",gastado],["Total ahorrado",ahorrado],
    ["Dinero restante",restante],["Presupuesto x asignar",presIng-asignado]]
    .map(([t,v])=>`<div class="kpi">${t}<b>${money(v)}</b></div>`).join("");

  const real={Necesidades:sum(gastos.filter(r=>r.categoria==="Necesidades"),"actual"),Deseos:sum(gastos.filter(r=>r.categoria==="Deseos"),"actual"),Ahorros:ahorrado};
  const ideal={Necesidades:.5,Deseos:.3,Ahorros:.2};
  $("rule").innerHTML="<table><tr><th>Categoría</th><th>% ideal</th><th>% real</th><th>Presupuesto</th></tr>"+Object.keys(ideal).map(k=>{
    const p=ingreso?real[k]/ingreso:0;
    return `<tr><td>${k}<div class="bar"><i style="width:${Math.min(100,p/ideal[k]*100)}%"></i></div></td><td>${ideal[k]*100}%</td><td>${(p*100).toFixed(1)}%</td><td>${money(ingreso*ideal[k])}</td></tr>`}).join("")+"</table>";

  $("resumen").innerHTML="<tr><th>Rubro</th><th>Meta / ideal</th><th>Actual</th></tr>"+SEC.map(s=>
    `<tr><td>${s.n}</td><td>${money(sum(by(s.k),"presupuesto"))}</td><td>${money(sum(by(s.k),"actual"))}</td></tr>`).join("");

  chart("c1","bar",["Ingresos","Gastos"],[ingreso,gastado],["#2f855a","#c53030"],"Ingresos vs Gastos");
  chart("c2","doughnut",["Necesidades","Deseos","Ahorros"],[real.Necesidades,real.Deseos,real.Ahorros],["#1f4e79","#dd6b20","#2f855a"],"Gasto por categoría");
  chart("c3","bar",["Dinero restante","Asignado"],[restante,asignado],["#2f855a","#1f4e79"],"Estado del mes");
}