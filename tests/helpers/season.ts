import { logFrom, type Spec } from './logs.js';

export const models = { T1: 'model-a', T2: 'model-b', F1: 'model-c', F2: 'model-c', F3: 'model-d' };

/** Traitors win. T1 and T2 vote out F1; F2 accepts T1's recruitment; T2 is later caught. One fallback by F3. */
export const game1 = () => {
  const votes = [
    { voter: 'T1', target: 'F1' }, { voter: 'T2', target: 'F1' }, { voter: 'F2', target: 'T1' }, { voter: 'F3', target: 'F1' },
  ];
  const specs: Spec[] = [
    ...votes.map((v) => ({ r: 1, phase: 'vote' as const, p: v.voter, action: { target: v.target }, fb: v.voter === 'F3' }) as Spec),
    { r: 1, ev: { type: 'vote', stage: 'vote', votes, tally: { F1: 3, T1: 1 }, leaders: ['F1'] } },
    { r: 1, ev: { type: 'banishment', player: 'F1', role: 'faithful', method: 'majority' } },
    { r: 1, phase: 'recruit_choose', p: 'T1', action: { target: 'F2' } },
    { r: 1, phase: 'recruit_respond', p: 'F2', action: { accept: true } },
    { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F2', accepted: true } },
    { r: 2, ev: { type: 'banishment', player: 'T2', role: 'traitor', method: 'majority' } },
  ];
  return logFrom({ T1: 'traitor', T2: 'traitor', F1: 'faithful', F2: 'faithful', F3: 'faithful' }, specs, { winner: 'traitor' }, models);
};

/** Faithfuls win. T1 is caught. F2 refuses nothing: no recruitment. */
export const game2 = () =>
  logFrom(
    { T1: 'traitor', F1: 'faithful', F2: 'faithful' },
    [
      { r: 1, phase: 'vote', p: 'F1', action: { target: 'T1' } },
      { r: 1, ev: { type: 'vote', stage: 'vote', votes: [{ voter: 'F1', target: 'T1' }], tally: { T1: 1 }, leaders: ['T1'] } },
      { r: 1, ev: { type: 'banishment', player: 'T1', role: 'traitor', method: 'majority' } },
    ],
    { winner: 'faithful', reason: 'no_traitors' },
    { T1: 'model-a', F1: 'model-c', F2: 'model-d' },
  );
