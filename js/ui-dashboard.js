import { getState } from "./state.js";
import { formatNumber, daysSince, clamp } from "./utils.js";

export function renderDashboard(root){
  const s = getState();

  const total = s.deals.length;
  const open = s.deals.filter(d => (d.status||"open")==="open").length;
  const won  = s.deals.filter(d => (d.status||"") === "won").length;
  const lost = s.deals.filter(d => (d.status||"") === "lost").length;

  const forecast = s.deals
    .filter(d => (d.status||"open")==="open")
    .reduce((sum, d) => sum + (Number(d.amount||0) * (clamp(d.probability||0,0,100)/100)), 0);

  const idle7 = s.deals.filter(d => daysSince(d.last_activity_at) >= 7).length;

  // 단계별 병목(건수 기준 Top)
  const byStage = new Map();
  for(const st of s.stages) byStage.set(st.id, { name: st.name, count:0, sum:0 });
  for(const d of s.deals){
    const a = byStage.get(d.stage_id);
    if(!a) continue;
    a.count += 1;
    a.sum += Number(d.amount||0);
  }
  const stageRank = Array.from(byStage.values()).sort((a,b)=> b.count-a.count).slice(0,5);

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2 class="title">대시보드</h2>
        <div class="kicker">요약 · 병목 · 예측</div>
      </div>
    </div>

    <div class="summary">
      <div class="card stat">
        <div class="label">전체 딜</div>
        <div class="value">${formatNumber(total)}</div>
        <div class="hint">성사 ${won} · 실패 ${lost}</div>
      </div>
      <div class="card stat">
        <div class="label">진행중</div>
        <div class="value">${formatNumber(open)}</div>
        <div class="hint">진행중 딜</div>
      </div>
      <div class="card stat">
        <div class="label">예상 매출</div>
        <div class="value">${formatNumber(Math.round(forecast))}원</div>
        <div class="hint">확률 반영</div>
      </div>
      <div class="card stat warn">
        <div class="label">7일+ 미접촉</div>
        <div class="value">${formatNumber(idle7)}</div>
        <div class="hint">방치 딜 관리</div>
      </div>
    </div>

    <div style="height:12px"></div>

    <div class="card" style="padding:12px">
      <div class="section-head" style="margin:0">
        <div>
          <div class="title" style="font-size:16px">병목(단계별 딜 수 TOP)</div>
          <div class="kicker">건수 기준</div>
        </div>
      </div>

      <div style="height:10px"></div>

      <table class="table">
        <thead>
          <tr>
            <th>단계</th>
            <th>딜 수</th>
            <th>금액 합</th>
          </tr>
        </thead>
        <tbody>
          ${stageRank.map(r => `
            <tr>
              <td>${r.name}</td>
              <td>${formatNumber(r.count)}</td>
              <td>${formatNumber(r.sum)}원</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}
