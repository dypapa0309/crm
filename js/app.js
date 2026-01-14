import { getState, setState, patchState, subscribe } from "./state.js";
import { debounce, qs, qsa, toast } from "./utils.js";
import { fetchStages, fetchDeals, fetchCompanies } from "./api.js";

import { renderDashboard } from "./ui-dashboard.js";
import { renderPipeline } from "./ui-board.js";
import { renderCompanies } from "./ui-company.js";
import { renderReports } from "./ui-reports.js";
import { renderDealPanel } from "./ui-deal.js";
import { renderDealsList } from "./ui-deals.js";

// ---- DOM
const $view = qs("#view");
const $panel = qs("#dealPanel");
const $search = qs("#globalSearch");
const $btnNewDeal = qs("#btnNewDeal");
const $btnRefresh = qs("#btnRefresh");

const $modal = qs("#modal");
const $modalTitle = qs("#modalTitle");
const $modalBody = qs("#modalBody");

// ---- Modal helpers (공용)
export function showModal(title, html){
  $modalTitle.textContent = title;
  $modalBody.innerHTML = html;
  $modal.classList.remove("hidden");
  $modal.setAttribute("aria-hidden","false");

  // close hooks (이번 모달에서만 1회)
  qsa('[data-close="1"]', $modal).forEach(el=>{
    el.addEventListener("click", closeModal, { once:true });
  });
}

export function closeModal(){
  $modal.classList.add("hidden");
  $modal.setAttribute("aria-hidden","true");
  $modalTitle.textContent = "-";
  $modalBody.innerHTML = "";
}

function getRoute(){
  const h = location.hash || "#/dashboard";
  const r = h.replace("#/","").split("?")[0];
  return ["dashboard","pipeline","deals","companies","reports"].includes(r) ? r : "dashboard";
}

function updateNavActive(){
  const s = getState();
  qsa(".nav-link").forEach(a=>{
    a.classList.toggle("active", a.dataset.route === s.route);
  });
}

// ---- Boot
init();

async function init(){
  setState({ route: getRoute() });
  updateNavActive();

  window.addEventListener("hashchange", ()=>{
    setState({ route: getRoute() });
    updateNavActive();
  });

  $search.addEventListener("input", debounce((e)=>{
    patchState(s => { s.q = e.target.value; });
  }, 150));

  $btnRefresh.addEventListener("click", async ()=>{
    await loadData(true);
    toast("새로고침", "데이터를 다시 불러왔어.");
  });

  // ✅ 글로벌 + 새 딜: 파이프라인 이동 + 모달 오픈 트리거 (alert/prompt 제거)
  $btnNewDeal.addEventListener("click", async ()=>{
    // 데이터 없으면 먼저 로드 (선택지 비어있는 문제 방지)
    const s = getState();
    if(!(s.stages && s.stages.length)){
      await loadData(true);
    }

    location.hash = "#/pipeline";
    // pipeline 렌더 후 이벤트 전달
    setTimeout(()=> window.dispatchEvent(new CustomEvent("crm:newDeal")), 60);
  });

  // modal: backdrop 클릭 닫기
  $modal.addEventListener("click", (e)=>{
    const t = e.target;
    if(t?.dataset?.close === "1") closeModal();
  });

  await loadData(true);

  subscribe(renderApp);
  renderApp(getState());
}

async function loadData(showToast=false){
  try{
    const [stages, deals, companies] = await Promise.all([
      fetchStages(),
      fetchDeals(),
      fetchCompanies(),
    ]);

    patchState(s=>{
      s.stages = stages ?? [];
      s.deals = deals ?? [];
      s.companies = companies ?? [];
    });

    if(showToast && (!stages?.length)){
      toast("단계 없음", "Stages 테이블에 단계가 비어있어. stage 데이터 확인해줘.");
    }
  }catch(err){
    console.error(err);
    if(showToast) toast("로드 실패", err?.message || "네트워크/권한/테이블을 확인해줘.");
    throw err;
  }
}

function renderApp(s){
  if(s.route === "dashboard") renderDashboard($view);
  if(s.route === "pipeline") renderPipeline($view);
  if(s.route === "companies") renderCompanies($view);
  if(s.route === "reports") renderReports($view);
  if(s.route === "deals") renderDealsList($view);

  // side panel (항상 렌더 호출)
  renderDealPanel($panel);
}
