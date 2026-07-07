/* ============================================================
   谬误侦探 — Game Engine
   "State Machine + Rendering + Scoring"
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const STATE = {
  screen: 'title',
  currentIndex: 0,
  selectedFallacies: new Set(),
  selectedBias: null,
  fallacySubmitted: false,
  biasSubmitted: false,
  scores: [],           // { fallacyScore, biasScore, total, stars }
  completed: new Set(), // indices of completed scenarios
};

// ── DOM Cache ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  title:    $('#screen-title'),
  intro:    $('#screen-intro'),
  fallacy:  $('#screen-fallacy'),
  bias:     $('#screen-bias'),
  verdict:  $('#screen-verdict'),
  progress: $('#screen-progress'),
  tutorial: $('#screen-tutorial'),
  review:   $('#screen-review'),
};

// ── Utils ──────────────────────────────────────────────────
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Persistence ────────────────────────────────────────────
const STORAGE_KEY = 'fallacy_detective_save';

function saveProgress() {
  const data = {
    currentIndex: STATE.currentIndex,
    scores: STATE.scores,
    completed: Array.from(STATE.completed),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.completed = new Set(data.completed || []);
    return data;
  } catch { return null; }
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Navigation ─────────────────────────────────────────────
function navigateTo(screenName) {
  // Deactivate all
  Object.values(screens).forEach((el) => {
    el.classList.remove('active');
  });

  const target = screens[screenName];
  if (target) {
    // Force reflow for transition to work
    void target.offsetWidth;
    target.classList.add('active');
    STATE.screen = screenName;
  }
}

// ── Title Screen ───────────────────────────────────────────
function initTitle() {
  const saved = loadProgress();
  const continueBtn = $('#btn-continue');

  if (saved && saved.currentIndex > 0) {
    continueBtn.classList.remove('hidden');
    continueBtn.addEventListener('click', () => {
      STATE.currentIndex = saved.currentIndex;
      STATE.scores = saved.scores || [];
      STATE.completed = saved.completed || new Set();
      startScenario();
    });
  } else {
    continueBtn.classList.add('hidden');
  }

  $('#btn-start').addEventListener('click', () => {
    STATE.currentIndex = 0;
    STATE.scores = [];
    STATE.completed = new Set();
    clearProgress();
    $('#btn-continue').classList.add('hidden');
    startScenario();
  });
}

// ── Scenario Flow ──────────────────────────────────────────
function startScenario() {
  const scenario = SCENARIOS[STATE.currentIndex];
  if (!scenario) {
    // All done — go back to title
    navigateTo('title');
    return;
  }

  // Reset round state
  STATE.selectedFallacies = new Set();
  STATE.selectedBias = null;
  STATE.fallacySubmitted = false;
  STATE.biasSubmitted = false;

  renderProgressDots();
  renderIntro(scenario);
  navigateTo('intro');
}

function renderProgressDots() {
  const container = $('#progress-dots');
  container.innerHTML = '';

  SCENARIOS.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'progress-dot';
    if (STATE.completed.has(i)) dot.classList.add('done');
    if (i === STATE.currentIndex) dot.classList.add('current');
    container.appendChild(dot);
  });
}

// ── Intro Screen ───────────────────────────────────────────
function renderIntro(scenario) {
  $('#tag-difficulty').textContent = '★'.repeat(scenario.difficulty) + '☆'.repeat(3 - scenario.difficulty);
  $('#tag-category').textContent = scenario.category;
  $('#intro-context').textContent = scenario.context;
  $('#intro-content').textContent = scenario.content;
}

// ── Fallacy Hunt ───────────────────────────────────────────
function beginAnalysis() {
  const scenario = SCENARIOS[STATE.currentIndex];
  renderFallacyHunt(scenario);
  navigateTo('fallacy');
}

function renderFallacyHunt(scenario) {
  // Reread box
  $('#case-reread').textContent = scenario.content;

  // Options — shuffled to avoid position bias
  const container = $('#fallacy-options');
  container.innerHTML = '';

  const shuffled = shuffle(scenario.fallacyOptions);
  shuffled.forEach((opt) => {
    const card = document.createElement('div');
    card.className = 'fallacy-option';
    card.dataset.fallacyId = opt.id;

    card.innerHTML = `
      <div class="fallacy-option-header">
        <span class="fallacy-option-name">${opt.name}</span>
        <span class="fallacy-option-check"></span>
      </div>
      <span class="fallacy-option-desc">${opt.description}</span>
      <span class="fallacy-option-feedback"></span>
    `;

    card.addEventListener('click', () => toggleFallacy(card, opt.id));
    container.appendChild(card);
  });

  // Reset submit button
  const submitBtn = $('#btn-fallacy-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = '确认提交';
  submitBtn.onclick = submitFallacies;

  updateSelectionCount();
}

function toggleFallacy(card, id) {
  if (STATE.fallacySubmitted) return;

  if (STATE.selectedFallacies.has(id)) {
    STATE.selectedFallacies.delete(id);
    card.classList.remove('selected');
  } else {
    STATE.selectedFallacies.add(id);
    card.classList.add('selected');
  }

  updateSelectionCount();
}

function updateSelectionCount() {
  const count = STATE.selectedFallacies.size;
  $('#selection-count').textContent = `已选 ${count} 项`;
  $('#btn-fallacy-submit').disabled = count === 0;
}

function submitFallacies() {
  if (STATE.fallacySubmitted) return;
  STATE.fallacySubmitted = true;

  const scenario = SCENARIOS[STATE.currentIndex];
  const options = $$('.fallacy-option');

  options.forEach((card) => {
    const id = card.dataset.fallacyId;
    const opt = scenario.fallacyOptions.find((o) => o.id === id);
    const wasSelected = STATE.selectedFallacies.has(id);

    card.classList.add('revealed');

    if (opt.isCorrect && wasSelected) {
      // Correctly identified
      card.classList.add('correct-reveal');
      card.querySelector('.fallacy-option-check').textContent = '✓';
      card.querySelector('.fallacy-option-feedback').textContent = '正确！你识别出了这个谬误。';
    } else if (opt.isCorrect && !wasSelected) {
      // Missed
      card.classList.add('missed-reveal');
      card.querySelector('.fallacy-option-check').textContent = '!';
      card.querySelector('.fallacy-option-feedback').textContent = '你漏掉了这个谬误。';
    } else if (!opt.isCorrect && wasSelected) {
      // False positive
      card.classList.add('incorrect-reveal');
      card.querySelector('.fallacy-option-check').textContent = '✕';
      card.querySelector('.fallacy-option-feedback').textContent = '这个不是该场景中的谬误。';
    }
    // else: correctly ignored — no extra class
  });

  // Update button
  const btn = $('#btn-fallacy-submit');
  btn.textContent = '继续 →';
  btn.disabled = false;
  btn.onclick = () => {
    const scenario = SCENARIOS[STATE.currentIndex];
    renderBiasCheck(scenario);
    navigateTo('bias');
  };
}

// ── Bias Check ─────────────────────────────────────────────
function renderBiasCheck(scenario) {
  $('#bias-question').textContent = scenario.biasCheck.question;

  const container = $('#bias-options');
  container.innerHTML = '';

  const shuffled = shuffle(scenario.biasCheck.options.map((opt, i) => ({ opt, originalIndex: i })));

  shuffled.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'bias-option';
    card.dataset.originalIndex = item.originalIndex;

    card.innerHTML = `
      <span class="bias-radio"></span>
      <span class="bias-option-label">${item.opt.text}</span>
    `;

    card.addEventListener('click', () => selectBias(card, item.originalIndex));
    container.appendChild(card);
  });

  // Reset
  STATE.selectedBias = null;
  STATE.biasSubmitted = false;
  $('#btn-bias-submit').disabled = true;
  $('#btn-bias-submit').textContent = '确认';
  $('#btn-bias-submit').onclick = submitBias;

  const feedback = $('#bias-feedback');
  feedback.classList.add('hidden');
  feedback.innerHTML = '';
}

function selectBias(card, index) {
  if (STATE.biasSubmitted) return;

  // Deselect all
  $$('.bias-option').forEach((c) => c.classList.remove('selected'));

  // Select this one
  card.classList.add('selected');
  STATE.selectedBias = index;
  $('#btn-bias-submit').disabled = false;
}

function submitBias() {
  if (STATE.biasSubmitted || STATE.selectedBias === null) return;
  STATE.biasSubmitted = true;

  const scenario = SCENARIOS[STATE.currentIndex];
  const options = $$('.bias-option');

  options.forEach((card) => {
    const originalIndex = parseInt(card.dataset.originalIndex);
    const opt = scenario.biasCheck.options[originalIndex];

    if (opt.isCorrect) {
      card.classList.add('correct-reveal');
    } else if (originalIndex === STATE.selectedBias && !opt.isCorrect) {
      card.classList.add('incorrect-reveal');
    }
  });

  // Show feedback
  const correctOpt = scenario.biasCheck.options.find((o) => o.isCorrect);
  const isBiasCorrect = STATE.selectedBias === scenario.biasCheck.options.indexOf(correctOpt);
  const feedback = $('#bias-feedback');
  feedback.classList.remove('hidden');
  feedback.innerHTML = `
    <div class="bias-feedback-label">${isBiasCorrect ? '✓ 回答正确' : '✕ 回答错误'}</div>
    <p class="bias-feedback-text">${correctOpt.explanation}</p>
  `;

  // Update button
  const btn = $('#btn-bias-submit');
  btn.textContent = '查看结果 →';
  btn.onclick = showVerdict;
}

// ── Verdict ────────────────────────────────────────────────
function showVerdict() {
  const scenario = SCENARIOS[STATE.currentIndex];

  // Calculate scores
  let fallacyScore = 0;
  const fallacyDetails = [];
  scenario.fallacyOptions.forEach((opt) => {
    const selected = STATE.selectedFallacies.has(opt.id);
    if (opt.isCorrect && selected) fallacyScore += 10;
    else if (!opt.isCorrect && selected) fallacyScore -= 5;
    fallacyDetails.push({ id: opt.id, name: opt.name, wasSelected: selected, isCorrect: opt.isCorrect });
  });

  const biasCorrect = STATE.biasSubmitted && STATE.selectedBias !== null
    ? scenario.biasCheck.options[STATE.selectedBias].isCorrect
    : false;
  const biasScore = STATE.biasSubmitted && STATE.selectedBias !== null
    ? (biasCorrect ? 20 : 0)
    : 0;

  const total = Math.max(0, fallacyScore + biasScore);
  const correctFallacies = scenario.fallacyOptions.filter((o) => o.isCorrect).length;
  const maxScore = correctFallacies * 10 + 20;
  const pct = maxScore > 0 ? total / maxScore : 0;
  const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;

  // Save — include detailed tracking for review
  const roundScore = { fallacyScore, biasScore, total, stars, fallacyDetails, biasCorrect };
  STATE.scores[STATE.currentIndex] = roundScore;
  STATE.completed.add(STATE.currentIndex);
  saveProgress();

  // Render score
  $('#score-number').textContent = '0';
  $('#score-number').classList.remove('animate');

  $('#score-stars').innerHTML = Array.from({ length: 3 }, (_, i) =>
    `<span class="star ${i < stars ? 'earned' : ''}">★</span>`
  ).join('');

  $('#score-breakdown').innerHTML = `
    <div class="score-breakdown-item">
      <span class="score-breakdown-value">${fallacyScore}</span>
      <span>谬误狩猎</span>
    </div>
    <div class="score-breakdown-item">
      <span class="score-breakdown-value">${biasScore}</span>
      <span>偏差觉察</span>
    </div>
  `;

  // Animate score
  setTimeout(() => {
    $('#score-number').textContent = total;
    $('#score-number').classList.add('animate');
  }, 300);

  // Render learning cards
  const learnContainer = $('#verdict-learn');
  learnContainer.innerHTML = '';

  scenario.fallacyOptions.forEach((opt) => {
    if (!opt.isCorrect) return;
    const card = document.createElement('div');
    card.className = 'learn-card';
    card.innerHTML = `
      <div class="learn-card-header">
        <span class="learn-card-type fallacy">逻辑谬误</span>
      </div>
      <div class="learn-card-name">${opt.name}</div>
      <div class="learn-card-body">${scenario.fallacyExplanations[opt.id] || opt.explanation}</div>
    `;
    learnContainer.appendChild(card);
  });

  // Bias learning card
  const correctBias = scenario.biasCheck.options.find((o) => o.isCorrect);
  const biasCard = document.createElement('div');
  biasCard.className = 'learn-card';
  biasCard.innerHTML = `
    <div class="learn-card-header">
      <span class="learn-card-type bias">认知偏差</span>
    </div>
    <div class="learn-card-name">${correctBias.text.split('：')[0]}</div>
    <div class="learn-card-body">${correctBias.explanation}</div>
  `;
  learnContainer.appendChild(biasCard);

  // Tip
  $('#verdict-tip').innerHTML = `
    <div class="verdict-tip-label">💡 生活实用技巧</div>
    <p class="verdict-tip-text">${scenario.tip}</p>
  `;

  // Next button
  const nextBtn = $('#btn-next');
  if (STATE.currentIndex < SCENARIOS.length - 1) {
    nextBtn.textContent = '下一关';
    nextBtn.onclick = nextScenario;
    nextBtn.classList.remove('hidden');
  } else {
    nextBtn.textContent = '查看训练报告 →';
    nextBtn.onclick = () => renderReview();
  }

  navigateTo('verdict');
}

function nextScenario() {
  STATE.currentIndex++;
  startScenario();
}

function renderAllDoneTitle() {
  const totalScore = STATE.scores.reduce((sum, s) => sum + (s ? s.total : 0), 0);
  const totalStars = STATE.scores.reduce((sum, s) => sum + (s ? s.stars : 0), 0);

  $('#screen-title').querySelector('.title-sub').textContent =
    `全部通关！总得分 ${totalScore}  ·  共获 ${totalStars} 颗星`;
  $('#btn-start').textContent = '重新开始';
  $('#btn-continue').classList.add('hidden');
}

// ── Progress Overlay ───────────────────────────────────────
function showProgress() {
  const totalScore = STATE.scores.reduce((sum, s) => sum + (s ? s.total : 0), 0);
  const totalStars = STATE.scores.reduce((sum, s) => sum + (s ? s.stars : 0), 0);
  const completedCount = STATE.completed.size;

  $('#progress-summary').innerHTML = `
    <div class="progress-stat">
      <div class="progress-stat-value">${completedCount}/${SCENARIOS.length}</div>
      <div class="progress-stat-label">完成关卡</div>
    </div>
    <div class="progress-stat">
      <div class="progress-stat-value">${totalScore}</div>
      <div class="progress-stat-label">总得分</div>
    </div>
    <div class="progress-stat">
      <div class="progress-stat-value">${totalStars}</div>
      <div class="progress-stat-label">总星数</div>
    </div>
  `;

  const listContainer = $('#progress-list');
  listContainer.innerHTML = '';

  SCENARIOS.forEach((scenario, i) => {
    const row = document.createElement('div');
    row.className = 'progress-row';

    const scoreData = STATE.scores[i];
    const isDone = STATE.completed.has(i);
    const starStr = scoreData ? '★'.repeat(scoreData.stars) + '☆'.repeat(3 - scoreData.stars) : '☆☆☆';
    const scoreStr = scoreData ? `${scoreData.total}分` : '—';

    row.innerHTML = `
      <span class="progress-row-title">${isDone ? '' : '🔒 '}${scenario.title}</span>
      <span class="progress-row-score">${scoreStr}</span>
      <span class="progress-row-star">${starStr}</span>
    `;
    listContainer.appendChild(row);
  });

  navigateTo('progress');
}

function hideProgress() {
  navigateTo(STATE.screensBeforeProgress || 'title');
}

// ── Tutorial Overlay ───────────────────────────────────────
function showTutorialOverlay() {
  STATE.screensBeforeProgress = STATE.screen;
  navigateTo('tutorial');
}

function hideTutorialOverlay() {
  navigateTo(STATE.screensBeforeProgress || 'title');
}

// ── Review Screen ──────────────────────────────────────────
function renderReview() {
  const totalScore = STATE.scores.reduce((sum, s) => sum + (s ? s.total : 0), 0);
  const totalStars = STATE.scores.reduce((sum, s) => sum + (s ? s.stars : 0), 0);
  const maxPossible = SCENARIOS.length * 40; // approximate max (2 fallacies × 10 + 20 bias)
  const overallPct = maxPossible > 0 ? totalScore / maxPossible : 0;

  // Rank
  let badge, title, sub;
  if (overallPct >= 0.8) {
    badge = '🏆'; title = '谬误侦探大师'; sub = '批判性思维已经成为你的本能';
  } else if (overallPct >= 0.5) {
    badge = '🎯'; title = '逻辑达人'; sub = '你具备了扎实的思辨基础，继续精进';
  } else {
    badge = '🌱'; title = '思维学徒'; sub = '每一次觉察都是一次进步，再来一局';
  }

  $('#review-rank').innerHTML = `
    <div class="review-rank-badge">${badge}</div>
    <div class="review-rank-title">${title}</div>
    <div class="review-rank-sub">${sub}</div>
  `;

  // Stats
  const fallacyTotal = STATE.scores.reduce((sum, s) => {
    if (!s || !s.fallacyDetails) return sum;
    return sum + s.fallacyDetails.filter(d => d.isCorrect).length;
  }, 0);
  const fallacyCorrect = STATE.scores.reduce((sum, s) => {
    if (!s || !s.fallacyDetails) return sum;
    return sum + s.fallacyDetails.filter(d => d.isCorrect && d.wasSelected).length;
  }, 0);
  const fallacyRate = fallacyTotal > 0 ? Math.round((fallacyCorrect / fallacyTotal) * 100) : 0;

  const biasTotal = STATE.scores.filter(s => s && s.biasCorrect !== undefined).length;
  const biasCorrectCount = STATE.scores.filter(s => s && s.biasCorrect === true).length;
  const biasRate = biasTotal > 0 ? Math.round((biasCorrectCount / biasTotal) * 100) : 0;

  $('#review-stats').innerHTML = `
    <div class="review-stat-card">
      <div class="review-stat-value accent">${totalScore}</div>
      <div class="review-stat-label">总得分</div>
    </div>
    <div class="review-stat-card">
      <div class="review-stat-value accent">${totalStars}/30</div>
      <div class="review-stat-label">总星数</div>
    </div>
    <div class="review-stat-card">
      <div class="review-stat-value correct">${fallacyRate}%</div>
      <div class="review-stat-label">谬误正确率</div>
    </div>
    <div class="review-stat-card">
      <div class="review-stat-value bias">${biasRate}%</div>
      <div class="review-stat-label">偏差正确率</div>
    </div>
  `;

  // Fallacy breakdown
  const fallacyMap = {};
  SCENARIOS.forEach((scenario, si) => {
    const score = STATE.scores[si];
    if (!score || !score.fallacyDetails) return;
    score.fallacyDetails.forEach(d => {
      if (!d.isCorrect) return;
      if (!fallacyMap[d.name]) fallacyMap[d.name] = { total: 0, correct: 0 };
      fallacyMap[d.name].total++;
      if (d.wasSelected) fallacyMap[d.name].correct++;
    });
  });

  const fallacyRows = Object.entries(fallacyMap)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .map(([name, data]) => {
      const pct = Math.round((data.correct / data.total) * 100);
      const cls = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'poor';
      return `
        <div class="review-table-row">
          <span class="review-table-name">${name}</span>
          <div class="review-table-bar-wrap"><div class="review-table-bar ${cls}" style="width:${pct}%"></div></div>
          <span class="review-table-pct ${cls}">${pct}%</span>
        </div>`;
    }).join('');
  $('#review-fallacy-table').innerHTML = fallacyRows || '<p style="color:var(--text-secondary);font-size:14px;">暂无数据</p>';

  // Bias breakdown
  const biasRows = SCENARIOS.map((scenario, i) => {
    const score = STATE.scores[i];
    const correctBias = scenario.biasCheck.options.find(o => o.isCorrect);
    const isCorrect = score && score.biasCorrect === true;
    const label = correctBias ? correctBias.text.split('：')[0] : scenario.title;
    return `
      <div class="review-table-row">
        <span class="review-table-name">${label}</span>
        <span class="review-table-pct ${isCorrect ? 'good' : 'poor'}">${isCorrect ? '✓' : '✕'}</span>
      </div>`;
  }).join('');
  $('#review-bias-table').innerHTML = biasRows;

  navigateTo('review');
}

function shareResult() {
  const totalScore = STATE.scores.reduce((sum, s) => sum + (s ? s.total : 0), 0);
  const totalStars = STATE.scores.reduce((sum, s) => sum + (s ? s.stars : 0), 0);
  const text = `🧠 谬误侦探 — 训练报告\n🏆 总得分：${totalScore} 分\n⭐ 总星数：${totalStars} / 30\n🔗 你也来挑战：识别逻辑谬误 · 觉察认知偏差`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('[data-action="shareResult"]');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ 已复制';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  }).catch(() => {});
}

// ── Global Event Delegation ────────────────────────────────
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset?.action;
  if (!action) return;

  switch (action) {
    case 'start':
      STATE.currentIndex = 0;
      STATE.scores = [];
      STATE.completed = new Set();
      clearProgress();
      $('#btn-continue').classList.add('hidden');
      $('#screen-title').querySelector('.title-sub').textContent = '识别逻辑谬误 · 觉察认知偏差';
      startScenario();
      break;

    case 'continue':
      {
        const saved = loadProgress();
        if (saved) {
          STATE.currentIndex = saved.currentIndex;
          STATE.scores = saved.scores || [];
          STATE.completed = saved.completed || new Set();
          startScenario();
        }
      }
      break;

    case 'backToTitle':
      navigateTo('title');
      break;

    case 'beginAnalysis':
      beginAnalysis();
      break;

    case 'submitFallacies':
      submitFallacies();
      break;

    case 'submitBias':
      submitBias();
      break;

    case 'nextScenario':
      nextScenario();
      break;

    case 'showProgress':
      STATE.screensBeforeProgress = STATE.screen;
      showProgress();
      break;

    case 'hideProgress':
      hideProgress();
      break;

    case 'resetProgress':
      clearProgress();
      STATE.scores = [];
      STATE.completed = new Set();
      STATE.currentIndex = 0;
      $('#btn-continue').classList.add('hidden');
      $('#btn-start').textContent = '开始新游戏';
      $('#screen-title').querySelector('.title-sub').textContent = '识别逻辑谬误 · 觉察认知偏差';
      navigateTo('title');
      break;

    case 'showTutorial':
      showTutorialOverlay();
      break;

    case 'hideTutorial':
      hideTutorialOverlay();
      break;

    case 'shareResult':
      shareResult();
      break;

    case 'restartGame':
      STATE.currentIndex = 0;
      STATE.scores = [];
      STATE.completed = new Set();
      clearProgress();
      startScenario();
      break;
  }
});

// ── Keyboard Support ───────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (STATE.screen === 'progress') hideProgress();
    else if (STATE.screen === 'tutorial') hideTutorialOverlay();
  }
});

// ── Init ───────────────────────────────────────────────────
function init() {
  initTitle();
  navigateTo('title');
}

init();
