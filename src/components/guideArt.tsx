// Simple drawn illustrations for the "How to scan" and "How to flag" guides
// (GuideSheet). Flat shapes in the app's colours, drawn with react-native-svg so
// they stay sharp at any size. Each one fills a 280×150 box.

import React from 'react';
import Svg, { Path, Rect, Circle, Line, G } from 'react-native-svg';
import { colors } from '../theme';

const INK = colors.text;
const ORANGE = colors.orange;
const DEEP = colors.orangeDeep;
const WHITE = '#FFFFFF';
const SOFT = '#F3E3D0'; // furniture / photo backgrounds

function Art({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 280 150" preserveAspectRatio="xMidYMid meet">
      {children}
    </Svg>
  );
}

// A phone seen from above or the side: rounded body with a lens dot.
function Phone({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <Rect x={-9} y={-15} width={18} height={30} rx={4} fill={INK} />
      <Rect x={-6.5} y={-11} width={13} height={21} rx={2} fill={ORANGE} />
      <Circle cx={0} cy={-13} r={1.2} fill={WHITE} />
    </G>
  );
}

// ---------- How to scan ----------

// 1. Start in a corner and sweep across the room.
export function ScanCornerArt() {
  return (
    <Art>
      {/* Room from above */}
      <Rect x={70} y={14} width={140} height={122} rx={6} fill={WHITE} stroke={INK} strokeWidth={2.5} />
      <Rect x={150} y={24} width={50} height={22} rx={4} fill={SOFT} />
      <Rect x={160} y={86} width={36} height={36} rx={18} fill={SOFT} />
      <Rect x={80} y={24} width={24} height={16} rx={3} fill={SOFT} />
      {/* Sweep from the corner */}
      <Path d="M86 124 L206 30" stroke={ORANGE} strokeWidth={2} strokeDasharray="5 5" />
      <Path d="M86 124 L206 84" stroke={ORANGE} strokeWidth={2} strokeDasharray="5 5" />
      <Path d="M86 124 L150 22" stroke={ORANGE} strokeWidth={2} strokeDasharray="5 5" />
      <Path d="M112 112 A30 30 0 0 0 104 96" stroke={DEEP} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M101 99 L104 95 L108 98" stroke={DEEP} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Phone x={86} y={122} rotate={-45} />
    </Art>
  );
}

// 2. Turn slowly so each photo overlaps the last.
export function ScanOverlapArt() {
  const frame = (x: number, y: number, r: number, n: number, on: boolean) => (
    <G transform={`translate(${x} ${y}) rotate(${r})`}>
      <Rect x={-42} y={-32} width={84} height={64} rx={6} fill={WHITE} stroke={on ? ORANGE : INK} strokeWidth={2.5} />
      <Rect x={-34} y={2} width={68} height={22} rx={3} fill={SOFT} />
      <Rect x={8} y={-22} width={22} height={18} rx={2} fill="#D7E9F7" />
      <G transform="translate(-60 0)">
        <Circle cx={30} cy={-22} r={9} fill={on ? ORANGE : colors.track} />
      <Path
        d={n === 1 ? 'M30 -26 L30 -18' : n === 2 ? 'M27 -25 Q30 -28 33 -25 L27 -18 L33 -18' : 'M27 -26 L33 -26 L29 -22 Q34 -21 31 -18 L27 -18'}
        stroke={INK}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      </G>
    </G>
  );
  return (
    <Art>
      {frame(82, 80, -8, 1, false)}
      {frame(140, 72, 0, 2, false)}
      {frame(198, 80, 8, 3, true)}
    </Art>
  );
}

// 3. Get low: floors, cords and plants at dog height.
export function ScanLowArt() {
  return (
    <Art>
      {/* Wall, floor and the "dog height" band */}
      <Rect x={20} y={88} width={240} height={40} rx={4} fill="#FFF3E3" />
      <Line x1={20} y1={128} x2={260} y2={128} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={20} y1={88} x2={260} y2={88} stroke={ORANGE} strokeWidth={2} strokeDasharray="6 5" />
      {/* Plant */}
      <Path d="M70 128 L66 104 L90 104 L86 128 Z" fill={DEEP} />
      <Path d="M78 104 Q64 84 72 74 Q80 88 78 104 Q84 82 96 80 Q90 96 78 104" fill="#7FB069" />
      {/* Socket and cord */}
      <Rect x={232} y={98} width={16} height={20} rx={3} fill={WHITE} stroke={INK} strokeWidth={2} />
      <Circle cx={237} cy={108} r={1.5} fill={INK} />
      <Circle cx={243} cy={108} r={1.5} fill={INK} />
      <Path d="M236 118 Q220 128 200 124 Q170 118 150 126" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* Phone tilted down at the floor */}
      <Path d="M160 40 L120 110" stroke={ORANGE} strokeWidth={2} strokeDasharray="4 4" />
      <Path d="M160 40 L200 116" stroke={ORANGE} strokeWidth={2} strokeDasharray="4 4" />
      <Phone x={160} y={34} rotate={180} />
    </Art>
  );
}

// 4. Show the exits: doors, windows, balcony and stairs.
export function ScanExitsArt() {
  return (
    <Art>
      <Line x1={14} y1={132} x2={266} y2={132} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      {/* Door, slightly open */}
      <Rect x={28} y={34} width={56} height={98} rx={3} fill={SOFT} stroke={INK} strokeWidth={2.5} />
      <Path d="M28 34 L64 44 L64 128 L28 132 Z" fill={WHITE} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <Circle cx={58} cy={88} r={3} fill={DEEP} />
      {/* Window */}
      <Rect x={110} y={30} width={64} height={56} rx={3} fill="#D7E9F7" stroke={INK} strokeWidth={2.5} />
      <Line x1={142} y1={30} x2={142} y2={86} stroke={INK} strokeWidth={2.5} />
      <Line x1={110} y1={58} x2={174} y2={58} stroke={INK} strokeWidth={2.5} />
      {/* Stairs */}
      <Path d="M196 132 L196 112 L216 112 L216 92 L236 92 L236 72 L256 72 L256 132 Z" fill={SOFT} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      {/* Highlight rings */}
      <Circle cx={56} cy={30} r={8} fill={ORANGE} />
      <Circle cx={142} cy={22} r={8} fill={ORANGE} />
      <Circle cx={226} cy={62} r={8} fill={ORANGE} />
    </Art>
  );
}

// ---------- How to flag ----------

// A flag pin as it appears on the photo: orange circle with a star.
function Pin({ x, y, faded }: { x: number; y: number; faded?: boolean }) {
  return (
    <G transform={`translate(${x} ${y})`} opacity={faded ? 0.35 : 1}>
      <Circle r={13} fill={ORANGE} stroke={WHITE} strokeWidth={2.5} />
      <Path d="M0 -7 L2 -2 L7.5 -2 L3 1.5 L4.8 7 L0 3.8 L-4.8 7 L-3 1.5 L-7.5 -2 L-2 -2 Z" fill={WHITE} />
    </G>
  );
}

function Photo({ children }: { children?: React.ReactNode }) {
  return (
    <G>
      <Rect x={50} y={10} width={180} height={130} rx={8} fill={WHITE} stroke={INK} strokeWidth={2.5} />
      <Rect x={52} y={96} width={176} height={42} fill={SOFT} />
      {/* Shelf with a vase */}
      <Rect x={70} y={72} width={70} height={8} rx={2} fill="#C9A27E" />
      <Path d="M96 72 Q86 60 92 48 Q94 42 92 38 L108 38 Q106 42 108 48 Q114 60 104 72 Z" fill="#7FA8D9" />
      <Rect x={160} y={30} width={50} height={36} rx={3} fill="#D7E9F7" />
      {children}
    </G>
  );
}

// 1. Tap the thing you want to protect.
export function FlagTapArt() {
  return (
    <Art>
      <Photo>
        <Circle cx={100} cy={56} r={22} fill="none" stroke={ORANGE} strokeWidth={2} opacity={0.6} />
        <Circle cx={100} cy={56} r={14} fill="none" stroke={ORANGE} strokeWidth={2.5} />
        {/* Fingertip */}
        <Path d="M108 64 Q118 62 126 74 L138 96 Q142 106 132 110 L118 114 Q108 116 104 106 L100 90 Q98 84 104 84 Q108 84 110 90 Z" fill="#F2C9A8" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </Photo>
    </Art>
  );
}

// 2. Name it and pick Valuable, Fragile or Off-limits.
export function FlagNameArt() {
  return (
    <Art>
      <Rect x={40} y={14} width={200} height={122} rx={14} fill={WHITE} stroke={INK} strokeWidth={2.5} />
      <Rect x={56} y={30} width={90} height={9} rx={4} fill={INK} />
      {/* Name field */}
      <Rect x={56} y={50} width={168} height={26} rx={6} fill={colors.track} />
      <Rect x={64} y={60} width={70} height={7} rx={3} fill={colors.textFaint} />
      <Line x1={138} y1={56} x2={138} y2={70} stroke={DEEP} strokeWidth={2} />
      {/* Valuable / Fragile / Off-limits */}
      <Rect x={56} y={88} width={168} height={22} rx={6} fill={colors.track} />
      <Rect x={56} y={88} width={56} height={22} rx={6} fill={colors.orangeLight} />
      <Rect x={70} y={96} width={28} height={6} rx={3} fill={INK} />
      <Rect x={126} y={96} width={28} height={6} rx={3} fill={colors.textFaint} />
      <Rect x={182} y={96} width={28} height={6} rx={3} fill={colors.textFaint} />
      <Rect x={150} y={118} width={74} height={12} rx={4} fill={ORANGE} />
    </Art>
  );
}

// 3. Drag a flag to move it; tap it to edit or remove.
export function FlagMoveArt() {
  return (
    <Art>
      <Photo>
        <Pin x={150} y={112} faded />
        <Path d="M150 112 Q120 104 104 66" stroke={DEEP} strokeWidth={2.5} strokeDasharray="5 5" fill="none" strokeLinecap="round" />
        <Path d="M98 74 L103 64 L111 71" stroke={DEEP} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Pin x={100} y={56} />
      </Photo>
    </Art>
  );
}
