(function () {
  'use strict';

  const configEl = document.getElementById('__ssh_config__');
  if (!configEl) return;

  let SPEED = parseFloat(configEl.getAttribute('data-speed')) || 1;
  let ENABLED = configEl.getAttribute('data-enabled') === 'true';
  configEl.remove();

  // ========================================
  // Сохраняем оригиналы
  // ========================================
  const _DateNow = Date.now;
  const _perfNow = performance.now.bind(performance);
  const _setTimeout = window.setTimeout.bind(window);
  const _setInterval = window.setInterval.bind(window);
  const _clearInterval = window.clearInterval.bind(window);
  const _RAF = window.requestAnimationFrame.bind(window);
  const _OrigDate = Date;

  const _startReal = _DateNow.call(Date);
  const _perfStart = _perfNow();

  // Виртуальное время — нужно для плавной смены скорости
  let virtualTimeOffset = 0;
  let lastRealTime = _startReal;
  let currentSpeed = ENABLED ? SPEED : 1;

  function getRealNow() {
    return _DateNow.call(Date);
  }

  function getVirtualNow() {
    const realNow = getRealNow();
    const realDelta = realNow - lastRealTime;
    virtualTimeOffset += realDelta * currentSpeed;
    lastRealTime = realNow;
    return _startReal + virtualTimeOffset;
  }

  function getRealPerf() {
    return _perfNow();
  }

  let perfVirtualOffset = 0;
  let lastRealPerf = _perfStart;

  function getVirtualPerf() {
    const realNow = getRealPerf();
    const realDelta = realNow - lastRealPerf;
    perfVirtualOffset += realDelta * currentSpeed;
    lastRealPerf = realNow;
    return _perfStart + perfVirtualOffset;
  }

  // ========================================
  // Слушаем обновления скорости (без F5!)
  // ========================================
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === '__SSH_SPEED_UPDATE__') {
      // "Зафиксировать" текущее виртуальное время перед сменой скорости
      getVirtualNow();
      getVirtualPerf();

      const newEnabled = event.data.enabled;
      const newSpeed = event.data.speed;

      if (newEnabled && newSpeed > 0) {
        currentSpeed = newSpeed;
      } else {
        currentSpeed = 1;
      }

      console.log(
        `%c[SSH] Speed → x${currentSpeed}`,
        'color: #888; font-size: 12px;'
      );
    }
  });

  // Также пробрасываем во вложенные iframe
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === '__SSH_SPEED_UPDATE__') {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow.postMessage(event.data, '*');
        } catch (e) {}
      });
    }
  });

  // ========================================
  // 1. Date.now()
  // ========================================
  Date.now = function () {
    return Math.floor(getVirtualNow());
  };

  // ========================================
  // 2. new Date()
  // ========================================
  function PatchedDate(...args) {
    if (args.length === 0) {
      if (new.target) return new _OrigDate(Date.now());
      return new _OrigDate(Date.now()).toString();
    }
    if (new.target) return new _OrigDate(...args);
    return new _OrigDate(...args).toString();
  }

  PatchedDate.prototype = _OrigDate.prototype;
  PatchedDate.now = Date.now;
  PatchedDate.parse = _OrigDate.parse;
  PatchedDate.UTC = _OrigDate.UTC;

  Object.getOwnPropertyNames(_OrigDate).forEach(prop => {
    if (!PatchedDate.hasOwnProperty(prop)) {
      try { PatchedDate[prop] = _OrigDate[prop]; } catch (e) {}
    }
  });

  window.Date = PatchedDate;

  // ========================================
  // 3. performance.now()
  // ========================================
  performance.now = function () {
    return getVirtualPerf();
  };

  // ========================================
  // 4. setTimeout
  // ========================================
  window.setTimeout = function (fn, delay, ...args) {
    const d = Math.max(0, (delay || 0) / currentSpeed);
    return _setTimeout(fn, d, ...args);
  };

  // ========================================
  // 5. setInterval — пересоздаём при смене скорости
  // ========================================
  const activeIntervals = new Map();
  let intervalIdCounter = 100000;

  window.setInterval = function (fn, delay, ...args) {
    const id = intervalIdCounter++;
    function start() {
      const d = Math.max(1, (delay || 0) / currentSpeed);
      return _setInterval(fn, d, ...args);
    }
    let realId = start();
    activeIntervals.set(id, { fn, delay, args, realId });
    return id;
  };

  window.clearInterval = function (id) {
    if (activeIntervals.has(id)) {
      const entry = activeIntervals.get(id);
      _clearInterval(entry.realId);
      activeIntervals.delete(id);
    } else {
      _clearInterval(id);
    }
  };

  // При смене скорости — пересоздаём все интервалы
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === '__SSH_SPEED_UPDATE__') {
      activeIntervals.forEach((entry, id) => {
        _clearInterval(entry.realId);
        const d = Math.max(1, (entry.delay || 0) / currentSpeed);
        entry.realId = _setInterval(entry.fn, d, ...entry.args);
      });
    }
  });

  // ========================================
  // 6. requestAnimationFrame
  // ========================================
  window.requestAnimationFrame = function (callback) {
    return _RAF(function (realTimestamp) {
      const elapsed = realTimestamp - _perfStart;
      // Используем виртуальный perf для согласованности
      callback(getVirtualPerf());
    });
  };

  // ========================================
  // 7. Event.timeStamp
  // ========================================
  try {
    const _tsGetter = Object.getOwnPropertyDescriptor(Event.prototype, 'timeStamp').get;
    if (_tsGetter) {
      Object.defineProperty(Event.prototype, 'timeStamp', {
        get: function () {
          const real = _tsGetter.call(this);
          const elapsed = real - _perfStart;
          return _perfStart + elapsed * currentSpeed;
        }
      });
    }
  } catch (e) {}

  // ========================================
  // Лог
  // ========================================
  if (currentSpeed !== 1) {
    console.log(
      `%c[SSH] Active — x${currentSpeed} | ${window.location.href.substring(0, 60)}`,
      'color: #666; font-size: 11px;'
    );
  }
})();