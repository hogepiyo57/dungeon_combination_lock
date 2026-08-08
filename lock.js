/* ==================================================================
   宝箱 — ダイヤル錠の動作

   番号やメッセージを変えたいだけなら config.js を編集してください。
   このファイルを触る必要はありません。
   ================================================================== */

(() => {
  "use strict";

  const DIGITS   = 4;
  const REPEATS  = 40;                            // 数字列の繰り返し数（無限スクロール用）
  const TOTAL    = REPEATS * 10;
  const START    = Math.floor(REPEATS / 2) * 10;  // 中央から開始

  const dialsEl  = document.getElementById("dials");
  const lockEl   = document.getElementById("lock");
  const raysEl   = document.getElementById("rays");
  const statusEl = document.getElementById("status");
  const unlockEl = document.getElementById("unlock");

  let solved = false;

  /* ---------- ダイヤル生成 ---------- */
  const dials = Array.from({ length: DIGITS }, (_, i) => createDial(i));

  function createDial(index) {
    const root = document.createElement("div");
    root.className = "dial";
    root.tabIndex = 0;
    root.setAttribute("role", "spinbutton");
    root.setAttribute("aria-label", `${index + 1}桁目`);
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-valuemax", "9");

    const up = document.createElement("button");
    up.className = "arrow";
    up.type = "button";
    up.textContent = "▲";
    up.setAttribute("aria-label", `${index + 1}桁目を増やす`);

    const win = document.createElement("div");
    win.className = "window";

    const strip = document.createElement("div");
    strip.className = "strip";
    for (let n = 0; n < TOTAL; n++) {
      const item = document.createElement("div");
      item.className = "item";
      item.textContent = n % 10;
      strip.appendChild(item);
    }
    win.appendChild(strip);

    const down = document.createElement("button");
    down.className = "arrow";
    down.type = "button";
    down.textContent = "▼";
    down.setAttribute("aria-label", `${index + 1}桁目を減らす`);

    root.append(up, win, down);
    dialsEl.appendChild(root);

    const dial = { root, win, strip, pos: START };

    /* --- 位置を反映 --- */
    const itemH = () => strip.firstChild.offsetHeight;

    dial.render = (animate, dragOffset = 0) => {
      strip.classList.toggle("animate", !!animate);
      strip.style.transform = `translateY(${(1 - dial.pos) * itemH() + dragOffset}px)`;
      root.setAttribute("aria-valuenow", dial.value());
    };

    dial.value = () => ((dial.pos % 10) + 10) % 10;

    dial.move = (delta) => {
      if (solved) return;
      dial.pos += delta;
      dial.render(true);
      recenterIfNeeded();
      clearStatus();
    };

    // 端に近づいたら見た目そのままで中央へ戻す
    function recenterIfNeeded() {
      if (dial.pos > 20 && dial.pos < TOTAL - 20) return;
      setTimeout(() => {
        const value = dial.value();
        dial.pos = START + (value - (START % 10));
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
      else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const diff = (Number(e.key) - dial.value() + 10) % 10;
        dial.move(diff);
        const next = dials[index + 1];
        if (next) next.root.focus();
      }
    });

    dial.render(false);
    return dial;
  }

  // フォント読み込みなどで高さが変わった場合に備えて再計算
  window.addEventListener("resize", () => dials.forEach((d) => d.render(false)));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => dials.forEach((d) => d.render(false)));
  }

  /* ---------- 判定 ---------- */
  function currentCode() {
    return dials.map((d) => d.value()).join("");
  }

  function clearStatus() {
    statusEl.classList.remove("show");
  }

  unlockEl.addEventListener("click", () => {
    if (solved) return;

    if (currentCode() === CONFIG.code) {
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
    raysEl.classList.add("burst");

    setTimeout(() => {
      document.getElementById("lockScene").hidden = true;

      document.getElementById("msgTitle").textContent = CONFIG.title;
      document.getElementById("msgBody").textContent  = CONFIG.message;

      const sign = document.getElementById("msgSign");
      if (CONFIG.signature) sign.textContent = CONFIG.signature;
      else sign.remove();

      document.getElementById("messageScene").hidden = false;
      document.title = CONFIG.title;
    }, 1100);
  }

  /* 動作確認用に最小限だけ外へ公開する（通常は使いません） */
  window.treasureBox = { dials, currentCode, openLock };
})();
