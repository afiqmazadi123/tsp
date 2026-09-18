/**
 * Livestream Performance Intelligence Platform
 * Google Spreadsheet Live Synchronization & File Import Engine
 */

(function(window) {
  'use strict';

  const SyncEngine = {
    sheetId: '1mPTvujucuvcoQlnEticjy1QDhiYoguHqk89_ylj44o8',
    sheetName: 'Report',
    isSyncing: false,
    lastSyncTime: null,

    init() {
      const savedConfig = localStorage.getItem('fyc_sync_config');
      if (savedConfig) {
        try {
          const cfg = JSON.parse(savedConfig);
          this.sheetId = cfg.sheetId || this.sheetId;
          this.sheetName = cfg.sheetName || this.sheetName;
        } catch (e) {}
      }

      // Check for saved custom sessions in localStorage
      const customSessions = localStorage.getItem('fyc_custom_sessions');
      if (customSessions) {
        try {
          const parsed = JSON.parse(customSessions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            window.MASTER_SESSIONS = parsed;
            console.log(`Loaded ${parsed.length} sessions from local storage.`);
          }
        } catch (e) {}
      }

      this.lastSyncTime = localStorage.getItem('fyc_last_sync') || '2026-09-17 15:45';
    },

    saveConfig(sheetId, sheetName) {
      this.sheetId = sheetId;
      this.sheetName = sheetName;
      localStorage.setItem('fyc_sync_config', JSON.stringify({ sheetId, sheetName }));
    },

    async syncFromGoogleSheet() {
      if (this.isSyncing) return { success: false, message: 'Sync already in progress' };
      this.isSyncing = true;
      this.updateSyncUI('syncing', 'Syncing from Google Sheet...');

      // Multiple fallback URLs for fetching Google Sheets as CSV
      const urls = [
        `https://docs.google.com/spreadsheets/d/${this.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.sheetName)}`,
        `https://docs.google.com/spreadsheets/d/${this.sheetId}/export?format=csv&sheet=${encodeURIComponent(this.sheetName)}`
      ];

      let csvText = null;
      let errorMsg = '';

      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            csvText = await res.text();
            if (csvText && csvText.includes('Date') && csvText.includes('GMV')) {
              break;
            }
          }
        } catch (e) {
          errorMsg = e.message;
        }
      }

      this.isSyncing = false;

      if (!csvText) {
        this.updateSyncUI('offline', 'Using bundled master dataset (1,798 rows)');
        return {
          success: false,
          fallback: true,
          message: 'Google Sheets sync restricted by browser CORS. You can drag-and-drop the exported CSV file anytime, or view pre-loaded master data.',
          error: errorMsg
        };
      }

      const sessions = this.parseCSVToSessions(csvText);
      if (sessions.length > 0) {
        window.MASTER_SESSIONS = sessions;
        try {
          localStorage.setItem('fyc_custom_sessions', JSON.stringify(sessions));
        } catch (e) {
          console.warn('LocalStorage quota exceeded for full dataset cache.');
        }

        const now = new Date();
        const timeStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        this.lastSyncTime = timeStr;
        localStorage.setItem('fyc_last_sync', timeStr);

        this.updateSyncUI('success', `Live Synced (${sessions.length.toLocaleString()} sessions)`);
        return { success: true, count: sessions.length, time: timeStr };
      }

      this.updateSyncUI('error', 'CSV parsed with 0 rows');
      return { success: false, message: 'Unable to parse valid livestream rows from spreadsheet.' };
    },

    parseCSVToSessions(csvText) {
      const rows = this.parseCSVRows(csvText);
      if (rows.length < 2) return [];

      const months = { 'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12 };
      
      function parseDate(dStr) {
        if (!dStr) return '';
        dStr = dStr.trim();
        const parts = dStr.split('-');
        if (parts.length === 3 && months[parts[1]]) {
          const d = String(parseInt(parts[0], 10)).padStart(2, '0');
          const m = String(months[parts[1]]).padStart(2, '0');
          const y = parts[2];
          return `${y}-${m}-${d}`;
        }
        return dStr;
      }

      function cleanMoney(v) {
        if (!v) return 0;
        const num = String(v).replace(/Rp|\s|,/g, '');
        return parseFloat(num) || 0;
      }

      function cleanPct(v) {
        if (!v) return 0;
        return parseFloat(String(v).replace(/%|\s/g, '')) || 0;
      }

      function cleanInt(v) {
        if (!v) return 0;
        return parseInt(String(v).replace(/,|\s/g, ''), 10) || 0;
      }

      const sessions = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 5 || !row[0]) continue;

        const date = parseDate(row[0]);
        const brand = (row[1] || 'Unknown').trim();
        const start = (row[2] || '').trim();
        const end = (row[3] || '').trim();
        const duration = parseFloat(row[4]) || 2.0;
        const platform = (row[5] || 'TikTok').trim();
        const host = (row[6] || 'Unknown').trim();

        const gmv = cleanMoney(row[7]);
        let gmvHr = cleanMoney(row[8]);
        if (!gmvHr && duration > 0) gmvHr = Math.round(gmv / duration);

        let product = (row[9] || '').trim();
        if (!product && row.length > 13 && row[13]) product = row[13].trim();

        const ctr = cleanPct(row[10]);
        const ctor = cleanPct(row[11]);
        const adsCost = cleanPct(row[12]);
        const views = cleanInt(row[14]);
        const followers = cleanInt(row[15]);
        const soldQty = cleanInt(row[16]);
        const buyer = cleanInt(row[17]) || soldQty;

        sessions.push({
          id: `s_${i}`,
          date,
          brand,
          start,
          end,
          duration,
          platform,
          host,
          gmv,
          gmv_hr: gmvHr,
          product,
          ctr,
          ctor,
          ads_cost: adsCost,
          views,
          followers,
          sold_qty: soldQty,
          buyer
        });
      }

      return sessions;
    },

    parseCSVRows(text) {
      const p = '';
      const rows = [];
      let row = [];
      let inQuotes = false;
      let cur = '';

      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];

        if (c === '"') {
          if (inQuotes && next === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          row.push(cur);
          cur = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
          if (c === '\r' && next === '\n') i++;
          row.push(cur);
          cur = '';
          if (row.length > 0 && row.some(cell => cell.trim().length > 0)) {
            rows.push(row);
          }
          row = [];
        } else {
          cur += c;
        }
      }
      if (cur || row.length > 0) {
        row.push(cur);
        rows.push(row);
      }
      return rows;
    },

    updateSyncUI(status, label) {
      const dot = document.getElementById('sync-status-dot');
      const text = document.getElementById('sync-status-text');
      const time = document.getElementById('sync-last-time');

      if (dot && text) {
        text.textContent = label;
        dot.className = 'status-dot ' + status;
      }
      if (time && this.lastSyncTime) {
        time.textContent = `Last update: ${this.lastSyncTime}`;
      }
    }
  };

  SyncEngine.init();
  window.SyncEngine = SyncEngine;
})(window);
