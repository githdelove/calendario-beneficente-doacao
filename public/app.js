const PRODUCTS={modelo1:{name:"Modelo 1 — Esperança",price:13},modelo2:{name:"Modelo 2 — Brasil mais justo",price:13},combo:{name:"Combo: Modelo 1 + Modelo 2",price:20}};
const $=id=>document.getElementById(id);let cur=null,orderId=null,timer=null,pix="";
const money=v=>"R$ "+v.toFixed(2).replace(".",",");
function step(n){["s1","s2","s3"].forEach((s,i)=>$(s).style.display=i+1===n?"block":"none")}
function openCheckout(k){cur=k;const p=PRODUCTS[k];$("mTitle").textContent="Finalizar compra";$("mName").textContent=p.name;$("mPrice").textContent=money(p.price);$("e1").textContent="";step(1);$("modal").classList.add("open")}
function closeM(){$("modal").classList.remove("open");clearInterval(timer)}
async function submitForm(){const name=$("fn").value.trim(),email=$("fe").value.trim();
 if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)){$("e1").textContent="Informe nome e um e-mail válido.";return}
 $("goPay").disabled=true;$("e1").textContent="";
 try{const r=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({product:cur,name,email})});
  const j=await r.json();if(!r.ok)throw new Error(j.error||"Erro ao gerar Pix");
  orderId=j.orderId;try{localStorage.setItem("order",orderId)}catch(e){}$("orderLink").style.display="";
  pix=j.copiaECola;$("copia").textContent=pix;$("qr").src="data:image/png;base64,"+j.qrBase64;$("qr").style.display=j.qrBase64?"block":"none";
  step(2);startPoll()}catch(e){$("e1").textContent=e.message}finally{$("goPay").disabled=false}}
async function copyPix(){try{await navigator.clipboard.writeText(pix)}catch(e){const t=document.createElement("textarea");t.value=pix;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}$("cpBtn").textContent="Copiado ✔";setTimeout(()=>$("cpBtn").textContent="Copiar código Pix",2000)}
function startPoll(){clearInterval(timer);check();timer=setInterval(check,3000)}
async function check(){try{const r=await fetch("/api/status?id="+encodeURIComponent(orderId));const j=await r.json();
 if(j.status==="paid"){clearInterval(timer);$("files").innerHTML=j.files.map(f=>`<div class="dl"><a class="btn" href="${f.url}">⬇ ${f.label}</a></div>`).join("");step(3);$("modal").classList.add("open")}
 else if(j.status==="expired"||j.status==="not_found"){clearInterval(timer);step(1);$("e1").textContent="Pedido expirado. Gere um novo Pix."}}catch(e){}}
function showOrder(){try{orderId=localStorage.getItem("order")}catch(e){}if(!orderId)return;step(2);$("modal").classList.add("open");startPoll()}
try{if(localStorage.getItem("order"))$("orderLink").style.display=""}catch(e){}
const U=location.origin,T=encodeURIComponent("Calendário 2027 em download digital, com molde A2. Confira: "+U);
$("sharebox").innerHTML=`<a target="_blank" rel="noopener" href="https://wa.me/?text=${T}">WhatsApp</a><a target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(U)}&text=${encodeURIComponent("Calendário 2027")}">Telegram</a><a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(U)}">Facebook</a><a target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${T}">X (Twitter)</a><a href="#" onclick="copyLink();return false" id="cl">Copiar link</a>`;
async function copyLink(){try{await navigator.clipboard.writeText(U)}catch(e){}$("cl").textContent="Link copiado ✔"}
async function share(){const d={title:document.title,text:"Calendário 2027 em download digital, com molde A2.",url:U};
 if(navigator.share){try{await navigator.share(d);return}catch(e){if(e.name==="AbortError")return}}closeM();$("sharebox").classList.toggle("open");scrollTo(0,0)}
document.addEventListener("click",e=>{if(!e.target.closest(".topbar"))$("sharebox").classList.remove("open")});
