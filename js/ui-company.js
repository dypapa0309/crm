import { getState, patchState } from "./state.js";
import { escapeHtml, fmt, formatNumber, toast } from "./utils.js";
import { showModal, closeModal } from "./app.js";
import {
  fetchContacts, createCompany, updateCompany, deleteCompany,
  createContact, deleteContact
} from "./api.js";
import { openDealPanel } from "./ui-deal.js";

export function renderCompanies(root){
  const s = getState();
  const q = (s.q || "").trim().toLowerCase();

  const rows = (s.companies || []).filter(c => {
    const name = (c.name||"").toLowerCase();
    const ind = (c.industry||"").toLowerCase();
    return !q || name.includes(q) || ind.includes(q);
  });

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2 class="title">고객(회사)</h2>
        <div class="kicker">회사 · 담당자 · 회사별 딜</div>
      </div>
      <div class="hstack">
        <button class="btn" id="btnNewCompany">+ 새 회사</button>
      </div>
    </div>

    <div class="card" style="padding:12px">
      <table class="table">
        <thead>
          <tr>
            <th style="width:34%">회사명</th>
            <th>업종</th>
            <th>태그</th>
            <th>수정</th>
          </tr>
        </thead>
        <tbody id="companyTbody"></tbody>
      </table>
    </div>

    <div style="height:12px"></div>

    <div class="card" style="padding:12px">
      <div class="section-head" style="margin:0">
        <div>
          <div class="title" style="font-size:16px">회사 상세</div>
          <div class="kicker">회사 클릭 → 상세 보기</div>
        </div>
      </div>
      <div id="companyDetail" class="kicker" style="padding-top:10px">회사를 선택해줘.</div>
    </div>
  `;

  const $tbody = root.querySelector("#companyTbody");
  const $detail = root.querySelector("#companyDetail");

  if(rows.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="kicker">회사 데이터가 없어. "+ 새 회사"로 추가해줘.</td>`;
    $tbody.appendChild(tr);
  }else{
    rows.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <a href="#" data-open="1">${escapeHtml(c.name)}</a>
          <div class="kicker">${c.updated_at ? fmt(c.updated_at) : "-"}</div>
        </td>
        <td>${escapeHtml(c.industry||"-")}</td>
        <td>${(c.tags||[]).map(t => `<span class="badge ghost">${escapeHtml(t)}</span>`).join(" ") || "-"}</td>
        <td>
          <div class="hstack">
            <button class="btn btn-outline" data-edit="1">편집</button>
            <button class="btn danger" data-del="1">삭제</button>
          </div>
        </td>
      `;

      tr.querySelector('[data-open="1"]').addEventListener("click", (e) => {
        e.preventDefault();
        renderCompanyDetail($detail, c.id);
      });

      tr.querySelector('[data-edit="1"]').addEventListener("click", () => openCompanyForm("회사 편집", c, $detail));

      tr.querySelector('[data-del="1"]').addEventListener("click", async () => {
        const ok = confirm("이 회사를 삭제할까? (연락처/딜 연결이 있으면 영향 있을 수 있어)");
        if(!ok) return;

        try{
          await deleteCompany(c.id);
          patchState(st => { st.companies = st.companies.filter(x => x.id !== c.id); });
          $detail.textContent = "회사를 선택해줘.";
          toast("삭제 완료", "회사가 삭제됐어.");
        }catch(err){
          console.error(err);
          toast("삭제 실패", supabaseErr(err));
          alert(`삭제 실패: ${supabaseErr(err)}`);
        }
      });

      $tbody.appendChild(tr);
    });
  }

  root.querySelector("#btnNewCompany").addEventListener("click", () => openCompanyForm("새 회사", null, $detail));
}

async function renderCompanyDetail(root, companyId){
  const s = getState();
  const c = (s.companies || []).find(x => x.id === companyId);
  if(!c){
    root.textContent = "회사를 찾을 수 없음";
    return;
  }

  let contacts = [];
  try{
    contacts = await fetchContacts(companyId);
  }catch(err){
    console.error(err);
    toast("담당자 로드 실패", supabaseErr(err));
  }

  const deals = (s.deals || []).filter(d => d.company_id === companyId);

  root.innerHTML = `
    <div class="hstack" style="justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-weight:900;font-size:18px">${escapeHtml(c.name)}</div>
        <div class="kicker">${escapeHtml(c.industry||"-")} · 업데이트 ${c.updated_at ? fmt(c.updated_at) : "-"}</div>
        <div style="margin-top:10px">${escapeHtml(c.memo||"")}</div>
        <div style="margin-top:10px">
          ${(c.tags||[]).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join(" ") || `<span class="badge ghost">태그 없음</span>`}
        </div>
      </div>
      <div class="hstack">
        <button class="btn btn-outline" id="btnAddContact">+ 담당자</button>
        <button class="btn btn-outline" id="btnEditCompany">회사 편집</button>
      </div>
    </div>

    <hr class="sep" />

    <div class="grid2">
      <div>
        <div class="kicker">담당자</div>
        <div class="list" id="contactList"></div>
      </div>
      <div>
        <div class="kicker">딜</div>
        <div class="list" id="dealList"></div>
      </div>
    </div>
  `;

  // contacts
  const $cl = root.querySelector("#contactList");
  if(!contacts.length){
    $cl.innerHTML = `<div class="item"><div class="sub">담당자 없음</div></div>`;
  } else {
    contacts.forEach(ct => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>
            <div><b>${escapeHtml(ct.name)}</b> <span class="badge ghost">${escapeHtml(ct.role||"-")}</span></div>
            <div class="sub">${escapeHtml(ct.phone||"-")} · ${escapeHtml(ct.email||"-")}</div>
          </div>
          <button class="btn danger">삭제</button>
        </div>
      `;
      div.querySelector("button").addEventListener("click", async () => {
        const ok = confirm("이 담당자를 삭제할까?");
        if(!ok) return;

        try{
          await deleteContact(ct.id);
          toast("삭제 완료", "담당자가 삭제됐어.");
          await renderCompanyDetail(root, companyId);
        }catch(err){
          console.error(err);
          toast("삭제 실패", supabaseErr(err));
          alert(`삭제 실패: ${supabaseErr(err)}`);
        }
      });
      $cl.appendChild(div);
    });
  }

  // deals
  const $dl = root.querySelector("#dealList");
  if(!deals.length){
    $dl.innerHTML = `<div class="item"><div class="sub">딜 없음</div></div>`;
  } else {
    deals.forEach(d => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>
            <div><b>${escapeHtml(d.title)}</b></div>
            <div class="sub">${formatNumber(d.amount||0)}원 · 확률 ${d.probability||0}% · ${d.last_activity_at ? fmt(d.last_activity_at) : "활동 없음"}</div>
          </div>
          <button class="btn btn-outline">열기</button>
        </div>
      `;
      div.querySelector("button").addEventListener("click", () => openDealPanel(d.id));
      $dl.appendChild(div);
    });
  }

  root.querySelector("#btnEditCompany").addEventListener("click", () => openCompanyForm("회사 편집", c, root));
  root.querySelector("#btnAddContact").addEventListener("click", () => openContactForm(companyId, root));
}

function openCompanyForm(title, company, detailRoot){
  const isEdit = !!company;

  showModal(title, `
    <div class="grid2">
      <div>
        <label class="kicker">회사명</label>
        <input id="fName" class="input" value="${escapeHtml(company?.name||"")}" />
      </div>
      <div>
        <label class="kicker">업종</label>
        <input id="fIndustry" class="input" value="${escapeHtml(company?.industry||"")}" />
      </div>
    </div>

    <div style="height:10px"></div>

    <div>
      <label class="kicker">태그(쉼표로 구분)</label>
      <input id="fTags" class="input" value="${escapeHtml((company?.tags||[]).join(","))}" />
    </div>

    <div style="height:10px"></div>

    <div>
      <label class="kicker">메모</label>
      <textarea id="fMemo" class="input" style="min-height:110px">${escapeHtml(company?.memo||"")}</textarea>
    </div>

    <div style="height:12px"></div>

    <div class="hstack" style="justify-content:flex-end">
      <button class="btn btn-outline" data-close="1">취소</button>
      <button class="btn" id="btnSaveCompany">${isEdit ? "저장" : "생성"}</button>
    </div>
  `);

  document.querySelector("#btnSaveCompany").addEventListener("click", async () => {
    const name = (document.querySelector("#fName")?.value || "").trim();
    if(!name){
      toast("입력 필요", "회사명은 필수야.");
      return alert("회사명은 필수야.");
    }

    const industry = (document.querySelector("#fIndustry")?.value || "").trim();
    const memo = (document.querySelector("#fMemo")?.value || "").trim();
    const tags = (document.querySelector("#fTags")?.value || "").split(",").map(x => x.trim()).filter(Boolean);

    try{
      if(isEdit){
        const updated = await updateCompany(company.id, { name, industry, memo, tags });
        patchState(st => {
          const idx = st.companies.findIndex(x => x.id === company.id);
          if(idx >= 0) st.companies[idx] = updated;
        });
        toast("저장 완료", "회사 정보가 저장됐어.");
        if(detailRoot?.id === "companyDetail") {
          await renderCompanyDetail(detailRoot, company.id);
        }
      } else {
        const created = await createCompany({ name, industry, memo, tags });
        patchState(st => { st.companies = [created, ...(st.companies || [])]; });
        toast("생성 완료", "회사가 추가됐어.");
        if(detailRoot) await renderCompanyDetail(detailRoot, created.id);
      }
      closeModal();
    }catch(err){
      console.error(err);
      const msg = supabaseErr(err);
      toast("저장 실패", msg);
      alert(`저장 실패: ${msg}`);
    }
  });
}

function openContactForm(companyId, detailRoot){
  showModal("담당자 추가", `
    <div class="grid2">
      <div>
        <label class="kicker">이름</label>
        <input id="cName" class="input" />
      </div>
      <div>
        <label class="kicker">직책/역할</label>
        <input id="cRole" class="input" placeholder="예: 구매 담당" />
      </div>
    </div>

    <div style="height:10px"></div>

    <div class="grid2">
      <div>
        <label class="kicker">전화</label>
        <input id="cPhone" class="input" />
      </div>
      <div>
        <label class="kicker">이메일</label>
        <input id="cEmail" class="input" />
      </div>
    </div>

    <div style="height:10px"></div>

    <div>
      <label class="kicker">메모</label>
      <textarea id="cMemo" class="input" style="min-height:90px"></textarea>
    </div>

    <div style="height:12px"></div>

    <div class="hstack" style="justify-content:flex-end">
      <button class="btn btn-outline" data-close="1">취소</button>
      <button class="btn" id="btnSaveContact">추가</button>
    </div>
  `);

  document.querySelector("#btnSaveContact").addEventListener("click", async () => {
    const name = (document.querySelector("#cName")?.value || "").trim();
    if(!name){
      toast("입력 필요", "이름은 필수야.");
      return alert("이름은 필수야.");
    }

    try{
      await createContact({
        company_id: companyId,
        name,
        role: (document.querySelector("#cRole")?.value || "").trim(),
        phone: (document.querySelector("#cPhone")?.value || "").trim(),
        email: (document.querySelector("#cEmail")?.value || "").trim(),
        memo: (document.querySelector("#cMemo")?.value || "").trim()
      });

      toast("추가 완료", "담당자가 추가됐어.");
      closeModal();
      if(detailRoot) await renderCompanyDetail(detailRoot, companyId);
    }catch(err){
      console.error(err);
      const msg = supabaseErr(err);
      toast("추가 실패", msg);
      alert(`추가 실패: ${msg}`);
    }
  });
}

function supabaseErr(err){
  if(!err) return "알 수 없는 오류";
  const msg = err.message || String(err);
  const code = err.code ? ` (code: ${err.code})` : "";
  const hint = err.hint ? ` / hint: ${err.hint}` : "";
  const details = err.details ? ` / details: ${err.details}` : "";
  return `${msg}${code}${hint}${details}`;
}
