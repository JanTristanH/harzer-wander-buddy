import {
  buildTourShareUrl,
  buildGoogleMapsDirectionsUrl,
} from "@/lib/tour-links";
test("both tour views keep the public share landing page and encoded tour identity", () => {
  const url = new URL(buildTourShareUrl("tour/1", " Wald & Wasser "));
  expect(url.origin + url.pathname).toBe(
    "https://www.harzer-wander-buddy.de/share/tour/",
  );
  expect(url.searchParams.get("id")).toBe("tour/1");
  expect(url.searchParams.get("title")).toBe("Wald & Wasser");
});
test("whole-tour navigation preserves the ordered waypoints and walking mode", () => {
  expect(buildGoogleMapsDirectionsUrl([])).toBeNull();
  const url = new URL(
    buildGoogleMapsDirectionsUrl(["51.1,10.1", "51.2,10.2", "51.1,10.1"])!,
  );
  expect(url.searchParams.get("travelmode")).toBe("walking");
  expect(url.searchParams.get("waypoints")).toBe("51.1,10.1|51.2,10.2");
  expect(url.searchParams.get("destination")).toBe("51.1,10.1");
});
