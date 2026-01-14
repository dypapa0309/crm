import { getState, patchState } from "./state.js";
import { escapeHtml, fmt, formatNumber, daysSince, clamp } from "./utils.js";
import { openDealPanel } from "./ui-deal.js";

const LS_KEY = "crm_saved_filters_v1";

function loadSavedFilters(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch{ return []; }
}
function saveSavedFilters(filters){
  localStorage.setItem(LS_KEY, JSON.stringify(filters));
}

export function renderDealsList(root){
  const s = getState();

  if(!s.ui.dealsList){
    patchState(st=>{
      st.ui.dealsList = {
        status: "open",
        stageId: "all",
        sort: "updated_desc",
        minAmount: "",
        maxAmount: "",
        minProb: "",
        idleDays: 7,
        idleOnly: false,
      };
    });
  }

  const f = getState().ui.dealsList;

  const q = (s.q || "").trim().toLowerCase();
  const idleN = Number(f.idleDays || 7);
  const minAmount = f.minAmount === "" ? null : Number(f.minAmount);
  const maxAmount = f.maxAmount === "" ? null : Number(f.maxAmount);
  const minProb = f.minProb === "" ? null : Number(f.minProb);

  let rows = s.deals.filter(d => {
    const title = (d.title || "").toLowerCase();
    const cname = (d.companies?.name || "").toLowerCase();
    const okQ = !q || title.includes(q) || cname.includes(q);
    if(!okQ) return false;

    const st = (d.status || "open");
    if(f.status !== "all" && st !== f.status) return false;

    if(f.stageId !== "all" && d.stage_id !== f.stageId) return false;

    const amount = Number(d.amount||0);
    if(minAmount !== null && amount < minAmount) return false;
    if(maxAmount !== null && amount > maxAmount) return false;

    const prob = clamp(d.probability||0, 0, 100);
    if(minProb !== null && prob < minProb) return false;

    if(f.idleOnly && daysSince(d.last_activity_at) < idleN) return false;

    return true;
  });

  rows = sortRows(rows, f.sort);

  const saved = loadSavedFilters();

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2 class="title">딜 목록</h2>
        <div class="kicker">표로 정리 · 필터 저장 · 정렬</div>
      </div>

      <div class="hstack">
        <button class="btn btn-outline" id="btnSaveFilter">필터 저장</button>
        <button class="btn btn-outline" id="btnResetFilter">필터 초기화</button>
      </div>
    </div>

    <div class="card">
      <div class="filters">
        <span class="chip ghost">검색: ${(s.q||"").trim() ? escapeHtml(s.q) : "없음"}</span>

        <label class="chip">
          상태
          <select id="fStatus" class="input" style="min-width:0">
            <option value="open" ${f.status==="open"?"selected":""}>진행중</option>
            <option value="won" ${f.status==="won"?"selected":""}>성사</option>
            <option value="lost" ${f.status==="lost"?"selected":""}>실패</option>
            <option value="all" ${f.status==="all"?"selected":""}>전체</option>
          </select>
        </label>

        <label class="chip">
          단계
          <select id="fStage" class="input" style="min-width:0">
            <option value="all" ${f.stageId==="all"?"selected":""}>전체</option>
            ${s.stages.map(st => `<option value="${st.id}" ${f.stageId===st.id?"selected":""}>${escapeHtml(st.name)}</option>`).join("")}
          </select>
        </label>

        <label class="chip">
          금액(최소)
          <input id="fMinAmount" class="input" style="min-width:0;width:130px" type="number" min="0" value="${escapeHtml(f.minAmount)}" />
        </label>

        <label class="chip">
          금액(최대)
          <input id="fMaxAmount" class="input" style="min-width:0;width:130px" type="number" min="0" value="${escapeHtml(f.maxAmount)}" />
        </label>

        <label class="chip">
          확률(최소)
          <input id="fMinProb" class="input" style="min-width:0;width:110px" type="number" min="0" max="100" value="${escapeHtml(f.minProb)}" />
        </label>

        <label class="chip">
          미접촉 기준
          <select id="fIdleDays" class="input" style="min-width:0">
            <option value="7" ${idleN===7?"selected":""}>7일</option>
            <option value="14" ${idleN===14?"selected":""}>14일</option>
            <option value="30" ${idleN===30?"selected":""}>30일</option>
          </select>
        </label>

        <label class="chip">
          <input id="fIdleOnly" type="checkbox" ${f.idleOnly?"checked":""} />
          미접촉만
        </label>

        <label class="chip">
          정렬
          <select id="fSort" class="input" style="min-width:0">
            <option value="updated_desc" ${f.sort==="updated_desc"?"selected":""}>최근 업데이트</option>
            <option value="amount_desc" ${f.sort==="amount_desc"?"selected":""}>금액 높은순</option>
            <option value="forecast_desc" ${f.sort==="forecast_desc"?"selected":""}>예상매출 높은순</option>
            <option value="idle_desc" ${f.sort==="idle_desc"?"selected":""}>미접촉 오래된순</option>
          </select>
        </label>
      </div>

      <div class="filters">
        <span class="chip ghost">결과: <b>${formatNumber(rows.length)}</b>건</span>
        ${renderSavedFilters(saved)}
      </div>
    </div>

    <div style="height:12px"></div>

    <div class="card" style="padding:12px">
      <table class="table">
        <thead>
          <tr>
            <th style="width:28%">딜</th>
            <th style="width:18%">회사</th>
            <th>단계</th>
            <th>금액</th>
            <th>확률</th>
            <th>예상</th>
            <th>미접촉</th>
            <th>최근활동</th>
            <th style="width:90px">액션</th>
          </tr>
        </thead>
        <tbody id="dealRows"></tbody>
      </table>
    </div>
  `;

  const $tbody = root.querySelector("#dealRows");
  if(rows.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" class="kicker">조건에 맞는 딜이 없어.</td>`;
    $tbody.appendChild(tr);
  } else {
    rows.forEach(d => {
      const stName = s.stages.find(x => x.id === d.stage_id)?.name || "-";
      const amount = Number(d.amount||0);
      const prob = clamp(d.probability||0, 0, 100);
      const forecast = Math.round(amount * (prob/100));
      const idleDays = daysSince(d.last_activity_at);

      const toneBadge =
        idleDays >= idleN ? `<span class="badge bad">미접촉</span>` :
        (!d.last_activity_at ? `<span class="badge warn">활동없음</span>` :
        (prob <= 30 ? `<span class="badge warn">확률↓</span>` : `<span class="badge ghost">OK</span>`));

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          ${toneBadge}
          <div style="margin-top:6px">
            <a href="#" class="link" data-open="1">${escapeHtml(d.title)}</a>
          </div>
          <div class="kicker">${escapeHtml(d.status || "open")}</div>
        </td>
        <td>${escapeHtml(d.companies?.name || "-")}</td>
        <td>${escapeHtml(stName)}</td>
        <td>${formatNumber(amount)}원</td>
        <td>${prob}%</td>
        <td>${formatNumber(forecast)}원</td>
        <td>${idleDays}일</td>
        <td>${d.last_activity_at ? fmt(d.last_activity_at) : "-"}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-outline" data-open="1">열기</button>
          </div>
        </td>
      `;

      tr.querySelectorAll('[data-open="1"]').forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          openDealPanel(d.id);
        });
      });

      $tbody.appendChild(tr);
    });
  }

  bindFilters(root);

  root.querySelector("#btnSaveFilter").addEventListener("click", () => onSaveFilter());
  root.querySelector("#btnResetFilter").addEventListener("click", () => onResetFilter());

  root.querySelectorAll("[data-filter-apply]").forEach(el => {
    el.addEventListener("click", () => applySavedFilter(el.dataset.filterApply));
  });
  root.querySelectorAll("[data-filter-del]").forEach(el => {
    el.addEventListener("click", () => deleteSavedFilter(el.dataset.filterDel));
  });
}

function bindFilters(root){
  const patch = (fn) => patchState(s => fn(s.ui.dealsList));

  root.querySelector("#fStatus").addEventListener("change", (e) => patch(f => f.status = e.target.value));
  root.querySelector("#fStage").addEventListener("change", (e) => patch(f => f.stageId = e.target.value));
  root.querySelector("#fSort").addEventListener("change", (e) => patch(f => f.sort = e.target.value));

  root.querySelector("#fMinAmount").addEventListener("change", (e) => patch(f => f.minAmount = e.target.value));
  root.querySelector("#fMaxAmount").addEventListener("change", (e) => patch(f => f.maxAmount = e.target.value));
  root.querySelector("#fMinProb").addEventListener("change", (e) => patch(f => f.minProb = e.target.value));

  root.querySelector("#fIdleDays").addEventListener("change", (e) => patch(f => f.idleDays = Number(e.target.value||7)));
  root.querySelector("#fIdleOnly").addEventListener("change", (e) => patch(f => f.idleOnly = !!e.target.checked));
}

function sortRows(rows, mode){
  const cp = [...rows];
  if(mode === "amount_desc"){
    cp.sort((a,b)=> Number(b.amount||0) - Number(a.amount||0));
  } else if(mode === "forecast_desc"){
    cp.sort((a,b)=> {
      const af = Number(a.amount||0) * (clamp(a.probability||0,0,100)/100);
      const bf = Number(b.amount||0) * (clamp(b.probability||0,0,100)/100);
      return bf - af;
    });
  } else if(mode === "idle_desc"){
    cp.sort((a,b)=> daysSince(b.last_activity_at) - daysSince(a.last_activity_at));
  } else {
    cp.sort((a,b)=> new Date(b.updated_at||0).getTime() - new Date(a.updated_at||0).getTime());
  }
  return cp;
}

function renderSavedFilters(saved){
  if(!saved.length) return `<span class="chip ghost">저장된 필터 없음</span>`;
  return saved.map(sf => `
    <span class="chip">
      <button data-filter-apply="${escapeHtml(sf.id)}">📌 ${escapeHtml(sf.name)}</button>
      <button data-filter-del="${escapeHtml(sf.id)}" title="삭제">✕</button>
    </span>
  `).join("");
}

function onSaveFilter(){
  const s = getState();
  const f = s.ui.dealsList;
  const name = prompt("필터 이름(예: 이번주 미접촉/고액)")?.trim();
  if(!name) return;

  const saved = loadSavedFilters();
  const item = {
    id: crypto.randomUUID(),
    name,
    payload: { ...f }
  };
  saved.unshift(item);
  saveSavedFilters(saved);
  patchState(st => { st.ui.dealsList = { ...st.ui.dealsList }; });
}

function onResetFilter(){
  patchState(s => {
    s.ui.dealsList = {
      status: "open",
      stageId: "all",
      sort: "updated_desc",
      minAmount: "",
      maxAmount: "",
      minProb: "",
      idleDays: 7,
      idleOnly: false,
    };
  });
}

function applySavedFilter(id){
  const saved = loadSavedFilters();
  const item = saved.find(x => x.id === id);
  if(!item) return;
  patchState(s => {
    s.ui.dealsList = { ...s.ui.dealsList, ...item.payload };
  });
}

function deleteSavedFilter(id){
  const ok = confirm("저장 필터 삭제할까?");
  if(!ok) return;
  const saved = loadSavedFilters().filter(x => x.id !== id);
  saveSavedFilters(saved);
  patchState(st => { st.ui.dealsList = { ...st.ui.dealsList }; });
}
