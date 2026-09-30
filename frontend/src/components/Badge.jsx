import { statusTone, prettyStatus } from '../utils.js';

// <Badge status="preparing" /> shows a coloured label. Or pass tone + children for custom text.
export default function Badge({ status, tone, children }) {
  const colour = tone || statusTone(status);
  return <span className={`badge tone-${colour}`}>{children || prettyStatus(status)}</span>;
}
