import { Platform } from 'react-native';

const DEFAULT_BOTTOM_MARGIN = 20;
const ANDROID_NAVBAR_CLEARANCE = 12;
const TAB_BAR_HEIGHT = 72;
const MAP_SHEET_GAP = 8;
const FLOATING_ACTION_GAP = 16;

export function getTabBarBottomMargin(bottomInset: number) {
  if (Platform.OS === 'android' && bottomInset > 0) {
    return bottomInset + ANDROID_NAVBAR_CLEARANCE;
  }

  return DEFAULT_BOTTOM_MARGIN;
}

export function getFloatingActionBottomOffset(bottomInset: number) {
  return getTabBarBottomMargin(bottomInset) + TAB_BAR_HEIGHT + FLOATING_ACTION_GAP;
}

export function getMapSheetBottomOffset(bottomInset: number) {
  return getTabBarBottomMargin(bottomInset) + TAB_BAR_HEIGHT + MAP_SHEET_GAP;
}
