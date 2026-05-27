function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatHMS(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function generateDateBlock(days) {
  let list = [];
  for (let i = days - 1; i >= 0; i--) {
    let target = new Date();
    target.setDate(target.getDate() - i);
    list.push(target.toLocaleDateString('en-CA'));
  }
  return list;
}

let isUserInteractingWithInput = false;

function renderPanel() {
  chrome.storage.local.get(null, (data) => {
    const mode = data.mode || 'study';
    const normalTimeLeft = data.normalTimeLeft !== undefined ? data.normalTimeLeft : 1200;
    const isFocusMode = data.isFocusMode || false;
    const dailyLimitMins = data.dailyLimitMins || 20;
    
    const today = new Date().toLocaleDateString('en-CA');
    const lecToday = (data.lectureTime && data.lectureTime[today]) || 0;
    const selfToday = (data.selfStudyTime && data.selfStudyTime[today]) || 0;

    document.getElementById('normalClock').textContent = formatTime(normalTimeLeft);
    document.getElementById('lecStat').textContent = formatHMS(lecToday);
    document.getElementById('selfStat').textContent = formatHMS(selfToday);

    // Keep setter value locked onto setting variable, avoiding ticking down
    if (!isUserInteractingWithInput) {
      document.getElementById('budgetInput').value = dailyLimitMins;
    }

    const badge = document.getElementById('modeBadge');
    const mBtn = document.getElementById('modeToggle');
    if (mode === 'study') {
      badge.textContent = "Study Mode";
      badge.className = "badge study";
      mBtn.textContent = "Switch to Normal Mode";
      mBtn.className = "btn-main is-studying";
    } else {
      badge.textContent = "Normal Mode";
      badge.className = "badge normal";
      mBtn.textContent = "Switch to Study Mode";
      mBtn.className = "btn-main";
    }

    if (normalTimeLeft <= 0) {
      mBtn.textContent = "Allowance Expired!";
      mBtn.disabled = true;
      mBtn.style.background = "#475569";
      mBtn.style.boxShadow = "none";
      mBtn.style.color = "#94a3b8";
    } else {
      mBtn.disabled = false;
    }

    const fBtn = document.getElementById('focusToggle');
    if (isFocusMode) {
      fBtn.textContent = "⚡ Active Focus Session (Stop)";
      fBtn.className = "btn-focus active";
    } else {
      fBtn.textContent = "🧘 Start Focus Session";
      fBtn.className = "btn-focus";
    }

    const container = document.getElementById('mapGrid');
    container.innerHTML = "";
    const chronologicalDays = generateDateBlock(28);

    chronologicalDays.forEach(dayString => {
      const lTime = (data.lectureTime && data.lectureTime[dayString]) || 0;
      const sTime = (data.selfStudyTime && data.selfStudyTime[dayString]) || 0;
      const hours = (lTime + sTime) / 3600;

      const block = document.createElement('div');
      block.className = 'box';

      let grade = 0;
      if (hours > 0 && hours <= 1) grade = 1;
      else if (hours > 1 && hours <= 3) grade = 2;
      else if (hours > 3 && hours <= 5) grade = 3;
      else if (hours > 5) grade = 4;

      block.classList.add(`l${grade}`);
      const prettyDate = new Date(dayString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      block.setAttribute('data-tip', `${prettyDate}: ${hours.toFixed(1)} hrs logged`);
      container.appendChild(block);
    });
  });
}

document.getElementById('modeToggle').addEventListener('click', () => {
  chrome.storage.local.get(['mode', 'normalTimeLeft'], (data) => {
    if (data.normalTimeLeft <= 0) return;
    const swap = data.mode === 'study' ? 'normal' : 'study';
    chrome.storage.local.set({ mode: swap, isFocusMode: false }, renderPanel);
  });
});

document.getElementById('focusToggle').addEventListener('click', () => {
  chrome.storage.local.get(['isFocusMode'], (data) => {
    const nextState = !data.isFocusMode;
    const packet = { isFocusMode: nextState };
    if (nextState) packet.mode = 'study';
    chrome.storage.local.set(packet, renderPanel);
  });
});

const bInput = document.getElementById('budgetInput');
bInput.addEventListener('focus', () => { isUserInteractingWithInput = true; });
bInput.addEventListener('blur', () => { isUserInteractingWithInput = false; });

bInput.addEventListener('change', (e) => {
  let newMins = parseInt(e.target.value) || 20;
  if (newMins < 1) newMins = 1;
  if (newMins > 120) newMins = 120;

  chrome.storage.local.get(['dailyLimitMins', 'normalTimeLeft'], (data) => {
    const oldMins = data.dailyLimitMins || 20;
    const currentLeft = data.normalTimeLeft !== undefined ? data.normalTimeLeft : oldMins * 60;
    
    // Smooth Delta Balance tracking adjustments
    const deltaSeconds = (newMins - oldMins) * 60;
    let updatedLeft = currentLeft + deltaSeconds;
    if (updatedLeft < 0) updatedLeft = 0;

    chrome.storage.local.set({
      dailyLimitMins: newMins,
      normalTimeLeft: updatedLeft
    }, renderPanel);
  });
});

document.getElementById('resetBrainBtn').addEventListener('click', () => {
  if (confirm("Reset neural classifier patterns? Anchors remain preserved.")) {
    chrome.storage.local.set({ learnedStudyWords: [], learnedDistractWords: [] }, () => {
      renderPanel();
    });
  }
});

setInterval(renderPanel, 1000);
document.addEventListener('DOMContentLoaded', renderPanel);