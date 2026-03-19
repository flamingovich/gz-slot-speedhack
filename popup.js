document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const statusText = document.getElementById('statusText');
  const speedSlider = document.getElementById('speedSlider');
  const speedDisplay = document.getElementById('speedDisplay');
  const extraToggle = document.getElementById('extraToggle');
  const extraSection = document.getElementById('extraSection');
  const extraSlider = document.getElementById('extraSlider');
  const extraSpeedDisplay = document.getElementById('extraSpeedDisplay');
  const applyBtn = document.getElementById('applyBtn');
  const feedback = document.getElementById('feedback');
  const speedCard = document.getElementById('speedCard');
  const extraCard = document.getElementById('extraCard');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // ===== Load state =====
  chrome.storage.local.get(['enabled', 'speed', 'extraMode', 'extraSpeed'], (data) => {
    const enabled = data.enabled ?? false;
    const speed = data.speed ?? 1.0;
    const extraMode = data.extraMode ?? false;
    const extraSpeed = data.extraSpeed ?? 10;

    setToggle(enabled);
    speedSlider.value = Math.round(speed * 10);
    speedDisplay.textContent = speed.toFixed(1) + 'x';
    updatePresetHighlight(speed);

    extraToggle.checked = extraMode;
    toggleExtra(extraMode);

    extraSlider.value = extraSpeed;
    extraSpeedDisplay.textContent = extraSpeed + 'x';
  });

  // ===== Toggle =====
  enableToggle.addEventListener('click', () => {
    const isActive = enableToggle.dataset.active === 'true';
    setToggle(!isActive);
    chrome.storage.local.set({ enabled: !isActive });
  });

  function setToggle(on) {
    enableToggle.dataset.active = on.toString();
    statusText.textContent = on ? 'ON' : 'OFF';
    statusText.classList.toggle('on', on);
    speedCard.classList.toggle('disabled', !on);
    extraCard.classList.toggle('disabled', !on);
    applyBtn.classList.toggle('disabled', !on);
  }

  // ===== Speed slider =====
  speedSlider.addEventListener('input', () => {
    const speed = (parseInt(speedSlider.value) / 10).toFixed(1);
    speedDisplay.textContent = speed + 'x';
    updatePresetHighlight(parseFloat(speed));
  });

  // ===== Presets =====
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      speedSlider.value = Math.round(speed * 10);
      speedDisplay.textContent = speed.toFixed(1) + 'x';
      updatePresetHighlight(speed);

      // If extra is on, turn it off
      if (extraToggle.checked) {
        extraToggle.checked = false;
        toggleExtra(false);
      }
    });
  });

  function updatePresetHighlight(speed) {
    presetBtns.forEach(btn => {
      const val = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', Math.abs(val - speed) < 0.05);
    });
  }

  // ===== Extra =====
  extraToggle.addEventListener('change', () => {
    toggleExtra(extraToggle.checked);
  });

  function toggleExtra(on) {
    extraSection.classList.toggle('hidden', !on);
    applyBtn.classList.toggle('extra-mode', on);
    applyBtn.textContent = on ? 'Применить EXTRA' : 'Применить';
  }

  extraSlider.addEventListener('input', () => {
    extraSpeedDisplay.textContent = extraSlider.value + 'x';
  });

  // ===== Apply =====
  applyBtn.addEventListener('click', () => {
    if (enableToggle.dataset.active !== 'true') return;

    const extraMode = extraToggle.checked;
    let finalSpeed;

    if (extraMode) {
      finalSpeed = parseInt(extraSlider.value);
    } else {
      finalSpeed = parseFloat((parseInt(speedSlider.value) / 10).toFixed(1));
    }

    const saveData = {
      enabled: true,
      speed: extraMode ? finalSpeed : finalSpeed,
      extraMode: extraMode,
      extraSpeed: extraMode ? finalSpeed : parseInt(extraSlider.value)
    };

    chrome.storage.local.set(saveData, () => {
      // Отправляем сообщение во все фреймы активной вкладки
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        const tabId = tabs[0].id;

        // Отправляем в основной фрейм
        chrome.tabs.sendMessage(tabId, {
          action: 'updateSpeed',
          speed: finalSpeed,
          enabled: true
        }).catch(() => {});

        // Отправляем во все фреймы
        chrome.webNavigation?.getAllFrames({ tabId }, (frames) => {
          if (!frames) return;
          frames.forEach(frame => {
            chrome.tabs.sendMessage(tabId, {
              action: 'updateSpeed',
              speed: finalSpeed,
              enabled: true
            }, { frameId: frame.frameId }).catch(() => {});
          });
        });
      });

      // Feedback
      feedback.classList.remove('hidden');
      feedback.textContent = `x${finalSpeed} — применено`;
      feedback.style.color = extraMode ? '#f87171' : '#4ade80';

      setTimeout(() => {
        feedback.classList.add('hidden');
      }, 2000);
    });
  });
});