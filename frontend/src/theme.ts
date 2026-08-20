import type { ThemeConfig } from 'antd';

/** Antd theme tokens: a nature/leaf green primary, replacing Refine's default blue. Kept close
 *  to plain Antd defaults otherwise (standard font stack, modest border radius) -- deliberately
 *  not a heavily custom-skinned look. */
const theme: ThemeConfig = {
  token: {
    colorPrimary: '#3C8C40',
    colorLink: '#3C8C40',
    borderRadius: 8
  },
  components: {
    Layout: {
      headerBg: 'transparent',
      bodyBg: '#f4f7f2'
    },
    Menu: {
      itemSelectedColor: '#2E7D32',
      itemSelectedBg: '#e8f5e9'
    }
  }
};

export default theme;
