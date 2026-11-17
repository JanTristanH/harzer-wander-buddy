import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { StampNoticesSection } from "@/components/stamp-notices-section";
import { StampNoticeBadge } from "@/components/stamp-notice-badge";
import { fetchStampNoticeReportCooldown, reportStampNotice } from "@/lib/api";
import { parseActiveNotices } from "@/lib/stamp-notices";

let mockToken: string | null = "test-token";
let mockOffline = false;
const mockPush = jest.fn();
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: mockToken }),
}));
jest.mock("@/lib/connectivity", () => ({
  useConnectivity: () => ({ isOffline: mockOffline }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/api", () => ({ reportStampNotice: jest.fn(), fetchStampNoticeReportCooldown: jest.fn() }));
const value = JSON.stringify([
  {
    ID: "notice1",
    kind: "closure",
    source: "community",
    message: "Zugang ab Parkplatz gesperrt.",
  },
]);
beforeEach(() => {
  jest.clearAllMocks();
  mockToken = "test-token";
  mockOffline = false;
  (fetchStampNoticeReportCooldown as jest.Mock).mockResolvedValue(null);
});

test("warning is visible and exposes its moderation/source information", async () => {
  render(<StampNoticesSection stampId="stamp1" value={value} />);
  await screen.findByText("Sperrung oder Defekt melden");
  expect(screen.getByText("⚡ Sperrung")).toBeTruthy();
  expect(screen.getByText("Zugang ab Parkplatz gesperrt.")).toBeTruthy();
  expect(screen.getByText("Community · vom Admin freigegeben")).toBeTruthy();
});
test("report is submitted for review, with success and no premature public warning", async () => {
  (reportStampNotice as jest.Mock).mockResolvedValue({});
  render(<StampNoticesSection stampId="stamp1" />);
  fireEvent.press(await screen.findByText("Sperrung oder Defekt melden"));
  fireEvent.changeText(
    screen.getByLabelText("Beschreibung der Meldung"),
    "  Der Stempelkasten ist beschädigt.  ",
  );
  fireEvent.press(screen.getByText("Zur Prüfung senden"));
  await waitFor(() =>
    expect(reportStampNotice).toHaveBeenCalledWith(
      "test-token",
      "stamp1",
      "defect",
      "Der Stempelkasten ist beschädigt.",
    ),
  );
  await waitFor(() =>
    expect(screen.getByText(/Danke! Deine Meldung wird geprüft/)).toBeTruthy(),
  );
  expect(screen.queryByText("⚡ Defekt")).toBeNull();
  expect(screen.queryByText("Sperrung oder Defekt melden")).toBeNull();
});
test("failed submission retains entered text and permits retry", async () => {
  (reportStampNotice as jest.Mock).mockRejectedValue(new Error("network"));
  render(<StampNoticesSection stampId="stamp1" />);
  fireEvent.press(await screen.findByText("Sperrung oder Defekt melden"));
  fireEvent.changeText(
    screen.getByLabelText("Beschreibung der Meldung"),
    "Der Stempelkasten ist beschädigt.",
  );
  fireEvent.press(screen.getByText("Zur Prüfung senden"));
  await waitFor(() =>
    expect(screen.getByText(/konnte nicht gesendet/)).toBeTruthy(),
  );
  expect(
    screen.getByDisplayValue("Der Stempelkasten ist beschädigt."),
  ).toBeTruthy();
});
test("offline state keeps cached warnings and blocks report submission", async () => {
  mockOffline = true;
  render(<StampNoticesSection stampId="stamp1" value={value} />);
  expect(screen.getByText(/Offline: zuletzt geladener Stand/)).toBeTruthy();
  fireEvent.press(await screen.findByText("Sperrung oder Defekt melden"));
  expect(screen.queryByText("Zur Prüfung senden")).toBeNull();
  expect(reportStampNotice).not.toHaveBeenCalled();
});
test("guest can read warnings and is directed to login when reporting", () => {
  mockToken = null;
  render(<StampNoticesSection stampId="stamp1" value={value} />);
  fireEvent.press(screen.getByText("Zum Melden anmelden"));
  expect(mockPush).toHaveBeenCalledWith("/login");
});
test("badge and parser handle empty or malformed cached data", () => {
  expect(parseActiveNotices("not-json")).toEqual([]);
  expect(parseActiveNotices('[{"ID":"x"}]')).toEqual([]);
  const { rerender } = render(<StampNoticeBadge />);
  expect(screen.queryByText(/⚡/)).toBeNull();
  rerender(<StampNoticeBadge value={value} />);
  expect(
    screen.getByLabelText("1 aktuelle Sperrungen oder Hinweise"),
  ).toBeTruthy();
});

test("server cooldown survives reopening and expires after 24 hours", async () => {
  jest.useFakeTimers();
  (fetchStampNoticeReportCooldown as jest.Mock).mockResolvedValue(new Date(Date.now() + 1000).toISOString());
  render(<StampNoticesSection stampId="stamp1" />);
  await act(async () => {});
  expect(fetchStampNoticeReportCooldown).toHaveBeenCalledWith("test-token", "stamp1");
  expect(screen.queryByText("Sperrung oder Defekt melden")).toBeNull();
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(screen.getByText("Sperrung oder Defekt melden")).toBeTruthy();
  jest.useRealTimers();
});
test("cooldown for one stamp does not hide another stamp or another user's report button", async () => {
  (fetchStampNoticeReportCooldown as jest.Mock).mockResolvedValueOnce(new Date(Date.now() + 86400000).toISOString());
  const { rerender } = render(<StampNoticesSection stampId="stamp1" />);
  await waitFor(() => expect(fetchStampNoticeReportCooldown).toHaveBeenCalledTimes(1));
  rerender(<StampNoticesSection stampId="stamp2" />);
  expect(await screen.findByText("Sperrung oder Defekt melden")).toBeTruthy();
  mockToken = "other-user";
  rerender(<StampNoticesSection stampId="stamp1" />);
  expect(await screen.findByText("Sperrung oder Defekt melden")).toBeTruthy();
});
