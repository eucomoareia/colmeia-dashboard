(() => {
  "use strict";

  const C = window.CONFIG;
  const AUDIO_BASE = C.pastaAudios;
  const MAX_PONTOS = 600;
  const PAGINA_TABELA = 25;

  const $ = (id) => document.getElementById(id);
  const estado = {
    horas: 0,
    janela: "",
    todas: null,
    eventos: [],
    linhas: [],
    mostrando: PAGINA_TABELA,
    soComAudio: false
  };

  /* ---------------- formatacao ---------------- */
  const TZ = { timeZone: C.fuso };
  const fmtHora = new Intl.DateTimeFormat("pt-BR", { ...TZ, hour: "2-digit", minute: "2-digit" });
  const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { ...TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDiaHora = new Intl.DateTimeFormat("pt-BR", { ...TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fmtDia = new Intl.DateTimeFormat("pt-BR", { ...TZ, day: "2-digit", month: "2-digit" });
  const fmtDataCompleta = new Intl.DateTimeFormat("pt-BR", { ...TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const num = (v, casas = 1) =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  function comoData(s) {
    // PostgREST devolve "2026-08-22T16:21:57.166837+00:00"; alguns navegadores
    // engasgam com espaco no lugar do T e com offset sem dois-pontos.
    if (s instanceof Date) return s;
    let t = String(s).trim().replace(" ", "T");
    if (/[+-]\d{2}$/.test(t)) t += ":00";
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? new Date(String(s)) : d;
  }

  function haQuanto(d) {
    const seg = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (seg < 60) return "ha " + Math.round(seg) + " s";
    if (seg < 3600) return "ha " + Math.round(seg / 60) + " min";
    if (seg < 86400) return "ha " + Math.round(seg / 3600) + " h";
    return "ha " + Math.round(seg / 86400) + " d";
  }

  /* ---------------- dados ---------------- */
  // Os dados ficam no repositorio: um CSV com as leituras e um JSON com os eventos.
  async function baixarTudo() {
    const r = await fetch(C.arquivoLeituras, { cache: "force-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status + " ao ler " + C.arquivoLeituras);
    const texto = await r.text();
    const linhas = texto.trim().split(/\r?\n/);
    const cab = linhas.shift().split(",");
    const ix = Object.fromEntries(cab.map((c, i) => [c, i]));
    const n = (s) => (s === "" || s === undefined ? null : Number(s));
    estado.todas = linhas.map((l) => {
      const c = l.split(",");
      return {
        t: new Date(Number(c[ix.t]) * 1000),
        dispositivo: C.dispositivo,
        temp: n(c[ix.temp]),
        umidade: n(c[ix.umidade]),
        db: n(c[ix.db]),
        audio_nome: c[ix.audio] || null
      };
    });
    try {
      const re = await fetch(C.arquivoEventos, { cache: "force-cache" });
      estado.eventos = re.ok ? (await re.json()).map((e) => ({ ...e, t: new Date(e.t * 1000) })) : [];
    } catch (e) { estado.eventos = []; }
  }

  function filtrar() {
    const todas = estado.todas;
    if (!todas.length) return [];
    if (estado.janela) {
      const faixas = (C.janelas[estado.janela].partes || [estado.janela]).map((k) => {
        const j = C.janelas[k];
        return [new Date(j.ini).getTime(), new Date(j.fim).getTime()];
      });
      return todas.filter((l) => faixas.some(([a, b]) => l.t.getTime() >= a && l.t.getTime() <= b));
    }
    if (estado.horas > 0) {
      // periodo contado a partir da ultima leitura da coleta, nao de agora
      const fim = todas[todas.length - 1].t.getTime();
      const desde = fim - estado.horas * 3600 * 1000;
      return todas.filter((l) => l.t.getTime() >= desde);
    }
    return todas;
  }

  async function carregar() {
    try {
      if (!estado.todas) {
        mostrarCarregando();
        await baixarTudo();
      }
      estado.linhas = filtrar();
      esconderAlerta();
      render();
    } catch (e) {
      mostrarAlerta(e);
    }
  }

  function mostrarAlerta(e) {
    const el = $("alerta");
    el.innerHTML = "<strong>Nao consegui carregar os dados.</strong><br>" +
      "Confira se o arquivo <code>" + C.arquivoLeituras + "</code> esta no repositorio. Detalhe: <code>" +
      String(e.message).replace(/[<>&]/g, "") + "</code>. Abrindo o index.html direto do disco o navegador bloqueia a leitura; use um servidor local.";
    el.hidden = false;
    $("statusDot").className = "dot dot-off";
    $("statusTexto").textContent = "Dados nao carregados";
  }
  function esconderAlerta() { $("alerta").hidden = true; }

  function mostrarCarregando() {
    $("statusTexto").textContent = "Carregando…";
    $("statusDot").className = "dot dot-idle";
  }

  /* ---------------- resumo ---------------- */
  function ultimoValido(campo) {
    for (let i = estado.linhas.length - 1; i >= 0; i--) {
      const v = estado.linhas[i][campo];
      if (v !== null && v !== undefined && !(campo === "db" && v <= C.pisoRuidoDb)) return estado.linhas[i];
    }
    return null;
  }

  function estatisticas(campo) {
    const vs = estado.linhas
      .map((l) => l[campo])
      .filter((v) => v !== null && v !== undefined && !(campo === "db" && v <= C.pisoRuidoDb));
    if (!vs.length) return null;
    return { min: Math.min(...vs), max: Math.max(...vs), media: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length };
  }

  function renderTiles() {
    const linhas = estado.linhas;
    const ultima = linhas[linhas.length - 1];

    if (!ultima) {
      ["vTemp", "vUmid", "vDb", "vTotal"].forEach((id) => ($(id).textContent = "—"));
      ["sTemp", "sUmid", "sDb", "sTotal"].forEach((id) => ($(id).textContent = "sem leituras no periodo"));
      $("statusDot").className = "dot dot-idle";
      $("statusTexto").textContent = "Sem leituras no periodo";
      return;
    }

    const todas = estado.todas;
    $("statusDot").className = "dot dot-idle";
    $("statusTexto").textContent =
      "Coleta encerrada · " + fmtDataCompleta.format(todas[0].t) + " a " + fmtDataCompleta.format(todas[todas.length - 1].t) +
      " · " + todas.length.toLocaleString("pt-BR") + " leituras";

    const par = [
      ["temp", "vTemp", "sTemp", 1, "°C"],
      ["umidade", "vUmid", "sUmid", 1, "%"],
      ["db", "vDb", "sDb", 1, "dBFS"]
    ];
    for (const [campo, idV, idS, casas, un] of par) {
      const reg = ultimoValido(campo);
      const est = estatisticas(campo);
      $(idV).textContent = reg ? num(reg[campo], casas) : "—";
      if (!reg) {
        $(idS).textContent = campo === "db" ? "microfone sem sinal no periodo" : "sem valor no periodo";
        continue;
      }
      const partes = [];
      if (est) partes.push("min " + num(est.min, casas) + " · max " + num(est.max, casas) + " " + un);
      if (reg !== ultima) partes.push("de " + fmtHora.format(reg.t));
      $(idS).textContent = partes.join(" · ");
    }

    const comAudio = linhas.filter((l) => l.audio_nome).length;
    $("vTotal").textContent = linhas.length.toLocaleString("pt-BR");
    $("sTotal").textContent = comAudio + " com clipe de audio";
  }

  /* ---------------- grafico ---------------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  const el = (nome, attrs) => {
    const n = document.createElementNS(SVGNS, nome);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  function reduzir(pontos, max) {
    if (pontos.length <= max) return pontos;
    const t0 = pontos[0].x, t1 = pontos[pontos.length - 1].x;
    const passo = (t1 - t0) / max || 1;
    const baldes = new Map();
    for (const p of pontos) {
      const k = Math.floor((p.x - t0) / passo);
      if (!baldes.has(k)) baldes.set(k, []);
      baldes.get(k).push(p);
    }
    return [...baldes.keys()].sort((a, b) => a - b).map((k) => {
      const g = baldes.get(k);
      const validos = g.filter((p) => p.y !== null);
      // balde que contem um buraco vira buraco, para a lacuna continuar visivel
      const buraco = g.some((p) => p.y === null);
      return {
        x: g[Math.floor(g.length / 2)].x,
        y: !buraco && validos.length ? validos.reduce((a, p) => a + p.y, 0) / validos.length : null,
        n: g.length
      };
    });
  }

  function escalaBonita(min, max) {
    if (min === max) { min -= 1; max += 1; }
    const folga = (max - min) * 0.12;
    let lo = min - folga, hi = max + folga;
    const bruto = (hi - lo) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= bruto) || mag * 10;
    lo = Math.floor(lo / passo) * passo;
    hi = Math.ceil(hi / passo) * passo;
    const ticks = [];
    for (let v = lo; v <= hi + passo / 1000; v += passo) ticks.push(Number(v.toFixed(6)));
    return { lo, hi, ticks };
  }

  function desenhar(container, campo, cor, un, casas, fonte) {
    container.textContent = "";
    const origem = fonte || estado.linhas;
    const brutos = origem.map((l) => {
      let v = l[campo];
      if (v === null || v === undefined) v = null;
      if (campo === "db" && v !== null && v <= C.pisoRuidoDb) v = null;
      return { x: l.t.getTime(), y: v };
    });
    // lacunas de mais de 1 h viram buraco no grafico, em vez de uma reta ligando as pontas
    const comBuracos = [];
    for (let i = 0; i < brutos.length; i++) {
      if (i && brutos[i].x - brutos[i - 1].x > 3600 * 1000) comBuracos.push({ x: brutos[i - 1].x + 1, y: null });
      comBuracos.push(brutos[i]);
    }
    const pontos = reduzir(comBuracos, MAX_PONTOS);
    const validos = pontos.filter((p) => p.y !== null);

    if (validos.length < 2) {
      const aviso = document.createElement("p");
      aviso.className = "aviso";
      aviso.textContent = validos.length === 0
        ? (campo === "db" ? "Sem sinal do microfone neste periodo." : "Sem dados neste periodo.")
        : "Apenas uma leitura neste periodo.";
      container.appendChild(aviso);
      return;
    }

    const W = container.clientWidth || 640, H = container.clientHeight || 200;
    const m = { t: 14, r: 16, b: 24, l: 46 };
    const iw = Math.max(10, W - m.l - m.r), ih = Math.max(10, H - m.t - m.b);

    // modo "ambos": o intervalo vazio entre as duas janelas e encurtado para nao desperdicar espaco
    const corte = estado.janela === "ambos"
      ? { a: new Date(C.janelas.primeiros.fim).getTime(), folga: new Date(C.janelas.ultimos.ini).getTime() - new Date(C.janelas.primeiros.fim).getTime() }
      : null;
    const comp = (x) => (corte && x > corte.a ? x - corte.folga : x);
    const desc = (x) => (corte && x > corte.a ? x + corte.folga : x);
    const xs = pontos.map((p) => comp(p.x));
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const ys = validos.map((p) => p.y);
    const esc = escalaBonita(Math.min(...ys), Math.max(...ys));

    const px = (x) => m.l + ((comp(x) - x0) / (x1 - x0 || 1)) * iw;
    const py = (y) => m.t + ih - ((y - esc.lo) / (esc.hi - esc.lo || 1)) * ih;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "img" });
    svg.setAttribute("aria-label", `Serie de ${campo} ao longo do tempo. Minimo ${num(Math.min(...ys), casas)} ${un}, maximo ${num(Math.max(...ys), casas)} ${un}.`);

    // grade + ticks y
    const passoY = esc.ticks.length > 1 ? Math.abs(esc.ticks[1] - esc.ticks[0]) : 1;
    const casasY = passoY >= 1 && Number.isInteger(passoY) ? 0 : passoY >= 0.1 ? 1 : 2;
    for (const v of esc.ticks) {
      const y = py(v);
      svg.appendChild(el("line", { class: "g-grade", x1: m.l, x2: m.l + iw, y1: y, y2: y }));
      const tx = el("text", { class: "g-tick", x: m.l - 8, y: y + 4, "text-anchor": "end" });
      tx.textContent = num(v, casasY);
      svg.appendChild(tx);
    }
    // eixo x
    svg.appendChild(el("line", { class: "g-eixo", x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih }));
    const spanH = (x1 - x0) / 3600000;
    const fmtX = spanH > 72 ? fmtDia : spanH > 26 ? fmtDiaHora : fmtHora;
    const nTicks = iw < 420 ? 3 : 5;
    for (let i = 0; i < nTicks; i++) {
      const x = x0 + ((x1 - x0) * i) / (nTicks - 1);
      const tx = el("text", { class: "g-tick", x: px(x), y: m.t + ih + 16, "text-anchor": i === 0 ? "start" : i === nTicks - 1 ? "end" : "middle" });
      tx.textContent = fmtX.format(new Date(desc(x)));
      svg.appendChild(tx);
    }

    if (corte && corte.a >= x0 && corte.a <= x1) {
      svg.appendChild(el("line", { class: "g-evento", x1: px(corte.a), x2: px(corte.a), y1: m.t, y2: m.t + ih, "stroke-dasharray": "2 4" }));
    }

    // eventos registrados: linha vertical tracejada
    for (const ev of estado.eventos) {
      const x = ev.t.getTime();
      if (corte && x > corte.a && x < corte.a + corte.folga) continue;
      if (comp(x) < x0 || comp(x) > x1) continue;
      const ln = el("line", { class: "g-evento", x1: px(x), x2: px(x), y1: m.t, y2: m.t + ih });
      const tt = el("title", {}); tt.textContent = fmtDiaHora.format(ev.t) + " · " + ev.tipo;
      ln.appendChild(tt);
      svg.appendChild(ln);
    }

    // segmentos continuos (buracos onde nao ha valor)
    const segs = [];
    let atual = [];
    for (const p of pontos) {
      if (p.y === null) { if (atual.length) segs.push(atual); atual = []; }
      else atual.push(p);
    }
    if (atual.length) segs.push(atual);

    for (const seg of segs) {
      if (seg.length === 1) {
        svg.appendChild(el("circle", { class: "g-ponto", cx: px(seg[0].x), cy: py(seg[0].y), r: 3.5, fill: cor }));
        continue;
      }
      const d = seg.map((p, i) => (i ? "L" : "M") + px(p.x).toFixed(2) + " " + py(p.y).toFixed(2)).join(" ");
      const area = d + ` L ${px(seg[seg.length - 1].x).toFixed(2)} ${(m.t + ih).toFixed(2)} L ${px(seg[0].x).toFixed(2)} ${(m.t + ih).toFixed(2)} Z`;
      svg.appendChild(el("path", { class: "g-area", d: area, fill: cor }));
      svg.appendChild(el("path", { class: "g-linha", d, stroke: cor }));
    }

    // serie esparsa (pesagem manual): marca cada ponto, senao some entre os pixels
    if (validos.length <= 40) {
      for (const p of validos) {
        svg.appendChild(el("circle", { class: "g-ponto", cx: px(p.x), cy: py(p.y), r: 3.5, fill: cor }));
      }
    }

    // rotulo direto no ultimo valor
    const ult = validos[validos.length - 1];
    svg.appendChild(el("circle", { class: "g-ponto", cx: px(ult.x), cy: py(ult.y), r: 4.5, fill: cor }));
    const rot = el("text", { class: "g-rot", x: Math.min(px(ult.x) + 10, m.l + iw), y: Math.max(py(ult.y) - 10, m.t + 10), "text-anchor": px(ult.x) > m.l + iw - 52 ? "end" : "start" });
    rot.textContent = num(ult.y, casas) + " " + un;
    svg.appendChild(rot);

    // camada de hover
    const cursor = el("line", { class: "g-cursor", y1: m.t, y2: m.t + ih, x1: 0, x2: 0, opacity: 0 });
    const foco = el("circle", { class: "g-ponto", r: 5, fill: cor, opacity: 0 });
    svg.appendChild(cursor); svg.appendChild(foco);
    const captura = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent", style: "cursor:crosshair" });
    svg.appendChild(captura);

    const tip = $("tooltip");
    const nome = { temp: "Temperatura", umidade: "Umidade", db: "Nivel sonoro" }[campo];
    function mover(ev) {
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY);
      const cxSvg = ((cx - svg.getBoundingClientRect().left) / svg.getBoundingClientRect().width) * W;
      let melhor = null, dist = Infinity;
      for (const p of validos) {
        const d = Math.abs(px(p.x) - cxSvg);
        if (d < dist) { dist = d; melhor = p; }
      }
      if (!melhor) return;
      cursor.setAttribute("x1", px(melhor.x)); cursor.setAttribute("x2", px(melhor.x)); cursor.setAttribute("opacity", 1);
      foco.setAttribute("cx", px(melhor.x)); foco.setAttribute("cy", py(melhor.y)); foco.setAttribute("opacity", 1);
      tip.hidden = false;
      tip.innerHTML = "<span class='tt-h'>" + fmtDiaHora.format(new Date(melhor.x)) + "</span>" + nome + ": <b>" + num(melhor.y, casas) + " " + un + "</b>";
      const larg = tip.offsetWidth || 150;
      tip.style.left = Math.min(window.innerWidth - larg - 10, Math.max(10, cx + 14)) + "px";
      tip.style.top = Math.max(10, cy - 52) + "px";
    }
    function sair() {
      cursor.setAttribute("opacity", 0); foco.setAttribute("opacity", 0); $("tooltip").hidden = true;
    }
    captura.addEventListener("mousemove", mover);
    captura.addEventListener("mouseleave", sair);
    captura.addEventListener("touchstart", mover, { passive: true });
    captura.addEventListener("touchmove", mover, { passive: true });
    captura.addEventListener("touchend", sair);

    container.appendChild(svg);
  }

  function renderGraficos() {
    const cs = getComputedStyle(document.documentElement);
    desenhar($("gTemp"), "temp", cs.getPropertyValue("--serie-temp").trim(), "°C", 1);
    desenhar($("gUmid"), "umidade", cs.getPropertyValue("--serie-umidade").trim(), "%", 1);
    desenhar($("gDb"), "db", cs.getPropertyValue("--serie-db").trim(), "dBFS", 1);

    const semSinal = estado.linhas.filter((l) => l.db !== null && l.db <= C.pisoRuidoDb).length;
    $("subDb").textContent = "dBFS, nível calculado no aparelho" + (semSinal ? " · " + semSinal + " leitura(s) sem sinal do microfone foram omitidas" : "");
  }

  /* ---------------- tabela ---------------- */
  function renderTabela() {
    const corpo = $("corpoTabela");
    corpo.textContent = "";
    let linhas = [...estado.linhas].reverse();
    if (estado.soComAudio) linhas = linhas.filter((l) => l.audio_nome);

    $("subTabela").textContent = linhas.length
      ? "mostrando " + Math.min(estado.mostrando, linhas.length) + " de " + linhas.length + (estado.soComAudio ? " leituras com audio" : " leituras")
      : "nenhuma leitura para os filtros atuais";

    if (!linhas.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td colspan='6' class='vazio'>Nenhuma leitura para os filtros atuais.</td>";
      corpo.appendChild(tr);
      $("btnMais").hidden = true;
      return;
    }

    for (const l of linhas.slice(0, estado.mostrando)) {
      const tr = document.createElement("tr");
      const semSinal = l.db === null || l.db <= C.pisoRuidoDb;
      const tds = [
        ["", fmtDataHora.format(l.t)],
        ["", l.dispositivo || "—"],
        ["num", num(l.temp, 1)],
        ["num", num(l.umidade, 1)],
        ["num" + (semSinal ? " sem-sinal" : ""), semSinal ? "sem sinal" : num(l.db, 1)]
      ];
      for (const [cls, txt] of tds) {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        td.textContent = txt;
        tr.appendChild(td);
      }
      const tdA = document.createElement("td");
      if (l.audio_nome) {
        const a = document.createElement("audio");
        a.controls = true; a.preload = "none";
        a.src = AUDIO_BASE + encodeURIComponent(l.audio_nome);
        a.setAttribute("aria-label", "Clipe de audio de " + fmtDataHora.format(l.t));
        tdA.appendChild(a);
      } else {
        tdA.className = "sem-sinal";
        tdA.textContent = "—";
      }
      tr.appendChild(tdA);
      corpo.appendChild(tr);
    }
    $("btnMais").hidden = linhas.length <= estado.mostrando;
  }

  /* ---------------- eventos ---------------- */
  function renderEventos() {
    const ul = $("listaEventos");
    ul.textContent = "";
    if (!estado.eventos.length) { ul.innerHTML = "<li class='vazio'>Nenhum evento registrado.</li>"; return; }
    for (const ev of estado.eventos) {
      const li = document.createElement("li");
      const b = document.createElement("b"); b.textContent = fmtDiaHora.format(ev.t);
      const d = document.createElement("span");
      const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = ev.tipo + (ev.caixa_aberta ? " · caixa aberta" : "");
      d.appendChild(tag); d.appendChild(document.createTextNode(ev.descricao));
      li.appendChild(b); li.appendChild(d); ul.appendChild(li);
    }
  }

  function render() {
    renderEventos();
    renderTiles();
    renderGraficos();
    renderTabela();
    const rot = estado.janela ? C.janelas[estado.janela].rotulo + " de coleta" : { 24: "24 horas finais da coleta", 168: "7 dias finais da coleta", 0: "coleta completa" }[estado.horas];
    $("notaPeriodo").textContent = estado.linhas.length
      ? estado.linhas.length.toLocaleString("pt-BR") + " leituras · " + rot
      : "nada encontrado · " + rot;
  }

  /* ---------------- tema ---------------- */
  function aplicarTema(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    try { t ? localStorage.setItem("tema", t) : localStorage.removeItem("tema"); } catch (e) {}
    $("btnTemaIcone").textContent = t === "dark" ? "☾" : t === "light" ? "☀" : "◐";
  }
  function temaSalvo() { try { return localStorage.getItem("tema"); } catch (e) { return null; } }

  /* ---------------- eventos ---------------- */
  $("segPeriodo").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-horas], button[data-janela]");
    if (!b) return;
    [...e.currentTarget.querySelectorAll("button")].forEach((x) => { x.classList.remove("ativo"); x.removeAttribute("aria-pressed"); });
    b.classList.add("ativo"); b.setAttribute("aria-pressed", "true");
    estado.janela = b.dataset.janela || "";
    estado.horas = b.dataset.horas ? Number(b.dataset.horas) : 0;
    estado.mostrando = PAGINA_TABELA;
    carregar();
  });
  $("soComAudio").addEventListener("change", (e) => { estado.soComAudio = e.target.checked; estado.mostrando = PAGINA_TABELA; renderTabela(); });
  $("btnMais").addEventListener("click", () => { estado.mostrando += PAGINA_TABELA; renderTabela(); });
  $("btnTema").addEventListener("click", () => {
    const atual = document.documentElement.getAttribute("data-theme");
    aplicarTema(atual === "dark" ? "light" : atual === "light" ? null : "dark");
    if (estado.linhas.length) renderGraficos();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (estado.linhas.length) renderGraficos(); });

  let redimTimer;
  window.addEventListener("resize", () => {
    clearTimeout(redimTimer);
    redimTimer = setTimeout(() => { if (estado.linhas.length) renderGraficos(); }, 160);
  });


  /* ---------------- inicio ---------------- */
  document.title = C.titulo;
  $("titulo").textContent = C.titulo;
  aplicarTema(temaSalvo());
  carregar();
})();