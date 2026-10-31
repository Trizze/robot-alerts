// Temporary testing boundary, keyed by verified Twitch IDs rather than display names.
export const TEST_ACCOUNTS = Object.freeze({ '14824099': 'Trizze', '429225647': 'itsTrizze' });
export const allowedViewer = id => Object.hasOwn(TEST_ACCOUNTS, id || '');
export const allowedReaction = event => allowedViewer(event?.viewer?.id);
