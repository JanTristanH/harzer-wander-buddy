import {
  dialAngleDelta,
  snapDialMinutes,
  dialMinutesLabel,
} from "@/lib/time-dial";
test("unwraps the noon seam in either direction for repeated turns", () => {
  expect(dialAngleDelta(355, 5)).toBe(10);
  expect(dialAngleDelta(5, 355)).toBe(-10);
  expect(
    [0, 90, 180, 270, 0]
      .slice(1)
      .reduce(
        (minutes, angle, index) =>
          minutes + dialAngleDelta([0, 90, 180, 270][index], angle) / 6,
        120,
      ),
  ).toBe(180);
});
test("snaps to five minutes, enforces planner bounds and labels mixed durations", () => {
  expect(snapDialMinutes(1)).toBe(15);
  expect(snapDialMinutes(999)).toBe(720);
  expect(snapDialMinutes(92)).toBe(90);
  expect(snapDialMinutes(93)).toBe(95);
  expect(dialMinutesLabel(90)).toBe("1 Std. 30 Min.");
});
