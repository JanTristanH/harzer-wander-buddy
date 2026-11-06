export function buildGoogleMapsDirectionsUrl(locations: string[]) {
  if (locations.length === 0) {
    return null;
  }

  const formatLocation = (value: string) => {
    const trimmed = value.trim();
    if (/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }

    return encodeURIComponent(trimmed);
  };

  const destination = locations[locations.length - 1];
  const waypoints = locations.slice(0, -1);
  const queryParts = [
    "api=1",
    `destination=${formatLocation(destination)}`,
    `travelmode=walking`,
  ];

  if (waypoints.length > 0) {
    queryParts.push(
      `waypoints=${waypoints.map((value) => formatLocation(value)).join("|")}`,
    );
  }

  return `https://www.google.com/maps/dir/?${queryParts.join("&")}`;
}

/** Keep the public website's existing share landing page on every tour screen. */
export function buildTourShareUrl(id: string, name: string) {
  const title = name.trim() || "Tour";
  const parameters = new URLSearchParams({
    id,
    title,
    description: `${title} in der Harzer Wanderbuddy App teilen.`,
    image: "assets/images/BuddyWithMap.webp",
  });
  return `https://www.harzer-wander-buddy.de/share/tour/?${parameters.toString()}`;
}
