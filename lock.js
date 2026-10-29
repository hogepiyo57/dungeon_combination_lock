/* ==================================================================
   ダンジョンの扉 — イントロ演出とダイヤル錠の動作

   合言葉やメッセージを変えたいだけなら config.js を編集してください。
   このファイルを触る必要はありません。
   ================================================================== */

(() => {
  "use strict";

  const LETTERS  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const N        = LETTERS.length;                // 26
  const DIGITS   = 4;
  const REPEATS  = 12;                            // 文字列の繰り返し数（無限スクロール用）
  const TOTAL    = REPEATS * N;
  const START    = Math.floor(REPEATS / 2) * N;   // 中央から開始（= 「A」）

  const dialsEl  = document.getElementById("dials");
  const lockEl   = document.getElementById("lock");
  const statusEl = document.getElementById("status");
  const unlockEl = document.getElementById("unlock");

  let solved = false;

  /* ================= イントロ ================= */
  const introEl = document.getElementById("intro");
  const bgEl    = document.getElementById("bg");
  const glowEl  = document.getElementById("glow");
  const lockScene = document.getElementById("lockScene");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let introTimers = [];
  let introDone = false;

  const later = (fn, ms) => introTimers.push(setTimeout(fn, ms));

  function startIntro() {
    if (reduced) { finishIntro(); return; }

    // 画像を読み終えてから始める（途中で映像が飛ばないように）
    const imgs = Array.from(introEl.querySelectorAll("img"));
    Promise.all(imgs.map((img) => img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
      .then(() => {
        if (introDone) return;
        introEl.classList.add("play");           // 暗転から扉が現れる
        later(() => introEl.classList.add("zoom"), 900);    // 中央の鍵へズーム
        later(() => introEl.classList.add("cross"), 3000);  // 鍵のアップへクロスディゾルブ
        later(finishIntro, 5600);                // 錠前の操作画面へ
      });
  }

  function finishIntro() {
    if (introDone) return;
    introDone = true;
    introTimers.forEach(clearTimeout);

    lockScene.hidden = false;
    bgEl.classList.add("show");
    glowEl.classList.add("show");
    introEl.classList.add("out");
    setTimeout(() => { introEl.hidden = true; }, 1400);

    dials.forEach((d) => d.render(false));       // 表示後に位置を再計算
    dials[0].root.focus({ preventScroll: true });
  }

  document.getElementById("skip").addEventListener("click", finishIntro);

  /* ================= ダイヤル生成 ================= */
  const dials = Array.from({ length: DIGITS }, (_, i) => createDial(i));

  function createDial(index) {
    const root = document.createElement("div");
    root.className = "dial";
    root.tabIndex = 0;
    root.setAttribute("role", "spinbutton");
    root.setAttribute("aria-label", `${index + 1}文字目`);
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-valuemax", String(N - 1));

    const up = document.createElement("button");
    up.className = "arrow";
    up.type = "button";
    up.tabIndex = -1;
    up.textContent = "▲";
    up.setAttribute("aria-label", `${index + 1}文字目を前へ`);

    const win = document.createElement("div");
    win.className = "window";

    const strip = document.createElement("div");
    strip.className = "strip";
    for (let n = 0; n < TOTAL; n++) {
      const item = document.createElement("div");
      item.className = "item";
      item.textContent = LETTERS[n % N];
      strip.appendChild(item);
    }
    win.appendChild(strip);

    const down = document.createElement("button");
    down.className = "arrow";
    down.type = "button";
    down.tabIndex = -1;
    down.textContent = "▼";
    down.setAttribute("aria-label", `${index + 1}文字目を次へ`);

    root.append(up, win, down);
    dialsEl.appendChild(root);

    const dial = { root, win, strip, pos: START };

    /* --- 位置を反映 ---
       ズレ防止のため、移動量は JS で測らず CSS の calc() に計算させる。
       --item-h は clamp() の都合で端数になることがあり、
       offsetHeight（整数に丸められる）を何十コマも掛けると
       1 コマ分を超える誤差になって表示が隣の文字にズレてしまう。 */
    const itemH = () => strip.firstChild.getBoundingClientRect().height;

    dial.value = () => ((dial.pos % N) + N) % N;

    dial.render = (animate, dragOffset = 0) => {
      strip.classList.toggle("animate", !!animate);
      strip.style.transform =
        `translateY(calc(var(--item-h) * ${1 - dial.pos} + ${dragOffset}px))`;
      root.setAttribute("aria-valuenow", dial.value());
      root.setAttribute("aria-valuetext", LETTERS[dial.value()]);
    };

    dial.move = (delta) => {
      if (solved) return;
      dial.pos += delta;
      dial.render(true);
      recenterIfNeeded();
      clearStatus();
    };

    // 端に近づいたら見た目そのままで中央へ戻す（START は N の倍数）
    function recenterIfNeeded() {
      if (dial.pos > N && dial.pos < TOTAL - N) return;
      setTimeout(() => {
        dial.pos = START + dial.value();
        dial.render(false);
      }, 300);
    }

    /* --- 操作: ▲▼ --- */
    up.addEventListener("click", () => dial.move(-1));
    down.addEventListener("click", () => dial.move(1));

    /* --- 操作: ホイール --- */
    let wheelLock = false;
    win.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      setTimeout(() => (wheelLock = false), 110);
      dial.move(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    /* --- 操作: ドラッグ / スワイプ --- */
    let dragging = false, startY = 0, offset = 0;

    win.addEventListener("pointerdown", (e) => {
      if (solved) return;
      dragging = true;
      startY = e.clientY;
      offset = 0;
      win.setPointerCapture(e.pointerId);
      strip.classList.remove("animate");
    });

    win.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      offset = e.clientY - startY;
      dial.render(false, offset);
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      dial.pos += Math.round(-offset / itemH());
      dial.render(true);
      recenterIfNeeded();
      clearStatus();
    };
    win.addEventListener("pointerup", endDrag);
    win.addEventListener("pointercancel", endDrag);

    /* --- 操作: キーボード --- */
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp")        { e.preventDefault(); dial.move(-1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); dial.move(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); focusDial(index - 1); }
      else if (e.key === "ArrowRight"){ e.preventDefault(); focusDial(index + 1); }
      else if (e.key === "Enter")     { e.preventDefault(); unlockEl.click(); }
      else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        const target = LETTERS.indexOf(e.key.toUpperCase());
        // 近い向きに回す
        let diff = (target - dial.value() + N) % N;
        if (diff > N / 2) diff -= N;
        dial.move(diff);
        focusDial(index + 1);
      }
    });

    dial.render(false);
    return dial;
  }

  function focusDial(i) {
    const d = dials[i];
    if (d) d.root.focus();
  }

  // フォント読み込みなどで高さが変わった場合に備えて再計算
  window.addEventListener("resize", () => dials.forEach((d) => d.render(false)));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => dials.forEach((d) => d.render(false)));
  }

  /* ================= 判定 ================= */
  function currentCode() {
    return dials.map((d) => LETTERS[d.value()]).join("");
  }

  function clearStatus() {
    statusEl.classList.remove("show");
  }

  unlockEl.addEventListener("click", () => {
    if (solved) return;

    if (currentCode() === CONFIG.code.toUpperCase()) {
      openLock();
    } else {
      statusEl.textContent = CONFIG.wrongText;
      statusEl.classList.add("show");
      lockEl.classList.add("shake", "wrong");
      setTimeout(() => lockEl.classList.remove("shake", "wrong"), 550);
    }
  });

  function openLock() {
    solved = true;
    clearStatus();
    unlockEl.disabled = true;
    lockEl.classList.add("open");

    // 掛け金が外れ、閃光が走る
    const flash = document.createElement("div");
    flash.className = "flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.classList.add("go"), 700);

    setTimeout(showMessage, 1500);
    setTimeout(() => flash.remove(), 2400);
  }

  function showMessage() {
    lockScene.hidden = true;

    document.getElementById("msgTitle").textContent = CONFIG.title;
    document.getElementById("msgBody").textContent  = CONFIG.message;

    const sign = document.getElementById("msgSign");
    if (CONFIG.signature) sign.textContent = CONFIG.signature;
    else sign.remove();

    makeEmbers();
    document.getElementById("messageScene").hidden = false;
    document.title = CONFIG.title;
  }

  function makeEmbers() {
    const box = document.getElementById("embers");
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("span");
      const size = 3 + Math.random() * 6;
      s.style.cssText =
        `left:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
        `--dx:${(Math.random() - .5) * 120}px;` +
        `animation-duration:${7 + Math.random() * 8}s;animation-delay:${-Math.random() * 12}s;`;
      box.appendChild(s);
    }
  }

  /* 動作確認用に最小限だけ外へ公開する（通常は使いません） */
  window.treasureBox = { dials, currentCode, openLock, finishIntro };

  startIntro();
})();
