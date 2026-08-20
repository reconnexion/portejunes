import { WALLET_SIDEBAR_WIDTH } from './WalletSidebar';

/** Shared sizing so the app bar's content (logo/title, user menu) lines up exactly with the
 *  left column (nav + wallet) and main content column below it, instead of spanning edge to
 *  edge -- kept in its own file since PageLayout imports AppBar and would create a circular
 *  import if AppBar imported the constant from PageLayout directly. */
export const MAIN_COLUMN_WIDTH = 640;
export const COLUMN_GAP = 24;
export const PAGE_MAX_WIDTH = WALLET_SIDEBAR_WIDTH + COLUMN_GAP + MAIN_COLUMN_WIDTH;
