import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { StampSelectionCelebration } from '@/components/stamp-selection-feedback';
import { STAMP_SELECTION_FILL_MS, stampSelectionTiming } from '@/lib/stamp-selection-motion';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it.each([1, 3, 10, 222])('shows one flying stamp per confirmed visit (%i)', (count) => {
  const finish = jest.fn();
  render(<StampSelectionCelebration count={count} onFinish={finish} />);
  expect(screen.getByTestId('stamp-success-buddy-badge', { includeHiddenElements: true }).props.source).toEqual(require('@/assets/images/buddy/stamp-success-badge.png'));
  expect(screen.getAllByTestId('stamp-flying-visit', { includeHiddenElements: true })).toHaveLength(count);
  // The old live animation already ended here. The new seal is still readable.
  act(() => jest.advanceTimersByTime(1500));
  expect(finish).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(stampSelectionTiming(count).durationMs + 150));
  expect(finish).toHaveBeenCalledTimes(1);
});

it('keeps the normal success moment slower than the combined demo without making large batches unbounded', () => {
  expect(STAMP_SELECTION_FILL_MS + stampSelectionTiming(1).durationMs).toBeGreaterThanOrEqual(4000);
  expect(stampSelectionTiming(3).sealStartMs).toBeGreaterThan(stampSelectionTiming(1).sealStartMs);
  expect(stampSelectionTiming(222).durationMs).toBeLessThan(5000);
});
