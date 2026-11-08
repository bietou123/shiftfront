(function (root) {
  'use strict';
  const G = root.ShiftfrontGame;
  const TEAMS = ['#65d7d3', '#f99a80', '#edca74'];
  const TAU = Math.PI * 2;
  const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  let map;

  function line(ctx, pts, width, color, dash) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = fill; ctx.fill();
  }

  function polygon(ctx, coords, fill) {
    ctx.beginPath(); ctx.moveTo(coords[0], coords[1]);
    for (let i = 2; i < coords.length; i += 2) ctx.lineTo(coords[i], coords[i + 1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  function background() {
    if (map) return map;
    map = document.createElement('canvas');
    map.width = G.WIDTH; map.height = G.HEIGHT;
    const c = map.getContext('2d');
    const grad = c.createLinearGradient(0, 0, G.WIDTH, G.HEIGHT);
    grad.addColorStop(0, '#31524d'); grad.addColorStop(.5, '#35534e'); grad.addColorStop(1, '#253f45');
    c.fillStyle = grad; c.fillRect(0, 0, G.WIDTH, G.HEIGHT);
    for (let y = 0; y < G.HEIGHT; y += 96) {
      for (let x = 0; x < G.WIDTH; x += 96) {
        const h = hash(x * 13 + y);
        c.fillStyle = h > .55 ? 'rgba(142,188,135,.035)' : 'rgba(0,12,20,.045)';
        c.fillRect(x + 2, y + 2, 92, 92);
        if (h > .73) {
          ellipse(c, x + 44, y + 40, 32, 15, '#193f3d');
          ellipse(c, x + 40, y + 33, 27, 18, '#46745d');
          ellipse(c, x + 34, y + 29, 13, 11, '#61926c');
          ellipse(c, x + 54, y + 34, 13, 12, '#548364');
        } else if (h < .11) {
          c.fillStyle = '#467061'; c.fillRect(x + 18, y + 29, 60, 36);
          c.fillStyle = '#598276'; c.fillRect(x + 24, y + 25, 49, 31);
          c.fillStyle = '#a9b89b'; c.fillRect(x + 29, y + 31, 13, 8);
          c.fillRect(x + 49, y + 31, 13, 8);
        }
      }
    }
    const river = [{ x: 1260, y: -90 }, { x: 1420, y: 370 }, { x: 1100, y: 930 }, { x: 1320, y: 1700 }];
    line(c, river, 191, '#254342');
    line(c, river, 159, '#33858a');
    line(c, river, 118, '#419b9b');
    line(c, river, 3, 'rgba(179,238,216,.29)', [24, 35]);
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 15) * G.WIDTH, y = hash(i * 19 + 80) * G.HEIGHT;
      c.globalAlpha = .28; ellipse(c, x, y, 2 + hash(i) * 3, 1.5, '#b5e9d5'); c.globalAlpha = 1;
    }
    for (const lane of G.LANES) {
      line(c, lane, 133, '#213b3f');
      line(c, lane, 119, '#4d6264');
      line(c, lane, 104, '#718284');
      line(c, lane, 78, '#819193');
      line(c, lane, 3, 'rgba(227,225,197,.42)', [16, 27]);
    }
    for (const p of G.BASES) {
      ellipse(c, p.x, p.y + 13, 151, 110, '#1a393e');
      ellipse(c, p.x, p.y, 139, 97, '#607778');
      ellipse(c, p.x, p.y, 125, 86, '#859794');
      for (let a = 0; a < TAU; a += Math.PI / 4) {
        c.save(); c.translate(p.x + Math.cos(a) * 111, p.y + Math.sin(a) * 71); c.rotate(a);
        c.fillStyle = '#c0bba0'; c.fillRect(-12, -3, 24, 6); c.restore();
      }
    }
    for (let i = 0; i < 65; i++) {
      const x = 55 + hash(i * 4.8) * (G.WIDTH - 110);
      const y = 55 + hash(i * 8.7) * (G.HEIGHT - 110);
      if (G.LANES.some((_, l) => { for (let t = 0; t <= 1; t += .025) if (Math.hypot(G.pathPoint(l, t).x - x, G.pathPoint(l, t).y - y) < 100) return true; return false; })) continue;
      if (hash(i * 77) < .6) {
        ellipse(c, x, y + 10, 29, 18, 'rgba(12,35,32,.45)');
        ellipse(c, x, y, 25, 19, '#47775d');
        ellipse(c, x - 7, y - 7, 14, 13, '#659471');
      } else {
        c.save(); c.translate(x, y); c.rotate(hash(i * 3) * 3);
        c.fillStyle = '#394d4c'; c.fillRect(-30, -15, 60, 30);
        c.fillStyle = '#8eaa99'; c.fillRect(-28, -17, 56, 21);
        c.fillStyle = '#40575a'; c.fillRect(-11, -12, 22, 12);
        c.restore();
      }
    }
    return map;
  }

  function bar(ctx, x, y, width, fraction, color, height = 5) {
    cRound(ctx, x - width / 2, y, width, height, height / 2, '#17272c');
    if (fraction > 0) cRound(ctx, x - width / 2 + 1, y + 1, (width - 2) * Math.max(0, Math.min(1, fraction)), height - 2, 2, color);
  }

  function cRound(ctx, x, y, w, h, r, fill) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }

  function worker(ctx, heroId, x, y, radius, team, time = 0, facing = -.4) {
    const hero = G.HEROES.find(h => h.id === heroId) || G.HEROES[0];
    const scale = radius / 23;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ellipse(ctx, 1, 17, 25, 10, 'rgba(8,23,29,.46)');
    ctx.strokeStyle = team === 0 ? '#7af0de' : '#ffa084'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(0, 0, 26, .2, TAU + .2); ctx.stroke();
    ctx.translate(0, Math.sin(time * 5) * 1.1);
    const outfit = hero.color;
    polygon(ctx, [-14, 10, -16, -4, -7, -14, 7, -14, 16, -4, 14, 10, 0, 17], '#1d313a');
    polygon(ctx, [-12, 7, -12, -5, -5, -12, 6, -12, 13, -5, 12, 7, 0, 14], outfit);
    cRound(ctx, -15, 7, 10, 6, 2, '#283c43'); cRound(ctx, 5, 7, 10, 6, 2, '#283c43');
    ellipse(ctx, -17, -2, 5.5, 6, '#deb795'); ellipse(ctx, 17, -2, 5.5, 6, '#deb795');
    ellipse(ctx, 0, -12, 12, 12, '#f3caa5');
    ellipse(ctx, -4, -11, 1.1, 1.1, '#293940'); ellipse(ctx, 4, -11, 1.1, 1.1, '#293940');
    if (heroId === 'coder') {
      cRound(ctx, -12, 2, 24, 14, 3, '#284852');
      cRound(ctx, -9, 3, 18, 9, 1, '#93deda');
      cRound(ctx, -13, -24, 26, 8, 4, '#27434c');
    } else if (heroId === 'medic') {
      polygon(ctx, [-4, 3, 0, 6, 4, 3, 7, 11, 0, 14, -7, 11], '#f5f4dc');
      cRound(ctx, -2, 4, 4, 9, 1, '#49b978'); cRound(ctx, -5, 7, 10, 3, 1, '#49b978');
      cRound(ctx, -12, -22, 24, 6, 2, '#e4f3e9');
    } else if (heroId === 'rider') {
      cRound(ctx, -13, -23, 26, 11, 5, '#f3a747');
      cRound(ctx, 6, 1, 12, 12, 2, '#f6d276');
      cRound(ctx, 8, 3, 8, 3, 1, '#836447');
    } else if (heroId === 'builder') {
      cRound(ctx, -14, -26, 28, 11, 5, '#ffc855');
      cRound(ctx, -17, -17, 34, 4, 2, '#e29743');
      cRound(ctx, -3, 1, 6, 12, 1, '#f5d19b');
      cRound(ctx, 13, -12, 5, 23, 2, '#704b45');
    } else if (heroId === 'chef') {
      ellipse(ctx, -7, -25, 9, 7, '#f7f3e5'); ellipse(ctx, 6, -25, 9, 7, '#fff8eb');
      cRound(ctx, -12, -26, 24, 11, 3, '#fff8ed');
      cRound(ctx, -6, 4, 12, 11, 2, '#f8eee3');
      ellipse(ctx, 4, 7, 2, 2, '#c96b53');
    } else {
      cRound(ctx, -14, -23, 28, 6, 2, '#4b4169');
      polygon(ctx, [-11, 3, -2, 4, 0, 11, -10, 10], '#f6efcc');
      polygon(ctx, [11, 3, 2, 4, 0, 11, 10, 10], '#e2d9b4');
      cRound(ctx, -2, -1, 4, 8, 1, '#704f77');
    }
    ctx.restore();
  }

  function structure(ctx, e, time) {
    if (!e.alive) {
      ellipse(ctx, e.x, e.y + 8, e.radius + 10, 18, '#334443');
      polygon(ctx, [e.x - 19, e.y, e.x - 4, e.y - 15, e.x + 12, e.y - 3, e.x + 26, e.y + 4, e.x + 5, e.y + 12], '#596766');
      return;
    }
    const color = TEAMS[e.team];
    const r = e.kind === 'base' ? 69 : 37;
    ellipse(ctx, e.x, e.y + 19, r + 12, r * .61, '#20343a');
    ellipse(ctx, e.x, e.y + 8, r + 7, r * .55, '#a2aaa1');
    ellipse(ctx, e.x, e.y + 3, r, r * .52, '#334850');
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = .78;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, r - 8, r * .40, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    const towerHeight = e.kind === 'base' ? 90 : 59;
    polygon(ctx, [e.x - r * .43, e.y, e.x - r * .4, e.y - towerHeight, e.x, e.y - towerHeight - 13, e.x + r * .43, e.y - towerHeight, e.x + r * .4, e.y], '#263b43');
    polygon(ctx, [e.x - r * .4, e.y - towerHeight, e.x, e.y - towerHeight - 13, e.x + r * .43, e.y - towerHeight, e.x, e.y - towerHeight + 1], '#637e84');
    polygon(ctx, [e.x - 8, e.y - towerHeight + 5, e.x, e.y - towerHeight - 4, e.x + 8, e.y - towerHeight + 5, e.x, e.y - towerHeight + 16], color);
    if (e.kind === 'base') {
      for (let i = -1; i <= 1; i++) cRound(ctx, e.x + i * 19 - 5, e.y - 64, 10, 38, 2, i === 0 ? color : '#78949b');
      ellipse(ctx, e.x, e.y - towerHeight - 7 + Math.sin(time * 2) * 2, 13, 13, color);
    } else {
      cRound(ctx, e.x - 5, e.y - 52, 10, 32, 1, color);
    }
    bar(ctx, e.x, e.y - towerHeight - 29, e.kind === 'base' ? 104 : 74, e.hp / e.maxHp, color, 7);
  }

  function unit(ctx, e, time) {
    if (e.kind === 'hero') {
      worker(ctx, e.heroId, e.x, e.y, e.radius, e.team, e.walk || time, e.facing);
      bar(ctx, e.x, e.y - 44, 56, e.hp / e.maxHp, TEAMS[e.team], 7);
      if (e.shield > 0) bar(ctx, e.x, e.y - 35, 56, e.shield / 350, '#f5d181', 3);
      cRound(ctx, e.x - 30, e.y - 54, 13, 12, 3, '#1b292d');
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(String(e.level), e.x - 23, e.y - 45);
      if (e.stunUntil > time) { ctx.font = '22px sans-serif'; ctx.fillText('✦', e.x, e.y - 61); }
    } else if (e.kind === 'minion') {
      ellipse(ctx, e.x, e.y + 9, 16, 9, '#243a3a');
      ellipse(ctx, e.x, e.y - 3, e.radius, e.radius * .78, TEAMS[e.team]);
      ellipse(ctx, e.x, e.y - 7, e.radius * .6, e.radius * .5, e.team ? '#854b4b' : '#346973');
      cRound(ctx, e.x - 4, e.y - 9, 8, 3, 1, '#e5e5c6');
      bar(ctx, e.x, e.y - 24, 29, e.hp / e.maxHp, TEAMS[e.team], 4);
    } else if (e.kind === 'creep') {
      ellipse(ctx, e.x, e.y + 14, 26, 12, '#203935');
      ellipse(ctx, e.x, e.y, 24, 22, '#b48b60');
      polygon(ctx, [e.x - 19, e.y - 12, e.x - 15, e.y - 30, e.x - 3, e.y - 17], '#dbc095');
      polygon(ctx, [e.x + 19, e.y - 12, e.x + 15, e.y - 30, e.x + 3, e.y - 17], '#dbc095');
      ellipse(ctx, e.x - 8, e.y - 3, 2, 2, '#353832'); ellipse(ctx, e.x + 8, e.y - 3, 2, 2, '#353832');
      bar(ctx, e.x, e.y - 36, 54, e.hp / e.maxHp, TEAMS[2], 5);
    } else if (e.kind === 'deploy') {
      ellipse(ctx, e.x, e.y + 7, 23, 12, '#20343b');
      cRound(ctx, e.x - 15, e.y - 12, 30, 26, 4, '#304e54');
      cRound(ctx, e.x - 11, e.y - 18, 22, 14, 3, TEAMS[e.team]);
      cRound(ctx, e.x - 3, e.y - 25, 6, 12, 2, '#c7eadc');
      bar(ctx, e.x, e.y - 37, 42, e.hp / e.maxHp, TEAMS[e.team]);
    }
    if (e.flashUntil > time) { ellipse(ctx, e.x, e.y - 8, e.radius + 10, e.radius + 10, 'rgba(255,255,255,.27)'); }
  }

  function draw(ctx, match, canvas, camera) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#193338'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);
    ctx.drawImage(background(), 0, 0);
    for (const fx of match.effects) {
      if (fx.kind === 'damage') continue;
      const life = (match.time - fx.started) / (fx.until - fx.started);
      ctx.save(); ctx.globalAlpha = fx.ticks ? .19 : Math.max(0, .62 * (1 - life));
      ctx.fillStyle = fx.kind === 'heal' || fx.kind === 'regen' ? '#b1edc2' : fx.kind === 'fire' || fx.kind === 'firezone' ? '#f49a61' : TEAMS[fx.team || 0];
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.radius * (fx.ticks ? 1 : .35 + life * .65), 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff7d7'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    }
    for (const tower of match.towers) structure(ctx, tower, match.time);
    for (const base of match.base) structure(ctx, base, match.time);
    const units = match.entities.filter(e => e.alive && !['tower', 'base'].includes(e.kind));
    units.sort((a, b) => a.y - b.y);
    for (const e of units) unit(ctx, e, match.time);
    for (const p of match.projectiles) {
      ctx.save(); ctx.shadowColor = p.color; ctx.shadowBlur = 15;
      ellipse(ctx, p.x, p.y, p.radius, p.radius, p.color);
      ellipse(ctx, p.x, p.y, p.radius * .43, p.radius * .43, '#f9ffe9'); ctx.restore();
    }
    for (const fx of match.effects) {
      if (fx.kind !== 'damage') continue;
      const progress = (match.time - fx.started) / (fx.until - fx.started);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.textAlign = 'center'; ctx.font = 'bold 19px sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = '#25353a';
      const y = fx.y - 38 - progress * 28;
      ctx.strokeText(String(fx.amount), fx.x, y);
      ctx.fillStyle = fx.team === 0 ? '#fff1a7' : '#ffa189';
      ctx.fillText(String(fx.amount), fx.x, y);
      ctx.restore();
    }
    ctx.restore();
  }

  function minimap(ctx, match, canvas) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.scale(w / G.WIDTH, h / G.HEIGHT);
    ctx.fillStyle = '#193a3b'; ctx.fillRect(0, 0, G.WIDTH, G.HEIGHT);
    line(ctx, [{ x: 1260, y: 0 }, { x: 1420, y: 370 }, { x: 1100, y: 930 }, { x: 1320, y: 1600 }], 210, '#357e80');
    for (const lane of G.LANES) line(ctx, lane, 120, '#879492');
    for (const e of match.entities) {
      if (!e.alive || e.kind === 'minion' || e.kind === 'creep' || e.kind === 'deploy') continue;
      ctx.beginPath(); ctx.arc(e.x, e.y, e === match.player ? 47 : e.kind === 'hero' ? 34 : e.kind === 'base' ? 55 : 27, 0, TAU);
      ctx.fillStyle = e === match.player ? '#fff9d7' : TEAMS[e.team]; ctx.fill();
    }
    ctx.restore();
  }

  function avatar(canvas, heroId, team = 0) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, box.width * ratio);
    canvas.height = Math.max(1, box.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const size = Math.min(box.width, box.height) * .38;
    ellipse(ctx, box.width / 2, box.height * .67, size * 1.1, size * .32, 'rgba(6,29,35,.19)');
    worker(ctx, heroId, box.width / 2, box.height * .50, size, team, 0);
  }

  root.ShiftfrontRender = { draw, minimap, avatar, background };
})(typeof globalThis !== 'undefined' ? globalThis : this);
