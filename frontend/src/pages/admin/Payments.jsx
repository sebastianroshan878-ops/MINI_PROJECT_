import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Badge from '../../components/Badge.jsx';
import { money, dateTime, METHOD_LABEL } from '../../utils.js';

export default function Payments() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [data, setData] = useState({ payments: [], summary: {} });

  const load = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    api.get(`/payments?${params}`).then(setData);
  };
  useEffect(load, [status]);

  async function refund(payment) {
    const reason = prompt('Reason for the refund?', 'Order cancelled');
    if (reason === null) return;
    try {
      await api.post(`/payments/${payment._id}/refund`, { reason });
      toast('Refund processed', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="stack">
      <h1>Payments</h1>
      <div className="kpi-grid">
        <div className="kpi"><span>Total collected</span><strong>{money(data.summary.collected)}</strong></div>
        <div className="kpi"><span>Refunded</span><strong>{money(data.summary.refunded)}</strong></div>
        <div className="kpi"><span>Failed attempts</span><strong>{data.summary.failed}</strong></div>
        <div className="kpi"><span>Total transactions</span><strong>{data.summary.count}</strong></div>
      </div>

      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option><option value="success">Success</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
      </select>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p._id}>
                <td>{dateTime(p.createdAt)}</td>
                <td>{p.order ? p.order.orderNumber : p.orderNumber}</td>
                <td>{p.customerName || '—'}</td>
                <td>{METHOD_LABEL[p.method]}</td>
                <td>{money(p.amount)}</td>
                <td><Badge status={p.status} /></td>
                <td>{p.status === 'success' && <button className="link-btn danger" onClick={() => refund(p)}>Refund</button>}</td>
              </tr>
            ))}
            {data.payments.length === 0 && <tr><td colSpan={7} className="muted center-text">No payments found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
