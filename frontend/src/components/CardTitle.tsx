import type { ReactNode } from 'react';

/** Card title with the page's nav icon in front, in the primary green -- reads as a section
 *  heading rather than a table header. Size and the absence of a separator line come from the
 *  theme's Card tokens and index.css (.ant-card-head). Use the same icon as the NavMenu entry so
 *  the heading echoes where the user just clicked. */
const CardTitle = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 10, lineHeight: 1.2 }}>
    <span style={{ color: '#3C8C40', display: 'inline-flex', fontSize: '0.95em' }}>{icon}</span>
    {children}
  </span>
);

export default CardTitle;
