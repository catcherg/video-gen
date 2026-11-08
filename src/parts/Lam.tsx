/** Flat-shaded Lambert material, the look used by every mechanical part. */
export const Lam: React.FC<{ c: string; e?: string; ei?: number }> = ({ c, e, ei }) => (
  <meshLambertMaterial color={c} emissive={e ?? "#000000"} emissiveIntensity={ei ?? 0} flatShading />
);
