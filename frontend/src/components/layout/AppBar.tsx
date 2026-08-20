import { Layout } from 'antd';
import { Link } from 'react-router';

import UserMenu from './UserMenu';
import { PAGE_MAX_WIDTH } from './constants';
import g1Logo from '../../assets/g1-logo.svg';
import { APP_NAME } from '../../config/env';

export const APP_BAR_HEIGHT = 64;

// The gradient background spans the full viewport width, but its content (logo/title, user
// menu) is constrained to PAGE_MAX_WIDTH and centered, so it lines up with the left column and
// main content column below it instead of sitting flush against the viewport edges.
const AppBar = () => (
  <Layout.Header className="pj-header-gradient" style={{ height: APP_BAR_HEIGHT, padding: 0, color: '#fff', boxShadow: 'none' }}>
    <div
      style={{
        maxWidth: PAGE_MAX_WIDTH,
        height: '100%',
        margin: '0 auto',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Link to="/" className="pj-appbar-title">
        <img src={g1Logo} alt="" width={32} height={32} />
        {APP_NAME}
      </Link>
      <UserMenu />
    </div>
  </Layout.Header>
);

export default AppBar;
