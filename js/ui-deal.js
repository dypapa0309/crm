import { getState, patchState } from "./state.js";
import { escapeHtml, fmt, clamp, formatNumber, toast } from "./utils.js";
import {
  fetchActivitiesByDeal, fetchTasksByDeal,
  createActivity, createTask, updateTask,
  updateDeal, deleteDeal, fetchDeals
} from "./api.js";

export function renderDealPanel(root){
  const s = getState();
  const id = s.ui.activeDealId;
  const deal = s.deals.find(d => d.id === id);

  if(!s.ui.dealPanelOpen || !deal){
    root.classList.add("hidden");
    root.innerHTML = "";
    return;
  }

  root.classList.remove("hidden");

  const companyName = deal.companies?.name ?? "회사 미지정";

  root.innerHTML = `
    <div class="panel-head">
      <div>
        <div class="panel-title">${escapeHtml(deal.title)}</div>
        <div class="panel-meta">${escapeHtml(companyName)} · 딜ID ${String(deal.id).slice(0,8)}</div>
      </div>
      <button class="icon-btn" data-act="close">✕</button>
    </div>

    <div class="panel-body">
      <div class="row">
        <label class="kicker">단계</label>
        <select id="pStage" class="input">
          ${s.stages.map(st => `<option value="${st.id}" ${st.id===deal.stage_id?"selected":""}>${escapeHtml(st.name)}</option>`).join("")}
        </select>
      </div>

      <div class="row grid2">
        <div>
          <label class="kicker">예상매출(원)</label>
          <input id="pAmount" class="input" type="number" min="0" value="${Number(deal.amount||0)}" />
        </div>
        <div>
          <label class="kicker">확률(0~100)</label>
          <input id="pProb" class="input" type="number" min="0" max="100" value="${Number(deal.probability||0)}" />
        </div>
      </div>

      <div class="row">
        <label class="kicker">다음 액션(할 일)</label>
        <div class="hstack">
          <input id="tTitle" class="input" placeholder="예: 견적서 발송" style="min-width:0;flex:1" />
          <button class="btn" data-act="addTask">추가</button>
        </div>
        <div id="taskList" class="list"></div>
      </div>

      <div class="row">
        <label class="kicker">활동 기록</label>
        <div class="hstack">
          <select id="aType" class="input" style="min-width:0">
            <option value="call">통화</option>
            <option value="meeting">미팅</option>
            <option value="sms">문자</option>
            <option value="email">메일</option>
            <option value="note" selected>메모</option>
          </select>
          <input id="aContent" class="input" placeholder="기록 입력" style="min-width:0;flex:1" />
          <button class="btn" data-act="addAct">저장</button>
        </div>
        <div id="actList" class="list"></div>
      </div>

      <div class="row">
        <div class="hstack" style="justify-content:space-between">
          <div class="badge ghost">예상(확률반영): ${formatNumber(Math.round(Number(deal.amount||0) * (Number(deal.probability||0)/100)))}원</div>
          <button class="btn danger" data-act="deleteDeal">딜 삭제</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-act="close"]').addEventListener("click", closeDealPanel);

  const $pStage = root.querySelector("#pStage");
  const $pAmount = root.querySelector("#pAmount");
  const $pProb = root.querySelector("#pProb");

  const updateFields = async () => {
    const stage_id = $pStage.value;
    const amount = Math.max(0, Number($pAmount.value||0));
    const probability = clamp($pProb.value, 0, 100);

    try{
      await updateDeal(deal.id, { stage_id, amount, probability });
      await refreshDealsKeepPanel(deal.id);
    }catch(err){
      console.error(err);
      toast("업데이트 실패", err?.message || "권한/테이블 상태를 확인해줘.");
    }
  };

  $pStage.addEventListener("change", updateFields);
  $pAmount.addEventListener("change", updateFields);
  $pProb.addEventListener("change", updateFields);

  root.querySelector('[data-act="addAct"]').addEventListener("click", async () => {
    const type = root.querySelector("#aType").value;
    const content = (root.querySelector("#aContent").value||"").trim();
    if(!content) return;

    const now = new Date().toISOString();

    try{
      await createActivity({
        deal_id: deal.id,
        company_id: deal.company_id,
        contact_id: deal.contact_id,
        type,
        content,
        occurred_at: now
      });

      await updateDeal(deal.id, { last_activity_at: now });
      root.querySelector("#aContent").value = "";
      await refreshDealsKeepPanel(deal.id);
    }catch(err){
      console.error(err);
      toast("저장 실패", err?.message || "권한/테이블 상태를 확인해줘.");
    }
  });

  root.querySelector('[data-act="addTask"]').addEventListener("click", async () => {
    const title = (root.querySelector("#tTitle").value||"").trim();
    if(!title) return;

    try{
      await createTask({
        deal_id: deal.id,
        company_id: deal.company_id,
        contact_id: deal.contact_id,
        title
      });
      root.querySelector("#tTitle").value = "";
      await loadPanelLists(deal.id, root);
    }catch(err){
      console.error(err);
      toast("저장 실패", err?.message || "권한/테이블 상태를 확인해줘.");
    }
  });

  root.querySelector('[data-act="deleteDeal"]').addEventListener("click", async () => {
    const ok = confirm("이 딜을 삭제할까? (활동/할일도 같이 삭제됨)");
    if(!ok) return;
    try{
      await deleteDeal(deal.id);
      closeDealPanel();
      patchState(st => { st.deals = st.deals.filter(x => x.id !== deal.id); });
      toast("삭제 완료", "딜이 삭제됐어.");
    }catch(err){
      console.error(err);
      toast("삭제 실패", err?.message || "권한/테이블 상태를 확인해줘.");
    }
  });

  loadPanelLists(deal.id, root);
}

export function openDealPanel(dealId){
  patchState(s => {
    s.ui.dealPanelOpen = true;
    s.ui.activeDealId = dealId;
  });
}

export function closeDealPanel(){
  patchState(s => {
    s.ui.dealPanelOpen = false;
    s.ui.activeDealId = null;
  });
}

async function loadPanelLists(dealId, root){
  const [tasks, acts] = await Promise.all([
    fetchTasksByDeal(dealId),
    fetchActivitiesByDeal(dealId)
  ]);

  const $taskList = root.querySelector("#taskList");
  $taskList.innerHTML = "";

  if(!tasks.length){
    $taskList.innerHTML = `<div class="item"><div class="sub">할 일이 아직 없어.</div></div>`;
  }else{
    tasks.forEach(t => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <div>${t.is_done ? "✅" : "⬜️"} ${escapeHtml(t.title)}</div>
          <button class="btn btn-outline small">${t.is_done ? "되돌리기" : "완료"}</button>
        </div>
        <div class="sub">${t.due_at ? "마감 " + fmt(t.due_at) : ""}</div>
      `;
      div.querySelector("button").addEventListener("click", async () => {
        await updateTask(t.id, {
          is_done: !t.is_done,
          done_at: !t.is_done ? new Date().toISOString() : null
        });
        await loadPanelLists(dealId, root);
      });
      $taskList.appendChild(div);
    });
  }

  const $actList = root.querySelector("#actList");
  $actList.innerHTML = "";

  if(!acts.length){
    $actList.innerHTML = `<div class="item"><div class="sub">활동 기록이 아직 없어.</div></div>`;
  }else{
    acts.forEach(a => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div>${icon(a.type)} ${escapeHtml(a.content)}</div>
        <div class="sub">${fmt(a.occurred_at)}</div>
      `;
      $actList.appendChild(div);
    });
  }
}

function icon(type){
  const map = { call:"📞", meeting:"📅", sms:"💬", email:"✉️", note:"📝" };
  return map[type] || "🗂️";
}

async function refreshDealsKeepPanel(dealId){
  const refreshed = await fetchDeals();
  patchState(s => {
    s.deals = refreshed;
    s.ui.dealPanelOpen = true;
    s.ui.activeDealId = dealId;
  });
}
