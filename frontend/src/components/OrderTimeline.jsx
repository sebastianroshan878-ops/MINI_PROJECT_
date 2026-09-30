import { useConfig } from '../context/ConfigContext.jsx';
import { timeOnly } from '../utils.js';

// Shows the steps of an order (Placed -> Preparing -> ...) and where it is now.
export default function OrderTimeline({ order }) {
  const config = useConfig();
  const flow = config.orderFlow[order.type];

  if (order.status === 'cancelled') {
    return <div className="alert alert-red">This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : ''}.</div>;
  }

  const current = flow.indexOf(order.status);
  const labelFor = (step) => {
    if (step === 'ready') return order.type === 'parcel' ? 'Ready for pickup' : order.type === 'dine-in' ? 'Ready to serve' : 'Packed and ready';
    if (step === 'completed') return order.type === 'delivery' ? 'Delivered' : order.type === 'parcel' ? 'Picked up' : 'Served';
    return config.statusLabels[step];
  };

  return (
    <ol className="timeline">
      {flow.map((step, i) => {
        const entry = (order.statusHistory || []).find((h) => h.status === step);
        const cls = i < current ? 'done' : i === current ? 'current' : '';
        return (
          <li key={step} className={cls}>
            <span className="dot">{i <= current && order.status === 'completed' ? '✓' : i < current ? '✓' : ''}</span>
            <div>
              <strong>{labelFor(step)}</strong>
              {entry && <small>{timeOnly(entry.at)}</small>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
