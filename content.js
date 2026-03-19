(function () {
  if (document.documentElement.getAttribute('data-ssh-injected')) return;
  document.documentElement.setAttribute('data-ssh-injected', 'true');

  // Слушаем сообщения от popup через chrome.runtime
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'updateSpeed') {
      // Пробрасываем в inject.js через postMessage
      window.postMessage({
        type: '__SSH_SPEED_UPDATE__',
        speed: msg.speed,
        enabled: msg.enabled
      }, '*');
    }
  });

  // Начальная инъекция
  chrome.storage.local.get(['enabled', 'speed', 'extraMode', 'extraSpeed'], (data) => {
    const enabled = data.enabled ?? false;

    let speed = 1;
    if (enabled) {
      speed = data.extraMode ? (data.extraSpeed ?? 10) : (data.speed ?? 1.0);
    }

    const configEl = document.createElement('div');
    configEl.id = '__ssh_config__';
    configEl.style.display = 'none';
    configEl.setAttribute('data-speed', speed.toString());
    configEl.setAttribute('data-enabled', enabled.toString());
    document.documentElement.appendChild(configEl);

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
  });
})();