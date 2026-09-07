/**
 * Scope Consulting Engineers - HTTPS static server + contact email API
 * + AI document-chatbot proxy.
 *
 * - Serves all the existing HTML/CSS/JS/images over HTTPS.
 * - POST /api/contact validates the submission and emails it (name, email,
 *   project type, message) to CONTACT_TO using Gmail SMTP via Nodemailer.
 * - POST /api/chat (and /api/chatbot/*) are proxied to the local Python RAG
 *   service (chatbot/api.py) so the browser only ever talks to this one HTTPS
 *   origin — no CORS, no mixed content. See chatbot/ for that service.
 * - A self-signed certificate is generated automatically on first run so the
 *   site works over https://localhost with no OpenSSL required.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const express = require("express");
const nodemailer = require("nodemailer");
const selfsigned = require("selfsigned");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");

const app = express();

const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3000;
const HTTP_PORT = Number(process.env.HTTP_PORT) || 3001;

// Where the Python chatbot API (chatbot/api.py) is listening.
const CHATBOT_HOST = process.env.CHATBOT_HOST || "127.0.0.1";
const CHATBOT_PORT = Number(process.env.CHATBOT_PORT) || 8000;

// --- Middleware ---------------------------------------------------------------
// Larger limit because the "Plan Your Project" tool posts SVG drawings.
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

// --- AI chatbot proxy ---------------------------------------------------------
// Forward requests to the local Python RAG service. Responses are STREAMED back
// (piped) so the chat answer can appear token-by-token. Built-in http only.
const MAX_UPLOAD_BYTES = (Number(process.env.CHATBOT_MAX_UPLOAD_MB) || 15) * 1024 * 1024;

function offline(res, msg) {
  if (!res.headersSent) {
    res.status(503).json({
      error:
        msg ||
        "The AI assistant is offline. Start it with: python chatbot/api.py " +
        "(and make sure Ollama is running)."
    });
  } else {
    res.end();
  }
}

// Simple in-memory fixed-window rate limiter (per IP + bucket). No dependency.
function rateLimiter(bucket, max, windowMs) {
  const hits = new Map();
  let lastSweep = Date.now();
  return function (req, res, next) {
    const now = Date.now();
    // Drop expired entries occasionally so a long-running server cannot grow
    // this map without bound (one entry per IP that ever hit the route).
    if (now - lastSweep > windowMs) {
      hits.forEach((rec, key) => { if (now > rec.reset) hits.delete(key); });
      lastSweep = now;
    }
    const key = (req.ip || req.socket.remoteAddress || "?") + ":" + bucket;
    const rec = hits.get(key);
    if (!rec || now > rec.reset) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (rec.count >= max) {
      return res.status(429).json({
        error: "You're sending requests too quickly. Please wait a moment."
      });
    }
    rec.count += 1;
    next();
  };
}

// Forward a JSON request and pipe the (possibly streaming) response through.
function proxyJson(upstreamPath, method) {
  return function (req, res) {
    const bodyString = method === "GET" ? null : JSON.stringify(req.body || {});
    const headers = {};
    if (bodyString !== null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(bodyString);
    }

    const upstream = http.request(
      { host: CHATBOT_HOST, port: CHATBOT_PORT, method, path: upstreamPath, headers },
      (upstreamRes) => {
        res.status(upstreamRes.statusCode || 502);
        if (upstreamRes.headers["content-type"]) {
          res.setHeader("Content-Type", upstreamRes.headers["content-type"]);
        }
        upstreamRes.pipe(res); // stream tokens straight to the browser
      }
    );

    upstream.on("error", (err) => {
      console.error("[chatbot] Proxy error:", err.message);
      offline(res);
    });
    upstream.setTimeout(180000, () => upstream.destroy(new Error("timeout")));

    if (bodyString !== null) upstream.write(bodyString);
    upstream.end();
  };
}

app.post("/api/chat", rateLimiter("chat", 20, 60000), proxyJson("/chat", "POST"));
app.post("/api/chatbot/page", rateLimiter("page", 20, 60000), proxyJson("/page", "POST"));
app.post("/api/chatbot/followups", proxyJson("/followups", "POST"));
app.post("/api/chatbot/vision", rateLimiter("vision", 20, 60000), proxyJson("/vision", "POST"));
app.post("/api/chatbot/forget", proxyJson("/forget", "POST"));
app.post("/api/chatbot/feedback", proxyJson("/feedback", "POST"));
app.get("/api/chatbot/documents", proxyJson("/documents", "GET"));
app.get("/api/chatbot/health", proxyJson("/health", "GET"));

// Reusable multipart upload proxy: streams the file straight through to the
// Python service at `upstreamPath`, with a size guard.
function uploadProxy(upstreamPath) {
  return function (req, res) {
    const declared = Number(req.headers["content-length"] || 0);
    if (declared && declared > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        error: `That file is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
      });
    }
    const headers = {};
    if (req.headers["content-type"]) headers["Content-Type"] = req.headers["content-type"];
    if (req.headers["content-length"]) headers["Content-Length"] = req.headers["content-length"];

    const upstream = http.request(
      { host: CHATBOT_HOST, port: CHATBOT_PORT, method: "POST", path: upstreamPath, headers },
      (upstreamRes) => {
        const chunks = [];
        upstreamRes.on("data", (c) => chunks.push(c));
        upstreamRes.on("end", () => {
          if (res.headersSent) return;
          res.status(upstreamRes.statusCode || 502);
          res.type("application/json");
          res.send(Buffer.concat(chunks));
        });
      }
    );
    upstream.on("error", (err) => {
      console.error("[chatbot] Upload proxy error:", err.message);
      offline(res, "The AI assistant is offline, so the file could not be processed.");
    });
    upstream.setTimeout(180000, () => upstream.destroy(new Error("timeout")));

    let received = 0;
    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES) {
        upstream.destroy(new Error("upload too large"));
        if (!res.headersSent) {
          res.status(413).json({
            error: `That file is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
          });
        }
      }
    });
    req.pipe(upstream);
  };
}

// File upload for the "Personal Bot" mode.
app.post("/api/chatbot/ingest", rateLimiter("ingest", 12, 5 * 60000), uploadProxy("/ingest"));

// --- Admin dashboard (protected by username + password) -----------------------
// Both must be supplied in .env. There is deliberately no fallback: a default
// credential in source is a published credential once the source is public.
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_USER || !ADMIN_PASS) {
  console.error(
    "\n  ADMIN_USER and ADMIN_PASS must be set in .env before starting.\n" +
    "  Copy .env.example to .env and choose a strong pair.\n"
  );
  process.exit(1);
}
function adminGuard(req, res, next) {
  const u = req.headers["x-admin-user"] || "";
  const p = req.headers["x-admin-pass"] || "";
  if (u === ADMIN_USER && p === ADMIN_PASS) return next();
  return res.status(401).json({ error: "Wrong username or password." });
}
app.get("/api/admin/overview", adminGuard, proxyJson("/admin/overview", "GET"));
app.post("/api/admin/delete", adminGuard, proxyJson("/admin/delete", "POST"));
app.post("/api/admin/ingest", adminGuard, uploadProxy("/admin/ingest"));

// Serve the static website (this same folder).
app.use(express.static(__dirname));

// --- Email transport ----------------------------------------------------------
function buildTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null; // Not configured yet.
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass }
  });
}

const transporter = buildTransport();

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Consultation booking: opening hours + slot reservation -------------------
// The office is open Saturday–Thursday, 09:00–14:00 and 17:00–21:30. Friday is
// the weekend. Visitors may only book a slot that falls inside these hours and
// that nobody else has taken.
//
// All times here are plain local wall-clock strings ("HH:MM") and dates are
// "YYYY-MM-DD". Nothing is converted between timezones, so the time a visitor
// picks is exactly the time the office sees.
const SLOT_MINUTES = 30;
const BOOKING_HORIZON_DAYS = 90; // how far ahead the calendar may be booked

const CLOSED = [];
const OPEN_DAY = [["09:00", "14:00"], ["17:00", "21:30"]];
// Keyed by JavaScript's day number: 0 = Sunday … 6 = Saturday.
const BUSINESS_HOURS = {
  0: OPEN_DAY, // Sunday
  1: OPEN_DAY, // Monday
  2: OPEN_DAY, // Tuesday
  3: OPEN_DAY, // Wednesday
  4: OPEN_DAY, // Thursday
  5: CLOSED,   // Friday — weekend
  6: OPEN_DAY  // Saturday
};

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(total) {
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" +
    String(total % 60).padStart(2, "0");
}
function pad2(n) { return String(n).padStart(2, "0"); }
function dateToString(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
// Parse "YYYY-MM-DD" as a LOCAL date (new Date("...") would treat it as UTC and
// can shift the day). Returns null if the string is not a real calendar date.
function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const real = dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  return real ? dt : null;
}

// Every slot start time the office offers on that date ([] when closed).
function slotsForDate(dateString) {
  const dt = parseLocalDate(dateString);
  if (!dt) return [];
  const out = [];
  (BUSINESS_HOURS[dt.getDay()] || CLOSED).forEach(([open, close]) => {
    const last = toMinutes(close) - SLOT_MINUTES; // a slot must finish by closing
    for (let t = toMinutes(open); t <= last; t += SLOT_MINUTES) out.push(toHHMM(t));
  });
  return out;
}

const DATA_DIR = path.join(__dirname, "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");

function readBookings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return []; // no file yet, or it is unreadable — start from empty
  }
}
function writeBookings(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(list, null, 2), "utf8");
}

// Which of a date's slots are still free. A slot is unavailable when somebody
// has booked it, or when it is already in the past today.
function availabilityFor(dateString) {
  const taken = new Set(
    readBookings().filter((b) => b.date === dateString).map((b) => b.time)
  );
  const now = new Date();
  const isToday = dateString === dateToString(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  return slotsForDate(dateString).map((time) => ({
    time,
    available: !taken.has(time) && !(isToday && toMinutes(time) <= minutesNow)
  }));
}

// Claim a slot. Read-check-write runs synchronously with no await in between,
// so two requests for the same slot cannot interleave and both succeed.
// Returns the stored booking, or null when the slot was already taken.
function reserveSlot(details) {
  const all = readBookings();
  if (all.some((b) => b.date === details.date && b.time === details.time)) return null;

  const booking = Object.assign(
    { id: "bk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) },
    details,
    { createdAt: new Date().toISOString() }
  );
  all.push(booking);
  writeBookings(all);
  return booking;
}

// Which slots are free on a given day (drives the time dropdown on quote.html).
app.get("/api/availability", (req, res) => {
  const date = (req.query.date || "").toString();
  if (!parseLocalDate(date)) {
    return res.status(400).json({ error: "Please provide a valid date (YYYY-MM-DD)." });
  }
  const slots = availabilityFor(date);
  res.json({
    date,
    closed: slots.length === 0, // nothing offered at all -> the office is shut
    slots,
    slotMinutes: SLOT_MINUTES
  });
});

// --- Contact API --------------------------------------------------------------
app.post("/api/contact", rateLimiter("contact", 5, 10 * 60000), async (req, res) => {
  const body = req.body || {};

  // Honeypot: bots fill hidden fields; humans leave them empty.
  if (body._honey) {
    return res.json({ success: true }); // Pretend success, drop silently.
  }

  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim();
  const project = (body.project || body.projectType || "").toString().trim();
  const message = (body.message || "").toString().trim();

  // --- Server-side validation ---
  const errors = [];
  if (!name) errors.push("name");
  if (!isValidEmail(email)) errors.push("email");
  if (!project) errors.push("project");
  if (!message) errors.push("message");

  if (errors.length) {
    return res.status(400).json({
      success: false,
      error: "Please fill in all fields with valid information.",
      fields: errors
    });
  }

  if (!transporter) {
    console.error(
      "[contact] Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env"
    );
    return res.status(500).json({
      success: false,
      error: "The email service is not configured on the server yet."
    });
  }

  const to = process.env.CONTACT_TO || process.env.GMAIL_USER;

  const mail = {
    from: `"Scope Website" <${process.env.GMAIL_USER}>`,
    to,
    replyTo: `"${name}" <${email}>`,
    subject: `New Contact Form Message from ${name}`,
    text:
      `New contact form submission\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Project Type: ${project}\n\n` +
      `Message:\n${message}\n`,
    html:
      `<h2>New contact form submission</h2>` +
      `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
      `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
      `<p><strong>Project Type:</strong> ${escapeHtml(project)}</p>` +
      `<p><strong>Message:</strong></p>` +
      `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`
  };

  try {
    await transporter.sendMail(mail);
    return res.json({ success: true });
  } catch (err) {
    console.error("[contact] Failed to send email:", err.message);
    return res.status(502).json({
      success: false,
      error: "Sorry, we could not send your message. Please try again later."
    });
  }
});

// --- Booking / quote request -> reserves a slot, then emails the company ------
// The browser only offers open, free slots, but it is not trusted: the date and
// time are re-checked against the opening hours and existing bookings here.
app.post("/api/book", rateLimiter("book", 5, 10 * 60000), async (req, res) => {
  const b = req.body || {};
  if (b._honey) return res.json({ success: true }); // honeypot

  const name = (b.name || "").toString().trim();
  const email = (b.email || "").toString().trim();
  const phone = (b.phone || "").toString().trim();
  const service = (b.service || "").toString().trim();
  const date = (b.date || "").toString().trim();
  const time = (b.time || "").toString().trim();
  const message = (b.message || "").toString().trim();
  const quote = (b.quote || "").toString().trim(); // optional estimate summary

  const errors = [];
  if (!name) errors.push("name");
  if (!isValidEmail(email)) errors.push("email");
  if (errors.length) {
    return res.status(400).json({ success: false, error: "Please enter your name and a valid email.", fields: errors });
  }

  // --- The requested slot must be real, open, in the future and still free ---
  const requestedDay = parseLocalDate(date);
  if (!requestedDay || !time) {
    return res.status(400).json({
      success: false, error: "Please choose an appointment date and time.",
      fields: [!requestedDay ? "date" : null, !time ? "time" : null].filter(Boolean)
    });
  }

  const today = new Date();
  const todayString = dateToString(today);
  if (date < todayString) {
    return res.status(400).json({ success: false, error: "That date has already passed.", fields: ["date"] });
  }
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + BOOKING_HORIZON_DAYS);
  if (date > dateToString(horizon)) {
    return res.status(400).json({
      success: false,
      error: `Please pick a date within the next ${BOOKING_HORIZON_DAYS} days.`,
      fields: ["date"]
    });
  }
  if (!slotsForDate(date).includes(time)) {
    return res.status(400).json({
      success: false,
      error: "We are closed at that time. Please pick one of the offered slots.",
      fields: ["time"]
    });
  }
  const slot = availabilityFor(date).find((s) => s.time === time);
  if (!slot || !slot.available) {
    return res.status(409).json({
      success: false,
      error: "Sorry, that time has just been taken. Please choose another slot.",
      fields: ["time"]
    });
  }

  const booking = reserveSlot({ date, time, name, email, phone, service, message, quote });
  if (!booking) {
    return res.status(409).json({
      success: false,
      error: "Sorry, that time has just been taken. Please choose another slot.",
      fields: ["time"]
    });
  }

  // The slot is now held. Emailing is a notification on top of that — if it
  // fails the booking still stands and shows up on the admin dashboard.
  const subject = `New consultation booking from ${name} — ${date} ${time}`;
  const rows = [
    ["Appointment", `${date} at ${time} (${SLOT_MINUTES} min)`],
    ["Name", name], ["Email", email], ["Phone", phone || "-"], ["Service", service || "-"],
    quote ? ["Estimate", quote] : null, message ? ["Message", message] : null
  ].filter(Boolean);

  if (!transporter) {
    console.warn("[book] Slot reserved but email is not configured; see the admin dashboard.");
    return res.json({ success: true, booking: { date, time }, emailed: false });
  }

  try {
    await transporter.sendMail({
      from: `"Scope Website" <${process.env.GMAIL_USER}>`,
      to: process.env.CONTACT_TO || process.env.GMAIL_USER,
      replyTo: `"${name}" <${email}>`, subject,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
      html: `<h2>${escapeHtml(subject)}</h2>` + rows.map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</p>`).join("")
    });
    res.json({ success: true, booking: { date, time }, emailed: true });
  } catch (err) {
    console.error("[book] Slot reserved but the email failed:", err.message);
    res.json({ success: true, booking: { date, time }, emailed: false });
  }
});

// --- Admin: consultation bookings --------------------------------------------
// Node owns these (the bookings live in data/bookings.json), so unlike the other
// /api/admin/* routes they are answered here instead of proxied to Python.
app.get("/api/admin/bookings", adminGuard, (req, res) => {
  const bookings = readBookings().slice().sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time)
  );
  const today = dateToString(new Date());
  res.json({
    bookings,
    upcoming: bookings.filter((b) => b.date >= today).length,
    slotMinutes: SLOT_MINUTES
  });
});

// Cancelling frees the slot again so it can be re-booked.
app.post("/api/admin/bookings/cancel", adminGuard, (req, res) => {
  const id = ((req.body || {}).id || "").toString();
  const all = readBookings();
  const index = all.findIndex((b) => b.id === id);
  if (index < 0) return res.status(404).json({ error: "That booking no longer exists." });
  const [removed] = all.splice(index, 1);
  writeBookings(all);
  console.log(`[book] Cancelled ${removed.date} ${removed.time} (${removed.name}).`);
  res.json({ ok: true, removed });
});

// Simple health check.
app.get("/api/health", (req, res) => {
  res.json({ ok: true, emailConfigured: Boolean(transporter) });
});

// --- "Plan Your Project" PDF + email -----------------------------------------
// The planner (js/planner.js) posts the project info plus one SVG drawing per
// floor. We render a multi-page PDF (one page per floor) with a title block.
function renderPlanPdf(doc, project, floors) {
  project = project || {};
  const pageW = doc.page.width;
  const margin = 36;

  floors.forEach((floor, index) => {
    if (index > 0) doc.addPage();

    // --- Title block ---
    doc.fillColor("#0b1f33").fontSize(20).font("Helvetica-Bold")
      .text("Scope Consulting Engineers", margin, margin);
    doc.fontSize(11).font("Helvetica").fillColor("#6b7280")
      .text("Project Plan", margin, margin + 26);

    const info = [
      ["Project", project.projectName || "-"],
      ["Prepared by", project.clientName || "-"],
      ["Email", project.clientEmail || "-"],
      ["Floor", floor.name || `Floor ${index + 1}`],
      ["Floor area", floor.areaLabel || "-"],
      ["Date", new Date().toLocaleDateString()]
    ];
    let iy = margin;
    doc.fontSize(9);
    info.forEach(([k, v]) => {
      doc.fillColor("#6b7280").font("Helvetica-Bold").text(k + ":", pageW - margin - 200, iy, { width: 70, align: "left" });
      doc.fillColor("#1f2937").font("Helvetica").text(String(v), pageW - margin - 128, iy, { width: 128, align: "left" });
      iy += 13;
    });

    doc.moveTo(margin, margin + 48).lineTo(pageW - margin, margin + 48)
      .strokeColor("#e2e8f0").lineWidth(1).stroke();

    // --- Room schedule (left column) ---
    const contentTop = margin + 60;
    const colW = 168;
    let sy = contentTop;
    doc.fillColor("#0b1f33").font("Helvetica-Bold").fontSize(11).text("Room schedule", margin, sy);
    sy += 18;
    const rooms = Array.isArray(floor.rooms) ? floor.rooms : [];
    doc.fontSize(9);
    if (!rooms.length) {
      doc.fillColor("#9ca3af").font("Helvetica").text("(no rooms)", margin, sy);
      sy += 14;
    }
    rooms.forEach((r) => {
      doc.fillColor("#1f2937").font("Helvetica").text(String(r.name || "Room"), margin, sy, { width: colW - 54, ellipsis: true });
      doc.fillColor("#334155").font("Helvetica-Bold").text(String(r.area || ""), margin + colW - 52, sy, { width: 52, align: "right" });
      sy += 13;
    });
    // total
    doc.moveTo(margin, sy + 2).lineTo(margin + colW, sy + 2).strokeColor("#e2e8f0").lineWidth(1).stroke();
    sy += 6;
    doc.fillColor("#0b1f33").font("Helvetica-Bold").fontSize(10)
      .text("Total", margin, sy, { width: colW - 60, continued: false });
    doc.text(String(floor.areaLabel || "-"), margin + colW - 60, sy, { width: 60, align: "right" });

    // --- Drawing (to the right of the schedule) ---
    const drawTop = contentTop;
    const drawLeft = margin + colW + 16;
    const drawW = pageW - margin - drawLeft;
    const drawH = doc.page.height - drawTop - margin - 24;
    if (floor.svg) {
      try {
        SVGtoPDF(doc, floor.svg, drawLeft, drawTop, {
          width: drawW,
          height: drawH,
          preserveAspectRatio: "xMidYMid meet",
          assumePt: false
        });
      } catch (err) {
        doc.fillColor("#b91c1c").fontSize(10)
          .text("Could not render this floor's drawing.", drawLeft, drawTop);
      }
    }

    if (project.notes) {
      doc.fillColor("#6b7280").fontSize(8).font("Helvetica")
        .text("Notes: " + project.notes, margin, doc.page.height - margin - 14,
          { width: drawW, height: 12, ellipsis: true });
    }
  });
}

function buildPlanPdfBuffer(project, floors) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      renderPlanPdf(doc, project, floors);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function validFloors(floors) {
  return Array.isArray(floors) && floors.length > 0 &&
    floors.every((f) => f && typeof f.svg === "string" && f.svg.length < 2_000_000);
}

// Download the plan as a PDF.
app.post("/api/plan/pdf", async (req, res) => {
  const { project, floors } = req.body || {};
  if (!validFloors(floors)) {
    return res.status(400).json({ error: "No valid floors to export." });
  }
  try {
    const buffer = await buildPlanPdfBuffer(project, floors);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="scope-project-plan.pdf"');
    res.send(buffer);
  } catch (err) {
    console.error("[plan] PDF generation failed:", err.message);
    res.status(500).json({ error: "Could not generate the PDF." });
  }
});

// Email the plan (as a PDF attachment) to the company.
app.post("/api/plan/email", rateLimiter("planEmail", 5, 10 * 60000), async (req, res) => {
  const { project, floors } = req.body || {};
  if (!validFloors(floors)) {
    return res.status(400).json({ error: "No valid floors to send." });
  }
  if (!transporter) {
    return res.status(500).json({
      success: false,
      error: "The email service is not configured on the server yet."
    });
  }

  const name = (project && project.clientName || "").toString().trim() || "Website Visitor";
  const email = (project && project.clientEmail || "").toString().trim();
  const projectName = (project && project.projectName || "").toString().trim() || "Untitled";

  try {
    const buffer = await buildPlanPdfBuffer(project, floors);
    const to = process.env.CONTACT_TO || process.env.GMAIL_USER;
    await transporter.sendMail({
      from: `"Scope Website" <${process.env.GMAIL_USER}>`,
      to,
      replyTo: isValidEmail(email) ? `"${name}" <${email}>` : undefined,
      subject: `New Project Plan: ${projectName} (from ${name})`,
      text:
        `A visitor designed a project plan using the website planner.\n\n` +
        `Name: ${name}\nEmail: ${email || "-"}\nProject: ${projectName}\n` +
        `Floors: ${floors.length}\nNotes: ${(project && project.notes) || "-"}\n`,
      html:
        `<h2>New project plan from the website planner</h2>` +
        `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
        `<p><strong>Email:</strong> ${escapeHtml(email || "-")}</p>` +
        `<p><strong>Project:</strong> ${escapeHtml(projectName)}</p>` +
        `<p><strong>Floors:</strong> ${floors.length}</p>` +
        `<p><strong>Notes:</strong> ${escapeHtml((project && project.notes) || "-")}</p>` +
        `<p>The full plan is attached as a PDF.</p>`,
      attachments: [{ filename: "scope-project-plan.pdf", content: buffer }]
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[plan] Email failed:", err.message);
    res.status(502).json({ success: false, error: "Could not send the plan. Please try again later." });
  }
});

// --- Self-signed certificate --------------------------------------------------
function loadOrCreateCert() {
  const certDir = path.join(__dirname, "certs");
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }

  console.log("Generating a self-signed certificate for https://localhost ...");
  const attrs = [{ name: "commonName", value: "localhost" }];
  const pems = selfsigned.generate(attrs, {
    days: 825,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" }, // DNS
          { type: 7, ip: "127.0.0.1" } // IP
        ]
      }
    ]
  });

  fs.mkdirSync(certDir, { recursive: true });
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

// --- Start servers ------------------------------------------------------------
const credentials = loadOrCreateCert();

https.createServer(credentials, app).listen(HTTPS_PORT, () => {
  console.log(`\n  Scope website running over HTTPS:`);
  console.log(`    https://localhost:${HTTPS_PORT}\n`);
  if (!transporter) {
    console.log(
      "  NOTE: Contact email is NOT configured. Copy .env.example to .env"
    );
    console.log("        and fill in GMAIL_USER and GMAIL_APP_PASSWORD.\n");
  }
});

// Redirect plain HTTP to HTTPS for convenience.
http
  .createServer((req, res) => {
    const host = (req.headers.host || `localhost:${HTTP_PORT}`).split(":")[0];
    res.writeHead(301, {
      Location: `https://${host}:${HTTPS_PORT}${req.url}`
    });
    res.end();
  })
  .listen(HTTP_PORT, () => {
    console.log(`  (HTTP on ${HTTP_PORT} redirects to HTTPS)\n`);
  });
