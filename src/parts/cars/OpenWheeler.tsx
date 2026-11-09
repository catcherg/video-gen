import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../../core/theme";
import { Box, extrude, profile, Wheel, type XY, type XYZ } from "./common";

// Generic low-poly open-wheel single-seater of the late-2000s kind, nose toward -x: stepped floor,
// multi-element wings, bargeboards, grooved tyres and a tall engine cover fin. No badges, sponsors or brand marks.
// The engine bay is the gap between the tub and the gearbox, under a removable cover.

export const OPEN_WHEELER = { frontAxleX: -15.5, rearAxleX: 15.3, bayFront: 3.9, bayRear: 9.2, plankTop: 0.75 };
const { frontAxleX, rearAxleX, bayFront, bayRear, plankTop } = OPEN_WHEELER;

const CARBON = "#343769";
const CARBON_LIGHT = "#6066a8";

export type Livery = { body: string; accent: string };
export const HERO_LIVERY: Livery = { body: "#d9dcef", accent: "#e5354b" };

const tubProfile: XY[] = [
  [-13, 1.5],
  [-13, 4.2],
  [-7, 5.2],
  [-3.8, 6.9],
  [-2.6, 6.6],
  [2, 6.6],
  [bayFront, 6.2],
  [bayFront, 1.1],
];
const noseProfile: XY[] = [
  [-25.2, 2.3],
  [-25, 3],
  [-13, 4.5],
  [-13, 1.8],
];
const coverProfile: XY[] = [
  [-0.6, 7],
  [0.2, 10.1],
  [2.6, 10.1],
  [6.5, 8.2],
  [14, 5.2],
  [14.8, 4.6],
  [14.8, 4],
  [bayFront, 6],
];
const sidepodProfile: XY[] = [
  [-1.2, 1.1],
  [-1.2, 5],
  [1, 5.5],
  [8, 4.5],
  [12, 2.6],
  [12, 1.1],
];
const gearboxProfile: XY[] = [
  [bayRear, 1],
  [bayRear, 4.2],
  [16.5, 3.6],
  [18.6, 2.6],
  [18.6, 1.8],
  [16.5, 1],
];
const finProfile: XY[] = [
  [6.2, 8],
  [13.2, 8.6],
  [14.6, 8.2],
  [14.6, 4.4],
];

const Strut: React.FC<{ a: XYZ; b: XYZ; r?: number; c?: string }> = ({ a, b, r = 0.14, c = CARBON }) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[r, r, A.distanceTo(B), 5]} />
      <meshLambertMaterial color={c} flatShading />
    </mesh>
  );
};

const Flame: React.FC<{ x: number; y: number; z: number; size: number }> = ({ x, y, z, size }) => {
  if (size <= 0.02) return null;
  return (
    <group position={[x, y, z]} rotation={[0, 0, -0.5]}>
      <mesh position={[0, 1.6 * size, 0]}>
        <coneGeometry args={[0.7 * size, 3.2 * size, 6]} />
        <meshBasicMaterial color={C.warm} />
      </mesh>
      <mesh position={[0, 1.1 * size, 0]}>
        <coneGeometry args={[0.38 * size, 2.2 * size, 6]} />
        <meshBasicMaterial color={C.hot} />
      </mesh>
    </group>
  );
};

/** Multi-element front wing. */
const FrontWing: React.FC<{ l: Livery; fine: boolean }> = ({ l, fine }) => (
  <>
    <Box p={[-26.8, 1.25, 0]} s={[4.6, 0.3, 18]} c={l.accent} />
    <Box p={[-26, 2, 0]} s={[2.4, 0.2, 16.6]} c={l.body} r={[0, 0, 0.25]} />
    {[1, -1].map((s) => (
      <group key={s}>
        <Box p={[-26.8, 1.9, s * 9]} s={[5, 2.4, 0.25]} c={CARBON} />
        <Box p={[-26.4, 0.72, s * 9.3]} s={[6.4, 0.2, 0.9]} c={CARBON_LIGHT} />
        {fine ? (
          <>
            <Box p={[-27.3, 2.55, s * 6.6]} s={[1.6, 0.14, 4.6]} c={l.accent} r={[0, 0, 0.42]} />
            <Box p={[-25.6, 2.95, s * 6.4]} s={[1.2, 0.14, 4.2]} c={l.body} r={[0, 0, 0.7]} />
            <Box p={[-26.8, 2.2, s * 4.2]} s={[4.6, 1.1, 0.12]} c={CARBON} />
            <Box p={[-24.8, 3.3, s * 7.8]} s={[1.3, 0.1, 1.5]} c={CARBON_LIGHT} r={[0, 0, 0.9]} />
          </>
        ) : null}
      </group>
    ))}
    {[1, -1].map((s) => (
      <Strut key={`pylon${s}`} a={[-24.6, 2.5, s * 0.8]} b={[-24.8, 1.4, s * 1.3]} r={0.16} />
    ))}
  </>
);

/** Driver, cockpit rim, wheel and mirrors. */
const Cockpit: React.FC<{ l: Livery; fine: boolean }> = ({ l, fine }) => (
  <>
    <Box p={[-0.6, 6.45, 0]} s={[5.4, 0.5, 3.8]} c={CARBON} />
    <Box p={[-1, 6.85, 2.05]} s={[6.4, 0.5, 0.45]} c={CARBON_LIGHT} />
    <Box p={[-1, 6.85, -2.05]} s={[6.4, 0.5, 0.45]} c={CARBON_LIGHT} />
    <mesh position={[-0.6, 7.25, 0]}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshLambertMaterial color={C.body} flatShading />
    </mesh>
    <Box p={[-1.45, 7.35, 0]} s={[0.3, 0.42, 1.5]} c={C.glass} />
    {fine ? (
      <>
        <Box p={[-0.6, 7.9, 0]} s={[1.5, 0.16, 0.5]} c={l.accent} />
        <Box p={[0.5, 7.1, 0]} s={[0.9, 1.1, 2.3]} c={CARBON_LIGHT} />
        <Box p={[-2.9, 6.7, 0]} s={[0.25, 0.7, 1.6]} c={C.coil} />
        <Box p={[-2.95, 6.75, 0]} s={[0.1, 0.25, 0.5]} c={C.intake} />
        {[1, -1].map((s) => (
          <group key={s}>
            <Strut a={[-3.7, 6.1, s * 2.6]} b={[-4.3, 6.75, s * 4.6]} r={0.09} />
            <Box p={[-4.4, 6.85, s * 4.75]} s={[0.25, 0.55, 1.15]} c={l.accent} />
            <Box p={[-4.25, 6.85, s * 4.75]} s={[0.06, 0.42, 0.95]} c={C.glass} />
          </group>
        ))}
      </>
    ) : null}
  </>
);

/** Sidepod aero and detail on one side of the car. */
const SidepodDetail: React.FC<{ l: Livery; s: number; fine: boolean }> = ({ l, s, fine }) => (
  <>
    <Box p={[-1.3, 3.2, s * 5.1]} s={[0.25, 2.6, 2.6]} c={CARBON} />
    <Box p={[3.5, 5.28, s * 5.1]} s={[8, 0.06, 3.2]} c={l.accent} r={[0, 0, Math.atan2(-1, 7)]} />
    {fine ? (
      <>
        {/* bargeboard and turning vanes ahead of the sidepod */}
        <Box p={[-7, 2.8, s * 4.9]} s={[4.2, 3.2, 0.14]} c={CARBON} />
        <Box p={[-4.2, 2.8, s * 6.5]} s={[3.2, 2.8, 0.12]} c={CARBON_LIGHT} r={[0, s * 0.25, 0]} />
        <Box p={[-3.1, 5.85, s * 6.3]} s={[1.6, 0.1, 1.4]} c={l.accent} r={[0, 0, 0.35]} />
        {/* louvres and chimney */}
        {[5, 6, 7, 8].map((x) => (
          <Box key={x} p={[x, 5.28 - (x - 3.5) / 7, s * 5.1]} s={[0.4, 0.08, 2.5]} c={CARBON} r={[0, 0, -0.3]} />
        ))}
        <mesh position={[8.7, 4.55, s * 6]} rotation={[0, 0, -0.55]}>
          <cylinderGeometry args={[0.42, 0.42, 1, 8]} />
          <meshLambertMaterial color={CARBON} flatShading />
        </mesh>
        {/* floor edge */}
        <Box p={[3.5, plankTop + 0.06, s * 6.15]} s={[16, 0.14, 0.5]} c={l.accent} />
        <Box p={[-7, plankTop - 0.1, s * 3.2]} s={[6, 0.25, 0.25]} c={CARBON_LIGHT} />
      </>
    ) : null}
  </>
);

/** Rear wing, with a two-element top plane and a lower beam wing. */
const RearWing: React.FC<{ l: Livery; fine: boolean }> = ({ l, fine }) => (
  <>
    <Box p={[20.3, 9.6, 0]} s={[3.2, 0.3, 9.4]} c={l.accent} r={[0, 0, -0.18]} />
    <Box p={[18.6, 9.1, 0]} s={[1.6, 0.2, 9.4]} c={l.body} r={[0, 0, -0.5]} />
    <Box p={[20.6, 5.2, 0]} s={[2.2, 0.25, 8.6]} c={CARBON} r={[0, 0, -0.1]} />
    {[1, -1].map((s) => (
      <group key={s}>
        <Box p={[20, 6.6, s * 4.8]} s={[6.2, 7.2, 0.25]} c={l.body} />
        {fine ? (
          <>
            <Box p={[20.4, 8.5, s * 4.95]} s={[4.4, 1.3, 0.06]} c={l.accent} />
            {[0, 1, 2].map((k) => (
              <Box key={k} p={[20 + k * 1.2 - 1.2, 4.6, s * 4.96]} s={[0.5, 1.5, 0.06]} c={CARBON} />
            ))}
          </>
        ) : null}
      </group>
    ))}
    {fine ? <Box p={[21.85, 10.1, 0]} s={[0.1, 0.42, 9.3]} c={C.hot} /> : null}
    <Strut a={[17.8, 3, 0.4]} b={[19.8, 9.2, 0.4]} r={0.2} />
    <Strut a={[17.8, 3, -0.4]} b={[19.8, 9.2, -0.4]} r={0.2} />
  </>
);

const Diffuser: React.FC<{ rain: THREE.Color }> = ({ rain }) => (
  <>
    <Box p={[19.1, 1.25, 0]} s={[3.4, 0.2, 10]} c={CARBON} r={[0, 0, 0.28]} />
    {[-3.6, -1.8, 0, 1.8, 3.6].map((z) => (
      <Box key={z} p={[19.1, 1.5, z]} s={[3.2, 1.2, 0.12]} c={CARBON_LIGHT} r={[0, 0, 0.28]} />
    ))}
    <mesh position={[19.4, 2.35, 0]}>
      <boxGeometry args={[0.4, 0.8, 1]} />
      <meshBasicMaterial color={rain} />
    </mesh>
  </>
);

export type OpenWheelerProps = {
  /** How far the engine cover has lifted, 0 = fitted. */
  coverLift: number;
  /** Rain-light and underglow pulse, 0..1. */
  pulse?: number;
  /** Exhaust flame size, 0..1. */
  flame?: number;
  squat?: number;
  /** Set during engine close-ups, so the car's tall parts stop catching the eye. */
  showRearWing?: boolean;
  /** Wheel rotation in radians. */
  wheelSpin?: number;
  livery?: Livery;
  /** False drops the small aero and cockpit parts, for cars far from the camera. */
  fine?: boolean;
};

export const OpenWheeler: React.FC<OpenWheelerProps> = ({ coverLift, pulse = 0, flame = 0, squat = 0, showRearWing = true, wheelSpin = 0, livery = HERO_LIVERY, fine = true }) => {
  const geo = useMemo(
    () => ({
      tub: extrude(profile(tubProfile), 6.4),
      nose: extrude(profile(noseProfile), 3),
      cover: extrude(profile(coverProfile), 3.2),
      pod: extrude(profile(sidepodProfile), 3.2),
      gearbox: extrude(profile(gearboxProfile), 3),
      fin: extrude(profile(finProfile), 0.14),
    }),
    [],
  );
  const rain = new THREE.Color(C.tail).multiplyScalar(0.5 + pulse * 1.2);
  const { body, accent } = livery;
  return (
    <group position={[0, -squat, 0]}>
      {/* stepped floor */}
      <Box p={[1.5, plankTop - 0.15, 0]} s={[28, 0.3, 11.8]} c={CARBON} />
      <Box p={[1.5, plankTop - 0.42, 0]} s={[28, 0.24, 3]} c={C.valley} />
      {/* tub and nose */}
      <mesh geometry={geo.tub}>
        <meshLambertMaterial color={body} flatShading />
      </mesh>
      <mesh geometry={geo.nose}>
        <meshLambertMaterial color={body} flatShading />
      </mesh>
      <Box p={[-19, 3.82, 0]} s={[12.2, 0.08, 1.2]} c={accent} r={[0, 0, Math.atan2(1.5, -12)]} />
      {fine ? (
        <>
          <Box p={[-8.2, 5.05, 0]} s={[6, 0.08, 2.4]} c={accent} r={[0, 0, Math.atan2(-1, 6)]} />
          {[1, -1].map((s) => (
            <Box key={s} p={[-20.8, 3.9, s * 1.55]} s={[1.5, 0.45, 0.45]} c={CARBON} />
          ))}
        </>
      ) : null}
      <Cockpit l={livery} fine={fine} />
      <FrontWing l={livery} fine={fine} />
      {/* wheels and suspension */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Wheel x={frontAxleX} z={s * 7.7} spin={wheelSpin} grooves={fine ? 4 : 0} sidewall={fine ? "#c9cce4" : undefined} />
          <Wheel x={rearAxleX} z={s * 7.5} spin={wheelSpin} grooves={fine ? 4 : 0} sidewall={fine ? "#c9cce4" : undefined} />
          <Strut a={[-12.6, 3.9, s * 1.5]} b={[frontAxleX, 4.3, s * 6.3]} />
          <Strut a={[-9, 3.5, s * 2.6]} b={[frontAxleX, 4.3, s * 6.3]} />
          <Strut a={[-12.6, 2, s * 1.5]} b={[frontAxleX, 2.5, s * 6.3]} />
          <Strut a={[-9, 1.9, s * 2.6]} b={[frontAxleX, 2.5, s * 6.3]} />
          <Strut a={[13.2, 3.6, s * 1.2]} b={[rearAxleX, 4.4, s * 6.1]} />
          <Strut a={[17, 3.2, s * 1.2]} b={[rearAxleX, 4.4, s * 6.1]} />
          <Strut a={[13.2, 1.7, s * 1.2]} b={[rearAxleX, 2.6, s * 6.1]} />
          <Strut a={[17, 1.7, s * 1.2]} b={[rearAxleX, 2.6, s * 6.1]} />
          {fine ? (
            <>
              {/* pushrods, steering arm, driveshaft and brake ducts */}
              <Strut a={[-11.5, 5, s * 1]} b={[frontAxleX, 2.7, s * 6.1]} c={accent} r={0.11} />
              <Strut a={[-13, 3.1, s * 1.4]} b={[frontAxleX + 0.9, 3.2, s * 6.2]} r={0.09} c={C.metalLight} />
              <Strut a={[14.8, 3.4, s * 1.5]} b={[rearAxleX, 3.4, s * 5.8]} r={0.28} c={C.metalDark} />
              <Box p={[frontAxleX + 1.6, 3.4, s * 5.7]} s={[2.6, 1.5, 0.9]} c={CARBON_LIGHT} />
              <Box p={[rearAxleX - 1.5, 3.8, s * 5.55]} s={[2.4, 2.2, 0.9]} c={CARBON_LIGHT} />
            </>
          ) : null}
          <group position={[0, 0, s * 5.1]}>
            <mesh geometry={geo.pod}>
              <meshLambertMaterial color={body} flatShading />
            </mesh>
          </group>
          <SidepodDetail l={livery} s={s} fine={fine} />
          <mesh position={[10.2, 4.1, s * 4.6]} rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.6, 0.6, 1.3, 8]} />
            <meshLambertMaterial color="#8a4a2a" flatShading />
          </mesh>
          <Flame x={10.6} y={4.6} z={s * 4.6} size={flame} />
        </group>
      ))}
      {/* gearbox and crash structure */}
      <mesh geometry={geo.gearbox}>
        <meshLambertMaterial color={CARBON} flatShading />
      </mesh>
      <Diffuser rain={rain} />
      {showRearWing ? <RearWing l={livery} fine={fine} /> : null}
      {/* engine cover: lifts straight up and away */}
      <group position={[0, coverLift, 0]} visible={coverLift < 60}>
        <mesh geometry={geo.cover}>
          <meshLambertMaterial color={body} flatShading />
        </mesh>
        {[1, -1].map((side) => (
          <Box key={side} p={[6.4, 5.05, side * 2.55]} s={[6.5, 0.2, 2.1]} c={body} r={[side * 0.08, 0, Math.atan2(-1, 7)]} />
        ))}
        <Box p={[0.2, 9.1, 0]} s={[0.25, 1.2, 1.8]} c={CARBON} />
        <Box p={[8.2, 7.1, 0]} s={[12, 0.05, 0.9]} c={accent} r={[0, 0, Math.atan2(-3, 7.5)]} />
        {fine ? (
          <>
            <mesh geometry={geo.fin}>
              <meshLambertMaterial color={accent} flatShading />
            </mesh>
            <Box p={[1.4, 10.55, 0]} s={[1.3, 0.75, 0.75]} c={CARBON} />
            <Box p={[1.4, 10.4, 0]} s={[0.1, 0.5, 2]} c={accent} />
            <Strut a={[5, 9, 0]} b={[6.5, 10.8, 0]} r={0.05} c={C.metalLight} />
          </>
        ) : null}
      </group>
    </group>
  );
};
