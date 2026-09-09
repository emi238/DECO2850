// A self-contained "demo room" so the flow works with no camera (iOS Simulator)
// and serves as the reliable seeded demo room (PRD §10, day 6).
//
// One wide room SCENE is drawn once; each of the 8 sweep "frames" is a viewBox
// window into it, giving natural left-to-right overlap (PRD F1.3). The known
// object positions below are shared with the mock assessment so its pins land
// exactly on the drawn hazards.

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Ellipse,
  Path,
  Line,
  G,
  Polygon,
} from 'react-native-svg';
import type { Frame } from '../types';

export const SCENE_W = 1800;
export const SCENE_H = 480;
export const FRAME_W = 360;
export const FRAME_H = 480;
export const FRAME_COUNT = 8;
export const STEP = (SCENE_W - FRAME_W) / (FRAME_COUNT - 1); // ~205.7

export function frameOriginX(i: number): number {
  return i * STEP;
}

export function frameViewBox(i: number): string {
  return `${frameOriginX(i)} 0 ${FRAME_W} ${FRAME_H}`;
}

// Convert a point in SCENE space to normalised [0,1] coords WITHIN a given frame.
export function sceneToFrame(
  sx: number,
  sy: number,
  frameIndex: number
): { x: number; y: number } {
  const ox = frameOriginX(frameIndex);
  return {
    x: clamp01((sx - ox) / FRAME_W),
    y: clamp01(sy / FRAME_H),
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Known object anchors in SCENE space, with the frame each is best centred in.
// The mock reads these so findings pin onto the real drawing.
export const DEMO_OBJECTS = {
  window: { sx: 225, sy: 175, frame: 0 },
  plant: { sx: 300, sy: 300, frame: 1 },
  vase: { sx: 740, sy: 250, frame: 3 },
  cords: { sx: 960, sy: 360, frame: 4 },
  balconyDoor: { sx: 1190, sy: 205, frame: 5 },
  cleaners: { sx: 1440, sy: 380, frame: 6 },
} as const;

export const DEMO_FRAMES: Frame[] = Array.from({ length: FRAME_COUNT }, (_, i) => ({
  uri: `demo:${i}`,
}));

export function isDemoUri(uri: string): boolean {
  return uri.startsWith('demo:');
}

export function demoIndex(uri: string): number {
  return parseInt(uri.slice('demo:'.length), 10);
}

// The full room, drawn in SCENE space. Rendered inside an <Svg viewBox=...>.
function RoomScene() {
  return (
    <G>
      {/* Back wall gradient */}
      <Rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill="url(#wall)" />
      {/* Floor band (lower third) — hard tile */}
      <Rect x={0} y={335} width={SCENE_W} height={SCENE_H - 335} fill="url(#floor)" />
      <Line x1={0} y1={335} x2={SCENE_W} y2={335} stroke="#00000018" strokeWidth={2} />
      {/* Faint tile seams to read as slippery hard floor */}
      {Array.from({ length: 14 }).map((_, i) => (
        <Line
          key={`tile${i}`}
          x1={i * 140}
          y1={335}
          x2={i * 140 - 40}
          y2={SCENE_H}
          stroke="#0000000e"
          strokeWidth={2}
        />
      ))}

      {/* ---- Window (screenless), 8th floor -> fall/escape hazard ---- */}
      <G>
        <Rect x={110} y={55} width={230} height={250} rx={6} fill="#2b3440" />
        <Rect x={120} y={65} width={210} height={230} rx={3} fill="url(#sky)" />
        {/* mullions */}
        <Line x1={225} y1={65} x2={225} y2={295} stroke="#eef2f6" strokeWidth={6} />
        <Line x1={120} y1={180} x2={330} y2={180} stroke="#eef2f6" strokeWidth={6} />
        {/* clouds */}
        <Ellipse cx={180} cy={120} rx={26} ry={12} fill="#ffffffcc" />
        <Ellipse cx={280} cy={230} rx={30} ry={13} fill="#ffffffbb" />
        {/* window sill */}
        <Rect x={100} y={305} width={250} height={14} fill="#c9ccd2" />
        {/* NO screen — open sash gap implied by the ajar pane */}
        <Rect x={228} y={65} width={102} height={110} fill="#8fb7d6" opacity={0.55} />
      </G>

      {/* ---- Low houseplant on a stool near the window (toxic plant) ---- */}
      <G>
        <Rect x={280} y={315} width={40} height={20} fill="#8a6b4f" />
        <Polygon points="278,315 322,315 314,285 286,285" fill="#b5844f" />
        <Path d="M300 285 C 285 250, 270 255, 275 285 Z" fill="#3f7d4e" />
        <Path d="M300 285 C 315 245, 335 255, 322 288 Z" fill="#4c9560" />
        <Path d="M300 285 C 300 240, 305 240, 302 285 Z" fill="#3f7d4e" />
        <Path d="M300 285 C 288 258, 300 250, 300 285 Z" fill="#57a56c" />
      </G>

      {/* ---- Bookshelf with a fragile vase on a low shelf ---- */}
      <G>
        <Rect x={620} y={120} width={210} height={215} fill="#7a5a3c" />
        <Rect x={628} y={128} width={194} height={199} fill="#8c6a48" />
        {[128, 196, 264].map((y) => (
          <Rect key={`sh${y}`} x={628} y={y} width={194} height={8} fill="#6b4f36" />
        ))}
        {/* books on upper shelves */}
        {[
          [640, 140, '#c05a4a'], [656, 138, '#4a6ec0'], [672, 142, '#c0a24a'],
          [688, 139, '#4ac08a'], [704, 141, '#8a4ac0'],
        ].map(([x, y, c], i) => (
          <Rect key={`bk${i}`} x={x as number} y={y as number} width={12} height={52} fill={c as string} />
        ))}
        {/* the fragile antique vase on the LOW shelf */}
        <G>
          <Path
            d="M730 300 C 715 300, 715 268, 728 262 C 720 256, 720 248, 740 248 C 760 248, 760 256, 752 262 C 765 268, 765 300, 750 300 Z"
            fill="#d8e3ea"
            stroke="#9fb0bd"
            strokeWidth={2}
          />
          <Ellipse cx={740} cy={302} rx={22} ry={5} fill="#00000018" />
        </G>
      </G>

      {/* ---- TV console with a tangle of exposed cords near the floor ---- */}
      <G>
        <Rect x={860} y={250} width={200} height={85} fill="#3a3f47" />
        <Rect x={892} y={165} width={136} height={82} rx={6} fill="#12151a" />
        <Rect x={900} y={173} width={120} height={66} rx={3} fill="#20303f" />
        {/* cords draping to a power strip on the floor */}
        <Path d="M900 335 C 890 360, 930 360, 920 400 C 912 430, 950 430, 940 455" stroke="#20242b" strokeWidth={5} fill="none" />
        <Path d="M960 335 C 975 365, 940 380, 965 410 C 985 435, 950 445, 975 460" stroke="#2b2f38" strokeWidth={5} fill="none" />
        <Path d="M1000 335 C 1010 370, 980 385, 1000 420" stroke="#20242b" strokeWidth={5} fill="none" />
        <Rect x={905} y={452} width={90} height={16} rx={4} fill="#4a4f57" />
      </G>

      {/* ---- Balcony sliding door (railing visible behind glass) ---- */}
      <G>
        <Rect x={1090} y={60} width={210} height={275} fill="#2b3440" />
        <Rect x={1100} y={70} width={92} height={255} fill="url(#sky)" opacity={0.9} />
        <Rect x={1198} y={70} width={92} height={255} fill="url(#sky)" opacity={0.75} />
        {/* balcony railing bars behind the glass -> conveys height/balcony */}
        {Array.from({ length: 7 }).map((_, i) => (
          <Line key={`rail${i}`} x1={1100 + i * 30} y1={250} x2={1100 + i * 30} y2={325} stroke="#6b7684" strokeWidth={4} />
        ))}
        <Line x1={1100} y1={255} x2={1290} y2={255} stroke="#6b7684" strokeWidth={5} />
        {/* door handle */}
        <Rect x={1196} y={185} width={8} height={48} rx={4} fill="#c9ccd2" />
      </G>

      {/* ---- Low cabinet with cleaning products spilling onto the floor ---- */}
      <G>
        <Rect x={1360} y={250} width={170} height={90} fill="#e7e2d8" />
        <Rect x={1360} y={250} width={82} height={90} fill="#dcd6ca" />
        {/* open door */}
        <Rect x={1300} y={250} width={60} height={90} fill="#cfc7b8" />
        {/* bottles on the floor */}
        {[
          [1400, '#4aa3c0'], [1424, '#c0684a'], [1448, '#7bbf5a'], [1470, '#c0a24a'],
        ].map(([x, c], i) => (
          <G key={`bot${i}`}>
            <Rect x={x as number} y={355} width={18} height={40} rx={4} fill={c as string} />
            <Rect x={(x as number) + 5} y={347} width={8} height={10} fill="#efeee9" />
          </G>
        ))}
      </G>

      {/* ---- Sofa (climbable) + open floor space ---- */}
      <G>
        <Rect x={1560} y={235} width={230} height={100} rx={18} fill="#8a94a3" />
        <Rect x={1560} y={210} width={230} height={55} rx={16} fill="#9aa4b3" />
        <Rect x={1576} y={224} width={95} height={44} rx={12} fill="#aab4c2" />
        <Rect x={1679} y={224} width={95} height={44} rx={12} fill="#aab4c2" />
      </G>
    </G>
  );
}

// Reusable gradient defs — declared once per Svg instance.
function SceneDefs() {
  return (
    <Defs>
      <LinearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#f3efe7" />
        <Stop offset="1" stopColor="#e4ddd0" />
      </LinearGradient>
      <LinearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#d9cfc0" />
        <Stop offset="1" stopColor="#c8bca9" />
      </LinearGradient>
      <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#bfe0f5" />
        <Stop offset="1" stopColor="#e9f5fb" />
      </LinearGradient>
    </Defs>
  );
}

// A single demo frame: a viewBox window into the shared room scene.
export function DemoFrame({
  index,
  width,
  height,
}: {
  index: number;
  width: number;
  height: number;
}) {
  return (
    <Svg width={width} height={height} viewBox={frameViewBox(index)}>
      <SceneDefs />
      <RoomScene />
    </Svg>
  );
}

// Offscreen rasteriser: renders the 8 demo frames and turns each into a PNG
// (base64) so the built-in demo room can be sent to the real model on the
// Simulator, where there is no camera. Mount it, get the base64 back via onDone.
const RASTER_W = 480;
const RASTER_H = 640;

export function DemoRasterizer({ onDone }: { onDone: (frames: Frame[]) => void }) {
  const refs = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const out: string[] = new Array(FRAME_COUNT).fill('');
    let remaining = FRAME_COUNT;
    const finish = () => {
      if (cancelled) return;
      onDone(
        DEMO_FRAMES.map((f, i) => ({
          uri: f.uri,
          base64: out[i] || undefined,
          mime: 'image/png',
        }))
      );
    };
    // Let the SVGs lay out before capturing.
    const t = setTimeout(() => {
      for (let i = 0; i < FRAME_COUNT; i++) {
        const svg = refs.current[i];
        if (svg && typeof svg.toDataURL === 'function') {
          svg.toDataURL((data: string) => {
            // Some platforms include the data: prefix; strip it if present.
            out[i] = data.replace(/^data:image\/\w+;base64,/, '');
            remaining -= 1;
            if (remaining === 0) finish();
          });
        } else {
          remaining -= 1;
          if (remaining === 0) finish();
        }
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [onDone]);

  return (
    <View style={{ position: 'absolute', width: RASTER_W, height: RASTER_H, opacity: 0 }} pointerEvents="none">
      {Array.from({ length: FRAME_COUNT }).map((_, i) => (
        <Svg
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          width={RASTER_W}
          height={RASTER_H}
          viewBox={frameViewBox(i)}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <SceneDefs />
          <RoomScene />
        </Svg>
      ))}
    </View>
  );
}
