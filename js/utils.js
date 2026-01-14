export function qs(sel, root=document){ return root.querySelector(sel); }
export function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

export function debounce(fn, wait=200){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=> fn(...args), wait);
  };
}

export function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export function formatNumber(n){
  const x = Number(n ?? 0);
  if(Number.isNaN(x)) return "0";
  return x.toLocaleString("ko-KR");
}

export function formatMoney(n){
  const x = Number(n ?? 0);
  if(!x) return "0원";
  return formatNumber(x) + "원";
}

export function clamp(v, min, max){
  const x = Number(v);
  if(Number.isNaN(x)) return min;
  return Math.min(max, Math.max(min, x));
}

export function fmt(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n){ return String(n).padStart(2,"0"); }

export function daysSince(iso){
  if(!iso) return 9999;
  const t = new Date(iso).getTime();
  if(Number.isNaN(t)) return 9999;
  const diff = Date.now() - t;
  return Math.floor(diff / (1000*60*60*24));
}

/* toast */
let toastWrap = null;

export function toast(title, msg, ms=2400){
  if(!toastWrap){
    toastWrap = document.createElement("div");
    toastWrap.className = "toast-wrap";
    document.body.appendChild(toastWrap);
  }

  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(msg)}</small>`;
  toastWrap.appendChild(el);

  setTimeout(()=> {
    el.remove();
    if(toastWrap && toastWrap.children.length === 0){
      toastWrap.remove();
      toastWrap = null;
    }
  }, ms);
}
