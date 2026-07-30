import { Alert, Platform } from 'react-native';

import { confirmAction } from '@/lib/confirm-action';

describe('confirmAction', () => {
  const originalPlatform = Platform.OS;
  const originalConfirm = Object.getOwnPropertyDescriptor(window, 'confirm');

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
    if (originalConfirm) {
      Object.defineProperty(window, 'confirm', originalConfirm);
    } else {
      delete (window as Partial<Window>).confirm;
    }
    jest.restoreAllMocks();
  });

  it('uses the browser confirmation and invokes the callback when accepted', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    const onConfirm = jest.fn();
    const browserConfirm = jest.fn(() => true);
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: browserConfirm,
    });

    confirmAction({
      title: 'Besuch löschen?',
      message: 'Dieser Besuchseintrag wird dauerhaft entfernt.',
      confirmText: 'Löschen',
      destructive: true,
      onConfirm,
    });

    expect(browserConfirm).toHaveBeenCalledWith(
      'Besuch löschen?\n\nDieser Besuchseintrag wird dauerhaft entfernt.'
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the callback when the browser confirmation is dismissed', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    const onConfirm = jest.fn();
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: jest.fn(() => false),
    });

    confirmAction({
      title: 'Besuch löschen?',
      message: 'Dieser Besuchseintrag wird dauerhaft entfernt.',
      confirmText: 'Löschen',
      destructive: true,
      onConfirm,
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps using Alert.alert on native platforms', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    const onConfirm = jest.fn();
    const nativeAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    confirmAction({
      title: 'Besuch löschen?',
      message: 'Dieser Besuchseintrag wird dauerhaft entfernt.',
      confirmText: 'Löschen',
      destructive: true,
      onConfirm,
    });

    expect(nativeAlert).toHaveBeenCalledWith(
      'Besuch löschen?',
      'Dieser Besuchseintrag wird dauerhaft entfernt.',
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: onConfirm,
        },
      ]
    );
  });
});
