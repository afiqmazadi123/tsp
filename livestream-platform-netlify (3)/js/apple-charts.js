/**
 * Apple Design System - Lightweight Canvas Charting Engine
 * High-DPI Retina Support, Smooth Bezier Splines, Glow Fills, Interactive Tooltips
 * Safe error handling & null-checking
 */

(function(window) {
  'use strict';

  function setupCanvas(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.width || 400, height: canvas.height || 220 };
    const width = rect.width || canvas.width || 400;
    const height = rect.height || canvas.height || 220;
    
    if (width <= 0 || height <= 0) return null;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    return { ctx, width, height, dpr };
  }

  function formatIDRShort(num) {
    if (num >= 1e9) return 'Rp ' + (num / 1e9).toFixed(1) + 'M';
    if (num >= 1e6) return 'Rp ' + (num / 1e6).toFixed(1) + 'Jt';
    if (num >= 1e3) return 'Rp ' + (num / 1e3).toFixed(0) + 'Rb';
    return 'Rp ' + Math.round(num || 0);
  }

  function formatIDR(num) {
    return 'Rp ' + Math.round(num || 0).toLocaleString('id-ID');
  }

  // --- AREA / LINE CHART ---
  function drawAreaChart(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup || !setup.ctx) return;
    const { ctx, width, height } = setup;
    const data = options.data || [];
    if (data.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const padding = { top: 24, right: 24, bottom: 36, left: 56 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    if (chartW <= 0 || chartH <= 0) return;

    const maxVal = Math.max(...data.map(d => d.value || 0), 1) * 1.12;
    const minVal = 0;

    // Background Grid
    ctx.clearRect(0, 0, width, height);
    const gridLines = 4;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      const val = maxVal - (maxVal / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(formatIDRShort(val), padding.left - 10, y + 4);
    }

    // Points
    const stepX = chartW / Math.max(data.length - 1, 1);
    const points = data.map((d, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - (((d.value || 0) - minVal) / (maxVal - minVal)) * chartH;
      return { x, y, data: d };
    });

    // Draw Smooth Area Gradient
    const primaryColor = options.color || '#0071e3';
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, options.gradientTop || 'rgba(0, 113, 227, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 113, 227, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding.bottom);
    ctx.lineTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
    }

    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Smooth Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
    }
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // X Axis Labels
    ctx.textAlign = 'center';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
    const labelStep = Math.ceil(data.length / 8);
    points.forEach((p, i) => {
      if (i % labelStep === 0 || i === points.length - 1) {
        ctx.fillText(p.data.label || '', p.x, height - padding.bottom + 18);
      }
    });

    canvas._chartPoints = points;
    canvas._chartHitRegions = points.map((point, index) => ({
      type: 'point',
      x: point.x,
      y: point.y,
      radius: 18,
      index,
      data: point.data
    }));
  }

  // --- DONUT / PIE CHART ---
  function drawDonutChart(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup || !setup.ctx) return;
    const { ctx, width, height } = setup;
    const data = options.data || [];
    if (data.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
    if (total === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 16;
    if (radius <= 10) return;
    const innerRadius = radius * 0.65;

    ctx.clearRect(0, 0, width, height);

    let startAngle = -Math.PI / 2;
    const hitRegions = [];

    data.forEach((d, index) => {
      const sliceAngle = ((d.value || 0) / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = d.color || '#0071e3';
      ctx.fill();

      ctx.strokeStyle = isDark ? '#121216' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      hitRegions.push({
        type: 'donut',
        index,
        data: d,
        centerX,
        centerY,
        innerRadius,
        outerRadius: radius,
        startAngle,
        endAngle
      });

      startAngle = endAngle;
    });

    // Center Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#ffffff' : '#000000';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText(options.centerTitle || formatIDRShort(total), centerX, centerY - 6);

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(options.centerSub || 'Total GMV', centerX, centerY + 12);

    canvas._chartHitRegions = hitRegions;
  }

  // --- GROUPED / COMPARISON BAR CHART ---
  function drawBarChart(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup || !setup.ctx) return;
    const { ctx, width, height } = setup;
    const categories = options.categories || [];
    const series = options.series || [];
    if (categories.length === 0 || series.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const padding = { top: 24, right: 20, bottom: 36, left: 56 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    if (chartW <= 0 || chartH <= 0) return;

    let maxVal = 0;
    series.forEach(s => {
      (s.data || []).forEach(v => {
        if (v > maxVal) maxVal = v;
      });
    });
    maxVal = (maxVal || 1) * 1.15;

    ctx.clearRect(0, 0, width, height);

    const gridLines = 4;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      const val = maxVal - (maxVal / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(options.isMoney ? formatIDRShort(val) : Math.round(val).toLocaleString(), padding.left - 10, y + 4);
    }

    const catWidth = chartW / categories.length;
    const groupPadding = catWidth * 0.2;
    const barWidth = (catWidth - groupPadding * 2) / series.length;
    const hitRegions = [];

    categories.forEach((cat, catIdx) => {
      const groupX = padding.left + catIdx * catWidth + groupPadding;

      series.forEach((s, sIdx) => {
        const val = s.data[catIdx] || 0;
        const barH = (val / maxVal) * chartH;
        const barX = groupX + sIdx * barWidth;
        const barY = padding.top + chartH - barH;

        const r = Math.min(4, barWidth / 2);
        ctx.beginPath();
        ctx.moveTo(barX, padding.top + chartH);
        ctx.lineTo(barX, barY + r);
        ctx.quadraticCurveTo(barX, barY, barX + r, barY);
        ctx.lineTo(barX + barWidth - r, barY);
        ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + r);
        ctx.lineTo(barX + barWidth, padding.top + chartH);
        ctx.closePath();

        ctx.fillStyle = s.color || '#0071e3';
        ctx.fill();

        hitRegions.push({
          type: 'bar',
          category: cat,
          categoryIndex: catIdx,
          seriesName: s.name,
          seriesIndex: sIdx,
          value: val,
          x: barX,
          y: barY,
          width: barWidth,
          height: Math.max(barH, 4),
          color: s.color || '#0071e3'
        });
      });

      ctx.textAlign = 'center';
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(cat, padding.left + catIdx * catWidth + catWidth / 2, height - padding.bottom + 18);
    });

    canvas._chartHitRegions = hitRegions;
  }

  // --- RADAR / SPIDER CHART ---
  function drawRadarChart(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup || !setup.ctx) return;
    const { ctx, width, height } = setup;
    const labels = options.labels || ['CTA', 'Pin', 'Discipline', 'Grooming', 'Performance'];
    const values = options.values || [4.5, 4.2, 4.8, 4.7, 4.3];
    const maxVal = options.max || 5.0;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 32;
    if (radius <= 10) return;
    const angleStep = (Math.PI * 2) / labels.length;

    ctx.clearRect(0, 0, width, height);

    const levels = 4;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;

    for (let l = 1; l <= levels; l++) {
      const r = (radius / levels) * l;
      ctx.beginPath();
      for (let i = 0; i < labels.length; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';

    for (let i = 0; i < labels.length; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();

      const lx = centerX + (radius + 18) * Math.cos(angle);
      const ly = centerY + (radius + 18) * Math.sin(angle);
      ctx.textAlign = Math.abs(Math.cos(angle)) < 0.2 ? 'center' : (Math.cos(angle) > 0 ? 'left' : 'right');
      ctx.textBaseline = Math.abs(Math.sin(angle)) < 0.2 ? 'middle' : (Math.sin(angle) > 0 ? 'top' : 'bottom');
      ctx.fillText(labels[i], lx, ly);
    }

    const color = options.color || '#0071e3';
    ctx.beginPath();
    values.forEach((v, i) => {
      const norm = Math.min(Math.max((v || 0) / maxVal, 0), 1);
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * norm * Math.cos(angle);
      const y = centerY + radius * norm * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = options.fillColor || 'rgba(0, 113, 227, 0.25)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function normalizeAngle(angle) {
    let value = angle % (Math.PI * 2);
    if (value < 0) value += Math.PI * 2;
    return value;
  }

  function angleWithin(angle, start, end) {
    const a = normalizeAngle(angle);
    const s = normalizeAngle(start);
    const e = normalizeAngle(end);
    if (s <= e) return a >= s && a <= e;
    return a >= s || a <= e;
  }

  function getHitAt(canvas, x, y) {
    if (!canvas) return null;
    const regions = canvas._chartHitRegions || [];

    for (const region of regions) {
      if (region.type === 'bar') {
        if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
          return region;
        }
      }

      if (region.type === 'donut') {
        const dx = x - region.centerX;
        const dy = y - region.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < region.innerRadius || distance > region.outerRadius) continue;
        if (angleWithin(Math.atan2(dy, dx), region.startAngle, region.endAngle)) return region;
      }

      if (region.type === 'point') {
        const dx = x - region.x;
        const dy = y - region.y;
        if (Math.sqrt(dx * dx + dy * dy) <= region.radius) return region;
      }
    }

    if (canvas._chartPoints?.length) {
      const points = canvas._chartPoints;
      let nearest = points[0];
      let distance = Math.abs(points[0].x - x);
      points.forEach(point => {
        const next = Math.abs(point.x - x);
        if (next < distance) {
          nearest = point;
          distance = next;
        }
      });
      return { type: 'point', x: nearest.x, y: nearest.y, data: nearest.data };
    }

    return null;
  }

  window.AppleCharts = {
    drawAreaChart,
    drawDonutChart,
    drawBarChart,
    drawRadarChart,
    getHitAt,
    formatIDR,
    formatIDRShort
  };

})(window);
