/* Runtime for the static ANTE demo. Copied to demo-dist/demo.js and loaded by every saved page.
 *
 * Nothing runs on a server here: navigation maps to the saved screens, answers are looked up from the
 * results recorded when the demo was built, and the "Run" button returns a recorded sandbox log.
 * No code is executed. */
(function () {
  var role = (/^\/(s|l|a)\//.exec(location.pathname) || [])[1];
  if (!role) return;
  var manifest = null;
  var ready = fetch("/manifest.json").then(function (r) { return r.json(); }).then(function (m) { manifest = m; });

  function keyOf(pq) { return pq.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "home"; }
  function toast(msg) {
    var d = document.createElement("div");
    d.setAttribute("role", "status");
    d.textContent = msg;
    d.style.cssText = "position:fixed;top:76px;right:16px;z-index:100000;background:#111827;color:#fff;padding:10px 14px;border-radius:10px;font:14px system-ui,sans-serif;max-width:340px;box-shadow:0 8px 24px rgba(0,0,0,.35)";
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 3200);
  }
  function go(pq) {
    if (/^\/logout/.test(pq)) { location.href = "/"; return; }
    var list = (manifest && manifest.pages[role]) || [];
    if (list.indexOf(pq) >= 0 || (pq === "/" && role === "s")) { location.href = "/" + role + "/" + keyOf(pq) + ".html"; return; }
    var withoutHash = pq.split("#")[0];
    if (withoutHash !== pq && list.indexOf(withoutHash) >= 0) { location.href = "/" + role + "/" + keyOf(withoutHash) + ".html"; return; }
    toast("This screen is not part of the demo.");
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (a.getAttribute("data-raw")) return;
    if (!href || href.charAt(0) === "#" || /^(mailto:|javascript:)/.test(href)) return;
    if (/^https?:\/\//.test(href) || href.indexOf("//") === 0) return;
    e.preventDefault();
    if (/^\/static/.test(href)) return;
    ready.then(function () { go(href); });
  }, true);

  document.addEventListener("submit", function (e) {
    var form = e.target;
    e.preventDefault();
    e.stopPropagation();
    var action = form.getAttribute("action") || "";
    var op = form.querySelector("input[name=action]");
    ready.then(function () {
      var m = /^\/exercise\?q=(\d+)/.exec(action);
      if (m && op && op.value === "submit" && manifest.exercise[m[1]]) {
        var spec = manifest.exercise[m[1]], good = false;
        if (spec.type === "mcq") {
          var picked = form.querySelector("input[name=answer]:checked");
          if (!picked) { toast("Choose an answer first."); return; }
          good = picked.value === spec.correct;
        } else {
          var code = "";
          if (window.monaco && window.monaco.editor.getModels().length) code = window.monaco.editor.getModels()[0].getValue();
          else { var ta = form.querySelector("textarea[name=code_answer]"); code = ta ? ta.value : ""; }
          good = new RegExp(spec.correctPattern).test(code);
        }
        location.href = "/s/exercise_q_" + m[1] + "__" + (good ? "correct" : "wrong") + ".html";
        return;
      }
      toast("Read-only demo: changes are not saved.");
    });
  }, true);

  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input.url;
    var path = new URL(url, location.href).pathname;
    var respond = function (obj) { return new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } }); };
    if (path === "/exercise/run") {
      return ready.then(function () {
        var body = {}; try { body = JSON.parse((init && init.body) || "{}"); } catch (x) {}
        var code = body.code || "";
        var out = /\b(import\s+(os|subprocess|socket)|__import__|open\()/.test(code) ? manifest.run.blocked
          : new RegExp(manifest.exercise[1].correctPattern).test(code) ? manifest.run.correct : manifest.run.wrong;
        return new Promise(function (r) { setTimeout(function () { r(respond({ output: out })); }, 500); });
      });
    }
    if (path === "/exercise/preview-tests") {
      return Promise.resolve(respond({ passed: true, assertions: 1, output: "Demo: your unit tests are not executed in the public demo." }));
    }
    return realFetch(input, init);
  };

  function banner() {
    var b = document.createElement("div");
    b.setAttribute("role", "status");
    b.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#0f172a;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:8px 14px;text-align:center";
    var names = { s: "student", l: "lecturer", a: "admin" };
    b.innerHTML = 'Demo mode – you are the ' + names[role] + '. Saved screens and recorded sandbox results; nothing runs or is saved. <a style="color:#7dd3fc" data-raw="1" href="/">Switch role</a> · <a style="color:#7dd3fc" href="https://github.com/saeedabuhani/BS-PMC-26-Team1" target="_blank" rel="noopener">GitHub</a>';
    document.body.appendChild(b);
    document.body.style.paddingBottom = "44px";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner); else banner();
})();
