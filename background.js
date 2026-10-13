// Shows a grey toolbar icon while subtitles are switched off (from the popup or the Alt+\ shortcut).
const iconSet = (suffix) => Object.fromEntries([16, 32, 48].map((s) => [s, `icons/icon${s}${suffix}.png`]));
const ON = iconSet('');
const OFF = iconSet('-off');

async function syncIcon() {
  const { settings } = await chrome.storage.local.get('settings');
  const enabled = !settings || settings.enabled !== false;
  await chrome.action.setIcon({ path: enabled ? ON : OFF });
  await chrome.action.setTitle({ title: enabled ? 'Subtitle Overlay' : 'Subtitle Overlay (off)' });
}

chrome.runtime.onStartup.addListener(syncIcon);
chrome.runtime.onInstalled.addListener(syncIcon);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) syncIcon();
});
syncIcon();
