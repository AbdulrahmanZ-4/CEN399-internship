/**
 * Scope AI document-chatbot widget.
 *
 * Self-contained: builds its own DOM and appends it to <body>, so every page
 * only needs a single <script src="js/chatbot.js"></script> tag. Talks to the
 * site's own endpoints (proxied to the local Python RAG service).
 *
 * Features: Company / Personal modes, file upload, streaming answers, markdown,
 * clickable source snippets, confidence guard, follow-up memory, search-depth
 * control, bilingual (follows the site toggle), and — new — the conversation
 * PERSISTS across page navigation, a Stop button, Copy-answer, and 👍/👎
 * feedback.
 */
(function () {
  "use strict";

  var CHAT_ENDPOINT = "/api/chat";
  var INGEST_ENDPOINT = "/api/chatbot/ingest";
  var FORGET_ENDPOINT = "/api/chatbot/forget";
  var FEEDBACK_ENDPOINT = "/api/chatbot/feedback";
  var VISION_ENDPOINT = "/api/chatbot/vision";
  var PAGE_ENDPOINT = "/api/chatbot/page";
  var FOLLOWUPS_ENDPOINT = "/api/chatbot/followups";
  var ACCEPTED = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";
  var STATE_KEY = "scopeChatState_v1";

  // --- i18n --------------------------------------------------------------------
  var STRINGS = {
    en: {
      launcher: "Ask our AI", title: "Scope AI Assistant", clear: "Clear chat",
      tabCompany: "Company Docs", tabPersonal: "Personal Bot",
      subtitleCompany: "Ask about our company documents",
      subtitlePersonal: "Upload your files, ask about them",
      placeholder: "Type your question…", send: "Send", stop: "Stop",
      greetingCompany: "Hello! I'm the Scope AI assistant. Ask me anything about our company documents and projects.",
      greetingPersonal: "Upload your own files (PDF, DOCX, TXT, MD) or an image / drawing, then ask me about them. I'll answer from documents you upload, or read the image you attach.",
      thinking: "Searching documents…",
      offline: "The AI assistant is offline right now. Please try again later.",
      needUpload: "Please upload a file first, then ask your question.",
      uploadBtn: "Upload files", uploading: "Uploading…", chunks: "sections",
      uploadFailed: "Upload failed", sourcesLabel: "Sources",
      lowConfidence: "Low confidence — this may not be covered in the documents.",
      match: "match", copy: "Copy", copied: "Copied", helpful: "Helpful", notHelpful: "Not helpful",
      speak: "Read aloud", stopSpeak: "Stop", regenerate: "Regenerate",
      pageMode: "Ask about this page", pageOn: "Answering from this page", exportChat: "Download chat",
      followupsLabel: "You might also ask",
      noArabicVoice: "No Arabic text-to-speech voice is installed on this device, so I can't read Arabic aloud. (You can add one in your OS speech settings.)",
      handoffText: "Would you like our team to follow up with you directly?",
      handoffBtn: "Talk to our team",
      leadIntro: "Leave your details and we'll get back to you.",
      leadName: "Your name", leadEmail: "Your email", leadMsg: "Message",
      leadSend: "Send", leadSending: "Sending…",
      leadSent: "Thank you! Our team will contact you soon.",
      leadError: "Could not send — please use the Contact page.",
      leadMissing: "Please enter your name and a valid email.",
      depthLabel: "Search depth", depthQuick: "Quick", depthBalanced: "Balanced",
      depthThorough: "Thorough", depthMax: "Maximum",
      startersCompany: ["What services does Scope offer?", "Tell me about the villa design project.", "What are the design requirements?"],
      startersPersonal: ["Summarize this document.", "What are the key points?", "List the main requirements."]
    },
    ar: {
      launcher: "اسأل مساعدنا الذكي", title: "مساعد سكوب الذكي", clear: "مسح المحادثة",
      tabCompany: "مستندات الشركة", tabPersonal: "بوت شخصي",
      subtitleCompany: "اسأل عن مستندات الشركة",
      subtitlePersonal: "ارفع ملفاتك واسأل عنها",
      placeholder: "اكتب سؤالك…", send: "إرسال", stop: "إيقاف",
      greetingCompany: "مرحباً! أنا مساعد سكوب الذكي. اسألني عن مستندات الشركة ومشاريعها.",
      greetingPersonal: "ارفع ملفاتك الخاصة (PDF, DOCX, TXT, MD) أو صورة / مخطط، ثم اسألني عنها. سأجيب من المستندات التي ترفعها، أو أقرأ الصورة التي ترفقها.",
      thinking: "جارٍ البحث في المستندات…",
      offline: "المساعد الذكي غير متصل حالياً. يرجى المحاولة لاحقاً.",
      needUpload: "يرجى رفع ملف أولاً ثم طرح سؤالك.",
      uploadBtn: "رفع ملفات", uploading: "جارٍ الرفع…", chunks: "مقاطع",
      uploadFailed: "فشل الرفع", sourcesLabel: "المصادر",
      lowConfidence: "ثقة منخفضة — قد لا يكون هذا مذكوراً في المستندات.",
      match: "تطابق", copy: "نسخ", copied: "تم النسخ", helpful: "مفيد", notHelpful: "غير مفيد",
      speak: "استماع", stopSpeak: "إيقاف", regenerate: "إعادة توليد",
      pageMode: "اسأل عن هذه الصفحة", pageOn: "الإجابة من هذه الصفحة", exportChat: "تنزيل المحادثة",
      followupsLabel: "قد تسأل أيضاً",
      noArabicVoice: "لا يوجد صوت عربي مثبّت على هذا الجهاز، لذا لا يمكنني القراءة بالعربية. (يمكنك إضافته من إعدادات النطق في نظامك.)",
      handoffText: "هل تريد أن يتواصل معك فريقنا مباشرة؟",
      handoffBtn: "تحدث مع فريقنا",
      leadIntro: "اترك بياناتك وسنعاود التواصل معك.",
      leadName: "اسمك", leadEmail: "بريدك الإلكتروني", leadMsg: "رسالة",
      leadSend: "إرسال", leadSending: "جارٍ الإرسال…",
      leadSent: "شكراً! سيتواصل معك فريقنا قريباً.",
      leadError: "تعذّر الإرسال — يرجى استخدام صفحة التواصل.",
      leadMissing: "يرجى إدخال اسمك وبريد إلكتروني صحيح.",
      depthLabel: "عمق البحث", depthQuick: "سريع", depthBalanced: "متوازن",
      depthThorough: "شامل", depthMax: "الأقصى",
      startersCompany: ["ما هي الخدمات التي تقدمها سكوب؟", "أخبرني عن مشروع تصميم الفيلا.", "ما هي متطلبات التصميم؟"],
      startersPersonal: ["لخّص هذا المستند.", "ما هي النقاط الرئيسية؟", "اذكر أهم المتطلبات."]
    }
  };
  function curLang() { try { return localStorage.getItem("scopeLanguage") === "ar" ? "ar" : "en"; } catch (e) { return "en"; } }
  function t(key) { return STRINGS[curLang()][key]; }

  function sessionId() {
    try {
      var s = localStorage.getItem("scopeChatSession");
      if (!s) { s = "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("scopeChatSession", s); }
      return s;
    } catch (e) { return "sess-anon"; }
  }

  // --- Safe markdown -----------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderMarkdown(text) {
    var lines = escapeHtml(text).split(/\r?\n/), html = "", inList = false, i = 0;
    function inline(s) {
      return s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
              .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
              .replace(/`([^`]+)`/g, "<code>$1</code>");
    }
    function isRow(l) { return l.indexOf("|") !== -1; }
    function isSep(l) { return /\|/.test(l) && /^[\s|:-]+$/.test(l) && /-/.test(l); }
    function cells(l) { return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); }); }
    while (i < lines.length) {
      var line = lines[i];
      if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
        if (inList) { html += "</ul>"; inList = false; }
        var head = cells(line); i += 2; var rows = [];
        while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) { rows.push(cells(lines[i])); i++; }
        html += '<table class="scope-chat-table"><thead><tr>' + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
        rows.forEach(function (r) { html += "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; });
        html += "</tbody></table>";
        continue;
      }
      var b = line.match(/^\s*[-*]\s+(.*)$/);
      if (b) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + inline(b[1]) + "</li>"; }
      else { if (inList) { html += "</ul>"; inList = false; } html += line.trim() === "" ? "<br>" : "<div>" + inline(line) + "</div>"; }
      i++;
    }
    if (inList) html += "</ul>";
    return html;
  }

  // --- State -------------------------------------------------------------------
  var mode = "company", greetedMode = {}, history = [], personalFiles = [], visionImages = [], pageMode = false;
  var speaking = false;
  var transcript = [];      // persisted record of the visible conversation
  var busy = false, currentStop = null, handoffOffered = false;

  var CONTACT_ENDPOINT = "/api/contact";
  // Buying-intent keywords (EN + AR) that trigger the "talk to our team" offer.
  var INTENT = ["quote", "price", "cost", "how much", "hire", "consult", "appointment",
    "meeting", "call me", "contact", "budget", "estimate", "offer", "proposal",
    "سعر", "تكلفة", "عرض", "استشار", "تواصل", "موعد", "اتصل", "ميزاني", "مقترح"];

  var launcher, panel, messagesEl, inputEl, sendBtn, titleEl, subtitleEl, clearBtn;
  var tabCompanyBtn, tabPersonalBtn, uploadEl, fileInput, uploadBtnLabel, filesEl;
  var depthLabelEl, depthSelect, startersEl, exportBtn, pageBtn;
  function $(id) { return document.getElementById(id); }

  // --- Persistence across page navigation --------------------------------------
  function saveSession() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        mode: mode, depth: depthSelect ? depthSelect.value : "5",
        open: panel.classList.contains("open"),
        history: history, transcript: transcript, files: personalFiles
      }));
    } catch (e) {}
  }
  function record(entry) {
    transcript.push(entry);
    if (transcript.length > 160) transcript.shift();
    saveSession();
  }

  function build() {
    launcher = document.createElement("button");
    launcher.className = "scope-chat-launcher";
    launcher.setAttribute("aria-label", "Open AI assistant");
    launcher.innerHTML = '<span class="scope-chat-launcher-icon">💬</span><span class="scope-chat-launcher-text"></span>';

    panel = document.createElement("div");
    panel.className = "scope-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "AI assistant");
    panel.innerHTML =
      '<div class="scope-chat-header">' +
      '  <div class="scope-chat-header-text"><strong class="scope-chat-title"></strong><small class="scope-chat-subtitle"></small></div>' +
      '  <button class="scope-chat-export" title="" aria-label="Download chat">⭳</button>' +
      '  <button class="scope-chat-clear" title="" aria-label="Clear chat">↺</button>' +
      '  <button class="scope-chat-close" aria-label="Close">×</button>' +
      "</div>" +
      '<div class="scope-chat-tabs">' +
      '  <button class="scope-chat-tab active" data-mode="company"></button>' +
      '  <button class="scope-chat-tab" data-mode="personal"></button>' +
      "</div>" +
      '<div class="scope-chat-messages"></div>' +
      '<div class="scope-chat-upload">' +
      '  <label class="scope-chat-upload-btn"><input type="file" multiple hidden /><span></span></label>' +
      '  <div class="scope-chat-files"></div>' +
      "</div>" +
      '<div class="scope-chat-controls">' +
      '  <span class="scope-chat-depth-label"></span>' +
      '  <select class="scope-chat-depth-select">' +
      '    <option value="3"></option><option value="5" selected></option>' +
      '    <option value="8"></option><option value="10"></option>' +
      "  </select>" +
      "</div>" +
      '<form class="scope-chat-input">' +
      '  <button type="button" class="scope-chat-page" title="" aria-label="Ask about this page">📄</button>' +
      '  <input type="text" autocomplete="off" />' +
      '  <button type="submit"></button>' +
      "</form>";

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    messagesEl = panel.querySelector(".scope-chat-messages");
    inputEl = panel.querySelector(".scope-chat-input input");
    sendBtn = panel.querySelector('.scope-chat-input button[type="submit"]');
    titleEl = panel.querySelector(".scope-chat-title");
    subtitleEl = panel.querySelector(".scope-chat-subtitle");
    clearBtn = panel.querySelector(".scope-chat-clear");
    tabCompanyBtn = panel.querySelector('.scope-chat-tab[data-mode="company"]');
    tabPersonalBtn = panel.querySelector('.scope-chat-tab[data-mode="personal"]');
    uploadEl = panel.querySelector(".scope-chat-upload");
    fileInput = panel.querySelector(".scope-chat-upload input");
    uploadBtnLabel = panel.querySelector(".scope-chat-upload-btn span");
    filesEl = panel.querySelector(".scope-chat-files");
    depthLabelEl = panel.querySelector(".scope-chat-depth-label");
    depthSelect = panel.querySelector(".scope-chat-depth-select");
    exportBtn = panel.querySelector(".scope-chat-export");
    pageBtn = panel.querySelector(".scope-chat-page");
    fileInput.setAttribute("accept", ACCEPTED);

    launcher.addEventListener("click", togglePanel);
    panel.querySelector(".scope-chat-close").addEventListener("click", closePanel);
    clearBtn.addEventListener("click", clearConversation);
    exportBtn.addEventListener("click", exportTranscript);
    pageBtn.addEventListener("click", togglePageMode);
    panel.querySelector(".scope-chat-input").addEventListener("submit", onSubmit);
    tabCompanyBtn.addEventListener("click", function () { switchMode("company"); });
    tabPersonalBtn.addEventListener("click", function () { switchMode("personal"); });
    fileInput.addEventListener("change", onFilesChosen);
    depthSelect.addEventListener("change", saveSession);

    var languageBtn = document.getElementById("languageBtn");
    if (languageBtn) languageBtn.addEventListener("click", function () {
      setTimeout(function () { applyLang(); renderFiles(); refreshStarters(); }, 0);
    });

    var restored = loadSession();
    applyLang();
    if (!restored) return;
  }

  function loadSession() {
    var raw;
    try { raw = sessionStorage.getItem(STATE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return false; }

    mode = data.mode === "personal" ? "personal" : "company";
    tabCompanyBtn.classList.toggle("active", mode === "company");
    tabPersonalBtn.classList.toggle("active", mode === "personal");
    uploadEl.classList.toggle("visible", mode === "personal");
    if (data.depth) depthSelect.value = data.depth;
    personalFiles = data.files || [];
    history = data.history || [];
    transcript = data.transcript || [];
    greetedMode[mode] = transcript.length > 0;

    renderFiles();
    replayTranscript();
    if (data.open) { panel.classList.add("open"); launcher.classList.add("hidden"); }
    return true;
  }

  function replayTranscript() {
    messagesEl.innerHTML = "";
    transcript.forEach(function (e) {
      if (e.t === "msg") addMessage(e.text, e.who, { record: false });
      else if (e.t === "answer") addAnswer(e.text, e.question, { replay: true });
      else if (e.t === "sources") addSources(e.sources, { replay: true });
      else if (e.t === "lowconf") addConfidenceNote({ replay: true });
    });
  }

  function applyLang() {
    var lang = curLang();
    panel.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    launcher.querySelector(".scope-chat-launcher-text").textContent = t("launcher");
    launcher.setAttribute("title", t("launcher"));
    titleEl.textContent = t("title");
    clearBtn.setAttribute("title", t("clear"));
    if (exportBtn) exportBtn.setAttribute("title", t("exportChat"));
    if (pageBtn) pageBtn.setAttribute("title", t("pageMode"));
    subtitleEl.textContent = pageMode ? t("pageOn") : (mode === "personal" ? t("subtitlePersonal") : t("subtitleCompany"));
    tabCompanyBtn.textContent = t("tabCompany");
    tabPersonalBtn.textContent = t("tabPersonal");
    uploadBtnLabel.textContent = "📎 " + t("uploadBtn");
    inputEl.placeholder = t("placeholder");
    if (!busy) sendBtn.textContent = t("send");
    depthLabelEl.textContent = t("depthLabel");
    var dt = { "3": "depthQuick", "5": "depthBalanced", "8": "depthThorough", "10": "depthMax" };
    Array.prototype.forEach.call(depthSelect.options, function (o) { o.textContent = t(dt[o.value]); });
  }

  // --- Panel -------------------------------------------------------------------
  function togglePanel() { if (panel.classList.contains("open")) closePanel(); else openPanel(); }
  function openPanel() {
    panel.classList.add("open"); launcher.classList.add("hidden");
    showGreetingOnce(); refreshStarters(); saveSession();
    setTimeout(function () { inputEl.focus(); }, 50);
  }
  function closePanel() { panel.classList.remove("open"); launcher.classList.remove("hidden"); saveSession(); }

  // --- Mode / clear ------------------------------------------------------------
  function switchMode(next) {
    if (next === mode || busy) return;
    mode = next;
    tabCompanyBtn.classList.toggle("active", mode === "company");
    tabPersonalBtn.classList.toggle("active", mode === "personal");
    uploadEl.classList.toggle("visible", mode === "personal");
    messagesEl.innerHTML = ""; history = []; transcript = []; greetedMode[mode] = false; handoffOffered = false;
    applyLang(); renderFiles(); showGreetingOnce(); refreshStarters(); saveSession(); inputEl.focus();
  }
  function showGreetingOnce() {
    if (greetedMode[mode]) return;
    addMessage(mode === "personal" ? t("greetingPersonal") : t("greetingCompany"), "bot");
    greetedMode[mode] = true;
  }
  function clearConversation() {
    if (busy) return;
    var hashes = readyHashes();
    if (mode === "personal" && hashes.length) {
      fetch(FORGET_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_hashes: hashes }) }).catch(function () {});
    }
    if (mode === "personal") { personalFiles = []; visionImages = []; renderFiles(); }
    messagesEl.innerHTML = ""; history = []; transcript = []; greetedMode[mode] = false; handoffOffered = false;
    showGreetingOnce(); refreshStarters(); saveSession();
  }

  // --- Starters ----------------------------------------------------------------
  function refreshStarters() {
    if (startersEl) { startersEl.remove(); startersEl = null; }
    if (history.length > 0) return;
    var list = mode === "personal" ? t("startersPersonal") : t("startersCompany");
    startersEl = document.createElement("div");
    startersEl.className = "scope-chat-starters";
    list.forEach(function (q) {
      var chip = document.createElement("button");
      chip.className = "scope-chat-starter"; chip.type = "button"; chip.textContent = q;
      chip.addEventListener("click", function () { askQuestion(q); });
      startersEl.appendChild(chip);
    });
    messagesEl.appendChild(startersEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // --- Upload ------------------------------------------------------------------
  function onFilesChosen() {
    var files = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = "";
    files.forEach(function (file) {
      if (/^image\//.test(file.type)) addVisionImage(file);
      else uploadOneFile(file);
    });
  }

  // Read + downscale an image to keep the vision payload small and fast.
  function fileToVisionImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1024, w = img.width, h = img.height;
          if (Math.max(w, h) > max) { var s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
          var c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.9));
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  function addVisionImage(file) {
    var entry = { name: file.name, dataUrl: null, status: "loading", kind: "image" };
    visionImages.push(entry); renderFiles();
    fileToVisionImage(file)
      .then(function (dataUrl) { entry.dataUrl = dataUrl; entry.status = "ready"; renderFiles(); })
      .catch(function () { entry.status = "error"; renderFiles(); });
  }

  function readyImages() {
    return visionImages.filter(function (f) { return f.status === "ready" && f.dataUrl; }).map(function (f) { return f.dataUrl; });
  }
  function uploadOneFile(file) {
    var entry = { name: file.name, hash: null, chunks: 0, status: "uploading" };
    personalFiles.push(entry); renderFiles(); saveSession();
    var form = new FormData(); form.append("file", file); form.append("session_id", sessionId());
    fetch(INGEST_ENDPOINT, { method: "POST", body: form })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || res.d.error) { entry.status = "error"; entry.error = res.d.error || t("uploadFailed"); }
        else { entry.status = "done"; entry.hash = res.d.file_hash; entry.chunks = res.d.chunks_added || 0; }
        renderFiles(); saveSession();
      })
      .catch(function () { entry.status = "error"; entry.error = t("offline"); renderFiles(); saveSession(); });
  }
  function renderFiles() {
    if (!filesEl) return;
    filesEl.innerHTML = "";
    personalFiles.forEach(function (f) {
      var chip = document.createElement("div");
      chip.className = "scope-chat-file " + f.status;
      var label = f.name;
      if (f.status === "uploading") label += " · " + t("uploading");
      else if (f.status === "done") label += " · " + f.chunks + " " + t("chunks");
      else if (f.status === "error") label += " · " + (f.error || t("uploadFailed"));
      chip.textContent = label; filesEl.appendChild(chip);
    });
    visionImages.forEach(function (f, i) {
      var chip = document.createElement("div");
      chip.className = "scope-chat-file image " + f.status;
      var label = "🖼 " + f.name;
      if (f.status === "loading") label += " · " + t("uploading");
      else if (f.status === "error") label += " · " + t("uploadFailed");
      chip.textContent = label;
      var x = document.createElement("button");
      x.type = "button"; x.className = "scope-chat-file-x"; x.textContent = "×"; x.title = "Remove";
      x.addEventListener("click", function () { visionImages.splice(i, 1); renderFiles(); });
      chip.appendChild(x);
      filesEl.appendChild(chip);
    });
  }
  function readyHashes() {
    return personalFiles.filter(function (f) { return f.status === "done" && f.hash; }).map(function (f) { return f.hash; });
  }

  // --- Messages ----------------------------------------------------------------
  function addMessage(text, who, opts) {
    opts = opts || {};
    var msg = document.createElement("div");
    msg.className = "scope-chat-msg " + who;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (opts.record !== false && who.indexOf("thinking") === -1) record({ t: "msg", who: who, text: text });
    return msg;
  }

  function addAnswer(text, question, opts) {
    opts = opts || {};
    var msg = document.createElement("div");
    msg.className = "scope-chat-msg bot";
    msg.innerHTML = renderMarkdown(text);
    addToolbar(msg, text, question);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (!opts.replay) record({ t: "answer", text: text, question: question });
    return msg;
  }

  function addToolbar(msgEl, text, question) {
    var bar = document.createElement("div");
    bar.className = "scope-chat-msg-tools";

    var copy = document.createElement("button");
    copy.type = "button"; copy.className = "scope-chat-tool-btn"; copy.title = t("copy"); copy.textContent = "⧉";
    copy.addEventListener("click", function () {
      copyText(text);
      var old = copy.textContent; copy.textContent = "✓"; copy.title = t("copied");
      setTimeout(function () { copy.textContent = old; copy.title = t("copy"); }, 1200);
    });

    var up = document.createElement("button");
    up.type = "button"; up.className = "scope-chat-tool-btn"; up.title = t("helpful"); up.textContent = "👍";
    var down = document.createElement("button");
    down.type = "button"; down.className = "scope-chat-tool-btn"; down.title = t("notHelpful"); down.textContent = "👎";
    up.addEventListener("click", function () { vote("up", question, text, up, down); });
    down.addEventListener("click", function () { vote("down", question, text, up, down); });

    bar.appendChild(copy); bar.appendChild(up); bar.appendChild(down);

    if ("speechSynthesis" in window) {
      var speak = document.createElement("button");
      speak.type = "button"; speak.className = "scope-chat-tool-btn"; speak.title = t("speak"); speak.textContent = "🔊";
      speak.addEventListener("click", function () { speakText(text, speak); });
      bar.appendChild(speak);
    }
    if (question) {
      var regen = document.createElement("button");
      regen.type = "button"; regen.className = "scope-chat-tool-btn"; regen.title = t("regenerate"); regen.textContent = "↻";
      regen.addEventListener("click", function () { if (!busy) askQuestion(question); });
      bar.appendChild(regen);
    }
    msgEl.appendChild(bar);
  }

  function vote(v, question, answer, up, down) {
    up.classList.toggle("active", v === "up");
    down.classList.toggle("active", v === "down");
    fetch(FEEDBACK_ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: v, question: question || "", answer: (answer || "").slice(0, 500) })
    }).catch(function () {});
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(function () {}); return; }
    try {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    } catch (e) {}
  }

  function addSources(sources, opts) {
    opts = opts || {};
    if (!sources || !sources.length) return;
    var seen = {}, unique = [];
    sources.forEach(function (s) { if (s && s.label && !seen[s.label]) { seen[s.label] = true; unique.push(s); } });
    if (!unique.length) return;

    var wrap = document.createElement("div");
    wrap.className = "scope-chat-sources";
    var head = document.createElement("div");
    head.className = "scope-chat-sources-head"; head.textContent = t("sourcesLabel");
    wrap.appendChild(head);
    unique.forEach(function (s) {
      var item = document.createElement("button");
      item.type = "button"; item.className = "scope-chat-source-item";
      var pct = (typeof s.similarity === "number") ? " · " + s.similarity + "% " + t("match") : "";
      item.textContent = "📄 " + s.label + pct;
      var snippet = document.createElement("div");
      snippet.className = "scope-chat-source-snippet"; snippet.textContent = s.snippet || ""; snippet.style.display = "none";
      item.addEventListener("click", function () {
        snippet.style.display = snippet.style.display === "none" ? "block" : "none";
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
      wrap.appendChild(item);
      if (s.snippet) wrap.appendChild(snippet);
    });
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (!opts.replay) record({ t: "sources", sources: unique });
  }

  function addConfidenceNote(opts) {
    opts = opts || {};
    var note = document.createElement("div");
    note.className = "scope-chat-lowconf"; note.textContent = "⚠ " + t("lowConfidence");
    messagesEl.appendChild(note); messagesEl.scrollTop = messagesEl.scrollHeight;
    if (!opts.replay) record({ t: "lowconf" });
  }

  // --- Lead capture / human handoff -------------------------------------------
  function shouldOfferHandoff(question, confidence) {
    if (handoffOffered || mode !== "company") return false;
    if (confidence === "low") return true;
    var q = (question || "").toLowerCase();
    for (var i = 0; i < INTENT.length; i++) if (q.indexOf(INTENT[i]) !== -1) return true;
    return false;
  }

  function maybeOfferHandoff(question, confidence) {
    if (!shouldOfferHandoff(question, confidence)) return;
    handoffOffered = true;

    var card = document.createElement("div");
    card.className = "scope-chat-handoff";
    var p = document.createElement("div");
    p.className = "scope-chat-handoff-text"; p.textContent = t("handoffText");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "scope-chat-handoff-btn"; btn.textContent = t("handoffBtn");
    btn.addEventListener("click", function () { showLeadForm(card, question); });
    card.appendChild(p); card.appendChild(btn);
    messagesEl.appendChild(card);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showLeadForm(card, question) {
    card.innerHTML = "";
    var intro = document.createElement("div");
    intro.className = "scope-chat-handoff-text"; intro.textContent = t("leadIntro");

    var name = document.createElement("input");
    name.type = "text"; name.placeholder = t("leadName"); name.className = "scope-chat-lead-input";
    var email = document.createElement("input");
    email.type = "email"; email.placeholder = t("leadEmail"); email.className = "scope-chat-lead-input";
    var msg = document.createElement("textarea");
    msg.className = "scope-chat-lead-input"; msg.rows = 2;
    msg.value = question ? (curLang() === "ar" ? "سؤالي: " : "My question: ") + question : "";

    var send = document.createElement("button");
    send.type = "button"; send.className = "scope-chat-handoff-btn"; send.textContent = t("leadSend");
    var status = document.createElement("div");
    status.className = "scope-chat-lead-status";

    send.addEventListener("click", function () {
      var em = email.value.trim();
      if (!name.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        status.className = "scope-chat-lead-status error"; status.textContent = t("leadMissing"); return;
      }
      send.disabled = true; status.className = "scope-chat-lead-status"; status.textContent = t("leadSending");
      fetch(CONTACT_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(), email: em, project: "AI Assistant lead",
          message: msg.value.trim() || (question || ""), _honey: ""
        })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok && res.d.success) { card.innerHTML = ""; card.appendChild(okLine(t("leadSent"))); }
          else { send.disabled = false; status.className = "scope-chat-lead-status error"; status.textContent = res.d.error || t("leadError"); }
        })
        .catch(function () { send.disabled = false; status.className = "scope-chat-lead-status error"; status.textContent = t("leadError"); });
    });

    card.appendChild(intro); card.appendChild(name); card.appendChild(email);
    card.appendChild(msg); card.appendChild(send); card.appendChild(status);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    name.focus();
  }

  function okLine(text) {
    var d = document.createElement("div");
    d.className = "scope-chat-handoff-text ok"; d.textContent = "✓ " + text;
    return d;
  }

  // --- Busy / stop -------------------------------------------------------------
  function setBusy(state) {
    busy = state;
    inputEl.disabled = state;
    sendBtn.disabled = false;
    sendBtn.textContent = state ? t("stop") : t("send");
    sendBtn.classList.toggle("stop", state);
    if (!state) { currentStop = null; inputEl.focus(); }
  }
  function stopGeneration() { if (currentStop) currentStop(); }

  // --- Submit / stream ---------------------------------------------------------
  function onSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (busy) { stopGeneration(); return; }
    var question = inputEl.value.trim();
    if (!question) return;
    inputEl.value = "";
    askQuestion(question);
  }

  function askQuestion(question) {
    if (busy || !question) return;
    // Personal mode: images -> vision; else uploaded docs. Page mode -> this page.
    var useVision = mode === "personal" && readyImages().length > 0;
    var usePage = pageMode && !useVision;
    var hashes = null;
    if (mode === "personal" && !useVision) {
      hashes = readyHashes();
      if (!hashes.length) {
        if (startersEl) { startersEl.remove(); startersEl = null; }
        addMessage(question, "user");
        addMessage(t("needUpload"), "bot error");
        return;
      }
    }
    if (startersEl) { startersEl.remove(); startersEl = null; }

    var priorHistory = history.slice();
    addMessage(question, "user");
    history.push({ role: "user", text: question });
    setBusy(true);

    var thinking = addMessage(t("thinking"), "bot thinking", { record: false });

    var endpoint, payload;
    if (useVision) {
      endpoint = VISION_ENDPOINT;
      payload = { question: question, images: readyImages(), history: priorHistory };
    } else if (usePage) {
      endpoint = PAGE_ENDPOINT;
      payload = { question: question, page_text: getPageText(), history: priorHistory };
    } else {
      endpoint = CHAT_ENDPOINT;
      payload = { question: question, top_k: parseInt(depthSelect.value, 10) || 5, history: priorHistory, stream: true };
      if (hashes) payload.file_hashes = hashes;
    }
    streamAnswer(payload, thinking, question, endpoint);
  }

  // --- Page mode / voice / transcript -----------------------------------------
  function getPageText() {
    var main = document.querySelector("main") || document.body;
    return (main.innerText || "").replace(/\s+/g, " ").trim().slice(0, 8000);
  }
  function togglePageMode() {
    pageMode = !pageMode;
    pageBtn.classList.toggle("active", pageMode);
    subtitleEl.textContent = pageMode ? t("pageOn") : (mode === "personal" ? t("subtitlePersonal") : t("subtitleCompany"));
    inputEl.focus();
  }
  function isArabic(s) { return /[؀-ۿ]/.test(s); }
  function pickVoice(prefix) {
    var voices = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || [];
    var match = voices.filter(function (v) { return (v.lang || "").toLowerCase().indexOf(prefix) === 0; });
    return match[0] || null;
  }
  function speakText(text) {
    if (!("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); speaking = false; return; }
    var ar = isArabic(text);
    function go() {
      var voice = pickVoice(ar ? "ar" : "en");
      if (ar && !voice) { addMessage(t("noArabicVoice"), "bot error"); return; }  // no Arabic voice installed
      var u = new SpeechSynthesisUtterance(text);
      u.lang = ar ? "ar-SA" : "en-US";
      if (voice) u.voice = voice;
      u.onend = function () { speaking = false; };
      u.onerror = function () { speaking = false; };
      speaking = true; window.speechSynthesis.speak(u);
    }
    // Voices can load asynchronously — wait for them the first time.
    var vs = window.speechSynthesis.getVoices();
    if (vs && vs.length) go();
    else { window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.onvoiceschanged = null; go(); }; window.speechSynthesis.getVoices(); }
  }
  function exportTranscript() {
    if (!transcript.length) return;
    var lines = [], lang = curLang();
    transcript.forEach(function (e) {
      if (e.t === "msg" && e.who.indexOf("user") === 0) lines.push((lang === "ar" ? "أنت: " : "You: ") + e.text);
      else if (e.t === "msg") lines.push((lang === "ar" ? "المساعد: " : "Assistant: ") + e.text);
      else if (e.t === "answer") lines.push((lang === "ar" ? "المساعد: " : "Assistant: ") + e.text);
      else if (e.t === "sources") lines.push("  [" + t("sourcesLabel") + ": " + e.sources.map(function (s) { return s.label; }).join("; ") + "]");
    });
    var blob = new Blob(["Scope AI Assistant — chat\n\n" + lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "scope-chat.txt"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function addFollowups(question, answer) {
    if (mode === "personal") return; // keep it to company/page answers
    fetch(FOLLOWUPS_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question, answer: answer }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var qs = (d && d.followups) || []; if (!qs.length) return;
        var wrap = document.createElement("div"); wrap.className = "scope-chat-followups";
        var head = document.createElement("div"); head.className = "scope-chat-fu-head"; head.textContent = t("followupsLabel"); wrap.appendChild(head);
        qs.forEach(function (q) {
          var chip = document.createElement("button"); chip.type = "button"; chip.className = "scope-chat-starter"; chip.textContent = q;
          chip.addEventListener("click", function () { wrap.remove(); askQuestion(q); });
          wrap.appendChild(chip);
        });
        messagesEl.appendChild(wrap); messagesEl.scrollTop = messagesEl.scrollHeight;
      })
      .catch(function () {});
  }

  function streamAnswer(payload, thinkingEl, question, endpoint) {
    endpoint = endpoint || CHAT_ENDPOINT;
    var controller = ("AbortController" in window) ? new AbortController() : null;
    var stopped = false;
    var answerText = "", sources = null, confidence = null;
    var botMsg = thinkingEl;
    currentStop = function () { stopped = true; if (controller) controller.abort(); };

    function finalize() {
      if (!answerText) {
        if (botMsg && botMsg.parentNode) botMsg.remove();
        addMessage(t("offline"), "bot error");
      } else {
        // Replace the streaming bubble with a finished answer (markdown + tools).
        if (botMsg && botMsg.parentNode) botMsg.remove();
        addAnswer(answerText, question);
        history.push({ role: "assistant", text: answerText });
        if (confidence === "low") addConfidenceNote();
        addSources(sources);
        maybeOfferHandoff(question, confidence);
        addFollowups(question, answerText);
      }
      setBusy(false);
    }

    fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().catch(function () { return {}; }).then(function (d) {
            if (botMsg && botMsg.parentNode) botMsg.remove();
            addMessage(d.error || t("offline"), "bot error"); setBusy(false);
          });
        }
        if (!response.body || !response.body.getReader) {
          return response.text().then(function (txt) {
            parseWhole(txt); finalize();
          });
        }
        botMsg.className = "scope-chat-msg bot"; botMsg.textContent = "";
        var reader = response.body.getReader(), decoder = new TextDecoder(), buffer = "";
        function pump() {
          return reader.read().then(function (res) {
            if (res.done) { finalize(); return; }
            buffer += decoder.decode(res.value, { stream: true });
            var lines = buffer.split("\n"); buffer = lines.pop();
            lines.forEach(function (line) {
              if (!line.trim()) return;
              var evt; try { evt = JSON.parse(line); } catch (e) { return; }
              if (evt.type === "token") { answerText += evt.text; botMsg.innerHTML = renderMarkdown(answerText); messagesEl.scrollTop = messagesEl.scrollHeight; }
              else if (evt.type === "done") { sources = evt.sources; confidence = evt.confidence; }
              else if (evt.type === "error") { answerText += "\n" + (evt.error || t("offline")); }
            });
            return pump();
          });
        }
        return pump();
      })
      .catch(function () {
        if (stopped) { finalize(); return; }   // user pressed Stop -> keep partial
        if (botMsg && botMsg.parentNode) botMsg.remove();
        addMessage(t("offline"), "bot error"); setBusy(false);
      });

    function parseWhole(txt) {
      txt.split("\n").forEach(function (line) {
        if (!line.trim()) return;
        try { var e = JSON.parse(line);
          if (e.type === "token") answerText += e.text;
          else if (e.type === "done") { sources = e.sources; confidence = e.confidence; }
        } catch (x) {}
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
