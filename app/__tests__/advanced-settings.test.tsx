import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AdvancedSettings } from '@/components/profile/advanced-settings';
import { setMapStylePreference, useMapStylePreference } from '@/lib/map-style-preferences';

function MapConsumer() {
  return <Text testID="map-style">{useMapStylePreference()}</Text>;
}

describe('advanced profile settings', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await setMapStylePreference('standard');
  });

  it('starts collapsed and preserves the selected style across closing and reopening', async () => {
    const view = render(<AdvancedSettings />);
    const heading = view.getByRole('button', { name: 'Erweiterte Einstellungen' });
    expect(heading.props.accessibilityState.expanded).toBe(false);
    expect(view.queryByText('Kartenstil')).toBeNull();

    fireEvent.press(heading);
    fireEvent.press(view.getByRole('radio', { name: 'Schnell (Raster)' }));
    await waitFor(() => expect(view.getByRole('radio', { name: 'Schnell (Raster)' }).props.accessibilityState.checked).toBe(true));
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('@hwb:map-style', 'raster');

    fireEvent.press(heading);
    expect(view.queryByText('Kartenstil')).toBeNull();
    fireEvent.press(heading);
    expect(view.getByRole('radio', { name: 'Schnell (Raster)' }).props.accessibilityState.checked).toBe(true);
  });

  it('updates mounted map consumers and retains the selection when the settings remount', async () => {
    const view = render(<><AdvancedSettings /><MapConsumer /></>);
    fireEvent.press(view.getByText('Erweiterte Einstellungen'));
    fireEvent.press(view.getByText('Schnell (Raster)'));
    await waitFor(() => expect(view.getByTestId('map-style').props.children).toBe('raster'));
    view.unmount();

    const remounted = render(<AdvancedSettings />);
    fireEvent.press(remounted.getByText('Erweiterte Einstellungen'));
    expect(remounted.getByRole('radio', { name: 'Schnell (Raster)' }).props.accessibilityState.checked).toBe(true);
  });

  it('keeps the current map style on a failed save and allows retrying', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Storage full'));
    const view = render(<><AdvancedSettings /><MapConsumer /></>);
    fireEvent.press(view.getByText('Erweiterte Einstellungen'));
    fireEvent.press(view.getByText('Schnell (Raster)'));
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByTestId('map-style').props.children).toBe('standard');
    fireEvent.press(view.getByText('Schnell (Raster)'));
    await waitFor(() => expect(view.getByTestId('map-style').props.children).toBe('raster'));
    expect(view.queryByRole('alert')).toBeNull();
    await act(async () => { await setMapStylePreference('standard'); });
  });
  it('offers all existing web styles including the reduced walking style', async () => {
    const view = render(<AdvancedSettings />);
    fireEvent.press(view.getByText('Erweiterte Einstellungen'));
    for (const label of ['Schnell (Raster)', 'Standard', 'Hell', 'Wandern reduziert']) {
      expect(view.getByRole('radio', { name: label })).toBeTruthy();
    }
    fireEvent.press(view.getByText('Wandern reduziert'));
    await waitFor(() => expect(view.getByRole('radio', { name: 'Wandern reduziert' }).props.accessibilityState.checked).toBe(true));
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('@hwb:map-style', 'walking');
  });

});
