function getNextResetTimestamp() {
  const now = new Date();
  const reset = new Date();
  reset.setHours(3, 0, 0, 0);
  if (now >= reset) {
    reset.setDate(reset.getDate() + 1);
  }
  return reset.getTime();
}

function getTodayString() {
  return new Date().toLocaleDateString('en-CA'); 
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    mode: 'study',
    dailyLimitMins: 20,
    normalTimeLeft: 1200, 
    lectureTime: {},
    selfStudyTime: {},
    isFocusMode: false,
    nextResetTime: getNextResetTimestamp()
  });
});

function checkDailyReset(callback) {
  chrome.storage.local.get(['nextResetTime', 'dailyLimitMins'], (data) => {
    const now = Date.now();
    if (!data.nextResetTime || now >= data.nextResetTime) {
      const budget = data.dailyLimitMins || 20;
      chrome.storage.local.set({
        normalTimeLeft: budget * 60,
        mode: 'study',
        nextResetTime: getNextResetTimestamp()
      }, callback);
    } else {
      if (callback) callback();
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "HEARTBEAT") {
    checkDailyReset(() => {
      processHeartbeatTick(message.domain);
    });
  }
});

function processHeartbeatTick(domain) {
  chrome.storage.local.get(['mode', 'normalTimeLeft', 'isFocusMode', 'lectureTime', 'selfStudyTime'], (data) => {
    const today = getTodayString();

    if (data.isFocusMode) {
      let selfTime = data.selfStudyTime || {};
      selfTime[today] = (selfTime[today] || 0) + 1;
      chrome.storage.local.set({ selfStudyTime: selfTime });
      return;
    }

    if (domain === "youtube") {
      if (data.mode === 'normal') {
        let timeLeft = data.normalTimeLeft !== undefined ? data.normalTimeLeft : 1200;
        if (timeLeft <= 0) {
          chrome.storage.local.set({ mode: 'study' });
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: "https://www.pw.live/study-v2/study" });
          });
        } else {
          chrome.storage.local.set({ normalTimeLeft: timeLeft - 1 });
        }
      } else if (data.mode === 'study') {
        let lecTime = data.lectureTime || {};
        lecTime[today] = (lecTime[today] || 0) + 1;
        chrome.storage.local.set({ lectureTime: lecTime });
      }
    } else if (domain === "pw") {
      let lecTime = data.lectureTime || {};
      lecTime[today] = (lecTime[today] || 0) + 1;
      chrome.storage.local.set({ lectureTime: lecTime });
    }
  });
}