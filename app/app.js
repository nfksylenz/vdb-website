/* VDB Training: area clienti e pannello trainer. Parla con window.VDB_BACKEND (Firebase oppure demo). */
(function(){
"use strict";
const CFG = window.VDB_CONFIG || {};
const PACKS = [
  { id:"1",  name:"Lezione singola", lessons:1,  price:20 },
  { id:"10", name:"Pacchetto 10 lezioni", lessons:10, price:170 },
  { id:"20", name:"Pacchetto 20 lezioni", lessons:20, price:300 }
];
const SLOTS = [ {id:"mattina",label:"Mattina (7–12)"}, {id:"pomeriggio",label:"Pomeriggio (12–17)"}, {id:"sera",label:"Sera (17–21)"} ];
const WEEK_GOAL = 3;

let B = null;
const S = { ready:false, loadingData:false, user:null, role:null, me:null, plan:null, sessions:[], weights:[],
  tab:"oggi", confirmCancel:false, book:{pack:"10",day:"",slot:"sera",note:""}, loginErr:"", busy:false,
  clients:[], view:"list", cid:null, ctab:"progressi", cdata:null, edit:null, created:null, formErr:"" };

/* ---------- Utilità ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fmtDay = d => d.toLocaleDateString("it-IT",{day:"numeric",month:"short"});
const fmtLong = d => d.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
const kgNum = v => parseFloat(String(v).replace(",","."));
const kgTxt = v => String(v).replace(".",",");
function weekStart(){ const d=new Date(); const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x.getTime(); }
const weekCount = ss => ss.filter(s=>s.ts>=weekStart()).length;
function mapErr(e){ const c=(e&&e.code)||"";
  if(/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return "Email o password non corretti.";
  if(/too-many/.test(c)) return "Troppi tentativi. Riprova tra qualche minuto.";
  if(/network/.test(c)) return "Connessione assente. Riprova.";
  if(/email-already/.test(c)) return "Esiste già un account con questa email.";
  if(/weak-password/.test(c)) return "Password troppo corta: servono almeno 6 caratteri.";
  if(/permission/.test(c)) return "Permessi insufficienti. Controlla le regole di Firestore.";
  return "Qualcosa è andato storto. Riprova."; }
function toast(t){ const el=$("#toast"); el.textContent=t; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>{el.hidden=true},2400); }
const checkSvg = '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>';
const emptyPlan = () => ({ workout:{days:[]}, nutrition:{kcal:"",prot:"",carb:"",fat:"",meals:[],notes:""}, note:"", updatedAt:0 });
function normPlan(p){ const e=emptyPlan(); if(!p) return e; return { workout:{days:(p.workout&&p.workout.days)||[]}, nutrition:Object.assign(e.nutrition,p.nutrition||{}), note:p.note||"", updatedAt:p.updatedAt||0 }; }
const clone = o => JSON.parse(JSON.stringify(o));
const isTrainerEmail = e => !!e && !!CFG.trainerEmail && e.toLowerCase()===CFG.trainerEmail.toLowerCase();
function copyText(txt,fallbackEl){
  const fb=()=>{ if(fallbackEl){ const r=document.createRange(); r.selectNodeContents(fallbackEl); const s=getSelection(); s.removeAllRanges(); s.addRange(r);} toast("Seleziona e copia il testo"); };
  try{ navigator.clipboard.writeText(txt).then(()=>toast("Copiato"),fb); }catch(e){ fb(); } }

/* bozza allenamento in corso: solo comodità locale */
const draftKey = () => "vdb-draft-"+(S.user?S.user.uid:"x");
function loadDraft(){ try{ const r=localStorage.getItem(draftKey()); return r?JSON.parse(r):null; }catch(e){ return null; } }
let memDraft=null;
function getDraft(){ return memDraft || (memDraft=loadDraft()); }
function setDraft(d){ memDraft=d; try{ if(d) localStorage.setItem(draftKey(),JSON.stringify(d)); else localStorage.removeItem(draftKey()); }catch(e){} }

/* ---------- Timer di recupero ---------- */
let restEnd=0, restTimer=null;
function startRest(sec){ restEnd=Date.now()+sec*1000; $("#restlbl").textContent="Recupero"; clearInterval(restTimer); restTimer=setInterval(tick,250); $("#rest").hidden=false; tick(); }
function tick(){ const left=Math.max(0,Math.ceil((restEnd-Date.now())/1000)); $("#resttime").textContent=Math.floor(left/60)+":"+pad(left%60);
  if(left<=0){ clearInterval(restTimer); $("#restlbl").textContent="Si riparte!"; try{ navigator.vibrate&&navigator.vibrate(250); }catch(e){} setTimeout(()=>{ if(Date.now()>=restEnd) $("#rest").hidden=true; },2500); } }
function stopRest(){ clearInterval(restTimer); $("#rest").hidden=true; }

/* ---------- Componenti condivisi ---------- */
function ring(done,goal){ const r=40,c=2*Math.PI*r,p=Math.min(1,done/goal);
  return `<div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="${r}" fill="none" stroke-width="10"/><circle class="fg" cx="50" cy="50" r="${r}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-p)).toFixed(1)}"/></svg><b class="tnum">${done}/${goal}</b></div>`; }
function chart(weights){
  const w=weights.slice().sort((a,b)=>a.d<b.d?-1:1).slice(-12);
  if(w.length<2) return `<p class="muted" style="margin:0">Servono almeno due pesate per vedere l'andamento.</p>`;
  const W=320,H=170,L=34,R=12,T=14,Bt=26, vals=w.map(x=>x.kg), lo=Math.floor(Math.min(...vals)-1), hi=Math.ceil(Math.max(...vals)+1);
  const X=i=>L+i*(W-L-R)/(w.length-1), Y=v=>T+(hi-v)*(H-T-Bt)/(hi-lo);
  const pts=w.map((x,i)=>[X(i),Y(x.kg)]);
  const path=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area=path+` L${pts[pts.length-1][0].toFixed(1)} ${H-Bt} L${pts[0][0].toFixed(1)} ${H-Bt} Z`, mid=(lo+hi)/2;
  const dl=s=>{const p=s.split("-");return p[2]+"/"+p[1];};
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del peso">
    ${[lo,mid,hi].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L-6}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${v%1?v.toFixed(1):v}</text>`).join("")}
    <path class="area" d="${area}"/><path class="line" d="${path}"/>
    ${pts.map((p,i)=>`<circle class="dot${i===pts.length-1?" last":""}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5"/>`).join("")}
    <text x="${L}" y="${H-6}" text-anchor="start">${dl(w[0].d)}</text><text x="${W-R}" y="${H-6}" text-anchor="end">${dl(w[w.length-1].d)}</text></svg>`; }
function records(sessions){ const best={};
  sessions.forEach(s=>s.ex.forEach(e=>e.sets.forEach(x=>{ const kg=kgNum(x.kg); if(!isNaN(kg)&&(!best[e.n]||kg>best[e.n].kg)) best[e.n]={kg,reps:x.reps}; })));
  return Object.entries(best).sort((a,b)=>b[1].kg-a[1].kg).slice(0,6); }
function volume(s){ return Math.round(s.ex.reduce((t,e)=>t+e.sets.reduce((u,x)=>u+(kgNum(x.kg)||0)*(parseInt(x.reps)||0),0),0)); }
function progressBlocks(sessions,weights,opts){
  opts=opts||{}; const recs=records(sessions), ws=weights.slice().sort((a,b)=>a.d<b.d?1:-1).slice(0,5), hist=sessions.slice().reverse().slice(0,opts.trainer?15:8);
  const weightForm = opts.trainer ? "" : `<label class="l" for="wIn">Peso di oggi (kg)</label><div class="row"><input id="wIn" type="text" inputmode="decimal" placeholder="es. 72,5"><button class="btn small" data-a="add-weight" type="button">Aggiungi</button></div>`;
  const wList = ws.length?`<ul class="hist" style="margin-top:12px">${ws.map(x=>`<li><span>${esc(fmtDay(new Date(x.d+"T12:00:00")))}</span><span class="row"><b class="tnum">${kgTxt(x.kg)} kg</b>${opts.trainer?"":`<button class="x" type="button" data-a="del-weight" data-d="${x.d}" aria-label="Elimina pesata">×</button>`}</span></li>`).join("")}</ul>`:"";
  const histHtml = hist.length ? hist.map(s=>{
    const sets=s.ex.reduce((t,e)=>t+e.sets.length,0);
    const detail = opts.trainer ? `<ul>${s.ex.map(e=>`<li><b>${esc(e.n)}</b> ${e.sets.map(x=>esc(x.kg||"–")+"×"+esc(x.reps||"–")).join(" · ")}</li>`).join("")}</ul>` : "";
    return opts.trainer ? `<details class="sess"><summary><span><b>${esc(s.name)}</b><br><small class="muted">${esc(fmtDay(new Date(s.ts)))} · ${sets} serie</small></span><span class="tnum muted">${volume(s).toLocaleString("it-IT")} kg</span></summary>${detail}</details>`
      : `<li><span><b>${esc(s.name)}</b><br><small class="muted">${esc(fmtDay(new Date(s.ts)))} · ${sets} serie</small></span><span class="tnum muted">${volume(s).toLocaleString("it-IT")} kg</span></li>`;
  }).join("") : "";
  return `<div class="stats"><div class="stat"><b class="tnum">${sessions.length}</b><span>allenamenti</span></div><div class="stat"><b class="tnum">${weekCount(sessions)}</b><span>questa settimana</span></div><div class="stat"><b class="tnum">${recs.length}</b><span>esercizi con record</span></div></div>
    <section class="card"><div class="eyebrow">Peso corporeo</div><div style="margin:10px 0 14px">${chart(weights)}</div>${weightForm}${wList}</section>
    <section class="card"><div class="eyebrow">Record personali</div>${recs.length?`<ul class="hist" style="margin-top:8px">${recs.map(([n,r])=>`<li><span>${esc(n)}</span><b class="tnum">${kgTxt(r.kg)} kg${r.reps?" × "+esc(r.reps):""}</b></li>`).join("")}</ul>`:`<p class="muted" style="margin:8px 0 0">Nessun record ancora: compare dopo il primo allenamento.</p>`}</section>
    <section class="card"><div class="eyebrow">Storico allenamenti</div>${hist.length?(opts.trainer?`<div style="margin-top:8px">${histHtml}</div>`:`<ul class="hist" style="margin-top:8px">${histHtml}</ul>`):`<p class="muted" style="margin:8px 0 0">Nessun allenamento ancora registrato.</p>`}</section>`; }

/* ---------- Login ---------- */
function vLogin(){
  const demo = (CFG.demoLogins||[]).map(d=>`<button class="btn ghost block" type="button" data-a="demo-login" data-email="${esc(d.email)}">${esc(d.label)}</button>`).join("");
  return `<h1 class="page-title">Accedi</h1><p class="sub">Entra nella tua area personale: scheda di allenamento, alimentazione e progressi.</p>
  <form id="loginForm" class="card stack" novalidate>
    <div><label class="l" for="lEmail">Email</label><input id="lEmail" type="email" autocomplete="username" inputmode="email" autocapitalize="none" value="${esc(S.loginEmail||"")}" required></div>
    <div><label class="l" for="lPass">Password</label><input id="lPass" type="password" autocomplete="current-password" required></div>
    ${S.loginErr?`<p class="err" role="alert">${esc(S.loginErr)}</p>`:""}
    <button class="btn block" type="submit"${S.busy?" disabled":""}>${S.busy?"Accesso in corso…":"Entra"}</button>
    <button class="link" type="button" data-a="forgot">Password dimenticata?</button>
    ${CFG.privacy?`<button class="link" type="button" data-a="privacy-open">Informativa privacy</button>`:""}
  </form>
  ${demo?`<div class="stack" style="margin-top:14px"><div class="banner"><b>Versione dimostrativa.</b> I dati sono di esempio e non vengono salvati.</div>${demo}</div>`:""}`; }

/* ---------- Informativa privacy e consenso ---------- */
function policyHtml(){
  const P=CFG.privacy||{}, o=esc(P.owner||"[NOME DEL TITOLARE]"), a=esc(P.address||"[INDIRIZZO / P.IVA]"), m=esc(P.email||"[EMAIL]"), r=esc(P.retention||"12 mesi dalla fine del rapporto, salvo obblighi di legge");
  return `<h4>Informativa sul trattamento dei dati personali</h4><p class="muted">Ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR). Versione ${esc(P.version||"1")}.</p>
  <h4>1. Titolare del trattamento</h4><p>${o}, ${a}. Contatto: ${m}.</p>
  <h4>2. Quali dati trattiamo</h4><p>Dati identificativi e di contatto (nome, email); dati sull'attività fisica (allenamenti svolti, esercizi, carichi, ripetizioni); peso corporeo e obiettivo; piano alimentare e relative indicazioni. Questi ultimi dati possono rivelare informazioni relative alla salute, che il GDPR considera una categoria particolare di dati (art. 9). Conserviamo anche data e versione del tuo consenso.</p>
  <h4>3. Perché li trattiamo e su quale base</h4><p><b>a)</b> Creare e gestire il tuo accesso e fornirti schede di allenamento, piano alimentare e monitoraggio dei progressi: è necessario per eseguire il servizio di personal training che hai richiesto (art. 6.1.b).<br><b>b)</b> Trattare i dati relativi alla salute per le stesse finalità: lo facciamo solo con il tuo consenso esplicito (art. 9.2.a), che puoi revocare in ogni momento.<br><b>c)</b> Adempiere a eventuali obblighi di legge (art. 6.1.c).</p>
  <h4>4. Per quanto tempo</h4><p>Finché il tuo accesso resta attivo e, dopo la fine del rapporto, per ${r}. Poi i dati sono cancellati.</p>
  <h4>5. Chi può vedere i dati</h4><p>I dati sono visibili al titolare. Usiamo fornitori che agiscono come responsabili del trattamento: Google (servizio Firebase, per accessi e archivio dati) e GitHub (hosting della pagina). I dati non sono ceduti né diffusi. Se un fornitore tratta dati fuori dallo Spazio Economico Europeo, ciò avviene con le garanzie previste dal GDPR (ad esempio clausole contrattuali standard).</p>
  <h4>6. Conferimento dei dati</h4><p>Fornire i dati è facoltativo, ma senza email e senza il consenso al trattamento dei dati sulla salute non è possibile usare l'area personale.</p>
  <h4>7. I tuoi diritti</h4><p>Puoi chiedere in ogni momento l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione, la portabilità, e opporti al trattamento. Puoi revocare il consenso senza pregiudicare la liceità del trattamento già effettuato. Scrivi a ${m}. Hai inoltre diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it). Non è effettuato alcun processo decisionale automatizzato.</p>`; }
const hasConsent = me => !!(me && me.consent && CFG.privacy && me.consent.v===CFG.privacy.version);
const needConsent = () => !!(CFG.privacy && S.role==="client" && S.me && !hasConsent(S.me));
function vPolicy(){ return `<button class="link" data-a="privacy-close" type="button">← Indietro</button><h1 class="page-title" style="margin-top:6px">Informativa privacy</h1><div class="policy card" style="margin-top:14px">${policyHtml()}</div>`; }
function vConsent(){
  return `<h1 class="page-title">Prima di iniziare</h1><p class="sub">Leggi l'informativa sulla privacy e conferma il consenso per usare la tua area personale.</p>
  <div class="stack"><div class="policy card scroll" tabindex="0" aria-label="Informativa privacy">${policyHtml()}</div>
    <label class="chkrow"><input type="checkbox" id="c1"><span>Ho letto l'informativa sulla privacy.</span></label>
    <label class="chkrow"><input type="checkbox" id="c2"><span>Acconsento esplicitamente al trattamento dei miei dati relativi alla salute (peso, allenamenti, alimentazione) per le finalità indicate nell'informativa.</span></label>
    <button class="btn block" id="acceptBtn" data-a="accept-consent" type="button" disabled>Accetta e continua</button>
    <button class="link" data-a="logout" type="button">Esci senza accettare</button></div>`; }

/* ---------- Area cliente ---------- */
function days(){ return S.plan.workout.days; }
function planDay(id){ return days().find(d=>d.id===id); }
function nextDay(){ const ds=days(); if(!ds.length) return null; const last=S.sessions[S.sessions.length-1]; if(!last) return ds[0]; const i=ds.findIndex(d=>d.id===last.dayId); return ds[(i+1)%ds.length]||ds[0]; }
function lastFor(name){ for(let i=S.sessions.length-1;i>=0;i--){ const ex=S.sessions[i].ex.find(e=>e.n===name); if(ex&&ex.sets.length) return ex.sets[ex.sets.length-1]; } return null; }

function vOggi(){
  const n=nextDay(), wc=weekCount(S.sessions), last=S.sessions[S.sessions.length-1], dr=getDraft(), drDay=dr?planDay(dr.dayId):null, shown=drDay||n;
  const first=(S.me.name||"").split(" ")[0];
  const msg = S.plan.note ? `<div class="card hot"><div class="eyebrow">Messaggio dal tuo trainer</div><p style="margin:8px 0 0;white-space:pre-wrap">${esc(S.plan.note)}</p></div>` : "";
  const workout = shown ? `<div class="card hot"><div class="eyebrow">${drDay?"Allenamento in corso":"Prossimo allenamento"}</div><h2>${esc(shown.name)}</h2><p class="muted" style="margin:6px 0 14px">${esc(shown.focus||"")}${shown.focus?" · ":""}${shown.ex.length} esercizi</p>
      <button class="btn block" data-a="${drDay?"goto-allena":"start"}" data-id="${esc(shown.id)}" type="button">${drDay?"Riprendi":"Inizia ora"}</button></div>`
    : `<div class="card"><div class="eyebrow">La tua scheda</div><h2>In arrivo</h2><p class="muted" style="margin:6px 0 0">Il tuo trainer non ha ancora caricato la scheda di allenamento. Appena è pronta la trovi qui.</p></div>`;
  return `<h1 class="page-title">Ciao${first?", "+esc(first):""}</h1><p class="sub">La tua migliore versione, inizia da qui.</p>
  <div class="stack">${msg}
    <div class="card row">${ring(wc,WEEK_GOAL)}<div class="grow"><div class="eyebrow">Questa settimana</div><h2 style="font-size:28px">${wc>=WEEK_GOAL?"Obiettivo raggiunto":"Ancora "+(WEEK_GOAL-wc)+(WEEK_GOAL-wc===1?" allenamento":" allenamenti")}</h2></div></div>
    ${workout}
    ${last?`<div class="card"><div class="eyebrow">Ultimo allenamento</div><div class="row between" style="margin-top:6px"><b>${esc(last.name)}</b><span class="muted">${esc(fmtDay(new Date(last.ts)))}</span></div></div>`:""}
  ${CFG.privacy?`<button class="link" type="button" data-a="privacy-open">Informativa privacy</button>`:""}</div>`; }

function exCard(ex,i){
  const last=lastFor(ex.n), lastTxt=last?`Ultimo: ${esc(last.kg||"–")} kg × ${esc(last.reps||"–")}`:"Prima volta: scegli un carico comodo";
  const rows=ex.sets.map((s,j)=>`<div class="n">${j+1}</div>
    <input class="kg" inputmode="decimal" type="text" aria-label="Chili serie ${j+1}" data-i="${i}" data-j="${j}" value="${esc(s.kg)}" placeholder="${last?esc(last.kg):"kg"}">
    <input class="reps" inputmode="numeric" type="text" aria-label="Ripetizioni serie ${j+1}" data-i="${i}" data-j="${j}" value="${esc(s.reps)}" placeholder="${last?esc(last.reps):"rip"}">
    <button class="chk" type="button" data-a="chk" data-i="${i}" data-j="${j}" aria-pressed="${s.done}" aria-label="Serie ${j+1} completata">${checkSvg}</button>`).join("");
  return `<section class="card ex"><h3>${esc(ex.n)}</h3><div class="meta">${ex.s} × ${esc(ex.r)} · ${lastTxt}</div>${ex.note?`<div class="note">${esc(ex.note)}</div>`:""}
    <div class="sets"><span></span><span class="h">Kg</span><span class="h">Rip</span><span></span>${rows}</div>
    <button class="link" type="button" data-a="addset" data-i="${i}">+ Aggiungi serie</button></section>`; }
function vAllena(){
  const d=getDraft();
  if(d){ const p=planDay(d.dayId)||{name:d.name};
    return `<h1 class="page-title">${esc(p.name)}</h1><p class="sub">Spunta ogni serie completata: parte il recupero.</p>
    <div class="stack">${d.ex.map(exCard).join("")}
      <button class="btn block" data-a="finish" type="button"${S.busy?" disabled":""}>${S.busy?"Salvataggio…":"Termina allenamento"}</button>
      ${S.confirmCancel?`<div class="card"><p style="margin:0 0 12px">Vuoi eliminare questo allenamento? I dati inseriti andranno persi.</p><div class="row"><button class="btn ghost grow" data-a="cancel-no" type="button">Torna indietro</button><button class="btn grow" data-a="cancel-yes" type="button">Elimina</button></div></div>`:`<button class="link" data-a="cancel" type="button">Annulla allenamento</button>`}</div>`; }
  const ds=days();
  if(!ds.length) return `<h1 class="page-title">La tua scheda</h1><div class="card" style="margin-top:14px"><p style="margin:0">Il tuo trainer non ha ancora caricato la scheda di allenamento. Appena è pronta la trovi qui.</p></div>`;
  return `<h1 class="page-title">La tua scheda</h1><p class="sub">${S.plan.updatedAt?"Aggiornata il "+esc(fmtDay(new Date(S.plan.updatedAt)))+". ":""}Scegli l'allenamento di oggi.</p>
  <div class="stack">${ds.map(p=>`<section class="card day"><div class="eyebrow">${esc(p.focus||"")}</div><h2>${esc(p.name)}</h2>
    <ul class="list">${p.ex.map(e=>`<li><span>${esc(e.n)}</span><span class="tnum">${e.s} × ${esc(e.r)}</span></li>`).join("")}</ul>
    <button class="btn block" data-a="start" data-id="${esc(p.id)}" type="button">Inizia ${esc(p.name)}</button></section>`).join("")}</div>`; }

function vDieta(){
  const n=S.plan.nutrition, has=n.kcal||n.prot||n.carb||n.fat||n.meals.length||n.notes;
  if(!has) return `<h1 class="page-title">Alimentazione</h1><div class="card" style="margin-top:14px"><p style="margin:0">Il tuo trainer non ha ancora caricato il piano alimentare. Appena è pronto lo trovi qui.</p></div>`;
  const m=[["kcal","kcal"],["prot","proteine g"],["carb","carboidrati g"],["fat","grassi g"]].filter(x=>n[x[0]]);
  return `<h1 class="page-title">Alimentazione</h1><p class="sub">${S.plan.updatedAt?"Aggiornato il "+esc(fmtDay(new Date(S.plan.updatedAt)))+".":"Il tuo piano personale."}</p>
  <div class="stack">${m.length?`<div class="stats four">${m.map(x=>`<div class="stat"><b class="tnum">${esc(n[x[0]])}</b><span>${x[1]}</span></div>`).join("")}</div>`:""}
    ${n.meals.map(x=>`<section class="card"><h2 style="font-size:26px">${esc(x.name)}</h2><p style="margin:8px 0 0;white-space:pre-wrap">${esc(x.desc)}</p></section>`).join("")}
    ${n.notes?`<section class="card hot"><div class="eyebrow">Indicazioni</div><p style="margin:8px 0 0;white-space:pre-wrap">${esc(n.notes)}</p></section>`:""}</div>`; }

function vProgressi(){ return `<h1 class="page-title">Progressi</h1><p class="sub">Il tuo trainer vede questi dati e ti aiuta a migliorare.</p><div class="stack">${progressBlocks(S.sessions,S.weights)}</div>`; }

function bookMsg(){ const b=S.book, p=PACKS.find(x=>x.id===b.pack), sl=SLOTS.find(x=>x.id===b.slot), day=b.day?fmtLong(new Date(b.day+"T12:00:00")):"";
  let m="Ciao! Sono "+(S.me.name||"[il tuo nome]")+". Vorrei prenotare: "+p.name+" ("+p.price+" €).";
  if(day) m+="\nGiorno preferito: "+day+", fascia "+sl.label.toLowerCase()+".";
  if(b.note.trim()) m+="\nNote: "+b.note.trim();
  return m+"\nPuoi confermarmi la disponibilità? Grazie!"; }
function vPrenota(){
  const b=S.book, now=new Date(), ds=[]; for(let i=0;i<7;i++) ds.push(new Date(now.getFullYear(),now.getMonth(),now.getDate()+i));
  if(!b.day||b.day<iso(ds[0])) b.day=iso(ds[0]);
  const wa=CFG.whatsapp?`<a class="btn block" target="_blank" rel="noopener" href="https://wa.me/${esc(CFG.whatsapp)}?text=${encodeURIComponent(bookMsg())}">Apri WhatsApp</a>`:"";
  const ig=CFG.instagram?`<a class="btn ghost block" target="_blank" rel="noopener" href="https://instagram.com/${esc(CFG.instagram)}">Apri Instagram</a>`:"";
  return `<h1 class="page-title">Prenota</h1><p class="sub">Scegli il pacchetto e quando preferisci allenarti. Il trainer conferma la disponibilità.</p>
  <div class="stack"><div class="stack" style="gap:10px">${PACKS.map(p=>`<button class="pack" type="button" data-a="pack" data-id="${p.id}" aria-pressed="${b.pack===p.id}"><span><b>${esc(p.name)}</b><small>${p.lessons>1?(p.price/p.lessons).toLocaleString("it-IT")+" € a lezione":"Per provare"}</small></span><span class="p tnum">${p.price} €</span></button>`).join("")}</div>
    <section class="card"><label class="l">Giorno preferito</label><div class="chips">${ds.map(d=>`<button class="chip" type="button" data-a="day" data-d="${iso(d)}" aria-pressed="${b.day===iso(d)}">${esc(d.toLocaleDateString("it-IT",{weekday:"short"}))} ${d.getDate()}</button>`).join("")}</div>
      <label class="l" style="margin-top:16px">Fascia oraria</label><div class="chips">${SLOTS.map(s=>`<button class="chip" type="button" data-a="slot" data-id="${s.id}" aria-pressed="${b.slot===s.id}">${esc(s.label)}</button>`).join("")}</div>
      <label class="l" for="bNote" style="margin-top:16px">Note (facoltative)</label><textarea id="bNote" placeholder="Obiettivo, infortuni, richieste">${esc(b.note)}</textarea></section>
    <section class="card"><div class="eyebrow">Il tuo messaggio</div><div class="msg" id="msg" style="margin:10px 0 14px">${esc(bookMsg())}</div>
      <div class="stack" style="gap:10px"><button class="btn block" type="button" data-a="copy">Copia messaggio</button>${wa}${ig}</div>
      <p class="muted" style="font-size:14px;margin:12px 0 0">Invia il messaggio a VDB per completare la richiesta.</p></section></div>`; }

/* ---------- Pannello trainer ---------- */
function lastActivity(c){ const t=c.sessions.length?c.sessions[c.sessions.length-1].ts:0; return t; }
function vTList(){
  const cs=S.clients.slice().sort((a,b)=>lastActivity(b)-lastActivity(a));
  return `<div class="row between" style="margin-top:14px"><h1 class="page-title" style="margin:0">I tuoi clienti</h1></div>
  <p class="sub">${cs.length?cs.length+(cs.length===1?" cliente":" clienti"):"Nessun cliente ancora."}</p>
  <div class="stack"><button class="btn block" data-a="t-new" type="button">+ Nuovo cliente</button>
  ${cs.map(c=>{ const la=lastActivity(c), days=la?Math.floor((Date.now()-la)/864e5):null, lw=c.weights.slice().sort((a,b)=>a.d<b.d?-1:1).slice(-1)[0];
    const badge=la===0?`<span class="badge">Nessun allenamento</span>`:(days>7?`<span class="badge warn">Fermo da ${days} giorni</span>`:`<span class="badge ok">Attivo</span>`);
    return `<button class="client" type="button" data-a="t-open" data-id="${esc(c.id)}"><div class="row between"><span class="nm">${esc(c.name)}</span>${badge}</div>
      <div class="meta"><span>${esc(c.goal||"Obiettivo non indicato")}</span><span>${weekCount(c.sessions)} allenamenti questa settimana</span>${la?`<span>Ultimo: ${esc(fmtDay(new Date(la)))}</span>`:""}${lw?`<span>${kgTxt(lw.kg)} kg</span>`:""}${CFG.privacy&&!hasConsent(c)?`<span class="badge warn">Consenso privacy mancante</span>`:""}</div></button>`; }).join("")}
  </div>`; }
function genPass(){ const a="abcdefghjkmnpqrstuvwxyz23456789"; let p=""; const r=new Uint32Array(10); (window.crypto||{getRandomValues:x=>x.forEach((_,i)=>x[i]=Math.random()*4e9)}).getRandomValues(r); r.forEach(n=>p+=a[n%a.length]); return p; }
function accessMsg(c){ const link=location.origin+location.pathname;
  return "Ciao "+c.name.split(" ")[0]+"! Ecco l'accesso alla tua area personale VDB:\n"+link+"\nEmail: "+c.email+"\nPassword temporanea: "+c.password+"\nDopo il primo accesso puoi sceglierne una nuova con \"Password dimenticata?\"."; }
function vTNew(){
  if(S.created){ const c=S.created; return `<h1 class="page-title">Cliente creato</h1><p class="sub">Invia questi dati a ${esc(c.name)}.</p>
    <div class="stack"><section class="card"><div class="msg" id="accMsg">${esc(accessMsg(c))}</div><div class="stack" style="gap:10px;margin-top:14px"><button class="btn block" data-a="t-copyacc" type="button">Copia messaggio</button>${CFG.whatsapp?"":""}</div></section>
      <button class="btn ghost block" data-a="t-open" data-id="${esc(c.id)}" type="button">Apri scheda cliente</button><button class="link" data-a="t-list" type="button">Torna all'elenco</button></div>`; }
  return `<button class="link" data-a="t-list" type="button">← Clienti</button><h1 class="page-title">Nuovo cliente</h1><p class="sub">Crei l'accesso e gli mandi email e password temporanea.</p>
  <form id="newForm" class="card stack" novalidate>
    <div><label class="l" for="ncName">Nome e cognome</label><input id="ncName" type="text" autocomplete="off" value="${esc((S.nc||{}).name||"")}"></div>
    <div><label class="l" for="ncEmail">Email del cliente</label><input id="ncEmail" type="email" autocapitalize="none" autocomplete="off" value="${esc((S.nc||{}).email||"")}"></div>
    <div><label class="l" for="ncPass">Password temporanea</label><div class="row"><input id="ncPass" type="text" autocomplete="off" value="${esc((S.nc||{}).password||genPass())}"><button class="btn ghost small" type="button" data-a="t-genpass">Nuova</button></div></div>
    <div><label class="l" for="ncGoal">Obiettivo (facoltativo)</label><input id="ncGoal" type="text" placeholder="es. dimagrimento, massa muscolare" value="${esc((S.nc||{}).goal||"")}"></div>
    ${S.formErr?`<p class="err" role="alert">${esc(S.formErr)}</p>`:""}
    <button class="btn block" type="submit"${S.busy?" disabled":""}>${S.busy?"Creazione…":"Crea cliente"}</button></form>`; }

function curClient(){ return S.clients.find(c=>c.id===S.cid); }
function vTClient(){
  const c=curClient(); if(!c) return "";
  const t=S.ctab, seg=[["progressi","Progressi"],["allena","Allenamento"],["dieta","Alimentazione"],["dati","Dati"]].map(x=>`<button type="button" data-a="t-tab" data-t="${x[0]}" aria-pressed="${t===x[0]}">${x[1]}</button>`).join("");
  let body="";
  if(!S.cdata) body=`<div class="card"><p class="muted" style="margin:0">Caricamento…</p></div>`;
  else if(t==="progressi") body=progressBlocks(c.sessions,c.weights,{trainer:true});
  else if(t==="allena") body=edWorkout();
  else if(t==="dieta") body=edNutrition();
  else body=edData(c);
  return `<button class="link" data-a="t-list" type="button">← Clienti</button><h1 class="page-title" style="margin-top:6px">${esc(c.name)}</h1><p class="sub">${esc(c.goal||"")}${c.goal?" · ":""}${esc(c.email)}</p>
  <div class="seg" style="margin-bottom:14px">${seg}</div><div class="stack">${body}</div>`; }

function edWorkout(){ const e=S.edit;
  return `<section class="card"><label class="l" for="edNote">Messaggio per il cliente (facoltativo)</label><textarea id="edNote" data-f="note" placeholder="Compare nella home del cliente">${esc(e.note)}</textarea></section>
  ${e.workout.days.map((d,i)=>`<section class="card"><div class="row between"><div class="eyebrow">Giorno ${i+1}</div><button class="x" type="button" data-a="ed-delday" data-i="${i}" aria-label="Elimina giorno">×</button></div>
    <div class="grid2" style="margin-top:8px"><div><label class="l">Nome</label><input type="text" data-f="workout.days.${i}.name" value="${esc(d.name)}"></div><div><label class="l">Focus</label><input type="text" data-f="workout.days.${i}.focus" value="${esc(d.focus)}"></div></div>
    <div class="exlist">${d.ex.map((x,j)=>`<div class="exrow"><input type="text" data-f="workout.days.${i}.ex.${j}.n" placeholder="Esercizio" value="${esc(x.n)}"><input type="text" inputmode="numeric" data-f="workout.days.${i}.ex.${j}.s" placeholder="Serie" value="${esc(x.s)}"><input type="text" data-f="workout.days.${i}.ex.${j}.r" placeholder="Rip" value="${esc(x.r)}"><button class="x" type="button" data-a="ed-delex" data-i="${i}" data-j="${j}" aria-label="Elimina esercizio">×</button><input class="exnote" type="text" data-f="workout.days.${i}.ex.${j}.note" placeholder="Nota (facoltativa)" value="${esc(x.note||"")}"></div>`).join("")}</div>
    <button class="link" type="button" data-a="ed-addex" data-i="${i}">+ Aggiungi esercizio</button></section>`).join("")}
  <button class="btn ghost block" type="button" data-a="ed-addday">+ Aggiungi giorno</button>
  <section class="card"><label class="l" for="impText">Importa da testo</label><textarea id="impText" placeholder="Giorno A - Gambe e spinta&#10;Squat 3x8-10&#10;Panca piana 3x8-10&#10;&#10;Giorno B - Schiena&#10;Stacco rumeno 3x8"></textarea><button class="btn ghost small" type="button" data-a="ed-import" style="margin-top:10px">Importa giorni</button><p class="muted" style="font-size:14px;margin:10px 0 0">Separa i giorni con una riga vuota. Ogni esercizio: nome, serie x ripetizioni.</p></section>
  <button class="btn block" type="button" data-a="ed-save-w"${S.busy?" disabled":""}>Salva scheda allenamento</button>`; }
function edNutrition(){ const n=S.edit.nutrition;
  return `<section class="card"><div class="eyebrow">Obiettivi giornalieri</div><div class="grid2" style="margin-top:10px">
    <div><label class="l">Calorie (kcal)</label><input type="text" inputmode="numeric" data-f="nutrition.kcal" value="${esc(n.kcal)}"></div><div><label class="l">Proteine (g)</label><input type="text" inputmode="numeric" data-f="nutrition.prot" value="${esc(n.prot)}"></div>
    <div><label class="l">Carboidrati (g)</label><input type="text" inputmode="numeric" data-f="nutrition.carb" value="${esc(n.carb)}"></div><div><label class="l">Grassi (g)</label><input type="text" inputmode="numeric" data-f="nutrition.fat" value="${esc(n.fat)}"></div></div></section>
  ${n.meals.map((m,i)=>`<section class="card"><div class="row between"><div class="eyebrow">Pasto ${i+1}</div><button class="x" type="button" data-a="ed-delmeal" data-i="${i}" aria-label="Elimina pasto">×</button></div>
    <label class="l" style="margin-top:8px">Nome</label><input type="text" data-f="nutrition.meals.${i}.name" value="${esc(m.name)}" placeholder="es. Colazione">
    <label class="l" style="margin-top:10px">Cosa mangiare</label><textarea data-f="nutrition.meals.${i}.desc" placeholder="Alimenti e quantità">${esc(m.desc)}</textarea></section>`).join("")}
  <button class="btn ghost block" type="button" data-a="ed-addmeal">+ Aggiungi pasto</button>
  <section class="card"><label class="l" for="nNotes">Indicazioni generali</label><textarea id="nNotes" data-f="nutrition.notes" placeholder="Acqua, integratori, regole generali">${esc(n.notes)}</textarea></section>
  <button class="btn block" type="button" data-a="ed-save-n"${S.busy?" disabled":""}>Salva piano alimentare</button>`; }
function edData(c){
  return `<section class="card stack"><div><label class="l" for="dName">Nome</label><input id="dName" type="text" value="${esc(c.name)}"></div>
    <div><label class="l" for="dGoal">Obiettivo</label><input id="dGoal" type="text" value="${esc(c.goal||"")}"></div>
    <div><label class="l" for="dPriv">Note private (il cliente non le vede)</label><textarea id="dPriv">${esc(S.cdata.priv||"")}</textarea></div>
    <button class="btn block" type="button" data-a="t-savedata"${S.busy?" disabled":""}>Salva</button></section>
  ${CFG.privacy?`<section class="card"><div class="eyebrow">Consenso privacy</div><p style="margin:8px 0 0">${hasConsent(c)?`Accettato il ${esc(new Date(c.consent.ts).toLocaleDateString("it-IT"))} (versione ${esc(c.consent.v)}).`:`Non ancora accettato: il cliente lo vedrà al prossimo accesso.`}</p></section>`:""}
  <section class="card"><div class="eyebrow">Accesso</div><p class="muted" style="margin:8px 0 12px">Email: ${esc(c.email)}</p><button class="btn ghost block" type="button" data-a="t-reset">Invia email per nuova password</button></section>`; }

function parseWorkout(t){
  const blocks=t.split(/\n\s*\n/).map(b=>b.split("\n").map(l=>l.trim()).filter(Boolean)).filter(b=>b.length);
  return blocks.map((lines,i)=>{
    let head=lines[0].replace(/^[#*\-\s]+/,"").replace(/:\s*$/,""), name=head, focus="";
    const m=head.split(/\s[-–—]\s|:\s/); if(m.length>1){ name=m[0].trim(); focus=m.slice(1).join(" - ").trim(); }
    const ex=lines.slice(1).map(l=>{ const mm=l.replace(/^[-*•]\s*/,"").match(/^(.+?)\s+(\d{1,2})\s*[x×]\s*(.+)$/i);
      return mm?{n:mm[1].trim(),s:+mm[2],r:mm[3].trim(),note:""}:{n:l.replace(/^[-*•]\s*/,""),s:3,r:"",note:""}; });
    return { id:"d"+Date.now().toString(36)+i, name:name||("Giorno "+(i+1)), focus, ex }; }); }

/* ---------- Render ---------- */
const view=$("#view"), app=$("#app");
function viewHtml(){
  if(!S.ready||S.loadingData) return `<div class="card" style="margin-top:20px"><p class="muted" style="margin:0">Caricamento…</p></div>`;
  if(S.showPrivacy) return vPolicy();
  if(!S.user) return vLogin();
  if(S.role==="trainer"){ if(S.view==="new") return vTNew(); if(S.view==="client") return vTClient(); return vTList(); }
  if(!S.me) return `<h1 class="page-title">Profilo non attivo</h1><div class="card" style="margin-top:14px"><p style="margin:0">Il tuo accesso esiste ma il profilo non è ancora attivo. Scrivi al tuo trainer.</p></div>`;
  if(needConsent()) return vConsent();
  return ({oggi:vOggi,allena:vAllena,dieta:vDieta,progressi:vProgressi,prenota:vPrenota})[S.tab](); }
function render(keep){
  const y=window.scrollY, client=S.user&&S.role==="client"&&S.me&&!S.loadingData&&!needConsent()&&!S.showPrivacy;
  app.classList.toggle("wide",S.role==="trainer"&&!!S.user);
  $("#tabbar").hidden=!client; $("#logout").hidden=!S.user;
  view.innerHTML=viewHtml();
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected",String(t.dataset.tab===S.tab)));
  window.scrollTo(0,keep?y:0); }
function go(t){ S.tab=t; S.confirmCancel=false; render(); }

/* ---------- Dati ---------- */
async function loadClient(){ S.me=await B.getClient(S.user.uid); S.plan=normPlan(S.me?await B.getPlan(S.user.uid):null);
  S.sessions=S.me?await B.listSessions(S.user.uid):[]; S.weights=S.me?await B.listWeights(S.user.uid):[]; memDraft=null; }
async function loadClients(){ const list=await B.listClients(); S.clients=await Promise.all(list.map(async c=>Object.assign({},c,{sessions:await B.listSessions(c.id),weights:await B.listWeights(c.id)}))); }
async function onUser(u){
  S.user=u; S.role=null; S.me=null; S.loginErr=""; S.view="list"; S.tab="oggi"; S.created=null;
  if(!u){ S.loadingData=false; stopRest(); render(); return; }
  S.role=isTrainerEmail(u.email)?"trainer":"client"; S.loadingData=true; render();
  try{ if(S.role==="trainer") await loadClients(); else await loadClient(); }
  catch(e){ S.loginErr=mapErr(e); try{ await B.logout(); }catch(_){ } S.user=null; }
  S.loadingData=false; render(); }

/* ---------- Azioni cliente ---------- */
function startWorkout(id){ const p=planDay(id); if(!p) return;
  setDraft({dayId:id,name:p.name,startedAt:Date.now(),ex:p.ex.map(e=>({n:e.n,s:e.s,r:e.r,note:e.note||"",sets:Array.from({length:e.s},()=>({kg:"",reps:"",done:false}))}))}); go("allena"); }
async function finishWorkout(){
  const d=getDraft(); if(!d||S.busy) return;
  const ex=d.ex.map(e=>({n:e.n,sets:e.sets.filter(s=>s.done).map(s=>({kg:String(s.kg),reps:String(s.reps)}))})).filter(e=>e.sets.length);
  if(!ex.length){ toast("Segna almeno una serie completata"); return; }
  const sess={ts:Date.now(),dayId:d.dayId,name:d.name,ex}; S.busy=true; render(true);
  try{ await B.addSession(S.user.uid,sess); S.sessions.push(sess); setDraft(null); stopRest(); S.busy=false; toast("Allenamento salvato. Ottimo lavoro!"); go("oggi"); }
  catch(e){ S.busy=false; render(true); toast("Non riesco a salvare. Controlla la connessione e riprova."); } }

/* ---------- Eventi ---------- */
function pathSet(o,p,v){ const ks=p.split("."), last=ks.pop(); ks.reduce((a,k)=>a[k],o)[last]=v; }
async function createClientFromForm(){
  const name=$("#ncName").value.trim(), email=$("#ncEmail").value.trim().toLowerCase(), password=$("#ncPass").value, goal=$("#ncGoal").value.trim();
  S.nc={name,email,password,goal}; S.formErr=""; if(!name||!/^\S+@\S+\.\S+$/.test(email)){ S.formErr="Inserisci nome ed email valida."; render(true); return; }
  if(password.length<6){ S.formErr="La password deve avere almeno 6 caratteri."; render(true); return; }
  S.busy=true; try{
    const uid=await B.createClient({name,email,password,goal}); const c={id:uid,name,email,goal,sessions:[],weights:[]};
    S.clients.push(c); S.created={id:uid,name,email,password}; S.nc=null; S.busy=false; render();
  }catch(e){ S.busy=false; S.formErr=mapErr(e); render(true); } }
async function openClient(id){ S.cid=id; S.view="client"; S.ctab="progressi"; S.cdata=null; S.created=null; render();
  try{ const [plan,priv]=await Promise.all([B.getPlan(id),B.getPrivate(id)]); S.cdata={plan:normPlan(plan),priv:priv||""}; S.edit=clone(S.cdata.plan);
    S.edit.workout.days.forEach(d=>d.ex.forEach(x=>{ x.note=x.note||""; })); }
  catch(e){ toast(mapErr(e)); S.cdata={plan:emptyPlan(),priv:""}; S.edit=clone(S.cdata.plan); }
  render(); }
async function savePlanPart(part){
  S.busy=true; render(true);
  try{
    let data;
    if(part==="w"){ const ds=S.edit.workout.days.map((d,i)=>({id:d.id,name:String(d.name||"Giorno "+(i+1)).trim(),focus:String(d.focus||"").trim(),ex:d.ex.filter(x=>String(x.n||"").trim()).map(x=>({n:String(x.n).trim(),s:Math.max(1,parseInt(x.s)||3),r:String(x.r||"").trim(),note:String(x.note||"").trim()}))}));
      data={workout:{days:ds},note:String(S.edit.note||"").trim(),updatedAt:Date.now()}; }
    else { const n=S.edit.nutrition; data={nutrition:{kcal:String(n.kcal||"").trim(),prot:String(n.prot||"").trim(),carb:String(n.carb||"").trim(),fat:String(n.fat||"").trim(),meals:n.meals.filter(m=>String(m.name||"").trim()||String(m.desc||"").trim()).map(m=>({name:String(m.name||"").trim(),desc:String(m.desc||"").trim()})),notes:String(n.notes||"").trim()},updatedAt:Date.now()}; }
    await B.savePlan(S.cid,data); S.cdata.plan=normPlan(Object.assign({},S.cdata.plan,data)); S.edit=clone(S.cdata.plan); S.edit.workout.days.forEach(d=>d.ex.forEach(x=>{ x.note=x.note||""; }));
    S.busy=false; toast(part==="w"?"Scheda salvata: il cliente la vede subito":"Piano alimentare salvato"); render(true);
  }catch(e){ S.busy=false; render(true); toast(mapErr(e)); } }

document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-tab]"); if(t){ go(t.dataset.tab); return; }
  const el=e.target.closest("[data-a]"); if(!el) return;
  const a=el.dataset.a, i=+el.dataset.i, j=+el.dataset.j;
  switch(a){
    case "logout": try{ await B.logout(); }catch(_){ } break;
    case "demo-login": try{ await B.login(el.dataset.email,"demo"); }catch(err){ S.loginErr=mapErr(err); render(); } break;
    case "forgot": { const em=($("#lEmail").value||"").trim(); if(!em){ S.loginErr="Scrivi la tua email, poi tocca di nuovo «Password dimenticata?»."; render(); break; }
      try{ await B.resetPassword(em); toast("Se l'email è registrata, riceverai un link per la nuova password"); }catch(err){ toast("Se l'email è registrata, riceverai un link per la nuova password"); } break; }
    case "privacy-open": S.showPrivacy=true; render(); break;
    case "privacy-close": S.showPrivacy=false; render(); break;
    case "accept-consent": { if(!($("#c1").checked&&$("#c2").checked)) break; const consent={v:CFG.privacy.version,ts:Date.now()};
      try{ await B.saveConsent(S.user.uid,consent); S.me.consent=consent; render(); toast("Grazie, puoi iniziare"); }catch(err){ toast("Non riesco a salvare il consenso. Riprova."); } break; }
    /* cliente */
    case "start": startWorkout(el.dataset.id); break;
    case "goto-allena": go("allena"); break;
    case "chk": { const d=getDraft(), s=d.ex[i].sets[j], row=el.parentElement;
      const kg=row.querySelector(`.kg[data-i="${i}"][data-j="${j}"]`), rp=row.querySelector(`.reps[data-i="${i}"][data-j="${j}"]`);
      if(!s.done){ if(!kg.value&&kg.placeholder&&kg.placeholder!=="kg") kg.value=kg.placeholder; if(!rp.value&&rp.placeholder&&rp.placeholder!=="rip") rp.value=rp.placeholder; s.kg=kg.value; s.reps=rp.value; s.done=true; startRest(90); } else s.done=false;
      el.setAttribute("aria-pressed",String(s.done)); setDraft(d); break; }
    case "addset": { const d=getDraft(); d.ex[i].sets.push({kg:"",reps:"",done:false}); setDraft(d); render(true); break; }
    case "finish": finishWorkout(); break;
    case "cancel": S.confirmCancel=true; render(true); break;
    case "cancel-no": S.confirmCancel=false; render(true); break;
    case "cancel-yes": setDraft(null); S.confirmCancel=false; stopRest(); go("oggi"); break;
    case "add-weight": { const v=kgNum($("#wIn").value); if(!(v>20&&v<400)){ toast("Inserisci un peso valido, ad esempio 72,5"); break; }
      const w={d:iso(new Date()),kg:Math.round(v*10)/10}; try{ await B.setWeight(S.user.uid,w); S.weights=S.weights.filter(x=>x.d!==w.d); S.weights.push(w); render(true); }catch(err){ toast("Non riesco a salvare. Riprova."); } break; }
    case "del-weight": try{ await B.deleteWeight(S.user.uid,el.dataset.d); S.weights=S.weights.filter(x=>x.d!==el.dataset.d); render(true); }catch(err){ toast("Non riesco a eliminare. Riprova."); } break;
    case "pack": S.book.pack=el.dataset.id; render(true); break;
    case "day": S.book.day=el.dataset.d; render(true); break;
    case "slot": S.book.slot=el.dataset.id; render(true); break;
    case "copy": copyText(bookMsg(),$("#msg")); break;
    case "rest-add": restEnd=Math.max(restEnd,Date.now())+15000; $("#restlbl").textContent="Recupero"; clearInterval(restTimer); restTimer=setInterval(tick,250); $("#rest").hidden=false; tick(); break;
    case "rest-skip": stopRest(); break;
    /* trainer */
    case "t-list": S.view="list"; S.created=null; S.formErr=""; render(); break;
    case "t-new": S.view="new"; S.created=null; S.formErr=""; S.nc=null; render(); break;
    case "t-genpass": $("#ncPass").value=genPass(); break;
    case "t-copyacc": copyText(accessMsg(S.created),$("#accMsg")); break;
    case "t-open": openClient(el.dataset.id); break;
    case "t-tab": S.ctab=el.dataset.t; render(true); break;
    case "ed-addday": S.edit.workout.days.push({id:"d"+Date.now().toString(36),name:"Giorno "+(S.edit.workout.days.length+1),focus:"",ex:[{n:"",s:3,r:"",note:""}]}); render(true); break;
    case "ed-delday": S.edit.workout.days.splice(i,1); render(true); break;
    case "ed-addex": S.edit.workout.days[i].ex.push({n:"",s:3,r:"",note:""}); render(true); break;
    case "ed-delex": S.edit.workout.days[i].ex.splice(j,1); render(true); break;
    case "ed-import": { const txt=$("#impText").value; const ds=parseWorkout(txt); if(!ds.length){ toast("Incolla prima la scheda nel campo di testo"); break; } S.edit.workout.days.push(...ds); render(true); toast(ds.length+(ds.length===1?" giorno importato":" giorni importati")+". Ricorda di salvare."); break; }
    case "ed-save-w": savePlanPart("w"); break;
    case "ed-addmeal": S.edit.nutrition.meals.push({name:"",desc:""}); render(true); break;
    case "ed-delmeal": S.edit.nutrition.meals.splice(i,1); render(true); break;
    case "ed-save-n": savePlanPart("n"); break;
    case "t-savedata": { const name=$("#dName").value.trim(); if(!name){ toast("Il nome non può essere vuoto"); break; } const goal=$("#dGoal").value.trim(), priv=$("#dPriv").value;
      S.busy=true; try{ await B.updateClient(S.cid,{name,goal}); await B.savePrivate(S.cid,priv); const c=curClient(); c.name=name; c.goal=goal; S.cdata.priv=priv; S.busy=false; toast("Dati salvati"); render(true); }catch(err){ S.busy=false; render(true); toast(mapErr(err)); } break; }
    case "t-reset": try{ await B.resetPassword(curClient().email); toast("Email inviata al cliente"); }catch(err){ toast(mapErr(err)); } break;
  }
});
document.addEventListener("submit",async e=>{
  e.preventDefault();
  if(e.target.id==="loginForm"){ const em=$("#lEmail").value.trim(), pw=$("#lPass").value; if(!em||!pw){ S.loginErr="Inserisci email e password."; render(); return; }
    S.loginEmail=em; S.busy=true; S.loginErr=""; const btn=e.target.querySelector("button[type=submit]"); if(btn){ btn.disabled=true; btn.textContent="Accesso in corso…"; }
    try{ await B.login(em,pw); S.busy=false; }catch(err){ S.busy=false; S.loginErr=mapErr(err); render(true); } }
  else if(e.target.id==="newForm") createClientFromForm(); });
document.addEventListener("input",e=>{ const t=e.target;
  if(t.classList.contains("kg")||t.classList.contains("reps")){ const d=getDraft(), s=d.ex[+t.dataset.i].sets[+t.dataset.j]; if(t.classList.contains("kg")) s.kg=t.value; else s.reps=t.value; setDraft(d); }
  else if(t.id==="bNote"){ S.book.note=t.value; $("#msg").textContent=bookMsg(); }
  else if(t.dataset.f&&S.edit){ pathSet(S.edit,t.dataset.f,t.value); } });

document.addEventListener("change",e=>{ if(e.target.id==="c1"||e.target.id==="c2"){ const b=$("#acceptBtn"); if(b) b.disabled=!($("#c1").checked&&$("#c2").checked); } });

/* ---------- Avvio ---------- */
function boot(){ B=window.VDB_BACKEND; S.ready=true; render(); B.onAuth(onUser); }
if(window.VDB_BACKEND) boot(); else window.addEventListener("vdb-backend",boot,{once:true});
render();
})();
