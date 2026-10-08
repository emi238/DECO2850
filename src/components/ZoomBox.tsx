// Pinch-to-zoom box for a photo, in place (Review and Tagging carousels).
// Uses the iOS ScrollView's built-in zoom; Android ignores maximumZoomScale,
// so there it simply shows the photo unzoomed. At 1x the content is exactly
// the box size, so nothing scrolls and taps/swipes pass through as before.
// Children keep their own (unscaled) coordinates while zoomed, so tap
// positions and pins inside still line up with the photo.

import React from 'react';
import { ScrollView } from 'react-native';

export function ZoomBox({
  width,
  height,
  radius = 12,
  children,
}: {
  width: number;
  height: number;
  radius?: number;
  children: React.ReactNode;
}) {
  return (
    <ScrollView
      style={{ width, height, borderRadius: radius, overflow: 'hidden', flexGrow: 0 }}
      contentContainerStyle={{ width, height }}
      minimumZoomScale={1}
      maximumZoomScale={4}
      bouncesZoom
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      scrollsToTop={false}
    >
      {children}
    </ScrollView>
  );
}
