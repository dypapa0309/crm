import { getState } from "./state.js";
import { formatNumber, clamp } from "./utils.js";

export function renderReports(root){
  const s = getState();

  const openDeals = s.deals.filter(d => (d.status||"open")==="open");
  const sumAmount = openDeals.reduce((a,d)=> a + Number(d.amount||0), 0);
  const sumForecast = openDeals.reduce((a,d)=> a + (Number(d.amount||0) * (clamp(d.probability||0,0,100)/100)), 0);

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2 class="title">보고서</h2>
        <div class="kicker">v1: 진행중 딜 요약</div>
      </div>
    </div>

    <div class="card" style="padding:12px">
      <div class="kicker">진행중 딜 기준</div>
      <div style="height:10px"></div>
      <table class="table">
        <tbody>
          <tr>
            <td style="width:40%">진행중 딜 수</td>
            <td><b>${formatNumber(openDeals.length)}</b>건</td>
          </tr>
          <tr>
            <td>진행중 금액 합</td>
            <td><b>${formatNumber(sumAmount)}</b>원</td>
          </tr>
          <tr>
            <td>확률 반영 예상 매출 합</td>
            <td><b>${formatNumber(Math.round(sumForecast))}</b>원</td>
          </tr>
        </tbody>
      </table>

      <div style="height:10px"></div>
      <div class="kicker">v2에서: 단계별 전환/체류/활동량 상관 리포트 확장</div>
    </div>
  `;
}
