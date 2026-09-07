/**
 * Quote calculator + consultation request for the Scope website.
 * The estimate is a rough, transparent indication computed in the browser;
 * the request form posts to /api/book, which emails the company.
 */
(function () {
  "use strict";

  // Illustrative rates (AED per m², construction cost order of magnitude).
  var RATES = { villa: 4200, apartment: 3600, commercial: 3300, interior: 1800 };
  var FINISH = { standard: 1.0, premium: 1.28, luxury: 1.65 };

  function $(id) { return document.getElementById(id); }
  function isAr() { try { return localStorage.getItem("scopeLanguage") === "ar"; } catch (e) { return false; } }

  function money(n) {
    return "AED " + Math.round(n).toLocaleString("en-US");
  }

  function compute() {
    var type = $("qType").value;
    var area = Math.max(0, parseFloat($("qArea").value) || 0);
    var floors = Math.max(1, parseInt($("qFloors").value, 10) || 1);
    var finish = $("qFinish").value;
    var supervision = $("qSupervision").checked;

    var rate = RATES[type] || 3500;
    var factor = FINISH[finish] || 1;
    // Slight premium for extra floors (structural complexity).
    var floorFactor = 1 + Math.max(0, floors - 1) * 0.03;
    var cost = area * rate * factor * floorFactor;

    // Design + supervision fee as a % of construction cost.
    var feePct = supervision ? 0.08 : 0.05;
    var fee = cost * feePct;

    // Rough timeline: weeks.
    var weeks = Math.round(6 + area / 45 + (floors - 1) * 3);

    return { cost: cost, fee: fee, weeks: weeks };
  }

  function render() {
    var r = compute();
    var lo = r.cost * 0.85, hi = r.cost * 1.15;
    $("qAmount").textContent = money(lo) + " – " + money(hi);
    $("qTimeline").textContent = r.weeks + (isAr() ? " أسبوع" : " weeks");
    $("qFee").textContent = money(r.fee * 0.85) + " – " + money(r.fee * 1.15);
  }

  function quoteSummary() {
    var r = compute();
    var type = $("qType").options[$("qType").selectedIndex].text;
    var finish = $("qFinish").options[$("qFinish").selectedIndex].text;
    return type + ", " + ($("qArea").value || "?") + " m², " + $("qFloors").value + " floor(s), " +
      finish + " finish → " + money(r.cost * 0.85) + "–" + money(r.cost * 1.15) + ", ~" + r.weeks + " weeks";
  }

  // --- Appointment slots -------------------------------------------------------
  // The server decides which slots exist (opening hours) and which are still
  // free; this only renders what it returns. Booked slots stay visible but
  // disabled, so it is obvious why a time cannot be picked.
  var BOOKING_HORIZON_DAYS = 90;
  var slotState = { date: "", slots: [] };

  function pad2(n) { return String(n).padStart(2, "0"); }
  function dateToString(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function daysFromNow(n) { var d = new Date(); d.setDate(d.getDate() + n); return dateToString(d); }

  // "17:30" -> "5:30 PM" (or the Arabic equivalent).
  function timeLabel(hhmm) {
    var parts = hhmm.split(":"), hour = parseInt(parts[0], 10), ar = isAr();
    var suffix = hour < 12 ? (ar ? "ص" : "AM") : (ar ? "م" : "PM");
    var hour12 = hour % 12 || 12;
    return hour12 + ":" + parts[1] + " " + suffix;
  }

  function setSlotMsg(text) { var el = $("bSlotMsg"); if (el) el.textContent = text || ""; }

  function renderSlots() {
    var select = $("bTime"), ar = isAr();
    if (!select) return;
    var previous = select.value;
    select.innerHTML = "";

    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = ar ? "اختر وقتاً" : "Select a time";
    select.appendChild(placeholder);

    if (!slotState.date) {
      select.disabled = true;
      setSlotMsg(ar ? "اختر تاريخاً لعرض الأوقات المتاحة." : "Pick a date to see the available times.");
      return;
    }
    if (!slotState.slots.length) {
      select.disabled = true;
      setSlotMsg(ar ? "نحن مغلقون في هذا اليوم — الجمعة عطلتنا." : "We're closed that day — Friday is our weekend.");
      return;
    }

    var free = 0;
    slotState.slots.forEach(function (slot) {
      var option = document.createElement("option");
      option.value = slot.time;
      option.textContent = timeLabel(slot.time) + (slot.available ? "" : (ar ? " — محجوز" : " — booked"));
      option.disabled = !slot.available;
      if (slot.available) free++;
      select.appendChild(option);
    });
    select.disabled = false;
    if (previous) select.value = previous; // keep the choice across a refresh

    if (!free) setSlotMsg(ar ? "كل الأوقات محجوزة في هذا اليوم — جرّب تاريخاً آخر." : "Every time that day is booked — please try another date.");
    else if (ar) setSlotMsg(free + " وقت متاح");
    else setSlotMsg(free + (free === 1 ? " time" : " times") + " available");
  }

  function loadSlots() {
    var date = $("bDate") ? $("bDate").value : "";
    if (!date) { slotState = { date: "", slots: [] }; renderSlots(); return; }
    setSlotMsg(isAr() ? "جارٍ التحقق من الأوقات…" : "Checking times…");
    fetch("/api/availability?date=" + encodeURIComponent(date))
      .then(function (r) { return r.json(); })
      .then(function (d) { slotState = { date: date, slots: d.slots || [] }; renderSlots(); })
      .catch(function () {
        slotState = { date: date, slots: [] };
        setSlotMsg(isAr() ? "تعذّر تحميل الأوقات. حاول مرة أخرى." : "Could not load the times. Please try again.");
      });
  }

  function submit(e) {
    e.preventDefault();
    var msg = $("quoteMsg"), btn = e.target.querySelector('button[type="submit"]');
    var ar = isAr();
    var email = $("bEmail").value.trim();
    if (!$("bName").value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.style.display = "block"; msg.className = "form-message error";
      msg.textContent = ar ? "يرجى إدخال اسمك وبريد إلكتروني صحيح." : "Please enter your name and a valid email.";
      return;
    }
    if (!$("bDate").value || !$("bTime").value) {
      msg.style.display = "block"; msg.className = "form-message error";
      msg.textContent = ar ? "يرجى اختيار تاريخ ووقت للموعد." : "Please choose an appointment date and time.";
      return;
    }
    btn.disabled = true; var orig = btn.textContent; btn.textContent = ar ? "جارٍ الإرسال..." : "Sending...";
    fetch("/api/book", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("bName").value.trim(), email: email, phone: $("bPhone").value.trim(),
        service: $("qType").options[$("qType").selectedIndex].text,
        date: $("bDate").value, time: $("bTime").value, message: $("bMessage").value.trim(),
        quote: quoteSummary(), _honey: e.target.querySelector('[name="_honey"]').value
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (res) {
        msg.style.display = "block";
        if (res.ok && res.d.success) {
          var when = res.d.booking ? (res.d.booking.date + " · " + timeLabel(res.d.booking.time)) : "";
          msg.className = "form-message success";
          msg.textContent = (ar ? "تم تأكيد موعدك! " : "Your appointment is confirmed! ") + when +
            (ar ? " — سيتواصل معك فريقنا." : " — our team will be in touch.");
          e.target.reset();
          slotState = { date: "", slots: [] };
          renderSlots();
        } else {
          msg.className = "form-message error";
          msg.textContent = res.d.error || (ar ? "تعذّر الإرسال." : "Could not send.");
          // 409 = somebody claimed that slot first; re-pull so the list is honest.
          if (res.status === 409) loadSlots();
        }
      })
      .catch(function () {
        msg.style.display = "block"; msg.className = "form-message error";
        msg.textContent = ar ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.";
      })
      .finally(function () { btn.disabled = false; btn.textContent = orig; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ["qType", "qArea", "qFloors", "qFinish", "qSupervision"].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener("input", render);
      if (el) el.addEventListener("change", render);
    });
    var form = $("quoteForm"); if (form) form.addEventListener("submit", submit);
    var langBtn = $("languageBtn"); if (langBtn) langBtn.addEventListener("click", function () { setTimeout(function () { render(); renderSlots(); }, 0); });

    // Appointment picker: today .. +90 days, times pulled per chosen date.
    var dateInput = $("bDate");
    if (dateInput) {
      dateInput.min = dateToString(new Date());
      dateInput.max = daysFromNow(BOOKING_HORIZON_DAYS);
      dateInput.addEventListener("change", loadSlots);
    }
    renderSlots();
    render();
  });
})();
