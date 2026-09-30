// Tiny charts made from plain HTML/CSS (no chart library needed).

// Horizontal bars: [{ label, value }]
export function HBars({ data, format = (v) => v, color }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="muted">No data for this period yet.</p>;
  return (
    <div className="hbars">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <span className="bar-label" title={d.label}>{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className="bar-value">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Vertical columns: [{ label, value }]
export function Columns({ data, format = (v) => v, color }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="cols">
      {data.map((d) => (
        <div className="col" key={d.label}>
          <span className="col-value">{d.value > 0 ? format(d.value) : ''}</span>
          <div className="col-bar" style={{ height: `${Math.max(3, (d.value / max) * 110)}px`, background: color }} />
          <span className="col-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
