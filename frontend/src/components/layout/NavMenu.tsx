import { cloneElement, type ReactElement } from 'react';
import { Card } from 'antd';
import { Link } from 'react-router';
import { useMenu } from '@refinedev/core';

/** Nav for the app's four screens (Payer/Recevoir/Opérations/Contacts) -- reads straight off the
 *  `resources` passed to `<Refine>` in App.tsx (name/route/icon/label), so there's a single place
 *  that defines the app's pages instead of a second hardcoded list.
 *
 *  Renders two variants, toggled by CSS media query (`.pj-nav-desktop` / `.pj-nav-mobile` in
 *  index.css) rather than a JS breakpoint hook -- simpler, and avoids a resize-driven re-render:
 *  a vertical list above the wallet card on wide viewports, a fixed bottom tab bar (icon +
 *  label, like a native app) on narrow ones. */
const NavMenu = () => {
  const { menuItems, selectedKey } = useMenu();

  return (
    <>
      <Card className="pj-nav-desktop" style={{ width: '100%', marginBottom: 16 }} styles={{ body: { padding: 8 } }}>
        {menuItems.map(item => {
          const selected = item.key === selectedKey;
          return (
            <Link
              key={item.key}
              to={item.route ?? '/'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 6,
                fontWeight: selected ? 600 : 400,
                color: selected ? '#2E7D32' : 'rgba(0, 0, 0, 0.85)',
                background: selected ? '#e8f5e9' : 'transparent'
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </Card>

      <nav className="pj-nav-mobile">
        {menuItems.map(item => {
          const selected = item.key === selectedKey;
          return (
            <Link
              key={item.key}
              to={item.route ?? '/'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                flex: 1,
                padding: '8px 0',
                fontSize: 11,
                fontWeight: selected ? 600 : 400,
                color: selected ? '#2E7D32' : 'rgba(0, 0, 0, 0.65)'
              }}
            >
              {item.icon && cloneElement(item.icon as ReactElement<any>, { style: { fontSize: 20 } })}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default NavMenu;
