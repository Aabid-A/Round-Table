import { tablePoint } from '../layout.js';
import { PALETTE } from '../palette.js';

/**
 * A traitor's night: before each seat proposed for murder, small red discs on the table, one for each traitor who proposed it, so the
 * traitor sees where the others stand before choosing. Only a traitor's own view ever carries proposals.
 */
export function ProposalMarks({ proposals }: { proposals: { seat: number; count: number }[] }) {
  return (
    <>
      {proposals.flatMap(({ seat, count }) =>
        Array.from({ length: count }, (_, k) => {
          const [x, y, z] = tablePoint(seat, 1.0 - k * 0.11);
          return (
            <mesh key={`${seat}-${k}`} position={[x, y + 0.012, z]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.02, 20]} />
              <meshStandardMaterial color={PALETTE.traitor} roughness={0.4} metalness={0.3} emissive={PALETTE.traitor} emissiveIntensity={0.35} />
            </mesh>
          );
        }),
      )}
    </>
  );
}
