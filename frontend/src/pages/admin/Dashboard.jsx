import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { HBars, Columns } from '../../components/Charts.jsx';
import { money } from '../../utils.js';

const RANGES = [7, 14, 30];

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);

  useEffect(() => { api.get(`/analytics?days=${days}`).then(setData); }, [days]);
  if (!data) return <p className="muted">Loading dashboard...</p>;
  const s = data.summary;

  return (
    <div className="stack">
      <div className="spread">
        <h1>Dashboard</h1>
        <div className="tabs">{RANGES.map((d) => <button key={d} className={`tab ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d} days</button>)}</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><span>Revenue</span><strong>{money(s.revenue)}</strong></div>
        <div className="kpi"><span>Orders</span><strong>{s.orders}</strong><small>{s.cancelledOrders} cancelled</small></div>
        <div className="kpi"><span>Avg order value</span><strong>{money(s.avgOrderValue)}</strong></div>
        <div className="kpi"><span>Reservations</span><strong>{s.reservations}</strong></div>
        <div className="kpi"><span>New customers</span><strong>{s.newCustomers}</strong></div>
        <div className="kpi"><span>Avg rating</span><strong>{s.avgRating || '—'} ★</strong></div>
        <div className="kpi"><span>On waiting list now</span><strong>{s.waitingNow}</strong></div>
        <div className="kpi"><span>Table turns / table / day</span><strong>{data.tableTurnover.rate}</strong></div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h3>Revenue by day</h3>
          <Columns data={data.revenueByDay.map((d) => ({ label: d.date.slice(5), value: d.revenue }))} format={(v) => money(v)} color="var(--accent)" />
        </div>
        <div className="panel">
          <h3>Revenue by service type</h3>
          <HBars data={data.revenueByType.map((t) => ({ label: `${t.type} (${t.orders})`, value: t.revenue }))} format={(v) => money(v)} color="var(--primary)" />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h3>Popular dishes</h3>
          <HBars data={data.menu.popularDishes.map((d) => ({ label: d.name, value: d.quantity }))} format={(v) => `${v} sold`} color="var(--accent)" />
        </div>
        <div className="panel">
          <h3>Reservation trends by hour</h3>
          <Columns data={data.reservations.byHour} format={(v) => v} color="var(--primary)" />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <h3>Table turnover</h3>
          <HBars data={data.tableTurnover.tables.map((t) => ({ label: `Table ${t.table}`, value: t.turns }))} format={(v) => `${v} parties`} color="var(--primary)" />
        </div>
        <div className="panel">
          <h3>Customer satisfaction</h3>
          <p><strong>{data.satisfaction.average || '—'}</strong> average from {data.satisfaction.total} reviews ({data.satisfaction.satisfiedPercent}% gave 4-5 stars)</p>
          <HBars data={data.satisfaction.distribution.map((d) => ({ label: `${d.stars} star`, value: d.count }))} color="var(--accent)" />
        </div>
      </div>

      <div className="panel">
        <h3>Delivery performance</h3>
        <div className="kpi-grid">
          <div className="kpi"><span>Delivered</span><strong>{data.delivery.delivered}</strong></div>
          <div className="kpi"><span>On the way</span><strong>{data.delivery.active}</strong></div>
          <div className="kpi"><span>Avg delivery time</span><strong>{data.delivery.avgMinutes || 0} min</strong></div>
          <div className="kpi"><span>On-time rate</span><strong>{data.delivery.onTimePercent}%</strong></div>
        </div>
      </div>

      {data.menu.leastOrdered.length > 0 && (
        <div className="panel">
          <h3>Menu items to review (lowest sales)</h3>
          <ul className="plain-list">
            {data.menu.leastOrdered.map((m) => <li key={m.name} className="spread"><span>{m.name} <span className="muted small">({m.category})</span></span><span>{m.quantity} sold</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
