/**
 * Scope admin dashboard. Talks to /api/admin/* (gated by the username and
 * password typed here, sent as the X-Admin-User / X-Admin-Pass headers). Lets
 * staff add/remove company documents, review the consultation bookings, and see
 * the most-asked questions + feedback — no CLI.
 */
(function () {
  "use strict";

  var USER_STORE = "scopeAdminUser", PASS_STORE = "scopeAdminPass";
  function $(id) { return document.getElementById(id); }
  function creds() {
    try { return { u: sessionStorage.getItem(USER_STORE) || "", p: sessionStorage.getItem(PASS_STORE) || "" }; }
    catch (e) { return { u: "", p: "" }; }
  }
  function setCreds(u, p) { try { sessionStorage.setItem(USER_STORE, u); sessionStorage.setItem(PASS_STORE, p); } catch (e) {} }
  function hasCreds() { var c = creds(); return c.u && c.p; }

  // --- Language ----------------------------------------------------------------
  // script.js handles the static data-en/data-ar markup. Everything this file
  // writes at runtime goes through T() instead.
  var AR = {
    "Wrong username or password.": "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.",
    "Could not load.": "\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u062a\u062d\u0645\u064a\u0644.",
    "Server unreachable.": "\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062e\u0627\u062f\u0645.",
    "The document service is unavailable.": "\u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629.",
    "The document service is unreachable.": "\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a.",
    "Could not load bookings.": "\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a.",
    "No consultations booked yet.": "\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u062c\u0648\u0632\u0627\u062a \u0627\u0633\u062a\u0634\u0627\u0631\u0627\u062a \u0628\u0639\u062f.",
    "When": "\u0627\u0644\u0645\u0648\u0639\u062f",
    "Client": "\u0627\u0644\u0639\u0645\u064a\u0644",
    "Contact": "\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062a\u0648\u0627\u0635\u0644",
    "Service": "\u0627\u0644\u062e\u062f\u0645\u0629",
    "Estimate & message": "\u0627\u0644\u062a\u0642\u062f\u064a\u0631 \u0648\u0627\u0644\u0631\u0633\u0627\u0644\u0629",
    "past": "\u0645\u0646\u062a\u0647\u064d",
    "Cancel": "\u0625\u0644\u063a\u0627\u0621",
    "Cancel this booking and free the slot": "\u0625\u0644\u063a\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u062d\u062c\u0632 \u0648\u062a\u062d\u0631\u064a\u0631 \u0627\u0644\u0645\u0648\u0639\u062f",
    "Booking cancelled.": "\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062d\u062c\u0632.",
    "Cancel failed.": "\u0641\u0634\u0644 \u0627\u0644\u0625\u0644\u063a\u0627\u0621.",
    "No company documents yet. Add one above.": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0644\u0644\u0634\u0631\u0643\u0629 \u0628\u0639\u062f. \u0623\u0636\u0641 \u0645\u0633\u062a\u0646\u062f\u0627\u064b \u0645\u0646 \u0627\u0644\u0623\u0639\u0644\u0649.",
    "Delete": "\u062d\u0630\u0641",
    "Deleted.": "\u062a\u0645 \u0627\u0644\u062d\u0630\u0641.",
    "Delete failed.": "\u0641\u0634\u0644 \u0627\u0644\u062d\u0630\u0641.",
    "Questions asked": "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u0637\u0631\u0648\u062d\u0629",
    "Helpful": "\u0645\u0641\u064a\u062f\u0629",
    "Not helpful": "\u063a\u064a\u0631 \u0645\u0641\u064a\u062f\u0629",
    "Model": "\u0627\u0644\u0646\u0645\u0648\u0630\u062c",
    "No questions logged yet.": "\u0644\u0645 \u062a\u064f\u0633\u062c\u0651\u0644 \u0623\u0633\u0626\u0644\u0629 \u0628\u0639\u062f.",
    "Nothing flagged yet.": "\u0644\u0627 \u064a\u0648\u062c\u062f \u0634\u064a\u0621 \u0645\u064f\u0639\u0644\u0651\u0645 \u0628\u0639\u062f.",
    "No unhelpful answers yet.": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u062c\u0627\u0628\u0627\u062a \u063a\u064a\u0631 \u0645\u0641\u064a\u062f\u0629 \u0628\u0639\u062f.",
    "(question)": "(\u0633\u0624\u0627\u0644)",
    "Uploading & indexing...": "\u062c\u0627\u0631\u064d \u0627\u0644\u0631\u0641\u0639 \u0648\u0627\u0644\u0641\u0647\u0631\u0633\u0629...",
    "Upload failed.": "\u0641\u0634\u0644 \u0627\u0644\u0631\u0641\u0639.",
    "booking(s)": "\u062d\u062c\u0632",
    "upcoming": "\u0642\u0627\u062f\u0645\u0629",
    "min per slot": "\u062f\u0642\u064a\u0642\u0629 \u0644\u0643\u0644 \u0645\u0648\u0639\u062f",
    "company document(s)": "\u0645\u0633\u062a\u0646\u062f \u0634\u0631\u0643\u0629",
    "total chunks": "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0642\u0627\u0637\u0639",
    "personal upload(s)": "\u0631\u0641\u0639 \u0634\u062e\u0635\u064a",
    "chunks": "\u0645\u0642\u0627\u0637\u0639",
    "chunks added.": "\u0645\u0642\u0627\u0637\u0639 \u0645\u0636\u0627\u0641\u0629.",
    "AM": "\u0635",
    "PM": "\u0645"
  };
  function lang() {
    try { return localStorage.getItem("scopeLanguage") || "en"; } catch (e) { return "en"; }
  }
  function T(s) { return lang() === "ar" && AR[s] ? AR[s] : s; }


  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var c = creds();
    opts.headers["X-Admin-User"] = c.u;
    opts.headers["X-Admin-Pass"] = c.p;
    return fetch(path, opts);
  }

  // --- Login -------------------------------------------------------------------
  function showLogin(msg) {
    $("adminLogin").style.display = "";
    $("adminDash").style.display = "none";
    if (msg) { $("adminLoginMsg").textContent = msg; $("adminLoginMsg").className = "planner-msg error"; }
  }
  function showDash() {
    $("adminLogin").style.display = "none";
    $("adminDash").style.display = "";
    $("adminLoginMsg").textContent = ""; // clear any earlier "wrong password"
  }

  function tryLogin() {
    var u = $("adminUser").value.trim(), p = $("adminPass").value;
    if (!u || !p) return;
    setCreds(u, p);
    load();
  }

  // --- Load ---------------------------------------------------------------------
  // Signing in is checked against /api/admin/bookings, which Node answers on its
  // own. The documents + analytics panel comes from the Python service, so it is
  // loaded separately: if that service is down the admin can still sign in and
  // work with the bookings instead of being locked out of the whole dashboard.
  function load() {
    api("/api/admin/bookings")
      .then(function (r) {
        return r.json().then(function (d) { return { status: r.status, d: d }; });
      })
      .then(function (res) {
        if (res.status === 401) { showLogin(T("Wrong username or password.")); return; }
        if (res.status !== 200) { showLogin(res.d.error || T("Could not load.")); return; }
        showDash();
        lastBookings = res.d.bookings || [];
        lastMeta = res.d;
        renderBookings(lastBookings, res.d);
        loadOverview();
      })
      .catch(function () { showLogin(T("Server unreachable.")); });
  }

  // Documents + analytics (proxied to the Python service). Optional.
  function loadOverview() {
    api("/api/admin/overview")
      .then(function (r) {
        return r.json().then(function (d) { return { status: r.status, d: d }; });
      })
      .then(function (res) {
        if (res.status === 200) { render(res.d); return; }
        overviewOffline(res.d.error || T("The document service is unavailable."));
      })
      .catch(function () { overviewOffline(T("The document service is unreachable.")); });
  }

  // Explain the empty panels rather than leaving them blank.
  function overviewOffline(reason) {
    var note = '<p style="font-size:13px;color:var(--muted);">⚠ ' + escapeHtml(reason) +
      "<br>Bookings above still work. Start the chatbot service to manage documents and see analytics.</p>";
    ["docList", "statTiles", "topQuestions", "unanswered", "recentFeedback"].forEach(function (id) {
      var el = $(id); if (el) el.innerHTML = "";
    });
    var docs = $("docList"); if (docs) docs.innerHTML = note;
    var stats = $("statTiles"); if (stats) stats.innerHTML = note;
    var summary = $("docSummary"); if (summary) summary.textContent = "";
  }

  // --- Consultation bookings ---------------------------------------------------
  // Served by Node (data/bookings.json), not by the Python service.
  var lastBookings = [], lastMeta = null;
  function loadBookings() {
    api("/api/admin/bookings")
      .then(function (r) { return r.json(); })
      .then(function (d) { lastBookings = d.bookings || []; lastMeta = d; renderBookings(lastBookings, d); })
      .catch(function () {
        var el = $("bookingList");
        if (el) el.innerHTML = '<p style="font-size:13px;color:var(--muted);">' + T("Could not load bookings.") + '</p>';
      });
  }

  function todayString() {
    var n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }
  function timeLabel(hhmm) {
    var parts = String(hhmm).split(":"), hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return hhmm;
    return (hour % 12 || 12) + ":" + parts[1] + " " + T(hour < 12 ? "AM" : "PM");
  }

  function renderBookings(list, meta) {
    var wrap = $("bookingList"), summary = $("bookingSummary");
    if (!wrap) return;
    var today = todayString();
    if (summary) {
      summary.textContent = list.length
        ? list.length + " " + T("booking(s)") + " · " +
          (meta && meta.upcoming != null ? meta.upcoming : 0) + " " + T("upcoming") +
          " · " + ((meta && meta.slotMinutes) || 30) + " " + T("min per slot")
        : "";
    }
    if (!list.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">' + T("No consultations booked yet.") + '</p>';
      return;
    }

    wrap.innerHTML =
      '<table class="admin-booking-table"><thead><tr>' +
      "<th>" + T("When") + "</th><th>" + T("Client") + "</th><th>" + T("Contact") +
      "</th><th>" + T("Service") + "</th><th>" + T("Estimate & message") + "</th><th></th>" +
      "</tr></thead><tbody></tbody></table>";
    var body = wrap.querySelector("tbody");

    list.forEach(function (b) {
      var row = document.createElement("tr");
      if (b.date < today) row.className = "past";
      row.innerHTML =
        "<td><strong>" + escapeHtml(b.date) + "</strong><br><span>" + escapeHtml(timeLabel(b.time)) + "</span>" +
        (b.date < today ? '<br><em class="admin-booking-past">' + T("past") + '</em>' : "") + "</td>" +
        "<td>" + escapeHtml(b.name || "-") + "</td>" +
        "<td><a href=\"mailto:" + escapeHtml(b.email || "") + "\">" + escapeHtml(b.email || "-") + "</a>" +
        (b.phone ? "<br>" + escapeHtml(b.phone) : "") + "</td>" +
        "<td>" + escapeHtml(b.service || "-") + "</td>" +
        "<td>" + (b.quote ? "<span class=\"admin-booking-quote\">" + escapeHtml(b.quote) + "</span>" : "") +
        (b.message ? "<div>" + escapeHtml(b.message) + "</div>" : "") +
        (!b.quote && !b.message ? "-" : "") + "</td>";

      var actions = document.createElement("td");
      var cancel = document.createElement("button");
      cancel.className = "btn-tiny danger";
      cancel.textContent = T("Cancel");
      cancel.title = T("Cancel this booking and free the slot");
      cancel.addEventListener("click", function () { cancelBooking(b); });
      actions.appendChild(cancel);
      row.appendChild(actions);
      body.appendChild(row);
    });
  }

  function cancelBooking(b) {
    if (!window.confirm('Cancel the ' + b.date + " " + timeLabel(b.time) + ' booking for "' + (b.name || "") + '"?\nThe slot becomes available again.')) return;
    api("/api/admin/bookings/cancel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) { msg(res.ok ? T("Booking cancelled.") : (res.d.error || T("Cancel failed.")), !res.ok); loadBookings(); })
      .catch(function () { msg(T("Cancel failed."), true); });
  }

  function render(d) {
    // Documents
    var company = d.documents.filter(function (x) { return x.scope === "company"; });
    var personal = d.documents.filter(function (x) { return x.scope !== "company"; });
    $("docSummary").textContent =
      company.length + " " + T("company document(s)") + ", " + d.chunks + " " +
      T("total chunks") +
      (personal.length ? " · " + personal.length + " " + T("personal upload(s)") : "");

    var list = $("docList");
    list.innerHTML = "";
    if (!company.length) {
      list.innerHTML = '<p style="font-size:13px;color:var(--muted);">' + T("No company documents yet. Add one above.") + '</p>';
    }
    company.forEach(function (doc) {
      var row = document.createElement("div");
      row.className = "admin-doc-row";
      var info = document.createElement("span");
      info.textContent = doc.source + " · " + doc.chunks + " " + T("chunks");
      var del = document.createElement("button");
      del.className = "btn-tiny danger"; del.textContent = T("Delete");
      del.addEventListener("click", function () { deleteDoc(doc.file_hash, doc.source); });
      row.appendChild(info); row.appendChild(del);
      list.appendChild(row);
    });

    // Stat tiles
    var fb = d.feedback || { up: 0, down: 0 };
    var tiles = [
      [T("Questions asked"), d.questions_total],
      ["👍 " + T("Helpful"), fb.up],
      ["👎 " + T("Not helpful"), fb.down],
      [T("Model"), d.model]
    ];
    $("statTiles").innerHTML = tiles.map(function (t) {
      return '<div class="admin-stat"><strong>' + escapeHtml(String(t[1])) + "</strong><span>" + escapeHtml(t[0]) + "</span></div>";
    }).join("");

    // Top questions
    var tq = $("topQuestions");
    tq.innerHTML = "";
    if (!d.top_questions.length) {
      tq.innerHTML = '<p style="font-size:13px;color:var(--muted);">' + T("No questions logged yet.") + '</p>';
    }
    d.top_questions.forEach(function (q) {
      var row = document.createElement("div");
      row.className = "admin-q-row";
      row.innerHTML = '<span>' + escapeHtml(q.question) + '</span><strong>' + q.count + "</strong>";
      tq.appendChild(row);
    });

    // Unanswered / low-confidence questions (add documents for these)
    var un = $("unanswered");
    if (un) {
      var u = d.unanswered || [];
      un.innerHTML = u.length ? "" : '<p style="font-size:13px;color:var(--muted);">' + T("Nothing flagged yet.") + '</p>';
      u.forEach(function (q) {
        var row = document.createElement("div");
        row.className = "admin-q-row";
        row.innerHTML = '<span>⚠ ' + escapeHtml(q.question) + '</span><strong>' + q.count + "</strong>";
        un.appendChild(row);
      });
    }

    // Negative feedback review
    var rf = $("recentFeedback");
    if (rf) {
      var downs = (d.feedback && d.feedback.recent_down) || [];
      rf.innerHTML = downs.length ? "" : '<p style="font-size:13px;color:var(--muted);">' +
        T("No unhelpful answers yet.") + '</p>';
      downs.forEach(function (item) {
        var box = document.createElement("div");
        box.className = "admin-fb-item";
        box.innerHTML = '<div class="admin-fb-q">👎 ' + escapeHtml(item.question || T("(question)")) + "</div>" +
          '<div class="admin-fb-a">' + escapeHtml(item.answer || "") + "</div>";
        rf.appendChild(box);
      });
    }

    lastData = d;
  }

  var lastData = null;
  function exportCsv() {
    if (!lastData) return;
    var rows = [["Section", "Item", "Count/Detail"]];
    lastBookings.forEach(function (b) {
      rows.push([
        "Booking",
        b.date + " " + timeLabel(b.time),
        [b.name, b.email, b.phone, b.service, b.quote, b.message].filter(Boolean).join(" | ")
      ]);
    });
    (lastData.top_questions || []).forEach(function (q) { rows.push(["Top question", q.question, q.count]); });
    (lastData.unanswered || []).forEach(function (q) { rows.push(["Unanswered", q.question, q.count]); });
    var fb = lastData.feedback || {};
    rows.push(["Feedback", "Helpful (up)", fb.up || 0]);
    rows.push(["Feedback", "Not helpful (down)", fb.down || 0]);
    (fb.recent_down || []).forEach(function (i) { rows.push(["Down answer", i.question, i.answer]); });
    (lastData.documents || []).forEach(function (dd) { rows.push(["Document", dd.source + " (" + dd.scope + ")", dd.chunks]); });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "scope-analytics.csv"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // --- Actions -----------------------------------------------------------------
  function deleteDoc(fileHash, name) {
    if (!window.confirm('Delete "' + name + '" from the knowledge base?')) return;
    api("/api/admin/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_hash: fileHash })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) { msg(res.ok ? T("Deleted.") : (res.d.error || T("Delete failed.")), !res.ok); load(); })
      .catch(function () { msg(T("Delete failed."), true); });
  }

  function uploadDoc(file) {
    var um = $("uploadMsg");
    um.textContent = T("Uploading & indexing..."); um.className = "planner-msg";
    var form = new FormData(); form.append("file", file);
    api("/api/admin/ingest", { method: "POST", body: form })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && !res.d.error) { um.textContent = res.d.source + ": " + res.d.chunks_added + " " + T("chunks added."); um.className = "planner-msg ok"; }
        else { um.textContent = res.d.error || T("Upload failed."); um.className = "planner-msg error"; }
        load();
      })
      .catch(function () { um.textContent = T("Upload failed."); um.className = "planner-msg error"; });
  }

  function msg(text, isError) { $("adminMsg").textContent = text; $("adminMsg").className = "planner-msg " + (isError ? "error" : "ok"); }

  // --- Init --------------------------------------------------------------------
  // Redraw whatever is on screen when the language button is pressed.
  document.addEventListener("scope:language", function () {
    if (lastBookings && lastBookings.length) renderBookings(lastBookings, lastMeta || {});
    if (lastData) render(lastData);
  });

  document.addEventListener("DOMContentLoaded", function () {
    $("adminLoginBtn").addEventListener("click", tryLogin);
    ["adminUser", "adminPass"].forEach(function (id) { var e = $(id); if (e) e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") tryLogin(); }); });
    $("adminFile").addEventListener("change", function () {
      if (this.files && this.files[0]) { uploadDoc(this.files[0]); this.value = ""; }
    });
    var csvBtn = $("exportCsvBtn"); if (csvBtn) csvBtn.addEventListener("click", exportCsv);
    if (hasCreds()) load(); else showLogin();
  });
})();
