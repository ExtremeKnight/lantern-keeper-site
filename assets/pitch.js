/* The pitch presentation (pitch.html, 0.30.1). The facts come from the page's data (tools/build-pitch.js builds it from
   the home page, news.json and the devlog stories at every release); the words are English here and translated like
   the rest of the site (assets/i18n/<lang>.json, the dashboard's translations): {name} marks a number filled in later.
   Narration: the device's own voice for the language (the Web Speech API), one sentence at a time with captions. When
   a narrated slide ends the next one starts; without a voice the captions show the words and the slides move on after
   time to read them. Everything also works by hand: buttons, the chapter menu, arrow keys, swiping. */
(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('pitch-data').textContent), deck = document.getElementById('deck');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ico = id => `<svg aria-hidden="true" viewBox="0 0 24 24" class="pi"><path d="${{ prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', play: 'M7 4v16l13-8z', pause: 'M7 4h4v16H7zM13 4h4v16h-4z', menu: 'M4 6h16M4 12h16M4 18h16', voice: 'M4 9v6h4l5 4V5L8 9zM16 8a5 5 0 010 8', mute: 'M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6', cc: 'M3 5h18v14H3zM10 10H7v4h3M17 10h-3v4h3', full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18' }[id]}"/></svg>`;

  function run() {
    const L = window.LKI18N, lang = L ? L.lang() : 'en';
    const t = (s, v) => { let x = L ? L.t(s) : s; for (const [k, val] of Object.entries(v || {})) x = x.split('{' + k + '}').join(val); return x; };
    const day = d => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return d; } };
    const num = s => String(s).replace(/\+$/, '');
    const V = { version: D.version, date: day(D.date), updates: D.updates, regions: D.regions, weapons: D.weapons, keepers: D.keepers, charms: D.charms, achievements: num(D.achievements) };

    // ---------- the slides ----------
    const S = [
      { id: 'title', ch: 'Lantern Keeper', say: 'This is Lantern Keeper, an idle roguelite lighthouse defense game by Exenova. It is free to play on almost every screen, and nothing that changes how you play is ever sold.',
        html: () => `<div class="ps-hero"><img class="ps-logo" src="assets/img/icon-192.png" alt="" width="120" height="120"><h1>Lantern Keeper</h1><p class="ps-tag">${t('Keep the light. Hold back the fog.')}</p><p class="ps-sub">${t('An idle roguelite lighthouse defense game by Exenova.')}</p><p class="ps-badge">${t('Version {version}', V)} · ${esc(V.date)}</p></div><img class="ps-bg" src="assets/img/hero-desktop.webp" alt="">` },
      { id: 'idea', ch: 'The idea', say: 'You are the keeper of a lighthouse at the edge of a sea of fog. Every night, creatures rise from the dark, and your lantern is all that holds them back. It is easy to start in a minute, and deep enough to master for months.',
        html: () => `<div class="ps-split"><div><span class="kicker">${t('The idea')}</span><h2>${t('You are the keeper of a lighthouse at the edge of a sea of fog.')}</h2><p class="ps-lead">${t('Every night, creatures rise from the dark. Your lantern holds them back; your choices make it stronger.')}</p><p class="ps-lead">${t('Easy to start in a minute. Deep enough to master for months.')}</p></div><figure class="ps-shot ps-float"><img src="${esc(D.shots[0].src)}" alt="${esc(t(D.shots[0].alt))}"></figure></div>` },
      { id: 'loop', ch: 'How a night goes', say: 'Every night is a new run. Your lantern fires on its own while you tap the creatures that slip through. After every wave you choose one upgrade out of three. Every fifth wave a guardian rises from the deep. And the embers you bring home buy lasting upgrades for the next night.',
        html: () => `<span class="kicker">${t('How a night goes')}</span><h2>${t('Defend. Choose. Grow. Return.')}</h2><ol class="ps-loop">${D.loop.map((x, i) => `<li style="--i:${i}"><b>${i + 1}</b><h3>${esc(t(x.h))}</h3><p>${esc(t(x.p))}</p></li>`).join('')}</ol>` },
      { id: 'features', ch: 'Features', say: 'There are {regions} regions to chart, {weapons} weapons, {keepers} keepers and {charms} charms to combine, and more than {achievements} achievements. Play alone, with up to three friends in co-op, or in ranked duels.',
        html: () => `<span class="kicker">${t('Features')}</span><h2>${t('A big world to explore')}</h2><ul class="ps-stats">${D.stats.map((s, i) => `<li style="--i:${i}"><b data-count="${esc(s.n)}">${esc(s.n)}</b><span>${esc(t(s.label))}</span></li>`).join('')}</ul>
          <ul class="ps-chips">${['Solo nights', 'Co-op for up to four keepers', 'Ranked PvP duels', 'The Lantern Bazaar', 'Cloud saves'].map((c, i) => `<li style="--i:${i + 5}">${esc(t(c))}</li>`).join('')}</ul>` },
      { id: 'gallery', ch: 'Gallery', say: 'Every region has its own sky, creatures and hazards, so every night looks different. These are real screenshots from the current version, on a computer and on a phone.',
        html: () => `<span class="kicker">${t('Gallery')}</span><h2>${t('Every night looks different')}</h2><div class="ps-gal">${D.shots.slice(0, 8).map((s, i) => `<button type="button" class="ps-g ${s.w > s.h ? 'w' : 't'}" style="--i:${i}" data-big="${i}"><img src="${esc(s.src)}" alt="${esc(t(s.alt))}" loading="lazy"></button>`).join('')}</div>` },
      { id: 'platforms', ch: 'Play it anywhere', say: 'Lantern Keeper runs in the browser and as an app on Windows, macOS, Linux, Android, iPhone and iPad. One free account keeps your progress on all of them, and you can play with touch, a mouse and keyboard, or a controller.',
        html: () => `<span class="kicker">${t('Platforms')}</span><h2>${t('Play it anywhere')}</h2><ul class="ps-plat">${D.platforms.map((p, i) => `<li style="--i:${i}"><b>${esc(t(p.h))}</b><span>${esc(t(p.p))}</span></li>`).join('')}</ul>
          <ul class="ps-chips">${D.access.map((a, i) => `<li style="--i:${i + 8}">${esc(t(a.h))}</li>`).join('')}</ul>` },
      { id: 'fair', ch: 'Fair by design', say: 'Lantern Keeper is fair by design. Everything that makes you stronger is earned by playing. The store only sells looks and support, there are no ads and no trackers, and the server checks that nothing sold changes how a night plays.',
        html: () => `<span class="kicker">${t('Our promise')}</span><h2>${t('Fair by design')}</h2><ul class="ps-fair">${D.fair.map((f, i) => `<li style="--i:${i}"><b>${esc(t(f.h))}</b><span>${esc(t(f.p))}</span></li>`).join('')}</ul>` },
      { id: 'progress', ch: 'Development so far', say: 'Development has been fast and steady, with {updates} updates so far. Along the way came a world map, co-op, accounts, ranked duels, a wardrobe, the Lantern Bazaar and free online hosting. The latest version, {version}, came out on {date}.',
        html: () => `<span class="kicker">${t('Development so far')}</span><h2>${t('{updates} updates and counting', V)}</h2><ol class="ps-time">${D.timeline.map((m, i) => `<li style="--i:${i}"><b>${esc(m.v)}</b><span>${esc(t(m.t))}</span></li>`).join('')}</ol>
          <div class="ps-new"><h3>${t('New in {version}', V)}</h3><ul>${D.latest.highlights.map(h => `<li>${esc(t(h))}</li>`).join('')}</ul></div>` },
      { id: 'vision', ch: 'Where it is going', say: 'The goal is a game people keep coming back to for years: regular updates shaped by the community, the same game on every device, and a promise to stay fair. The lighthouse has a long way to shine.',
        html: () => `<span class="kicker">${t('Goals and vision')}</span><h2>${t('Where it is going')}</h2><ul class="ps-goals">${['Regular updates, shaped by players', 'The same game on every device', 'A friendly, safe community', 'Fair forever: power is earned, support is optional'].map((g, i) => `<li style="--i:${i}">${esc(t(g))}</li>`).join('')}</ul>` },
      { id: 'play', ch: 'Play free', say: 'Lantern Keeper is free to play today, in your browser or on your device. Thank you for watching, and keep the light burning.',
        html: () => `<div class="ps-hero"><h2>${t('Thank you for watching')}</h2><p class="ps-tag">${t('Keep the light. Hold back the fog.')}</p><p class="ps-cta"><a class="btn btn-primary" href="play/">${t('Play in your browser')}</a><a class="btn btn-ghost" href="downloads.html">${t('Downloads')}</a><a class="btn btn-ghost" href="community.html">${t('Join the community')}</a></p><p class="ps-sub">${t('Version {version}', V)} · ${esc(V.date)}</p></div><img class="ps-bg" src="assets/img/night-aurora.webp" alt="">` },
    ];

    // ---------- the frame: slides, captions, controls ----------
    deck.innerHTML = `<div class="ps-track">${S.map((s, i) => `<section class="ps-slide ps-s-${s.id}" id="slide-${i + 1}" aria-roledescription="slide" aria-label="${esc(t('Slide {n} of {total}', { n: i + 1, total: S.length }))}: ${esc(t(s.ch))}" ${i ? 'hidden' : ''}><div class="ps-in">${s.html()}</div></section>`).join('')}</div>
      <p class="ps-cap" aria-live="polite" hidden></p>
      <div class="ps-bar" role="toolbar" aria-label="${esc(t('Presentation controls'))}">
        <div class="ps-prog" aria-hidden="true">${S.map(() => '<i><u></u></i>').join('')}</div>
        <button type="button" data-a="prev" aria-label="${esc(t('Previous'))}">${ico('prev')}</button>
        <button type="button" data-a="play" aria-label="${esc(t('Play'))}">${ico('play')}</button>
        <button type="button" data-a="next" aria-label="${esc(t('Next'))}">${ico('next')}</button>
        <span class="ps-count" aria-live="polite"></span>
        <span class="ps-sp"></span>
        <button type="button" data-a="voice" aria-pressed="true" aria-label="${esc(t('Narration'))}">${ico('voice')}</button>
        <button type="button" data-a="cc" aria-pressed="true" aria-label="${esc(t('Captions'))}">${ico('cc')}</button>
        <label class="ps-lang">${ico('globe')}<span class="sr-only">${esc(t('Language'))}</span><select data-a="lang" translate="no">${(L ? L.LANGS : [['en', 'English']]).map(([k, n]) => `<option value="${k}" ${k === lang ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <button type="button" data-a="menu" aria-expanded="false" aria-controls="ps-menu" aria-label="${esc(t('Chapters'))}">${ico('menu')}</button>
        <button type="button" data-a="full" aria-label="${esc(t('Full screen'))}">${ico('full')}</button>
      </div>
      <nav class="ps-menu" id="ps-menu" hidden aria-label="${esc(t('Chapters'))}"><ol>${S.map((s, i) => `<li><button type="button" data-go="${i}">${esc(t(s.ch))}</button></li>`).join('')}</ol><p><a href="./">${t('Back to the website')}</a></p></nav>
      <div class="ps-start" role="dialog" aria-modal="true" aria-label="${esc(t('Lantern Keeper presentation'))}"><div><h2>${t('Lantern Keeper in a few minutes')}</h2><p>${t('The idea, how it plays, the features, fair play, the development so far and where it is going.')}</p>
        <p class="ps-cta"><button type="button" class="btn btn-primary" data-start="voice">${t('Start with narration')}</button><button type="button" class="btn btn-ghost" data-start="self">${t('Read at my own pace')}</button></p><p class="ps-note" data-novoice hidden>${t('This device has no voice for this language: the captions show the words.')}</p></div></div>
      <div class="ps-big" hidden role="dialog" aria-modal="true"><img alt=""><button type="button" aria-label="${esc(t('Close'))}">×</button></div>`;
    deck.setAttribute('translate', 'no'); // (already in the reader's language: the page translator leaves it alone)

    const slides = [...deck.querySelectorAll('.ps-slide')], cap = deck.querySelector('.ps-cap'), bar = deck.querySelector('.ps-bar'), prog = [...deck.querySelectorAll('.ps-prog u')];
    const btn = a => bar.querySelector(`[data-a="${a}"]`), menu = deck.querySelector('.ps-menu'), start = deck.querySelector('.ps-start');
    let at = 0, playing = false, voiceOn = true, ccOn = true, token = 0, tick = 0;

    // ---------- narration ----------
    const SYN = window.speechSynthesis, VOICE_LANG = { en: 'en', fil: 'fil', es: 'es', 'pt-BR': 'pt-BR', id: 'id', ja: 'ja', ko: 'ko', 'zh-CN': 'zh-CN' };
    let voice = null, speaking = null;
    const pickVoice = () => { if (!SYN) return null; const vs = SYN.getVoices(), want = (VOICE_LANG[lang] || 'en').toLowerCase(), base = want.split('-')[0];
      const ok = v => v.lang.toLowerCase().replace('_', '-'), cands = vs.filter(v => ok(v) === want || ok(v).startsWith(base + '-') || ok(v) === base || (base === 'fil' && /^(tl|fil)/.test(ok(v))));
      return cands.sort((a, b) => (/natural|neural|online|premium|enhanced/i.test(b.name) - /natural|neural|online|premium|enhanced/i.test(a.name)) || (b.localService === false) - (a.localService === false))[0] || null; };
    if (SYN) { voice = pickVoice(); SYN.onvoiceschanged = () => { voice = pickVoice(); deck.querySelector('[data-novoice]').hidden = !!voice; }; }
    deck.querySelector('[data-novoice]').hidden = !!voice;
    const sentences = s => (s.match(/[^.!?。！？]+[.!?。！？]+["”」』)]*\s*|[^.!?。！？]+$/g) || [s]).map(x => x.trim()).filter(Boolean);
    function stopVoice() { token++; clearTimeout(tick); if (SYN) SYN.cancel(); }
    function narrate(i) {
      stopVoice(); const my = token, parts = sentences(t(S[i].say, V)); let k = 0;
      const total = parts.join(' ').length, fill = done => { prog.forEach((u, j) => { u.style.width = j < i ? '100%' : j > i ? '0' : Math.min(100, done * 100) + '%'; }); };
      let doneChars = 0;
      const next = () => {
        if (my !== token) return;
        if (k >= parts.length) { cap.hidden = true; fill(1); if (playing) tick = setTimeout(() => { if (my !== token || !playing) return; if (i + 1 < S.length) go(i + 1, true); else setPlaying(false); }, 900); return; }
        const line = parts[k++]; cap.textContent = line; cap.hidden = !ccOn;
        let once = false; const after = () => { if (once || my !== token) return; once = true; doneChars += line.length; fill(doneChars / total); next(); };
        if (voiceOn && voice && SYN) { const u = new SpeechSynthesisUtterance(line); u.voice = voice; u.lang = voice.lang; u.rate = 1; u.onend = after; u.onerror = after; speaking = u; SYN.speak(u); // (kept in a variable: some browsers lose the end event of an utterance nothing refers to)
          const t0 = Date.now(), watch = setInterval(() => { if (once || my !== token) return clearInterval(watch); if (Date.now() - t0 > 1500 && !SYN.speaking && !SYN.pending) { clearInterval(watch); after(); } }, 500); } // (and when the end event never comes, the silence moves things on)
        else tick = setTimeout(after, Math.max(2200, line.length * (/^(ja|ko|zh)/.test(lang) ? 190 : 62))); // (time to read it)
      };
      next();
    }

    // ---------- moving between slides ----------
    function go(i, auto) {
      i = Math.max(0, Math.min(S.length - 1, i)); const from = at; at = i;
      slides.forEach((s, j) => { const on = j === i; if (on) { s.hidden = false; s.classList.remove('ps-out'); requestAnimationFrame(() => s.classList.add('ps-on')); } else if (j === from && from !== i && !RM) { s.classList.remove('ps-on'); s.classList.add('ps-out'); setTimeout(() => { if (at !== j) { s.hidden = true; s.classList.remove('ps-out'); } }, 600); } else { s.classList.remove('ps-on'); s.hidden = true; } });
      bar.querySelector('.ps-count').textContent = t('Slide {n} of {total}', { n: i + 1, total: S.length });
      btn('prev').disabled = i === 0; btn('next').disabled = i === S.length - 1;
      prog.forEach((u, j) => { u.style.width = j < i ? '100%' : '0'; });
      if (history.replaceState) history.replaceState(null, '', '#slide-' + (i + 1));
      countUp(slides[i]);
      if (playing) narrate(i); else { stopVoice(); cap.hidden = true; }
      if (!auto) slides[i].querySelector('h1, h2').focus({ preventScroll: true });
    }
    function setPlaying(on) { playing = on; btn('play').innerHTML = ico(on ? 'pause' : 'play'); btn('play').setAttribute('aria-label', t(on ? 'Pause' : 'Play')); if (on) narrate(at); else { stopVoice(); cap.hidden = true; } }
    function countUp(slide) { if (RM) return; for (const b of slide.querySelectorAll('[data-count]')) { const raw = b.dataset.count, n = parseInt(raw.replace(/[^0-9]/g, ''), 10); if (!n) continue; const t0 = performance.now(), fmt = x => raw.replace(/[0-9][0-9,]*/, Math.round(x).toLocaleString('en'));
      const step = now => { const p = Math.min(1, (now - t0) / 900); b.textContent = fmt(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); } }
    for (const s of slides) { const h = s.querySelector('h1, h2'); if (h) h.tabIndex = -1; }

    bar.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'prev') go(at - 1); else if (a === 'next') go(at + 1); else if (a === 'play') setPlaying(!playing);
      else if (a === 'voice') { voiceOn = !voiceOn; b.setAttribute('aria-pressed', voiceOn); b.innerHTML = ico(voiceOn ? 'voice' : 'mute'); if (playing) narrate(at); }
      else if (a === 'cc') { ccOn = !ccOn; b.setAttribute('aria-pressed', ccOn); if (!ccOn) cap.hidden = true; }
      else if (a === 'menu') { const open = menu.hidden; menu.hidden = !open; b.setAttribute('aria-expanded', open); if (open) menu.querySelector('button').focus(); }
      else if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } });
    bar.querySelector('select').addEventListener('change', e => { stopVoice(); if (L && L.setLang) L.setLang(e.target.value); });
    menu.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; menu.hidden = true; btn('menu').setAttribute('aria-expanded', 'false'); go(+b.dataset.go); });
    start.addEventListener('click', e => { const b = e.target.closest('[data-start]'); if (!b) return; start.remove(); if (b.dataset.start === 'voice') { voiceOn = true; setPlaying(true); } else { voiceOn = false; btn('voice').setAttribute('aria-pressed', 'false'); btn('voice').innerHTML = ico('mute'); } slides[at].querySelector('h1, h2').focus({ preventScroll: true }); });
    // a screenshot full size
    const big = deck.querySelector('.ps-big');
    deck.addEventListener('click', e => { const g = e.target.closest('[data-big]'); if (!g) return; const s = D.shots[+g.dataset.big]; big.querySelector('img').src = s.src; big.querySelector('img').alt = t(s.alt); big.hidden = false; big.querySelector('button').focus(); });
    big.addEventListener('click', e => { if (e.target === big || e.target.closest('button')) { big.hidden = true; } });
    document.addEventListener('keydown', e => { if (e.target.closest('select, input, textarea')) return; if (!big.hidden && e.key === 'Escape') { big.hidden = true; return; } if (!menu.hidden && e.key === 'Escape') { menu.hidden = true; btn('menu').focus(); return; }
      if (start.isConnected) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(at + 1); } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(at - 1); }
      else if (e.key === 'Home') go(0); else if (e.key === 'End') go(S.length - 1); else if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); setPlaying(!playing); }
      else if (e.key === 'f' || e.key === 'F') btn('full').click(); else if (e.key === 'm' || e.key === 'M') btn('voice').click(); else if (e.key === 'c' || e.key === 'C') btn('cc').click(); });
    let sx = null; deck.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true }); deck.addEventListener('touchend', e => { if (sx == null || start.isConnected) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) go(at + (dx < 0 ? 1 : -1)); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });
    addEventListener('pagehide', stopVoice);
    const m = /^#slide-(\d+)$/.exec(location.hash); go(m ? +m[1] - 1 : 0, true);
    window.LKPitch = { go, slides: S.length, at: () => at, playing: () => playing };
  }
  const wait = () => window.LKI18N && LKI18N.ready ? LKI18N.ready.then(run) : run();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait); else wait();
})();
