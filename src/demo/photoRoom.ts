// Photo demo room: the living-room photo from the Figma, bundled with the app so
// "Use a demo room instead" works on the Simulator (no camera). Frames use an
// "asset:<key>" uri; the mock assessment pins its hazards onto this photo.

import { IMAGES } from '../assets';
import type { Frame, Hazard } from '../types';

export const PHOTO_ASSETS: Record<string, number> = {
  'living-room': IMAGES.livingRoom,
};

export const PHOTO_DEMO_FRAMES: Frame[] = [{ uri: 'asset:living-room' }];

export function isAssetUri(uri: string): boolean {
  return uri.startsWith('asset:');
}

export function assetSource(uri: string): number {
  return PHOTO_ASSETS[uri.slice('asset:'.length)] ?? IMAGES.livingRoom;
}

// Object findings located on the photo (x/y are fractions of the image).
export function photoDemoHazards(petLabel: string): Omit<Hazard, 'id'>[] {
  return [
    {
      category: 'D',
      title: 'Ceramic lamp within tail reach',
      scope: 'object',
      location: { frame_index: 0, x: 0.24, y: 0.47 },
      risk_to: 'both',
      severity: 'high',
      evidence: 'A tall blue-and-white ceramic lamp sits on a low side cabinet, its cord running down to the floor.',
      why_it_matters: `A wagging tail or a curious nose could pull the cord and bring the lamp down, breaking the ceramic and startling ${petLabel}.`,
      recommendation: 'Move the lamp further back or onto a higher shelf, and clip the cord along the cabinet leg.',
    },
    {
      category: 'D',
      title: 'Glass trinkets on a low table',
      scope: 'object',
      location: { frame_index: 0, x: 0.1, y: 0.74 },
      risk_to: 'both',
      severity: 'medium',
      evidence: 'A low red side table holds a glass bowl of small stones and a porcelain box, right at dog height.',
      why_it_matters: 'Small stones are a choking risk, and broken glass can cut paws.',
      recommendation: 'Clear small objects off low surfaces, or swap them for something unbreakable.',
    },
    {
      category: 'N',
      title: 'Artwork above the sofa',
      scope: 'object',
      location: { frame_index: 0, x: 0.86, y: 0.31 },
      risk_to: 'home',
      severity: 'low',
      evidence: 'A large framed painting hangs just above the sofa back.',
      why_it_matters: `If ${petLabel} jumps onto the sofa, paws can reach the lower edge of the frame.`,
      recommendation: 'Hang the painting a little higher, or teach an "off the sofa" cue early.',
    },
    {
      category: 'N',
      title: 'Patterned upholstery',
      scope: 'object',
      location: { frame_index: 0, x: 0.79, y: 0.62 },
      risk_to: 'home',
      severity: 'low',
      evidence: 'A delicate printed sofa with fringed cushions faces the room.',
      why_it_matters: 'Claws and chewing can snag the fabric and fringe.',
      recommendation: 'Add a washable throw and give the dog its own bed nearby.',
    },
  ];
}
