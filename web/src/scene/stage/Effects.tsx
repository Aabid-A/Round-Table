import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import type { QualitySettings } from './quality.js';

/** Vignette, light bloom on the flames, film grain, and depth of field on close shots, each switched by the quality level. */
export function Effects({ quality }: { quality: QualitySettings }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {quality.bloom ? <Bloom intensity={0.85} luminanceThreshold={0.85} luminanceSmoothing={0.35} mipmapBlur /> : <></>}
      {quality.depthOfField ? <DepthOfField focusDistance={0.045} focalLength={0.06} bokehScale={2.2} height={480} /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {quality.grain ? <Noise blendFunction={BlendFunction.OVERLAY} opacity={0.1} /> : <></>}
      {quality.vignette ? <Vignette eskil={false} offset={0.28} darkness={0.92} /> : <></>}
    </EffectComposer>
  );
}
