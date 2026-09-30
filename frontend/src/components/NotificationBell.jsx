import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import { dateTime } from '../utils.js';

// The bell icon: shows reservation confirmations, order updates, payments and so on.
export default function NotificationBell() {
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  usePolling(() => {
    api.get('/notifications').then(setData).catch(() => {});
  }, 15000);

  // close the panel when clicking anywhere else
  useEffect(() => {
    const onClick = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markAllRead() {
    await api.post('/notifications/read-all');
    setData((d) => ({ notifications: d.notifications.map((n) => ({ ...n, read: true })), unread: 0 }));
  }

  return (
    <div className="bell" ref={box}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={`Notifications, ${data.unread} unread`}>
        🔔{data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          <div className="spread bell-head">
            <strong>Notifications</strong>
            {data.unread > 0 && <button className="link-btn" onClick={markAllRead}>Mark all read</button>}
          </div>
          {data.notifications.length === 0 && <p className="muted pad">Nothing here yet.</p>}
          <ul>
            {data.notifications.map((n) => (
              <li key={n._id} className={n.read ? '' : 'unread'}>
                <strong>{n.title}</strong>
                <span>{n.message}</span>
                <small>{dateTime(n.createdAt)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
