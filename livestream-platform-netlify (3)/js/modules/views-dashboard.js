/**
 * Extracted from app.js — dashboard, analytics, hosts, and brands views
 */
(function(window) {
  'use strict';
  const App = window.App;
  if (!App) return;

  Object.assign(App, {
    // 1. EXECUTIVE DASHBOARD VIEW
    renderDashboardView(container, data) {
      const { kpis, scoredHosts, brandBreakdown, platformComp, gmvTrend } = data;

      container.innerHTML = `
        <div class="kpi-grid">
          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Total Live GMV</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
            </div>
            <div class="kpi-value">${AppleCharts.formatIDRShort(kpis.totalGMV)}</div>
            <div class="kpi-meta">
              <span class="delta-badge positive">+18.4%</span>
              <span>vs target benchmark</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Total Live Hours</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
            </div>
            <div class="kpi-value">${kpis.totalDuration.toLocaleString('id-ID')} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">hrs</span></div>
            <div class="kpi-meta">
              <span class="delta-badge neutral">${kpis.sessionCount.toLocaleString()} sessions</span>
              <span>completed</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Average GMV / Hour</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
            </div>
            <div class="kpi-value">${AppleCharts.formatIDRShort(kpis.avgGmvHour)}</div>
            <div class="kpi-meta">
              <span class="delta-badge positive">+12.1%</span>
              <span>productivity index</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Active Creators</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>
            <div class="kpi-value">${kpis.activeHosts} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">hosts</span></div>
            <div class="kpi-meta">
              <span class="delta-badge neutral">${kpis.activeBrands} Brands</span>
              <span>assigned</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Avg CTOR (Conversion)</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/></svg>
              </div>
            </div>
            <div class="kpi-value">${kpis.avgCtor.toFixed(2)}%</div>
            <div class="kpi-meta">
              <span>Avg CTR: <strong>${kpis.avgCtr.toFixed(1)}%</strong></span>
            </div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>GMV Performance Trajectory</h3>
                <p>Daily livestream revenue trend across all managed brands</p>
              </div>
              <div class="delta-badge positive">All Channels</div>
            </div>
            <div class="chart-wrapper">
              <canvas id="gmvTrendCanvas" class="chart-canvas"></canvas>
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Brand Share Distribution</h3>
                <p>Gross merchandise value contribution</p>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="brandDonutCanvas" class="chart-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Platform Efficiency: TikTok vs Shopee</h3>
                <p>Volume, duration, and productivity metrics</p>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="platformBarCanvas" class="chart-canvas"></canvas>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">
              <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm)">
                <div style="font-size:11px;color:var(--apple-cyan);font-weight:600">TikTok Live</div>
                <div style="font-size:16px;font-weight:700;margin-top:2px">${AppleCharts.formatIDRShort(platformComp.TikTok.gmv)}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">${platformComp.TikTok.duration.toFixed(0)} hrs • Rp ${(platformComp.TikTok.gmvHour).toLocaleString('id-ID', {maximumFractionDigits:0})}/hr</div>
              </div>
              <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm)">
                <div style="font-size:11px;color:var(--apple-orange);font-weight:600">Shopee Live</div>
                <div style="font-size:16px;font-weight:700;margin-top:2px">${AppleCharts.formatIDRShort(platformComp.Shopee.gmv)}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">${platformComp.Shopee.duration.toFixed(0)} hrs • Rp ${(platformComp.Shopee.gmvHour).toLocaleString('id-ID', {maximumFractionDigits:0})}/hr</div>
              </div>
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Top Host Leaderboard</h3>
                <p>Ranked by unified performance intelligence score</p>
              </div>
              <a href="#" class="apple-btn apple-btn-secondary" onclick="App.switchView('hosts'); return false;" style="padding:4px 10px;font-size:11.5px">View All</a>
            </div>
            <div class="leaderboard-list">
              ${scoredHosts.slice(0, 5).map(h => `
                <div class="leaderboard-item" onclick="App.openHostDrawer('${h.name}')">
                  <div class="rank-badge ${h.rank === 1 ? 'rank-1' : (h.rank === 2 ? 'rank-2' : (h.rank === 3 ? 'rank-3' : 'rank-other'))}">
                    ${h.rank}
                  </div>
                  <div class="host-avatar" style="background:${h.tierColor || '#0071e3'}">
                    ${h.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div class="host-info">
                    <div class="name">${h.name}</div>
                    <div class="meta">
                      <span>${h.tier}</span>
                      <span>•</span>
                      <span>${h.duration.toFixed(0)}h</span>
                      <span>•</span>
                      <span>CTOR: ${h.avgCtor.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div class="host-metric-pill">
                    <div class="gmv">${AppleCharts.formatIDRShort(h.gmv)}</div>
                    <div class="sub">Score: ${h.finalScore.toFixed(1)}%</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      setTimeout(() => {
        const trendCanvas = document.getElementById('gmvTrendCanvas');
        if (trendCanvas) {
          AppleCharts.drawAreaChart(trendCanvas, {
            data: gmvTrend,
            color: '#0071e3',
            gradientTop: 'rgba(0, 113, 227, 0.35)'
          });
        }

        const brandCanvas = document.getElementById('brandDonutCanvas');
        if (brandCanvas) {
          AppleCharts.drawDonutChart(brandCanvas, {
            data: brandBreakdown.map(b => ({
              label: b.brand,
              value: b.gmv,
              color: b.color
            })),
            centerTitle: AppleCharts.formatIDRShort(kpis.totalGMV),
            centerSub: 'Total GMV'
          });
        }

        const barCanvas = document.getElementById('platformBarCanvas');
        if (barCanvas) {
          AppleCharts.drawBarChart(barCanvas, {
            categories: ['GMV (Jt)', 'Hours', 'Sessions'],
            series: [
              { name: 'TikTok', color: '#2997ff', data: [platformComp.TikTok.gmv / 1e6, platformComp.TikTok.duration, platformComp.TikTok.sessions] },
              { name: 'Shopee', color: '#ff9f0a', data: [platformComp.Shopee.gmv / 1e6, platformComp.Shopee.duration, platformComp.Shopee.sessions] }
            ]
          });
        }
      }, 50);
    },

    // 2. LIVE SESSION ANALYTICS VIEW
    renderAnalyticsView(container, data) {
      const { sessions, platformComp } = data;
      const timeSlots = Analytics.getTimeSlotAnalysis(sessions);
      const topProducts = Analytics.getTopProducts(sessions, 8);

      container.innerHTML = `
        <div class="charts-grid-2">
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Broadcast Slot Productivity</h3>
                <p>Revenue and hours by time of day</p>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="slotBarCanvas" class="chart-canvas"></canvas>
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Top Selling Hero Products</h3>
                <p>Most converted items during livestream sessions</p>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${topProducts.map((p, i) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm)">
                  <div style="max-width:70%">
                    <div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i+1}. ${p.product}</div>
                    <div style="font-size:10.5px;color:var(--text-tertiary)">Brand: ${p.brand} • ${p.sessions} live shifts</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:13px;font-weight:700;color:var(--apple-cyan)">${p.sold.toLocaleString()} pcs</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Livestream Session Master Log</h3>
              <p>Granular breakdown of all ${sessions.length.toLocaleString()} shifts recorded</p>
            </div>
            <div style="display:flex;gap:10px;">
              <input type="text" id="session-search-input" placeholder="Search host, brand, product..." class="select-filter" style="width:240px" />
              <button class="apple-btn apple-btn-secondary" onclick="App.exportSessionsCSV()">Export CSV</button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table" id="session-master-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Brand</th>
                  <th>Platform</th>
                  <th>Host</th>
                  <th>Time / Dur</th>
                  <th>GMV</th>
                  <th>GMV/Hour</th>
                  <th>CTR</th>
                  <th>CTOR</th>
                  <th>Sold</th>
                </tr>
              </thead>
              <tbody id="session-table-body"></tbody>
            </table>
          </div>
          <div id="session-pagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid var(--border-subtle)"></div>
        </div>
      `;

      this.initSessionTablePagination(sessions);

      setTimeout(() => {
        const slotCanvas = document.getElementById('slotBarCanvas');
        if (slotCanvas) {
          AppleCharts.drawBarChart(slotCanvas, {
            categories: timeSlots.map(s => s.name.split(' ')[0]),
            series: [
              { name: 'GMV (Jt)', color: '#af52de', data: timeSlots.map(s => s.gmv / 1e6) },
              { name: 'Duration (h)', color: '#2997ff', data: timeSlots.map(s => s.duration) }
            ]
          });
        }
      }, 50);
    },

    initSessionTablePagination(sessions) {
      let currentPage = 1;
      const pageSize = 15;
      let filtered = [...sessions];

      const searchInput = document.getElementById('session-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase();
          filtered = sessions.filter(s => 
            s.host.toLowerCase().includes(q) ||
            s.brand.toLowerCase().includes(q) ||
            (s.product && s.product.toLowerCase().includes(q))
          );
          currentPage = 1;
          renderPage();
        });
      }

      const renderPage = () => {
        const tbody = document.getElementById('session-table-body');
        const pagination = document.getElementById('session-pagination');
        if (!tbody) return;

        const startIdx = (currentPage - 1) * pageSize;
        const pageItems = filtered.slice(startIdx, startIdx + pageSize);

        tbody.innerHTML = pageItems.map(s => `
          <tr>
            <td>${s.date}</td>
            <td><span class="brand-tag">${s.brand}</span></td>
            <td><span class="platform-pill ${s.platform.toLowerCase()}">${s.platform}</span></td>
            <td><strong>${s.host}</strong></td>
            <td>${s.start} - ${s.end} (${s.duration}h)</td>
            <td style="font-weight:600;color:var(--apple-cyan)">${AppleCharts.formatIDR(s.gmv)}</td>
            <td>${AppleCharts.formatIDR(s.gmv_hr)}</td>
            <td>${s.ctr.toFixed(1)}%</td>
            <td><strong>${s.ctor.toFixed(1)}%</strong></td>
            <td>${s.sold_qty} pcs</td>
          </tr>
        `).join('');

        const totalPages = Math.ceil(filtered.length / pageSize) || 1;
        pagination.innerHTML = `
          <span style="font-size:12px;color:var(--text-tertiary)">Showing ${startIdx + 1} - ${Math.min(startIdx + pageSize, filtered.length)} of ${filtered.length} sessions</span>
          <div style="display:flex;gap:6px;">
            <button class="apple-btn apple-btn-secondary" style="padding:4px 10px;font-size:11.5px" ${currentPage === 1 ? 'disabled' : ''} id="prev-page-btn">Prev</button>
            <span style="display:flex;align-items:center;padding:0 8px;font-size:12px">Page ${currentPage} of ${totalPages}</span>
            <button class="apple-btn apple-btn-secondary" style="padding:4px 10px;font-size:11.5px" ${currentPage === totalPages ? 'disabled' : ''} id="next-page-btn">Next</button>
          </div>
        `;

        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        if (prevBtn) prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderPage(); } };
        if (nextBtn) nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderPage(); } };
      };

      renderPage();
    },

    // 3. HOST MANAGEMENT VIEW
    renderHostsView(container, data) {
      const { scoredHosts } = data;
      const currentAcc = Accounts.getCurrentAccount();

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Creator Performance & Raport</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Click any creator card to view profile, rate card history, and multi-reviewer evaluations</p>
          </div>
          <button class="apple-btn apple-btn-primary" onclick="App.openAddReviewModal()">+ Add Host Assessment</button>
        </div>

        <div class="hosts-card-grid">
          ${scoredHosts.map(h => {
            const myReview = Scoring.getHostReviewByReviewer(h.name, currentAcc.name);
            return `
              <div class="glass-card host-card" onclick="App.openHostDrawer('${h.name}')">
                <div class="host-card-top">
                  <div class="host-card-avatar" style="background:${h.tierColor || '#0071e3'}">
                    ${h.name.substring(0, 2).toUpperCase()}
                    <span style="position:absolute;bottom:-4px;right:-4px;background:#141418;border-radius:50%;padding:2px 5px;font-size:9px;border:1px solid rgba(255,255,255,0.2)">#${h.rank}</span>
                  </div>
                  <div>
                    <div style="font-size:16px;font-weight:700">${h.name}</div>
                    <div style="display:flex;gap:6px;margin-top:4px;">
                      <span class="tier-badge" style="background:${h.tierColor}25;color:${h.tierColor}">${h.tier}</span>
                      <span class="tier-badge" style="background:rgba(255,255,255,0.08);color:var(--text-secondary)">Score: ${h.finalScore.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div class="host-stats-row">
                  <div class="host-stat-box">
                    <div class="title">Total GMV</div>
                    <div class="val" style="color:var(--apple-cyan)">${AppleCharts.formatIDRShort(h.gmv)}</div>
                  </div>
                  <div class="host-stat-box">
                    <div class="title">Duration</div>
                    <div class="val">${h.duration.toFixed(0)}h</div>
                  </div>
                  <div class="host-stat-box">
                    <div class="title">GMV/Hour</div>
                    <div class="val">${AppleCharts.formatIDRShort(h.gmvHour)}</div>
                  </div>
                </div>

                <div style="font-size:11.5px;color:var(--text-tertiary);display:flex;justify-content:space-between;padding:4px 2px;">
                  <span>Brands: <strong>${h.brands.join(', ')}</strong></span>
                  <span>CTOR: <strong>${h.avgCtor.toFixed(1)}%</strong></span>
                </div>

                <div style="display:flex;gap:8px;margin-top:auto" onclick="event.stopPropagation()">
                  ${myReview ? `
                    <button class="apple-btn apple-btn-secondary" style="flex:1;justify-content:center;padding:6px 0;font-size:11.5px;color:var(--apple-cyan)" onclick="App.openEditReviewModal('${myReview.id}')">
                      ✏️ Edit My Review (${myReview.cta.toFixed(1)})
                    </button>
                  ` : `
                    <button class="apple-btn apple-btn-primary" style="flex:1;justify-content:center;padding:6px 0;font-size:11.5px" onclick="App.openAddReviewModal('${h.name}')">
                      ★ Grade Host
                    </button>
                  `}
                  <button class="apple-btn apple-btn-secondary" style="padding:6px 12px;font-size:11.5px" onclick="App.openHostDrawer('${h.name}')">Raport</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    },

    // 4. BRAND ANALYTICS VIEW
    renderBrandsView(container, data) {
      const { brandBreakdown } = data;
      const isPitch = this.pitchModeActive;

      container.innerHTML = `
        <div class="${isPitch ? 'pitch-mode-view' : ''}">
          <div class="pitch-hero">
            <div>
              <div style="display:inline-block;padding:3px 10px;border-radius:var(--radius-pill);background:rgba(0,113,227,0.2);color:var(--apple-cyan);font-size:11px;font-weight:600;margin-bottom:8px">
                ${isPitch ? 'CLIENT PRESENTATION DECK' : 'BRAND PORTFOLIO INTELLIGENCE'}
              </div>
              <h2>Livestream Performance & ROI Matrix</h2>
              <p style="font-size:13.5px;color:var(--text-secondary);margin-top:4px">
                Comprehensive data intelligence across all portfolio brands, GMV conversion, and audience reach
              </p>
            </div>
            <div>
              <button class="apple-btn apple-btn-primary" onclick="window.print()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>Export Pitch Deck (PDF)</span>
              </button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
            ${brandBreakdown.map(b => `
              <div class="glass-card">
                <div class="card-header">
                  <div>
                    <h3 style="font-size:17px;font-weight:700">${b.brand}</h3>
                    <p style="font-size:12px;color:var(--text-tertiary)">${b.platforms.join(' & ')} • ${b.hostCount} Dedicated Hosts</p>
                  </div>
                  <span class="delta-badge positive">${b.share.toFixed(1)}% Share</span>
                </div>

                <div style="margin:16px 0;">
                  <div style="font-size:24px;font-weight:700;color:var(--apple-cyan)">${AppleCharts.formatIDR(b.gmv)}</div>
                  <div style="font-size:11.5px;color:var(--text-tertiary);margin-top:2px">
                    ${b.duration.toFixed(0)} live broadcast hours • ${b.sessions} shifts • Avg ${AppleCharts.formatIDRShort(b.gmvHour)}/hr
                  </div>
                </div>

                <div style="border-top:1px solid var(--border-subtle);padding-top:12px;display:flex;justify-content:space-between;font-size:12px;">
                  <span>Audience Reach: <strong>${(b.views).toLocaleString()} views</strong></span>
                  <span>Items Sold: <strong>${(b.sold).toLocaleString()} pcs</strong></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },


  });
})(window);
