'use strict';

// ===== STATE =====
let questions = [];       // [{question, answers, _correctOriginalLabel}]
let flatQuestions = [];   // with shuffled answers + _correctLabel
let userAnswers = {};
let currentQ = 0;
let examMode = 'test';
let timerSeconds = 1800;
let timerInterval = null;
let playerName = '';
let subjectInfo = {};

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  examMode = params.get('mode') || 'test';
  const subjId = params.get('subj');
  const examNum = params.get('exam');

  applyModeUI();

  // Time buttons
  document.querySelectorAll('.time-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timerSeconds = parseInt(btn.dataset.time) * 60;
    updateSetupInfo();
  }));

  // Load data
  try {
    const resp = await fetch('subjects.json');
    const data = await resp.json();
    const subj = data.subjects.find(s => s.id == subjId);
    if (!subj) throw new Error('Subject not found');
    questions = subj.exams[examNum];
    if (!questions || !questions.length) throw new Error('No questions');
    subjectInfo = { name: subj.name, icon: subj.icon, color: subj.color, examNum };
  } catch(e) {
    // fallback: try old exam_data.json
    try {
      const r2 = await fetch('exam_data.json');
      const d2 = await r2.json();
      questions = d2.flatMap(p => p.questions.map(q => ({
        question: q.question, answers: q.answers,
        _correctOriginalLabel: q.answers[0].label
      })));
      subjectInfo = { name: 'Trắc Nghiệm', icon: '📚', color: '#6366f1', examNum: '?' };
    } catch(e2) {
      alert('Không tải được dữ liệu câu hỏi!'); return;
    }
  }

  updateSetupInfo();

  // Update setup header
  document.getElementById('setup-subject-name').textContent = subjectInfo.name;
  document.getElementById('setup-exam-num').textContent = 'Mã đề ' + (subjectInfo.examNum || '?');
  document.getElementById('setup-q-count').textContent = questions.length + ' câu hỏi';
  document.getElementById('setup-icon').textContent = subjectInfo.icon || '📚';
  document.getElementById('mode-badge').textContent = examMode === 'practice' ? 'LUYỆN TẬP' : 'THI THỬ';
  if (examMode === 'practice') {
    document.getElementById('mode-badge').style.background = 'rgba(16,185,129,0.2)';
    document.getElementById('mode-badge').style.color = '#6ee7b7';
    document.getElementById('time-group').style.display = 'none';
  }

  document.getElementById('start-btn').addEventListener('click', startExam);
  document.getElementById('prev-btn').addEventListener('click', () => navigate(-1));
  document.getElementById('next-btn').addEventListener('click', () => navigate(1));
  document.getElementById('submit-btn').addEventListener('click', confirmSubmit);
  document.getElementById('review-btn').addEventListener('click', showReview);
  document.getElementById('retry-btn').addEventListener('click', () => location.href = 'index.html');

  showScreen('setup-screen');
});

function applyModeUI() {
  if (examMode === 'practice') {
    document.getElementById('setup-icon').textContent = '📖';
    document.getElementById('setup-title').textContent = 'Luyện Tập';
    document.getElementById('setup-desc').textContent = 'Xem đáp án ngay sau khi chọn, không giới hạn thời gian';
  } else {
    document.getElementById('setup-icon').textContent = '🎯';
    document.getElementById('setup-title').textContent = 'Thi Thử';
    document.getElementById('setup-desc').textContent = 'Đề bài random, không xem đáp án khi làm, đồng hồ đếm ngược';
  }
}

function updateSetupInfo() {
  const t = (examMode === 'practice') ? 0 : timerSeconds;
  document.getElementById('info-time').textContent = t === 0 ? 'Không giới hạn' : (t / 60) + ' phút';
  document.getElementById('info-questions').textContent = questions.length + ' câu';
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const t = document.getElementById(id);
  t.style.display = 'block'; t.classList.add('active');
}
window.showScreen = showScreen;

// ===== START EXAM =====
function startExam() {
  playerName = document.getElementById('player-name').value.trim() || 'Thí sinh';
  flatQuestions = questions.map(q => {
    const correctOrig = q._correctOriginalLabel || 'A';
    const labels = ['A','B','C','D'];
    let answers = q.answers.map(a => ({ ...a, _origLabel: a.label }));
    if (examMode === 'test') answers = answers.sort(() => Math.random() - 0.5);
    answers = answers.map((a, i) => ({ ...a, label: labels[i] }));
    const correctNew = answers.find(a => a._origLabel === correctOrig)?.label || 'A';
    return { ...q, answers, _correctLabel: correctNew };
  });

  if (examMode === 'test') flatQuestions = flatQuestions.sort(() => Math.random() - 0.5);

  userAnswers = {};
  currentQ = 0;
  buildNavGrid();
  startTimer();
  showScreen('exam-screen');
  renderQuestion(0);
}

// ===== TIMER =====
function startTimer() {
  clearInterval(timerInterval);
  if (examMode === 'practice' || timerSeconds === 0) {
    document.getElementById('timer-display').style.display = 'none'; return;
  }
  document.getElementById('timer-display').style.display = '';
  document.getElementById('timer-display').className = 'timer-display';
  let rem = timerSeconds;
  updateTimerDisplay(rem);
  timerInterval = setInterval(() => {
    rem--;
    updateTimerDisplay(rem);
    const td = document.getElementById('timer-display');
    if (rem <= 60) td.className = 'timer-display danger';
    else if (rem <= 300) td.className = 'timer-display warning';
    if (rem <= 0) { clearInterval(timerInterval); submitExam(); }
  }, 1000);
}

function updateTimerDisplay(sec) {
  const m = String(Math.floor(Math.abs(sec) / 60)).padStart(2, '0');
  const s = String(Math.abs(sec) % 60).padStart(2, '0');
  document.getElementById('timer-text').textContent = m + ':' + s;
}

// ===== NAV GRID =====
function buildNavGrid() {
  const grid = document.getElementById('nav-grid');
  grid.innerHTML = '';
  flatQuestions.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'nav-dot'; btn.textContent = i + 1; btn.id = 'nav-' + i;
    btn.addEventListener('click', () => renderQuestion(i));
    grid.appendChild(btn);
  });
  updateNavGrid();
}

function updateNavGrid() {
  let answered = 0;
  flatQuestions.forEach((_, i) => {
    const dot = document.getElementById('nav-' + i);
    if (!dot) return;
    dot.className = 'nav-dot';
    if (userAnswers[i] !== undefined) { dot.classList.add('answered'); answered++; }
    if (i === currentQ) dot.classList.add('current');
  });
  document.getElementById('nav-answered').textContent = answered + '/' + flatQuestions.length;
}

// ===== RENDER QUESTION =====
function renderQuestion(idx) {
  currentQ = idx;
  const fq = flatQuestions[idx];
  if (!fq) return;

  // Show subject info in question card
  document.getElementById('question-subject').textContent = subjectInfo.icon + ' ' + subjectInfo.name + ' · Đề ' + subjectInfo.examNum;
  document.getElementById('question-number').textContent = `Câu ${idx + 1} / ${flatQuestions.length}`;
  document.getElementById('current-q-label').textContent = `Câu ${idx + 1}/${flatQuestions.length}`;
  document.getElementById('question-text').textContent = fq.question;

  const userAns = userAnswers[idx];
  const correctLabel = fq._correctLabel;
  const answerList = document.getElementById('answer-list');
  answerList.innerHTML = '';

  fq.answers.forEach(ans => {
    const opt = document.createElement('div');
    opt.className = 'answer-option';
    if (examMode === 'practice' && userAns !== undefined) {
      if (ans.label === correctLabel) {
        opt.classList.add(userAns === ans.label ? 'correct' : 'show-correct');
      } else if (ans.label === userAns) opt.classList.add('wrong');
    } else if (userAns === ans.label) opt.classList.add('selected');

    opt.innerHTML = `<div class="answer-label">${ans.label}</div><div class="answer-text">${escHtml(ans.text)}</div>`;
    if (!(examMode === 'practice' && userAns !== undefined)) {
      opt.addEventListener('click', () => selectAnswer(idx, ans.label));
    }
    answerList.appendChild(opt);
  });

  // Feedback
  const oldFb = document.getElementById('feedback-box');
  if (oldFb) oldFb.remove();
  if (examMode === 'practice' && userAns !== undefined) {
    const ok = userAns === correctLabel;
    const fb = document.createElement('div');
    fb.id = 'feedback-box';
    fb.className = 'feedback-box ' + (ok ? 'correct' : 'wrong');
    fb.textContent = ok ? '✅ Chính xác!' : `❌ Sai rồi! Đáp án đúng là: ${correctLabel}`;
    answerList.after(fb);
  }

  document.getElementById('prev-btn').disabled = idx === 0;
  document.getElementById('next-btn').textContent = idx === flatQuestions.length - 1 ? '📝 Nộp bài →' : 'Câu sau →';
  updateNavGrid();
}

// ===== SELECT ANSWER =====
function selectAnswer(idx, label) {
  if (examMode === 'practice' && userAnswers[idx] !== undefined) return;
  userAnswers[idx] = label;
  renderQuestion(idx);
  if (examMode === 'practice' && idx < flatQuestions.length - 1) setTimeout(() => navigate(1), 700);
}

// ===== NAVIGATE =====
function navigate(dir) {
  const next = currentQ + dir;
  if (next >= flatQuestions.length) { confirmSubmit(); return; }
  if (next < 0) return;
  renderQuestion(next);
}

// ===== SUBMIT =====
function confirmSubmit() {
  const unanswered = flatQuestions.length - Object.keys(userAnswers).length;
  if (unanswered > 0 && examMode === 'test') {
    if (!confirm(`Còn ${unanswered} câu chưa trả lời. Nộp bài?`)) return;
  }
  submitExam();
}

function submitExam() {
  clearInterval(timerInterval);
  let correct = 0, wrong = 0, skipped = 0;
  flatQuestions.forEach((fq, i) => {
    const ua = userAnswers[i];
    if (ua === undefined) skipped++;
    else if (ua === fq._correctLabel) correct++;
    else wrong++;
  });
  const total = flatQuestions.length;
  const pct = Math.round((correct / total) * 100);

  document.getElementById('result-name').textContent = '👤 ' + playerName;
  document.getElementById('result-subject').textContent = subjectInfo.icon + ' ' + subjectInfo.name + ' · Đề ' + subjectInfo.examNum;
  document.getElementById('score-num').textContent = correct + '/' + total;
  document.getElementById('score-pct').textContent = pct + '%';
  document.getElementById('rs-correct').textContent = correct;
  document.getElementById('rs-wrong').textContent = wrong;
  document.getElementById('rs-skipped').textContent = skipped;

  const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '😐' : '😢';
  const title = pct >= 80 ? 'Xuất sắc!' : pct >= 60 ? 'Khá tốt!' : pct >= 40 ? 'Cần cố gắng thêm' : 'Cần ôn luyện nhiều hơn';
  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;

  const circ = 326.7;
  const ring = document.getElementById('ring-fill');
  const col = pct >= 80 ? '#10b981' : pct >= 60 ? '#6366f1' : pct >= 40 ? '#f59e0b' : '#ef4444';
  ring.style.stroke = col;
  setTimeout(() => { ring.style.strokeDashoffset = circ - (pct / 100) * circ; }, 100);
  showScreen('result-screen');
}

// ===== REVIEW =====
function showReview() {
  document.getElementById('review-score-label').textContent =
    `${document.getElementById('rs-correct').textContent} đúng / ${flatQuestions.length} câu · ${document.getElementById('score-pct').textContent}`;

  const body = document.getElementById('review-body');
  body.innerHTML = '';

  flatQuestions.forEach((fq, fi) => {
    const ua = userAnswers[fi];
    const ok = ua === fq._correctLabel;
    const status = ua === undefined ? '⬜' : ok ? '✅' : '❌';

    const qEl = document.createElement('div');
    qEl.className = 'review-question';
    qEl.innerHTML = `
      <div class="review-q-header">
        <div class="review-q-num">${status} Câu ${fi + 1}</div>
        <div class="review-q-text">${escHtml(fq.question)}</div>
      </div>
      <div class="review-answers"></div>
    `;
    const ansDiv = qEl.querySelector('.review-answers');
    fq.answers.forEach(ans => {
      const isCorrect = ans.label === fq._correctLabel;
      const isUser = ans.label === ua;
      const cls = (isCorrect && isUser) ? 'user-correct' : isCorrect ? 'is-correct' : isUser ? 'user-wrong' : '';
      const aEl = document.createElement('div');
      aEl.className = 'review-answer ' + cls;
      aEl.innerHTML = `<div class="review-answer-label">${ans.label}</div><span>${escHtml(ans.text)}</span>`;
      ansDiv.appendChild(aEl);
    });
    body.appendChild(qEl);
  });

  showScreen('review-screen');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
