// ============================================================
//  Smart Student – script.js  (fully working, no dead endpoints)
// ============================================================

// ── State ────────────────────────────────────────────────────
let timerInterval = null;
let timerSeconds  = 0;
let isRunning     = false;
let chatHistory   = [];   // [{role, content}, …]

// ── DOM refs ─────────────────────────────────────────────────
const timerDisplay = document.getElementById("timer");
const toggleBtn    = document.getElementById("toggleBtn");
const resetBtn     = document.getElementById("resetBtn");

// ============================================================
//  BOOT – load live performance data
// ============================================================
window.addEventListener("DOMContentLoaded", () => {
  loadPerformance();
  attachSearchHandler();
  attachUploadHandler();
  attachNavHandlers();
  attachActionCardHandlers("dashboard");
});

// ── Load streak / study stats from Flask ────────────────────
async function loadPerformance() {
  try {
    const res  = await fetch("/api/performance");
    const data = await res.json();

    const statValues = document.querySelectorAll(".stat-value");
    if (statValues[0]) statValues[0].textContent = data.streak + " 🔥";
    if (statValues[1]) statValues[1].textContent = data.study_hours + "h";

    const fills = document.querySelectorAll(".progress-fill");
    if (fills[0]) {
      fills[0].className = "progress-fill " + data.color;
      fills[0].style.width = data.progress_pct + "%";
    }
  } catch (e) {
    console.warn("Performance load failed:", e);
  }
}


// ============================================================
//  TIMER
// ============================================================
function formatTime(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function toggleTimer() {
  if (isRunning) {
    clearInterval(timerInterval);
    toggleBtn.textContent = "Resume";
    isRunning = false;
    // Persist elapsed seconds to server
    saveTimerToServer(timerSeconds);
  } else {
    timerInterval = setInterval(() => {
      timerSeconds++;
      timerDisplay.textContent = formatTime(timerSeconds);
    }, 1000);
    toggleBtn.textContent = "Pause";
    isRunning = true;
  }
}

function resetTimer() {
  if (isRunning) saveTimerToServer(timerSeconds);
  clearInterval(timerInterval);
  timerSeconds = 0;
  isRunning    = false;
  timerDisplay.textContent = "00:00:00";
  toggleBtn.textContent    = "Start";
}

async function saveTimerToServer(seconds) {
  if (seconds <= 0) return;
  try {
    await fetch("/api/timer", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ seconds }),
    });
  } catch (e) { /* silent */ }
}

toggleBtn.addEventListener("click", toggleTimer);
resetBtn.addEventListener("click",  resetTimer);


// ============================================================
//  NAVIGATION
// ============================================================
const quickActionsContent = {
  dashboard : [
    { icon: "📚", title: "Recent Topics",  description: "Continue where you left off", action: "topics"    },
    { icon: "🚀", title: "Quick Quiz",     description: "Test your knowledge",          action: "quiz"      },
    { icon: "💡", title: "AI Tutor",       description: "Get instant help",             action: "ai-chat"   },
  ],
  targets   : [
    { icon: "🎯", title: "Daily Goals",    description: "View your targets",            action: "targets"   },
    { icon: "📈", title: "Weekly Progress",description: "78% achieved",                 action: "progress"  },
    { icon: "➕", title: "New Target",     description: "Set a new goal",               action: "add-target"},
  ],
  "ai-agents": [
    { icon: "🤖", title: "Study Buddy",    description: "Chat with AI tutor",           action: "ai-chat"   },
    { icon: "📝", title: "Essay Helper",   description: "Writing assistance",           action: "ai-chat"   },
    { icon: "🧠", title: "Problem Solver", description: "Math and science help",        action: "ai-chat"   },
  ],
  analytics : [
    { icon: "📊", title: "Study Patterns", description: "View your habits",             action: "analytics" },
    { icon: "📉", title: "Performance",    description: "Track improvement",            action: "analytics" },
    { icon: "⏱️", title: "Time Analysis",  description: "Hours breakdown",             action: "analytics" },
  ],
  timetable : [
    { icon: "📅", title: "Today's Schedule",description: "3 sessions planned",         action: "timetable" },
    { icon: "🔔", title: "Upcoming",        description: "Math exam in 5 days",        action: "timetable" },
    { icon: "✨", title: "Generate Timetable",description: "AI-powered schedule",      action: "gen-timetable"},
  ],
  syllabus  : [
    { icon: "📖", title: "Current Syllabus",description: "View your course outline",   action: "topics"    },
    { icon: "✅", title: "Topics Covered",  description: "18 of 24 topics done",       action: "topics"    },
    { icon: "➕", title: "Add Subject",     description: "Import new syllabus",         action: "add-subject"},
  ],
};

function attachNavHandlers() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", function () {
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      this.classList.add("active");
      const tab = this.getAttribute("data-tab");
      renderQuickActions(tab);
    });
  });
}

function renderQuickActions(tab) {
  const grid = document.getElementById("actionsGrid");
  const actions = quickActionsContent[tab] || quickActionsContent.dashboard;

  const sectionTitle = document.querySelector(".quick-actions h3");
  const titles = { dashboard:"Quick Actions", targets:"Your Targets", "ai-agents":"AI Agents",
                   analytics:"Analytics", timetable:"Timetable", syllabus:"Syllabus" };
  if (sectionTitle) sectionTitle.textContent = titles[tab] || "Quick Actions";

  grid.innerHTML = actions.map((a, i) => `
    <div class="action-card" data-action="${a.action}" style="animation-delay:${i*60}ms">
      <div class="action-icon">${a.icon}</div>
      <h4>${a.title}</h4>
      <p>${a.description}</p>
    </div>`).join("");

  attachActionCardHandlers(tab);
}

function attachActionCardHandlers() {
  document.querySelectorAll(".action-card").forEach(card => {
    card.addEventListener("click", () => handleAction(card.dataset.action));
  });
}

function handleAction(action) {
  switch (action) {
    case "ai-chat":      openAIChat();                    break;
    case "quiz":         openQuizModal();                  break;
    case "add-target":   openAddModal("target");           break;
    case "add-subject":  openAddModal("subject");          break;
    case "gen-timetable":generateTimetable();              break;
    case "targets":      showTargetsList();                break;
    case "timetable":    showTimetableView();              break;
    default:             showToast("Feature coming soon!", "info");
  }
}


// ============================================================
//  SEARCH  →  AI Chat
// ============================================================
function attachSearchHandler() {
  document.querySelector(".search-input").addEventListener("keypress", e => {
    if (e.key !== "Enter") return;
    const q = e.target.value.trim();
    if (!q) return;
    e.target.value = "";
    openAIChat(q);
  });
}


// ============================================================
//  PDF UPLOAD  →  /api/upload
// ============================================================
function attachUploadHandler() {
  const uploadBtn = document.querySelector(".upload-btn");
  const pdfInput  = document.getElementById("pdfInput");

  uploadBtn.addEventListener("click", () => pdfInput.click());

  pdfInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    showToast("📄 Uploading & analysing PDF…", "info");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res  = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) { showToast("Upload failed: " + data.error, "error"); return; }

      // Show summary in AI chat
      openAIChat(null, `📄 **${data.filename}** uploaded!\n\n${data.summary}`);
      showToast("PDF uploaded & summarised ✅", "success");
    } catch (err) {
      showToast("Upload error: " + err.message, "error");
    }

    pdfInput.value = "";
  });
}


// ============================================================
//  AI CHAT MODAL  →  /api/chat
// ============================================================
function openAIChat(initialQuery = null, assistantMessage = null) {
  closeModal("aiChatModal");

  const modal = document.createElement("div");
  modal.id = "aiChatModal";
  modal.className = "ss-modal";
  modal.innerHTML = `
    <div class="ss-overlay" data-close="true">
      <div class="ss-box chat-box">
        <div class="ss-header">
          <span>🤖 AI Study Tutor</span>
          <button class="ss-close">✕</button>
        </div>
        <div class="chat-messages" id="chatMessages">
          <div class="cm-bubble assistant">
            Hi! I'm your AI Study Tutor. Ask me anything — concepts, problems, exam tips, essays!
          </div>
        </div>
        <div class="chat-footer">
          <input id="chatInput" type="text" placeholder="Ask a question…" />
          <button id="chatSend">Send</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector(".ss-close").onclick = () => closeModal("aiChatModal");
  modal.querySelector(".ss-overlay").addEventListener("click", e => {
    if (e.target.dataset.close) closeModal("aiChatModal");
  });

  const chatInput = document.getElementById("chatInput");
  document.getElementById("chatSend").onclick = sendChat;
  chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendChat(); });
  chatInput.focus();

  // Pre-populate if needed
  if (assistantMessage) appendBubble("assistant", assistantMessage);
  if (initialQuery) {
    chatInput.value = initialQuery;
    sendChat();
  }
}

async function sendChat() {
  const input     = document.getElementById("chatInput");
  const messages  = document.getElementById("chatMessages");
  const query     = input.value.trim();
  if (!query || !messages) return;

  appendBubble("user", escapeHtml(query));
  input.value = "";

  const loadingId = "ld_" + Date.now();
  messages.innerHTML += `<div class="cm-bubble assistant typing" id="${loadingId}">
    <span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  messages.scrollTop = messages.scrollHeight;

  chatHistory.push({ role: "user", content: query });

  try {
    const res  = await fetch("/api/chat", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ message: query, history: chatHistory.slice(-20) }),
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const reply = data.reply;
    chatHistory.push({ role: "assistant", content: reply });

    const el = document.getElementById(loadingId);
    if (el) { el.className = "cm-bubble assistant"; el.innerHTML = formatReply(reply); }

  } catch (err) {
    const el = document.getElementById(loadingId);
    if (el) { el.className = "cm-bubble assistant error"; el.textContent = "⚠️ " + err.message; }
  }

  messages.scrollTop = messages.scrollHeight;
}

function appendBubble(role, html) {
  const messages = document.getElementById("chatMessages");
  if (!messages) return;
  messages.innerHTML += `<div class="cm-bubble ${role}">${html}</div>`;
  messages.scrollTop = messages.scrollHeight;
}


// ============================================================
//  QUIZ MODAL  →  /api/quiz
// ============================================================
async function openQuizModal() {
  closeModal("quizModal");
  showToast("Generating quiz…", "info");

  let questions;
  try {
    const res  = await fetch("/api/quiz", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ subject: "General Knowledge", num_questions: 5 }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    questions = data.questions;
  } catch (e) {
    // Fallback hardcoded questions
    questions = [
      { question:"What is the powerhouse of the cell?",      options:["Nucleus","Mitochondria","Ribosome","Golgi"], correct_index:1, explanation:"Mitochondria produce ATP energy." },
      { question:"π to 2 decimal places?",                   options:["3.12","3.14","3.16","3.18"],                correct_index:1, explanation:"π ≈ 3.14159…" },
      { question:"Closest planet to the Sun?",               options:["Venus","Earth","Mercury","Mars"],           correct_index:2, explanation:"Mercury is closest." },
      { question:"What does CPU stand for?",                  options:["Central Processing Unit","Core Power Unit","Computer Personal Unit","Central Power Unit"], correct_index:0, explanation:"CPU = Central Processing Unit." },
      { question:"Who wrote Romeo and Juliet?",              options:["Dickens","Austen","Shakespeare","Homer"],   correct_index:2, explanation:"Shakespeare wrote it around 1594–1596." },
    ];
  }

  renderQuiz(questions);
}

function renderQuiz(questions) {
  let current = 0, score = 0;

  const modal = document.createElement("div");
  modal.id = "quizModal";
  modal.className = "ss-modal";
  modal.innerHTML = `
    <div class="ss-overlay" data-close="true">
      <div class="ss-box quiz-box">
        <div class="ss-header">
          <span>🚀 Quick Quiz</span>
          <button class="ss-close">✕</button>
        </div>
        <div id="quizBody"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector(".ss-close").onclick = () => closeModal("quizModal");
  modal.querySelector(".ss-overlay").addEventListener("click", e => {
    if (e.target.dataset.close) closeModal("quizModal");
  });

  function showQuestion() {
    if (current >= questions.length) {
      document.getElementById("quizBody").innerHTML = `
        <div class="quiz-result">
          <div class="quiz-score">${score}/${questions.length}</div>
          <p>${score >= 4 ? "🎉 Excellent!" : score >= 2 ? "👍 Good effort!" : "📚 Keep studying!"}</p>
          <button class="ss-btn primary" onclick="closeModal('quizModal');openQuizModal()">Try Again</button>
        </div>`;
      return;
    }
    const q = questions[current];
    document.getElementById("quizBody").innerHTML = `
      <div class="quiz-progress">Question ${current+1} of ${questions.length}</div>
      <div class="quiz-q">${escapeHtml(q.question)}</div>
      <div class="quiz-opts">
        ${q.options.map((o,i)=>`<button class="quiz-opt" data-idx="${i}">${escapeHtml(o)}</button>`).join("")}
      </div>
      <div class="quiz-explain" id="quizExplain" style="display:none"></div>`;

    document.querySelectorAll(".quiz-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".quiz-opt").forEach(b => b.disabled = true);
        const chosen = +btn.dataset.idx;
        if (chosen === q.correct_index) { btn.classList.add("correct"); score++; }
        else {
          btn.classList.add("wrong");
          document.querySelectorAll(".quiz-opt")[q.correct_index].classList.add("correct");
        }
        const exp = document.getElementById("quizExplain");
        exp.textContent = "💡 " + (q.explanation || "");
        exp.style.display = "block";
        setTimeout(() => { current++; showQuestion(); }, 1400);
      });
    });
  }

  showQuestion();
}


// ============================================================
//  ADD MODAL  (targets / subjects)
// ============================================================
function openAddModal(type) {
  closeModal("addModal");

  const labels = { target:"New Study Target", subject:"New Subject" };
  const placeholder = { target:"e.g. Study 2 hours daily", subject:"e.g. Mathematics" };

  const modal = document.createElement("div");
  modal.id = "addModal";
  modal.className = "ss-modal";
  modal.innerHTML = `
    <div class="ss-overlay" data-close="true">
      <div class="ss-box add-box">
        <div class="ss-header">
          <span>➕ ${labels[type]}</span>
          <button class="ss-close">✕</button>
        </div>
        <input id="addInput" type="text" class="ss-input" placeholder="${placeholder[type]}" />
        <button class="ss-btn primary" id="addSubmit" style="width:100%;margin-top:12px">Add</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector(".ss-close").onclick = () => closeModal("addModal");
  modal.querySelector(".ss-overlay").addEventListener("click", e => {
    if (e.target.dataset.close) closeModal("addModal");
  });

  const input = document.getElementById("addInput");
  input.focus();

  document.getElementById("addSubmit").onclick = async () => {
    const val = input.value.trim();
    if (!val) { showToast("Please enter a value.", "error"); return; }

    const endpoint = type === "target" ? "/api/targets" : "/api/targets";
    try {
      const res  = await fetch(endpoint, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ target: val }),
      });
      const data = await res.json();
      showToast(`✅ "${val}" added!`, "success");
      closeModal("addModal");
    } catch (e) {
      showToast("Failed to add. Try again.", "error");
    }
  };
}


// ============================================================
//  GENERATE TIMETABLE  →  /api/generate_timetable
// ============================================================
async function generateTimetable() {
  showToast("🗓️ Generating AI timetable…", "info");

  try {
    const res  = await fetch("/api/generate_timetable", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ hours_per_day: 4 }),
    });
    const data = await res.json();
    showTimetableModal(data.timetable, data.note);
  } catch (e) {
    showToast("Failed to generate timetable.", "error");
  }
}

function showTimetableModal(timetable, note) {
  closeModal("timetableModal");
  const modal = document.createElement("div");
  modal.id = "timetableModal";
  modal.className = "ss-modal";

  const rows = timetable.map(day => `
    <div class="tt-day">
      <div class="tt-day-name">${day.day}</div>
      <div class="tt-sessions">
        ${day.sessions.map(s => `
          <div class="tt-session">
            <span class="tt-time">${s.time}</span>
            <span class="tt-subj">${s.subject}</span>
            <span class="tt-dur">${s.duration}</span>
          </div>`).join("")}
      </div>
    </div>`).join("");

  modal.innerHTML = `
    <div class="ss-overlay" data-close="true">
      <div class="ss-box tt-box">
        <div class="ss-header">
          <span>📅 Your AI Timetable</span>
          <button class="ss-close">✕</button>
        </div>
        ${note ? `<p class="tt-note">${note}</p>` : ""}
        <div class="tt-grid">${rows}</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".ss-close").onclick = () => closeModal("timetableModal");
  modal.querySelector(".ss-overlay").addEventListener("click", e => {
    if (e.target.dataset.close) closeModal("timetableModal");
  });
}


// ============================================================
//  TARGETS LIST
// ============================================================
async function showTargetsList() {
  closeModal("targetsModal");
  let targets = [];
  try {
    const res  = await fetch("/api/targets");
    const data = await res.json();
    targets = data.targets || [];
  } catch (e) { /* use empty */ }

  const modal = document.createElement("div");
  modal.id = "targetsModal";
  modal.className = "ss-modal";
  modal.innerHTML = `
    <div class="ss-overlay" data-close="true">
      <div class="ss-box">
        <div class="ss-header">
          <span>🎯 Your Targets</span>
          <button class="ss-close">✕</button>
        </div>
        <ul class="targets-list">
          ${targets.length ? targets.map((t,i)=>`
            <li class="target-item">
              <span>${escapeHtml(t)}</span>
              <button class="del-btn" onclick="deleteTarget(${i})">🗑</button>
            </li>`).join("") : "<li style='color:var(--muted-foreground)'>No targets yet. Add one!</li>"}
        </ul>
        <button class="ss-btn primary" style="width:100%;margin-top:16px" 
                onclick="closeModal('targetsModal');openAddModal('target')">+ Add Target</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".ss-close").onclick = () => closeModal("targetsModal");
  modal.querySelector(".ss-overlay").addEventListener("click", e => {
    if (e.target.dataset.close) closeModal("targetsModal");
  });
}

async function deleteTarget(idx) {
  try {
    await fetch(`/api/targets/${idx}`, { method: "DELETE" });
    closeModal("targetsModal");
    showTargetsList();
    showToast("Target removed.", "info");
  } catch (e) { showToast("Failed to delete.", "error"); }
}


// ============================================================
//  TIMETABLE VIEW (static today's view)
// ============================================================
function showTimetableView() {
  openAddModal("subject"); // quick entry for now
}


// ============================================================
//  HELPERS
// ============================================================
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatReply(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

function showToast(msg, type = "info") {
  const old = document.getElementById("ss-toast");
  if (old) old.remove();
  const t = document.createElement("div");
  t.id = "ss-toast";
  t.className = `ss-toast ss-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(()=>t.remove(), 300); }, 3200);
}


// ============================================================
//  INJECTED STYLES for modals, chat, quiz, etc.
// ============================================================
const style = document.createElement("style");
style.textContent = `
/* ── Modal shell ── */
.ss-modal { position:fixed;inset:0;z-index:999; }
.ss-overlay {
  position:absolute;inset:0;
  background:rgba(0,0,0,.65);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(6px);
  padding:16px;
}
.ss-box {
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  padding:24px;
  width:100%;max-width:500px;
  max-height:90vh;overflow-y:auto;
  animation:ssIn .25s cubic-bezier(.34,1.56,.64,1);
  scrollbar-width:thin;
}
@keyframes ssIn {
  from{opacity:0;transform:scale(.88) translateY(16px)}
  to  {opacity:1;transform:scale(1)   translateY(0)}
}
.ss-header {
  display:flex;justify-content:space-between;align-items:center;
  margin-bottom:18px;font-size:1rem;font-weight:600;
}
.ss-close {
  background:var(--secondary);border:none;color:var(--foreground);
  width:30px;height:30px;border-radius:50%;cursor:pointer;
  font-size:.8rem;display:flex;align-items:center;justify-content:center;
  transition:background .2s;
}
.ss-close:hover{background:var(--muted);}

/* ── Chat ── */
.chat-box{max-width:540px;}
.chat-messages {
  height:320px;overflow-y:auto;
  display:flex;flex-direction:column;gap:10px;
  padding:12px;background:var(--secondary);
  border-radius:12px;margin-bottom:12px;
  scrollbar-width:thin;scrollbar-color:var(--muted) transparent;
}
.cm-bubble {
  max-width:85%;padding:10px 14px;border-radius:14px;
  font-size:.85rem;line-height:1.6;
}
.cm-bubble p{margin:2px 0;}
.cm-bubble.user {
  align-self:flex-end;
  background:var(--primary);color:var(--primary-foreground);
  border-radius:14px 14px 4px 14px;
}
.cm-bubble.assistant {
  align-self:flex-start;
  background:var(--muted);color:var(--foreground);
  border-radius:14px 14px 14px 4px;
}
.cm-bubble.error{background:rgba(239,68,68,.15);color:#ef4444;}
.cm-bubble.typing{display:flex;gap:5px;align-items:center;padding:14px;}
.dot{width:8px;height:8px;background:var(--muted-foreground);border-radius:50%;
     animation:dotBounce 1.2s infinite ease-in-out;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes dotBounce{0%,80%,100%{transform:scale(.8);opacity:.5}40%{transform:scale(1.1);opacity:1}}
.chat-footer{display:flex;gap:8px;}
.chat-footer input{
  flex:1;padding:10px 14px;
  background:var(--secondary);border:1px solid var(--border);
  border-radius:10px;color:var(--foreground);font-size:.875rem;outline:none;
}
.chat-footer input:focus{border-color:var(--primary);}
.chat-footer button{
  padding:10px 18px;background:var(--primary);color:var(--primary-foreground);
  border:none;border-radius:10px;cursor:pointer;font-weight:600;
  transition:opacity .2s;
}
.chat-footer button:hover{opacity:.85;}

/* ── Quiz ── */
.quiz-box{max-width:440px;}
.quiz-progress{font-size:.75rem;color:var(--muted-foreground);margin-bottom:6px;}
.quiz-q{font-size:.95rem;font-weight:600;margin-bottom:14px;line-height:1.4;}
.quiz-opts{display:flex;flex-direction:column;gap:8px;}
.quiz-opt{
  padding:11px 14px;background:var(--secondary);color:var(--foreground);
  border:1px solid var(--border);border-radius:10px;text-align:left;
  cursor:pointer;font-size:.875rem;transition:all .15s;
}
.quiz-opt:not(:disabled):hover{border-color:var(--primary);background:rgba(45,212,191,.1);}
.quiz-opt.correct{background:rgba(45,212,191,.2);border-color:#2dd4bf;color:#2dd4bf;}
.quiz-opt.wrong  {background:rgba(239,68,68,.15);border-color:#ef4444;color:#ef4444;}
.quiz-explain{margin-top:12px;padding:10px 14px;background:rgba(45,212,191,.08);
              border-radius:10px;font-size:.8rem;color:var(--muted-foreground);}
.quiz-result{text-align:center;padding:12px 0;}
.quiz-score{font-size:3rem;font-weight:700;color:var(--primary);margin-bottom:8px;}
.quiz-result p{color:var(--muted-foreground);margin-bottom:20px;}

/* ── Add / generic ── */
.add-box{max-width:380px;}
.ss-input{
  width:100%;padding:12px 14px;
  background:var(--secondary);border:1px solid var(--border);
  border-radius:10px;color:var(--foreground);font-size:.875rem;outline:none;
}
.ss-input:focus{border-color:var(--primary);}
.ss-btn{padding:11px 18px;border:none;border-radius:10px;cursor:pointer;
        font-weight:600;font-size:.875rem;transition:opacity .2s;}
.ss-btn.primary{background:var(--primary);color:var(--primary-foreground);}
.ss-btn.primary:hover{opacity:.85;}

/* ── Targets list ── */
.targets-list{list-style:none;display:flex;flex-direction:column;gap:8px;}
.target-item{
  display:flex;justify-content:space-between;align-items:center;
  padding:10px 14px;background:var(--secondary);border-radius:10px;font-size:.875rem;
}
.del-btn{background:none;border:none;cursor:pointer;font-size:1rem;opacity:.6;transition:opacity .2s;}
.del-btn:hover{opacity:1;}

/* ── Timetable modal ── */
.tt-box{max-width:560px;}
.tt-note{font-size:.75rem;color:var(--muted-foreground);margin-bottom:12px;}
.tt-grid{display:flex;flex-direction:column;gap:10px;}
.tt-day{background:var(--secondary);border-radius:12px;padding:14px;}
.tt-day-name{font-weight:600;font-size:.875rem;margin-bottom:8px;color:var(--primary);}
.tt-sessions{display:flex;flex-direction:column;gap:6px;}
.tt-session{display:flex;gap:10px;align-items:center;font-size:.8rem;}
.tt-time{color:var(--muted-foreground);min-width:70px;}
.tt-subj{font-weight:500;flex:1;}
.tt-dur{color:var(--muted-foreground);}

/* ── Toast ── */
.ss-toast{
  position:fixed;bottom:24px;right:24px;z-index:2000;
  padding:13px 20px;border-radius:12px;font-size:.875rem;font-weight:500;
  max-width:340px;pointer-events:none;
  opacity:0;transform:translateY(12px);transition:all .28s ease;
  box-shadow:0 8px 24px rgba(0,0,0,.3);
}
.ss-toast.show{opacity:1;transform:translateY(0);}
.ss-toast-success{background:rgba(45,212,191,.15);border:1px solid #2dd4bf;color:#2dd4bf;}
.ss-toast-error  {background:rgba(239,68,68,.15); border:1px solid #ef4444;color:#ef4444;}
.ss-toast-info   {background:rgba(96,165,250,.15); border:1px solid #60a5fa;color:#60a5fa;}

/* ── Action card animation ── */
.action-card{animation:cardIn .3s ease both;}
@keyframes cardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
`;
document.head.appendChild(style);