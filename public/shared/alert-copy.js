// Central defaults for future customization. Always render as text, never HTML.
const count = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
const number = value => value.toLocaleString('en-US');
export function alertCopy(alert) {
  const months = count(alert.months, 1), gifts = count(alert.gifts, 1), viewers = count(alert.raidSize);
  const presets = {
    sub: { label: 'NEW SUB', detail: 'First time subscriber!', icon: '+' },
    resub: { label: 'RE-SUB', detail: `Re-subscribed for ${number(months)} ${months === 1 ? 'month' : 'months'}!`, icon: '↻' },
    gift: { label: 'GIFT SUBS', detail: `Gifted ${number(gifts)} ${gifts === 1 ? 'sub' : 'subs'}!`, icon: '✦' },
    cheer: { label: 'CHEER', detail: `Cheered for ${number(count(alert.bits))} bits!`, icon: 'ϟ' },
    raid: { label: 'RAID', detail: `Raiding with ${number(viewers)} ${viewers === 1 ? 'viewer' : 'viewers'}!`, icon: '⚑' },
    follow: { label: 'NEW FOLLOWER', detail: 'Followed the stream!', icon: '♥' },
    preview: { label: 'ROBOT', detail: 'Your robot. Your look.', icon: '▣' }
  };
  return presets[alert.type] || presets.preview;
}
