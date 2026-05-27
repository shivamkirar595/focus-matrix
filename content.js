const ANCHOR_STUDY = ['pw', 'physics wallah', 'lecture', 'jee', 'neet', 'dpp', 'revision', 'ncert', 'class', 'one shot', 'pyq', 'formula', 'derivation'];
const ANCHOR_DISTRACT = ['gaming', 'gameplay', 'bgmi', 'minecraft', 'gta', 'vlog', 'funny', 'roast', 'prank', 'song', 'music', 'trailer', 'highlights', 'anime', 'cricket'];

class AntiPoisonAI {
  constructor() {
    this.studyWords = {};
    this.distractWords = {};
    this.studyCount = 0;
    this.distractCount = 0;
  }

  async init() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['learnedStudyWords', 'learnedDistractWords'], (data) => {
        this.studyWords = {};
        this.distractWords = {};
        this.studyCount = 0;
        this.distractCount = 0;

        ANCHOR_STUDY.forEach(w => this.addWord(w, 'study', 10));
        ANCHOR_DISTRACT.forEach(w => this.addWord(w, 'distract', 10));

        const dynamicStudy = data.learnedStudyWords || [];
        const dynamicDistract = data.learnedDistractWords || [];

        dynamicStudy.forEach(text => {
          text.toLowerCase().split(/\s+/).forEach(w => this.addWord(w, 'study', 1));
        });
        dynamicDistract.forEach(text => {
          text.toLowerCase().split(/\s+/).forEach(w => this.addWord(w, 'distract', 1));
        });
        resolve();
      });
    });
  }

  addWord(word, type, weight = 1) {
    if (word.length < 4) return;
    if (type === 'study' && ANCHOR_DISTRACT.includes(word)) return;
    if (type === 'distract' && ANCHOR_STUDY.includes(word)) return;

    if (type === 'study') {
      this.studyWords[word] = (this.studyWords[word] || 0) + weight;
      this.studyCount += weight;
    } else {
      this.distractWords[word] = (this.distractWords[word] || 0) + weight;
      this.distractCount += weight;
    }
  }

  predictStudyProbability(textString) {
    const words = textString.toLowerCase().split(/\s+/);
    let studyLogProb = 0;
    let distractLogProb = 0;

    words.forEach(word => {
      const sCount = this.studyWords[word] || 0;
      const dCount = this.distractWords[word] || 0;
      studyLogProb += Math.log((sCount + 1) / (this.studyCount + 2));
      distractLogProb += Math.log((dCount + 1) / (this.distractCount + 2));
    });

    const diff = studyLogProb - distractLogProb;
    return Math.round((1 / (1 + Math.exp(-diff))) * 100);
  }
}

const safeBrain = new AntiPoisonAI();

function teachAiOurHabits(titleAndDesc, currentMode) {
  const words = titleAndDesc.toLowerCase().split(/\s+/);
  const filteredWords = words.filter(word => {
    if (currentMode === 'study' && ANCHOR_DISTRACT.includes(word)) return false;
    if (currentMode === 'distract' && ANCHOR_STUDY.includes(word)) return false;
    return true;
  });

  const cleanSavedString = filteredWords.join(" ");
  const key = currentMode === 'study' ? 'learnedStudyWords' : 'learnedDistractWords';

  chrome.storage.local.get([key], (data) => {
    let currentMemory = data[key] || [];
    if (currentMemory.length > 150) currentMemory.shift();
    if (!currentMemory.includes(cleanSavedString)) {
      currentMemory.push(cleanSavedString);
      chrome.storage.local.set({ [key]: currentMemory });
    }
  });
}

function calculateHybridScore(title, description, channel) {
  const fullText = (title + " " + description + " " + channel).toLowerCase();

  let absoluteDistraction = ANCHOR_DISTRACT.some(w => fullText.includes(w));
  if (absoluteDistraction) return 0;

  let studyMatches = 0;
  ANCHOR_STUDY.forEach(w => { if (fullText.includes(w)) studyMatches++; });

  let keywordScore = studyMatches > 0 ? Math.min(100, 60 + (studyMatches * 10)) : 30;
  const aiScore = safeBrain.predictStudyProbability(fullText);

  return Math.round((keywordScore + aiScore) / 2);
}

async function enforceStrictStudyRules() {
  await safeBrain.init();

  chrome.storage.local.get(['mode'], (data) => {
    const currentMode = data.mode || 'study';
    const currentUrl = window.location.href;

    if (currentUrl.includes("/shorts/")) {
      if (currentMode === 'study') window.location.replace("https://www.pw.live/study-v2/study");
      return;
    }

    if (!currentUrl.includes("watch?v=")) {
      if (currentMode === 'study') applyStrictStyles();
      return;
    }

    const titleEl = document.querySelector('ytd-watch-metadata #title h1, ytd-video-primary-info-renderer .title');
    const descEl = document.querySelector('#description-inner, ytd-video-secondary-info-renderer .description');
    const channelEl = document.querySelector('ytd-watch-metadata #channel-name a, ytd-video-secondary-info-renderer #channel-name a');

    if (!titleEl || !channelEl) {
      setTimeout(enforceStrictStudyRules, 400);
      return;
    }

    const titleText = titleEl.textContent;
    const descText = descEl ? descEl.textContent : "";
    const cleanTextSample = (titleText + " " + descText).replace(/[^a-zA-Z0-9\s]/g, "");

    if (currentMode === 'study') {
      applyStrictStyles();
      const finalScore = calculateHybridScore(titleText, descText, channelEl.textContent);

      if (finalScore < 40) {
        window.location.replace("https://www.pw.live/study-v2/study");
      } else if (finalScore < 75) {
        renderWarningOverlay(finalScore);
      } else {
        removeWarningOverlay();
        setTimeout(() => {
          if (window.location.href.includes(titleEl.textContent)) {
            teachAiOurHabits(cleanTextSample, 'study');
          }
        }, 60000);
      }
    } else {
      removeStrictStyles();
      setTimeout(() => {
        if (window.location.href.includes(titleEl.textContent)) {
          teachAiOurHabits(cleanTextSample, 'distract');
        }
      }, 60000);
    }
  });
}

function applyStrictStyles() {
  if (document.getElementById('strict-study-css')) return;
  const style = document.createElement('style');
  style.id = 'strict-study-css';
  style.innerHTML = `
    ytd-browse[page-subtype="home"], #related, #comments, ytd-guide-renderer, ytd-mini-guide-renderer { display: none !important; }
    #page-manager { margin-left: 0 !important; }
    ytd-video-preview, #preview, .ytd-video-preview, ytd-hover-overlay-renderer { display: none !important; pointer-events: none !important; }
    #movie_player { border: 4px solid #10b981 !important; box-shadow: 0 0 20px rgba(16,185,129,0.5); }
  `;
  document.documentElement.appendChild(style);
}

function renderWarningOverlay(score) {
  if (document.getElementById('focus-warn-screen')) return;
  const player = document.querySelector('#movie_player');
  if (!player) return;

  const overlay = document.createElement('div');
  overlay.id = 'focus-warn-screen';
  overlay.style = "position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.98); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:sans-serif; text-align:center;";
  overlay.innerHTML = `
    <h2 style="color:#f59e0b; margin-bottom:5px;">Borderline Content Detected (${score}/100)</h2>
    <p style="margin: 0 0 15px 0; color:#94a3b8; max-width:80%;">Is this video related to your target study syllabus?</p>
    <div>
      <button id="allowBtn" style="padding:10px 20px; margin:5px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Yes, Watch Lecture</button>
      <button id="denyBtn" style="padding:10px 20px; margin:5px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">No, Open PW</button>
    </div>
  `;
  player.appendChild(overlay);

  document.getElementById('allowBtn').onclick = () => {
    overlay.remove();
    const titleEl = document.querySelector('ytd-watch-metadata #title h1, ytd-video-primary-info-renderer .title');
    const descEl = document.querySelector('#description-inner, ytd-video-secondary-info-renderer .description');
    if (titleEl) {
      const textSample = (titleEl.textContent + " " + (descEl ? descEl.textContent : "")).replace(/[^a-zA-Z0-9\s]/g, "");
      teachAiOurHabits(textSample, 'study');
    }
  };
  document.getElementById('denyBtn').onclick = () => { window.location.href = "https://www.pw.live/study-v2/study"; };
}

function removeWarningOverlay() {
  const el = document.getElementById('focus-warn-screen');
  if (el) el.remove();
}

function removeStrictStyles() {
  ['strict-study-css', 'focus-warn-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

setInterval(() => {
  if (document.visibilityState === 'visible' && document.hasFocus()) {
    const domain = window.location.hostname.includes("youtube.com") ? "youtube" : "pw";
    chrome.runtime.sendMessage({ type: "HEARTBEAT", domain: domain });
  }
}, 1000);

window.addEventListener('yt-navigate-finish', enforceStrictStudyRules);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enforceStrictStudyRules);
} else {
  enforceStrictStudyRules();
}