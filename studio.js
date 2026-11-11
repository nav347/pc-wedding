/* Couple's studio v0.1: footer entry + modal + generated versions in the switcher. Plain JS, no deps. */
(function(){
"use strict";
var POLL_MS = window.STUDIO_POLL_MS || 10000;
var MAX_PHOTOS = 6, MAX_BYTES = 6 * 1024 * 1024;
var REAL = {neha: 1, prabhanshu: 2};
var endpoint = null; // null = not loaded, "" = closed, string = base url

function lev(a, b){
  var prev = [], i, j; for (j = 0; j <= b.length; j++) prev.push(j);
  for (i = 1; i <= a.length; i++){
    var cur = [i];
    for (j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + (a[i-1] !== b[j-1] ? 1 : 0)));
    prev = cur;
  }
  return prev[b.length];
}
function norm(s){ return String(s).toLowerCase().replace(/[^a-z]/g, ""); }
function fuzzy(name){ // same rules as the server
  name = String(name || "").slice(0, 200);
  var c = [norm(name)].concat(name.split(/[^A-Za-z]+/).map(norm));
  for (var i = 0; i < c.length; i++){
    var t = c[i]; if (!t || t.length > 30) continue;
    if (t === "pc") return true;
    for (var r in REAL) if (t === r || lev(t, r) <= REAL[r]) return true;
  }
  return false;
}
function ls(op, k, v){ try { return op === "g" ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } }
function el(tag, attrs, kids){
  var n = document.createElement(tag);
  for (var k in (attrs || {})){ if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
  (kids || []).forEach(function(c){ n.appendChild(c); });
  return n;
}
function loadEndpoint(){
  if (endpoint !== null) return Promise.resolve(endpoint);
  return fetch("endpoint.json?nc=" + Date.now(), {cache: "no-store"}).then(function(r){ return r.json(); })
    .then(function(j){ endpoint = (j && typeof j.url === "string") ? j.url.replace(/\/+$/, "") : ""; return endpoint; })
    .catch(function(){ endpoint = ""; return endpoint; });
}
function withTimeout(p, ms){
  return Promise.race([p, new Promise(function(_, rej){ setTimeout(function(){ rej(new Error("timeout")); }, ms); })]);
}

/* ---------- modal ---------- */
var modal, panel, lastFocus, files = [], pollTimer = null;
function build(){
  modal = el("div", {"class": "st-modal", id: "stModal"});
  panel = el("div", {"class": "st-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "stT"});
  modal.appendChild(panel); document.body.appendChild(modal);
  modal.addEventListener("mousedown", function(e){ if (e.target === modal) close(); });
  document.addEventListener("keydown", function(e){
    if (!modal.classList.contains("on")) return;
    if (e.key === "Escape"){ e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    var f = [].filter.call(panel.querySelectorAll("button,input:not(.st-file),textarea,a[href]"), function(x){ return !x.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!panel.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}
function frame(title){
  panel.innerHTML = "";
  var x = el("button", {"class": "st-x", type: "button", "aria-label": "Close", text: "×"}); x.onclick = close;
  panel.appendChild(x);
  panel.appendChild(el("h3", {id: "stT", text: title}));
  panel.scrollTop = 0;
}
function open(){
  lastFocus = document.activeElement;
  modal.classList.add("on"); document.documentElement.classList.add("st-lock");
  frame("For the bride and groom");
  panel.appendChild(el("p", {"class": "st-sub", text: "One moment..."}));
  panel.querySelector(".st-x").focus();
  loadEndpoint().then(function(url){
    if (!modal.classList.contains("on")) return;
    if (!url) return soon();
    var jid = ls("g", "st_job");
    if (jid) return waiting(jid);
    stepName();
  });
}
function close(){
  modal.classList.remove("on"); document.documentElement.classList.remove("st-lock");
  if (pollTimer){ clearTimeout(pollTimer); pollTimer = null; }
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function soon(){
  frame("The couple's studio opens soon");
  panel.appendChild(el("p", {text: "This little corner is being set up. Please come back in a day or two."}));
  var b = el("button", {"class": "st-btn", type: "button", text: "Okay"}); b.onclick = close; panel.appendChild(b); b.focus();
}

/* ---------- step 1 ---------- */
function stepName(){
  frame("For the bride and groom");
  panel.appendChild(el("p", {"class": "st-sub", text: "Tell us who you are, and we will open the studio."}));
  panel.appendChild(el("label", {"for": "stName", text: "Your name"}));
  var inp = el("input", {type: "text", id: "stName", autocomplete: "off", maxlength: "40", placeholder: "Your name"});
  var msg = el("p", {"class": "st-msg", "aria-live": "polite", id: "stMsg"});
  var go = el("button", {"class": "st-btn", type: "button", id: "stGo", text: "Continue"});
  panel.appendChild(inp); panel.appendChild(msg); panel.appendChild(go);
  var NOPE = "This corner is reserved for the couple. Nice try though!";
  function submit(){
    var name = inp.value.trim();
    msg.textContent = "";
    if (!fuzzy(name)){ msg.textContent = NOPE; return; }
    go.disabled = true;
    withTimeout(fetch(endpoint + "/check", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name: name})}), 12000)
      .then(function(r){ return r.json(); })
      .then(function(j){
        go.disabled = false;
        if (j && j.ok) stepForm(name); else msg.textContent = NOPE;
      }).catch(function(){ go.disabled = false; msg.textContent = "The studio is not answering right now. Please try again in a little while."; });
  }
  go.onclick = submit;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); submit(); } });
  inp.focus();
}

/* ---------- step 2 ---------- */
function stepForm(name){
  files = [];
  frame("What shall we make?");
  panel.appendChild(el("label", {"for": "stPrompt", text: "What would you like?"}));
  var prompt = el("textarea", {id: "stPrompt", maxlength: "2000", placeholder: "A new look, a new mood, a new story..."});
  panel.appendChild(prompt);
  panel.appendChild(el("label", {"for": "stCtx", text: "Anything we should know? Stories, nicknames, inside jokes"}));
  var ctx = el("textarea", {id: "stCtx", maxlength: "4000"});
  panel.appendChild(ctx);
  panel.appendChild(el("label", {text: "Photos (up to 6)"}));
  var pick = el("button", {"class": "st-btn ghost", type: "button", id: "stPick", text: "Add photos"});
  var fin = el("input", {type: "file", id: "stFile", accept: "image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic", multiple: "multiple", "class": "st-file", tabindex: "-1", "aria-hidden": "true"});
  var thumbs = el("div", {"class": "st-thumbs"});
  var msg = el("p", {"class": "st-msg", "aria-live": "polite", id: "stMsg"});
  panel.appendChild(pick); panel.appendChild(fin); panel.appendChild(thumbs);
  pick.onclick = function(){ fin.click(); };
  function okType(f){ return /^image\/(jpeg|png|webp|heic)$/.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name); }
  function draw(){
    thumbs.innerHTML = "";
    files.forEach(function(f, i){
      var img = el("img", {alt: "Photo " + (i + 1)}); img.src = f.url;
      var rm = el("button", {type: "button", "aria-label": "Remove photo " + (i + 1), text: "×"});
      rm.onclick = function(){ URL.revokeObjectURL(f.url); files.splice(i, 1); draw(); pick.focus(); };
      thumbs.appendChild(el("div", {"class": "st-th"}, [img, rm]));
    });
  }
  fin.onchange = function(){
    msg.textContent = "";
    [].forEach.call(fin.files, function(f){
      if (files.length >= MAX_PHOTOS){ msg.textContent = "That is the limit: 6 photos."; return; }
      if (!okType(f)){ msg.textContent = f.name + " is not a jpeg, png, webp or heic photo."; return; }
      if (f.size > MAX_BYTES){ msg.textContent = f.name + " is bigger than 6 MB."; return; }
      files.push({file: f, url: URL.createObjectURL(f)});
    });
    fin.value = ""; draw();
  };
  panel.appendChild(el("div", {"class": "st-warn", role: "note", text: "Heads up: every new version is made by Naveen's AI and uses his tokens. Please use it wisely, a few times at most. Each request is reviewed by Naveen first."}));
  panel.appendChild(el("p", {"class": "st-priv", text: "Photos you upload will appear on the public invite page."}));
  panel.appendChild(msg);
  var send = el("button", {"class": "st-btn", type: "button", id: "stSend", text: "Make our version"});
  panel.appendChild(send);
  send.onclick = function(){
    var p = prompt.value.trim();
    if (!p){ msg.textContent = "Please tell us what you would like."; prompt.focus(); return; }
    var fd = new FormData();
    fd.append("name", name); fd.append("prompt", p); fd.append("context", ctx.value.trim());
    files.forEach(function(f){ fd.append("photos", f.file, f.file.name); });
    send.disabled = true; msg.textContent = "Sending...";
    withTimeout(fetch(endpoint + "/submit", {method: "POST", body: fd}), 120000)
      .then(function(r){ return r.json().catch(function(){ return {ok: false}; }); })
      .then(function(j){
        if (j && j.ok && j.id){ ls("s", "st_job", j.id); waiting(j.id); }
        else { send.disabled = false; msg.textContent = (j && j.message) || "That did not work. Please try again."; }
      }).catch(function(){ send.disabled = false; msg.textContent = "Could not reach the studio. Please try again."; });
  };
}

/* ---------- progress ---------- */
function waiting(id){
  frame("Your version is being made");
  panel.appendChild(el("p", {text: "Sent to Naveen. He'll give it the nod soon, then your version takes about 10 minutes. You can keep this window open, or come back later: we will remember it on this phone."}));
  panel.appendChild(el("div", {"class": "st-bar", role: "progressbar", "aria-label": "Making your version"}, [el("i")]));
  var line = el("p", {"class": "st-sub", "aria-live": "polite", text: "Waiting for Naveen's nod..."});
  panel.appendChild(line);
  var b = el("button", {"class": "st-btn ghost", type: "button", text: "Close for now"}); b.onclick = close; panel.appendChild(b);
  function tick(){
    withTimeout(fetch(endpoint + "/status/" + encodeURIComponent(id)), 12000).then(function(r){
      if (r.status === 404) return {status: "failed"};
      return r.json();
    }).then(function(j){
      var s = j && (j.status || j.state);
      if (s === "done" && j.url) return done(id, j.url);
      if (s === "failed"){ ls("s", "st_job", ""); return failed(); }
      if (s === "rejected"){ ls("s", "st_job", ""); return rejected(); }
      var pend = s === "pending_approval";
      line.textContent = pend ? "Sent to Naveen. He'll give it the nod soon, then your version takes about 10 minutes."
        : s === "building" ? "Being built right now, about 10 minutes..." : "In the queue...";
      pollTimer = setTimeout(tick, pend ? POLL_MS * 3 : POLL_MS);
    }).catch(function(){ pollTimer = setTimeout(tick, POLL_MS); });
  }
  tick();
}
function rejected(){
  frame("Not this time");
  panel.appendChild(el("p", {text: "Naveen could not approve this one. Have a word with him, and try again with a different idea."}));
  var b = el("button", {"class": "st-btn", type: "button", text: "Okay"}); b.onclick = close; panel.appendChild(b); b.focus();
}
function failed(){
  frame("That one did not work");
  panel.appendChild(el("p", {text: "Something went wrong while making your version. Please try again in a little while."}));
  var b = el("button", {"class": "st-btn", type: "button", text: "Okay"}); b.onclick = close; panel.appendChild(b); b.focus();
}
function done(id, url){
  ls("s", "st_job", "");
  frame("Your version is ready");
  panel.appendChild(el("p", {text: "It is live. Have a look:"}));
  var a = el("a", {"class": "st-btn", id: "stLink", href: url, target: "_blank", rel: "noopener", text: "Open my version"});
  panel.appendChild(a);
  panel.appendChild(el("br"));
  var add = el("button", {"class": "st-btn ghost", type: "button", id: "stAdd", text: "Add to the switcher"});
  add.onclick = function(){
    var list = extras();
    if (!list.some(function(v){ return v.id === id; })) list.push({id: id, title: "My version", created: new Date().toISOString()});
    ls("s", "st_extra", JSON.stringify(list)); renderMore(); add.textContent = "Added"; add.disabled = true;
  };
  panel.appendChild(add); a.focus();
}

/* ---------- switcher ---------- */
var published = [], moreLink = null, morePanel = null;
function extras(){ try { var l = JSON.parse(ls("g", "st_extra") || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function all(){
  var seen = {}, out = [];
  published.concat(extras()).forEach(function(v){ if (v && /^[\w-]+$/.test(v.id) && !seen[v.id]){ seen[v.id] = 1; out.push(v); } });
  return out;
}
function hideMore(){ if (morePanel){ morePanel.classList.remove("on"); moreLink.setAttribute("aria-expanded", "false"); } }
function renderMore(){
  var sw = document.querySelector(".vsw"); if (!sw) return;
  var list = all();
  if (!list.length){ if (moreLink){ moreLink.remove(); morePanel.remove(); moreLink = morePanel = null; } return; }
  if (!moreLink){
    moreLink = el("a", {href: "#", "class": "st-vmore", role: "button", "aria-haspopup": "true", "aria-expanded": "false", text: "More ▾"});
    morePanel = el("div", {"class": "st-more", role: "menu"});
    sw.appendChild(moreLink); document.body.appendChild(morePanel);
    moreLink.onclick = function(e){ e.preventDefault(); var on = morePanel.classList.toggle("on"); moreLink.setAttribute("aria-expanded", on); };
    document.addEventListener("click", function(e){ if (morePanel && !morePanel.contains(e.target) && !moreLink.contains(e.target)) hideMore(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && morePanel && morePanel.classList.contains("on")){ hideMore(); moreLink.focus(); } });
  }
  morePanel.innerHTML = "";
  list.forEach(function(v){
    morePanel.appendChild(el("a", {href: "v/" + v.id + "/" + location.search, role: "menuitem", text: String(v.title || "Version").slice(0, 60)}));
  });
}
function loadVersions(){
  fetch("versions.json?nc=" + Date.now(), {cache: "no-store"}).then(function(r){ return r.json(); })
    .then(function(l){ published = Array.isArray(l) ? l : []; renderMore(); }).catch(function(){ renderMore(); });
}

function init(){
  build();
  var f = document.querySelector("footer");
  var b = el("button", {"class": "st-open", type: "button", id: "stOpen", text: "For the bride and groom"});
  b.onclick = open;
  if (f){ f.appendChild(el("br")); f.appendChild(b); } else document.body.appendChild(b);
  loadVersions();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
