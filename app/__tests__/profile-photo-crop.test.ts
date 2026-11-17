import { photoCropLayout, profilePhotoCrop } from '@/lib/profile-photo-crop';
test('starts with a centered square crop and zooming retains source resolution', () => {
  const image = { width: 1200, height: 800 };
  expect(profilePhotoCrop(image, 320, { x: 0, y: 0, zoom: 1 })).toEqual({
    originX: 200,
    originY: 0,
    width: 800,
    height: 800,
  });
  expect(profilePhotoCrop(image, 320, { x: 0, y: 0, zoom: 2 })).toEqual({
    originX: 400,
    originY: 200,
    width: 400,
    height: 400,
  });
});
test('moving the image changes the exported crop and cannot expose empty borders', () => {
  const image = { width: 1200, height: 800 };
  expect(profilePhotoCrop(image, 320, { x: 80, y: 0, zoom: 1 }).originX).toBe(0);
  expect(profilePhotoCrop(image, 320, { x: -9999, y: 9999, zoom: 1 })).toEqual({
    originX: 400,
    originY: 0,
    width: 800,
    height: 800,
  });
  expect(photoCropLayout(image, 320, { x: 0, y: 0, zoom: 20 }).zoom).toBe(4);
});
