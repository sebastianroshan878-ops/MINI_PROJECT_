import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Stars } from '../../components/Stars.jsx';
import { dateTime } from '../../utils.js';

function ReplyBox({ item, onDone }) {
  const [text, setText] = useState(item.reply || '');
  const [open, setOpen] = useState(false);
  const toast = useToast();

  async function send() {
    try {
      await api.patch(`/feedback/${item._id}/reply`, { reply: text });
      toast('Reply sent', 'success');
      setOpen(false);
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (item.reply && !open) return <p className="reply">Your reply: {item.reply} <button className="link-btn" onClick={() => setOpen(true)}>Edit</button></p>;
  return open ? (
    <div className="form-grid">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply..." />
      <button className="btn btn-sm btn-primary" onClick={send}>Send</button>
    </div>
  ) : (
    <button className="link-btn" onClick={() => setOpen(true)}>Reply</button>
  );
}

export default function FeedbackAdmin() {
  const [rating, setRating] = useState('');
  const [list, setList] = useState([]);
  const load = () => api.get(`/feedback${rating ? `?rating=${rating}` : ''}`).then(setList);
  useEffect(load, [rating]);

  return (
    <div className="stack">
      <h1>Reviews</h1>
      <div className="chip-row">
        <button className={`chip ${rating === '' ? 'active' : ''}`} onClick={() => setRating('')}>All</button>
        {[5, 4, 3, 2, 1].map((n) => <button key={n} className={`chip ${rating === String(n) ? 'active' : ''}`} onClick={() => setRating(String(n))}>{n} ★</button>)}
      </div>

      <div className="stack">
        {list.map((f) => (
          <div key={f._id} className="list-card">
            <div className="spread"><Stars value={f.rating} /><span className="muted small">{dateTime(f.createdAt)}</span></div>
            <strong>{f.customerName}</strong>{f.orderNumber && <span className="muted small"> • {f.orderNumber}</span>}
            <p>{f.comment || <span className="muted">No comment</span>}</p>
            <ReplyBox item={f} onDone={load} />
          </div>
        ))}
        {list.length === 0 && <p className="muted">No reviews yet.</p>}
      </div>
    </div>
  );
}
