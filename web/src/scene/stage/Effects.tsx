import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import type { QualitySettings } from './quality.js';

/** `still` (reduced motion) drops the film grain, which crawls every frame. */
/** Vignette, light bloom on the flames, film grain, and depth of field on close shots, each switched by the quality level. */
export function Effects({ quality, still = false }: { quality: QualitySettings; still?: boolean }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {quality.bloom ? <Bloom intensity={0.6} luminanceThreshold={0.92} luminanceSmoothing={0.35} mipmapBlur /> : <></>}
      {quality.depthOfField ? <DepthOfField worldFocusDistance={2.6} worldFocusRange={5} bokehScale={1.4} height={480} /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {quality.grain && !still ? <Noise blendFunction={BlendFunction.OVERLAY} opacity={0.1} /> : <></>}
      {quality.vignette ? <Vignette eskil={false} offset={0.28} darkness={0.92} /> : <></>}
    </EffectComposer>
  );
}
