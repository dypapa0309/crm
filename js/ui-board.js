import { getState, patchState } from "./state.js";
import { escapeHtml, formatMoney, qs, clamp, toast } from "./utils.js";
import { createDeal, fetchDeals, createStages, fetchStages } from "./api.js";
import { showModal, closeModal } from "./app.js";
import { openDealPanel } from "./ui-deal.js";

function boardEmpty(){
  return `
    <div class="card empty">
      <b>아직 등록된 딜이 없어요</b>
      <div>오른쪽 위 <span class="pill">+ 새 딜</span> 버튼으로 첫 딜을 등록해줘.</div>
      <div class="cta">
        <button id="emptyNewDeal" class="btn">+ 첫 딜 등록</button>
        <a class="pill" href="#/companies">회사부터 등록하기</a>
      </div>
    </div>
  `;
}

// ✅ stages 없을 때: 앱 안에서 자동 생성
function openSeedStagesModal(){
  showModal("새 딜 등록", `
    <div class="kicker">딜을 등록하려면 “단계(Stages)” 데이터가 필요해.</div>
    <div style="height:10px"></div>

    <div class="card" style="padding:14px">
      <b>단계 데이터가 없어요</b>
      <div class="kicker" style="margin-top:6px">
        아래 버튼을 누르면 기본 단계를 자동으로 생성해줄게.
        <br/>생성 후 바로 새 딜 등록 화면을 열어줄게.
      </div>

      <div style="height:10px"></div>
      <div class="kicker">
        예시: <span class="pill">리드</span> <span class="pill">상담</span>
        <span class="pill">견적</span> <span class="pill">결제</span> <span class="pill">완료</span>
      </div>
    </div>

    <div style="height:12px"></div>
    <div class="hstack" style="justify-content:flex-end">
      <button class="btn btn-outline" data-close="1">닫기</button>
      <button class="btn" id="btnSeedStages">기본 단계 자동 생성</button>
    </div>
  `);

  // 닫기
  document.querySelector('[data-close="1"]')?.addEventListener("click", closeModal, { once:true });

  // 자동 생성
  document.querySelector("#btnSeedStages")?.addEventListener("click", async ()=>{
    try{
      const defaults = [
        { name:"리드", sort_order:10 },
        { name:"상담", sort_order:20 },
        { name:"견적", sort_order:30 },
        { name:"결제", sort_order:40 },
        { name:"진행", sort_order:50 },
        { name:"완료", sort_order:60 },
      ];

      await createStages(defaults);

      // stages 다시 불러와서 state 반영
      const stages = await fetchStages();
      patchState(st => { st.stages = stages ?? []; });

      toast("생성 완료", "기본 단계가 생성됐어. 이제 딜 등록할 수 있어.");
      closeModal();

      // ✅ 바로 새 딜 모달 오픈
      setTimeout(openNewDealModal, 0);
    }catch(err){
      console.error(err);
      toast("생성 실패", err?.message || "stages RLS/테이블 컬럼을 확인해줘.");
    }
  }, { once:true });
}

function openNewDealModal(){
  const s = getState();

  // ✅ stages가 없으면 안내+자동생성 모달
  if(!(s.stages||[]).length){
    openSeedStagesModal();
    return;
  }

  const firstStage = s.stages
    .slice()
    .sort((a,b)=>(a.sort_order??999)-(b.sort_order??999))[0]?.id || "";

  const stageOptions = (s.stages||[])
    .slice()
    .sort((a,b)=>(a.sort_order??999)-(b.sort_order??999))
    .map(st => `<option value="${st.id}" ${st.id===firstStage?"selected":""}>${escapeHtml(st.name)}</option>`)
    .join("");

  const companyOptions = (s.companies||[]).length
    ? `<option value="">(미지정)</option>` + s.companies.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="">(회사 없음)</option>`;

  showModal("새 딜 등록", `
    <div class="kicker">등록 즉시 파이프라인/딜목록에 반영돼.</div>
    <div style="height:10px"></div>

    <form id="dealForm" class="form">
      <label>
        <span>딜 제목 *</span>
        <input class="input" name="title" placeholder="예: OO고객 줄눈 시공 상담" required />
      </label>

      <div class="row">
        <label>
          <span>단계 *</span>
          <select class="input" name="stage_id" required>${stageOptions}</select>
        </label>

        <label>
          <span>회사</span>
          <select class="input" name="company_id">${companyOptions}</select>
        </label>
      </div>

      <div class="row">
        <label>
          <span>금액(원)</span>
          <input class="input" name="amount" type="number" min="0" placeholder="300000" />
        </label>

        <label>
          <span>확률(0~100)</span>
          <input class="input" name="probability" type="number" min="0" max="100" placeholder="30" />
        </label>
      </div>

      <label>
        <span>상태</span>
        <select class="input" name="status">
          <option value="open" selected>진행중</option>
          <option value="won">성사</option>
          <option value="lost">실패</option>
        </select>
      </label>

      <div class="actions">
        <button type="button" class="btn btn-outline" data-close="1">취소</button>
        <button type="submit" class="btn">저장</button>
      </div>
    </form>
  `);

  // 취소
  document.querySelector('[data-close="1"]')?.addEventListener("click", closeModal, { once:true });

  const form = document.querySelector("#dealForm");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const fd = new FormData(form);
    const payload = {
      title: String(fd.get("title")||"").trim(),
      stage_id: fd.get("stage_id") || null,
      company_id: fd.get("company_id") || null,
      amount: fd.get("amount") ? Number(fd.get("amount")) : null,
      probability: fd.get("probability") ? clamp(fd.get("probability"), 0, 100) : null,
      status: fd.get("status") || "open",
    };

    if(!payload.title){
      toast("입력 필요", "딜 제목을 적어줘.");
      return;
    }
    if(!payload.stage_id){
      toast("입력 필요", "단계를 선택해줘.");
      return;
    }

    try{
      await createDeal(payload);
      toast("등록 완료", "새 딜이 저장됐어.");

      const refreshed = await fetchDeals();
      patchState(s => { s.deals = refreshed; });

      closeModal();
    }catch(err){
      console.error(err);
      toast("저장 실패", err?.message || "권한/테이블 상태를 확인해줘.");
    }
  });
}

export function renderPipeline(root){
  const s = getState();
  const q = (s.q||"").trim().toLowerCase();

  const deals = q
    ? (s.deals||[]).filter(d=>{
        const title = (d.title||"").toLowerCase();
        const cname = (d?.companies?.name || "").toLowerCase();
        return title.includes(q) || cname.includes(q);
      })
    : (s.deals||[]);

  const byStage = new Map();
  (s.stages||[]).forEach(st => byStage.set(st.id, []));
  deals.forEach(d=>{
    if(!byStage.has(d.stage_id)) byStage.set(d.stage_id, []);
    byStage.get(d.stage_id).push(d);
  });

  root.innerHTML = `
    <div class="section-title">
      <div>
        <h2 class="title">파이프라인</h2>
        <p class="kicker">딜을 단계별로 관리해. (드래그 이동은 다음 버전에서)</p>
      </div>
      <div class="hstack">
        <button id="pipelineNewDeal" class="btn">+ 새 딜</button>
      </div>
    </div>

    ${deals.length ? `
      <div class="board">
        ${(s.stages||[])
          .slice()
          .sort((a,b)=>(a.sort_order??999)-(b.sort_order??999))
          .map(stage=>{
            const arr = (byStage.get(stage.id)||[])
              .slice()
              .sort((a,b)=> new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0));

            return `
              <div class="card col">
                <div class="col-header">
                  <div>
                    <b>${escapeHtml(stage.name)}</b>
                    <div class="meta">${arr.length}건</div>
                  </div>
                  <span class="pill">단계</span>
                </div>

                <div class="col-list">
                  ${arr.length ? arr.map(d=>{
                    const companyName = d?.companies?.name ? escapeHtml(d.companies.name) : "회사 미지정";
                    const amt = d.amount ? formatMoney(d.amount) : "금액 미입력";
                    const prob = (d.probability ?? null) !== null ? `${d.probability}%` : "확률 미입력";
                    return `
                      <div class="deal" data-deal="${d.id}">
                        <div class="t">${escapeHtml(d.title || "제목 없음")}</div>
                        <div class="s">
                          <span class="pill">${amt}</span>
                          <span class="pill">${prob}</span>
                          <span class="pill">${companyName}</span>
                        </div>
                      </div>
                    `;
                  }).join("") : `
                    <div class="empty" style="padding:18px 10px;">
                      <b>비어있어요</b>
                      <div>이 단계에 딜이 아직 없어.</div>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join("")}
      </div>
    ` : boardEmpty()}
  `;

  qs("#pipelineNewDeal", root)?.addEventListener("click", openNewDealModal);
  qs("#emptyNewDeal", root)?.addEventListener("click", openNewDealModal);

  root.querySelectorAll("[data-deal]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-deal");
      openDealPanel(id);
    });
  });

  // ✅ 글로벌 "+ 새 딜"에서 넘어온 intent 처리
  if(s.ui.intentNewDeal){
    patchState(st => { st.ui.intentNewDeal = false; });
    setTimeout(openNewDealModal, 0);
  }
}
