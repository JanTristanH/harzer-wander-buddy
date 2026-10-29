import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import TourScreen from "@/app/tours/[id]";
let mockParams = { id: "tour", edit: "0" };
let mockUser = "alice";
let mockAuthenticated = true;
let mockWrites = true;
const mockSetParams = jest.fn(),
  mockDelete = jest.fn(),
  mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    setParams: mockSetParams,
    replace: mockReplace,
    push: jest.fn(),
  }),
}));
jest.mock("@/components/classic-tour-editor", () => ({
  __esModule: true,
  default: function Editor() {
    return require("react").createElement(
      require("react-native").Text,
      null,
      "Manueller Editor",
    );
  },
}));
jest.mock("@/components/group-selector", () => ({ GroupSelector: () => null }));
jest.mock("@/components/maps/map-primitives", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function Map(props: object, _ref: unknown) {
      return React.createElement(View, props);
    }),
    Marker: View,
    Polyline: View,
  };
});
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: mockAuthenticated,
    canPerformWrites: mockWrites,
  }),
  useIdTokenClaims: () => ({ sub: mockUser }),
}));
jest.mock("@/lib/hiking-group", () => ({
  useHikingGroup: () => ({ groupUserIds: ["alice"] }),
}));
jest.mock("@/lib/queries", () => ({
  usePointsOfInterestQuery: () => ({ data: [] }),
  useTourDetailQuery: () => ({
    data: {
      tour: {
        ID: "tour",
        name: "Waldrunde",
        createdBy: "alice",
        distance: 1000,
        duration: 1200,
        stampCount: 1,
        newStampCountForUser: 1,
      },
      path: [],
    },
  }),
  useDeleteTourMutation: () => ({ isPending: false, mutateAsync: mockDelete }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: "tour", edit: "0" };
  mockUser = "alice";
  mockAuthenticated = true;
  mockWrites = true;
  mockDelete.mockResolvedValue(null);
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);
});
test("manual creation/edit flag opens the existing editor", () => {
  mockParams.edit = "1";
  render(<TourScreen />);
  expect(screen.getByText("Manueller Editor")).toBeTruthy();
});
test("saved own tour uses the shared reader and explicitly opens editing", () => {
  render(<TourScreen />);
  expect(screen.getByTestId("tour-map-sheet")).toBeTruthy();
  fireEvent.press(screen.getByText("Tour bearbeiten"));
  expect(mockSetParams).toHaveBeenCalledWith({ edit: "1" });
});
test("other users cannot edit or delete a readable tour", () => {
  mockUser = "bob";
  render(<TourScreen />);
  fireEvent.press(screen.getByLabelText("Touraktionen"));
  expect(screen.queryByText("Tour bearbeiten")).toBeNull();
  expect(screen.queryByText("Tour löschen")).toBeNull();
});
test("delete requires confirmation and cancel keeps the tour", async () => {
  render(<TourScreen />);
  fireEvent.press(screen.getByLabelText("Touraktionen"));
  fireEvent.press(screen.getByText("Tour löschen"));
  expect(mockDelete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Abbrechen"));
  expect(mockDelete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Touraktionen"));
  fireEvent.press(screen.getByText("Tour löschen"));
  await act(async () =>
    fireEvent.press(screen.getByText("Tour endgültig löschen")),
  );
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/tours");
});
test("offline ownership does not enable writing and signed-out readers request login", () => {
  mockWrites = false;
  const view = render(<TourScreen />);
  expect(
    screen.getByRole("button", { name: "Tour bearbeiten" }).props
      .accessibilityState.disabled,
  ).toBe(true);
  view.unmount();
  mockAuthenticated = false;
  render(<TourScreen />);
  expect(screen.getByText("Anmelden")).toBeTruthy();
  expect(screen.queryByTestId("tour-map-sheet")).toBeNull();
});
