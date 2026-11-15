/** How the player is choosing: by touch (tap a figure, swipe to look) or with a pointer and keys (select, arrows, Enter). */
export type InputKind = 'touch' | 'keys';

/**
 * The words that ask the player to choose a figure, for the turn prompt in the room and the live region. `ask` opens the turn
 * ("Your turn."), `to` is what choosing does ("accuse", "vote against them"). A touch screen is never told about keys it does not have.
 */
export function choosePrompt(ask: string, to: string, input: InputKind): string {
  return input === 'touch' ? `${ask} Tap a figure to ${to}.` : `${ask} Look at a figure and select them to ${to}, or use the arrow keys and Enter.`;
}

/** The words once a figure is chosen: how to confirm (`confirm` is what it does, "accuse them") and how to change your mind. */
export function chosenPrompt(name: string, confirm: string, input: InputKind): string {
  return input === 'touch' ? `${name} is chosen. Tap them again to ${confirm}, or swipe to someone else.` : `${name} is chosen. Select them again (or press Enter) to ${confirm}, or look at someone else.`;
}
