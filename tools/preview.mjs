#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3456);

function fileFontsCss() {
  return `<style>
  @font-face {
    font-family: "LINE Seed JP";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("/fonts/LINESeedJP_OTF_Rg.woff2") format("woff2");
  }
  @font-face {
    font-family: "LINE Seed JP";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url("/fonts/LINESeedJP_OTF_Bd.woff2") format("woff2");
  }
  @font-face {
    font-family: "LINE Seed JP";
    font-style: normal;
    font-weight: 800;
    font-display: swap;
    src: url("/fonts/LINESeedJP_OTF_Eb.woff2") format("woff2");
  }
  @font-face {
    font-family: "Moon Swing";
    font-style: normal;
    font-weight: 400 900;
    font-display: swap;
    src: url("/fonts/MoonSwing.otf") format("opentype");
  }
</style>`;
}

function include(name) {
  if (name === 'Fonts') return fileFontsCss();
  if (name === 'Tile') {
    return '<style>:root { --tile-image: url("/assets/white-tile-8.jpg"); }</style>';
  }
  return fs.readFileSync(path.join(ROOT, name + '.html'), 'utf8');
}

function pageTitle(page) {
  const suffix = { done: '予約確定', cancel: 'キャンセル', admin: '管理' }[page] || '予約';
  return 'Slotly - ' + suffix;
}

function renderIndex(page, token) {
  let html = fs.readFileSync(path.join(ROOT, 'Index.html'), 'utf8');
  html = html.replace(/<\?!= include\('([^']+)'\); \?>/g, (_, name) => include(name));
  html = html.replace(/<\?!= pageTitle \?>/g, pageTitle(page));
  html = html.replace(
    /<\?!= bootstrapJson \?>/g,
    JSON.stringify({ page: page, token: token, adminKey: page === 'admin' ? 'preview' : '' }),
  );
  html = html.replace('<div id="app"></div>', '<div id="app"></div>\n' + MOCK_SCRIPT);
  return html;
}

const MOCK_SCRIPT = String.raw`
<script>
(function () {
  function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
    var utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
    var dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    function asUtc(ms) {
      var map = {};
      dtf.formatToParts(new Date(ms)).forEach(function (part) {
        if (part.type !== 'literal') map[part.type] = part.value;
      });
      var h = Number(map.hour);
      if (h === 24) h = 0;
      return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), h, Number(map.minute), Number(map.second));
    }
    var offset = asUtc(utcGuess) - utcGuess;
    var utc = utcGuess - offset;
    var offset2 = asUtc(utc) - utc;
    return new Date(utcGuess - offset2);
  }

  function listDurations() {
    var list = [];
    for (var m = 15; m <= 240; m += 15) list.push(m);
    return list;
  }

  var store = { busy: {}, bookings: {}, settings: null };
  try {
    store = JSON.parse(sessionStorage.getItem('slotly-preview') || '{"busy":{},"bookings":{}}');
  } catch (e) {}
  var busy = store.busy || {};
  var bookings = store.bookings || {};
  var defaultWeekHours = {
    '0': null,
    '1': [{ start: '10:00', end: '18:00' }],
    '2': [{ start: '10:00', end: '18:00' }],
    '3': [{ start: '10:00', end: '18:00' }],
    '4': [{ start: '10:00', end: '18:00' }],
    '5': [{ start: '10:00', end: '18:00' }],
    '6': null
  };
  var previewSettings = store.settings || { weekHours: defaultWeekHours };
  function persist() {
    sessionStorage.setItem('slotly-preview', JSON.stringify({ busy: busy, bookings: bookings, settings: previewSettings }));
  }

  function dayRanges(hours) {
    if (!hours) return [];
    if (Object.prototype.toString.call(hours) === '[object Array]') return hours;
    if (hours.start && hours.end) return [hours];
    return [];
  }

  function hmToMin(hm) {
    var p = String(hm || '00:00').split(':');
    return Number(p[0] || 0) * 60 + Number(p[1] || 0);
  }

  function mockStarts(durationMin) {
    var tz = 'Asia/Tokyo';
    var out = [];
    var now = Date.now();
    var weekHours = (previewSettings && previewSettings.weekHours) || defaultWeekHours;
    for (var i = 0; i < 28; i++) {
      var seed = new Date(now + i * 86400000);
      var ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(seed);
      var parts = ymd.split('-').map(Number);
      var weekday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12)).getUTCDay();
      var ranges = dayRanges(weekHours[String(weekday)]);
      for (var r = 0; r < ranges.length; r++) {
        var startMin = hmToMin(ranges[r].start);
        var endMin = hmToMin(ranges[r].end);
        for (var minutes = startMin; minutes + durationMin <= endMin; minutes += 15) {
          var start = zonedTimeToUtc(parts[0], parts[1], parts[2], Math.floor(minutes / 60), minutes % 60, tz);
          if (start.getTime() > now + 2 * 3600000 && !busy[start.toISOString()]) out.push(start.toISOString());
        }
      }
    }
    return out;
  }

  function publicBooking(row) {
    return Object.assign({}, row, {
      googleUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(row.title),
      icsUrl: '/?page=ics&token=' + row.token,
      cancelUrl: '/?page=cancel&token=' + row.token
    });
  }

  var impl = {
    getPublicConfig: function () {
      return {
        configured: true,
        appName: 'Slotly',
        hostName: 'デモ',
        timezone: 'Asia/Tokyo',
        durations: listDurations(),
        maxDaysAhead: 28,
        minNoticeMin: 120
      };
    },
    getSlots: function (durationMin) {
      return { timezone: 'Asia/Tokyo', durationMin: durationMin, starts: mockStarts(Number(durationMin)) };
    },
    createBooking: function (payload) {
      if (!payload.name) throw new Error('お名前を入力してください。');
      var eventTitle = String(payload.eventTitle || '').trim();
      if (eventTitle.length > 80) throw new Error('予定のタイトルは80文字以内にしてください。');
      if (!payload.email || payload.email.indexOf('@') === -1) throw new Error('メールアドレスの形式が正しくありません。');
      if (busy[payload.startIso]) throw new Error('その時間は埋まりました。別の時間を選んでください。');
      var start = new Date(payload.startIso);
      var end = new Date(start.getTime() + payload.durationMin * 60000);
      var token = 'preview-' + Math.random().toString(36).slice(2, 10);
      busy[payload.startIso] = true;
      var row = {
        token: token,
        status: 'confirmed',
        title: eventTitle || (payload.name + ' さん（Slotly）'),
        guestName: payload.name,
        guestEmail: payload.email,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        durationMin: payload.durationMin,
        withMeet: !!payload.withMeet,
        meetUrl: payload.withMeet ? 'https://meet.google.com/preview-demo' : '',
        note: payload.note || ''
      };
      bookings[token] = row;
      persist();
      return publicBooking(row);
    },
    getBooking: function (token) {
      var row = bookings[token];
      if (!row) throw new Error('予約が見つかりません。');
      return publicBooking(row);
    },
    cancelBooking: function (token) {
      var row = bookings[token];
      if (!row) throw new Error('予約が見つかりません。');
      row.status = 'cancelled';
      delete busy[row.startIso];
      persist();
      return publicBooking(row);
    },
    adminGetState: function () {
      return {
        settings: {
          hostName: 'デモ',
          timezone: 'Asia/Tokyo',
          bufferMin: 15,
          minNoticeMin: 120,
          maxDaysAhead: 28,
          writeCalendarId: 'primary',
          busyCalendarIds: ['primary', 'private'],
          weekHours: previewSettings.weekHours
        },
        calendars: [
          { id: 'primary', name: 'メイン', primary: true },
          { id: 'private', name: 'プライベート', primary: false },
          { id: 'work', name: '仕事', primary: false }
        ]
      };
    },
    adminSaveSettings: function (_key, patch) {
      if (patch && patch.weekHours) {
        var names = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
        for (var d = 0; d <= 6; d++) {
          var ranges = dayRanges(patch.weekHours[String(d)]);
          var cleaned = [];
          for (var i = 0; i < ranges.length; i++) {
            var startMin = hmToMin(ranges[i].start);
            var endMin = hmToMin(ranges[i].end);
            if (!ranges[i].start || !ranges[i].end || endMin <= startMin) {
              throw new Error(names[d] + 'の終了時刻は開始より後にしてください。');
            }
            cleaned.push({ start: startMin, end: endMin });
          }
          cleaned.sort(function (a, b) { return a.start - b.start; });
          for (var j = 1; j < cleaned.length; j++) {
            if (cleaned[j].start < cleaned[j - 1].end) {
              throw new Error(names[d] + 'の時間帯が重なっています。');
            }
          }
        }
      }
      previewSettings = Object.assign({}, previewSettings, patch || {});
      persist();
      return previewSettings;
    }
  };

  var ok = function () {};
  var fail = function () {};
  var api = {
    withSuccessHandler: function (fn) { ok = fn; return api; },
    withFailureHandler: function (fn) { fail = fn; return api; }
  };
  Object.keys(impl).forEach(function (name) {
    api[name] = function () {
      var args = arguments;
      setTimeout(function () {
        try { ok(impl[name].apply(null, args)); }
        catch (err) { fail(err); }
      }, 60);
    };
  });
  window.google = { script: { run: api } };
})();
</script>
`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/assets/')) {
    const folder = url.pathname.startsWith('/fonts/') ? 'fonts' : 'assets';
    const filename = path.basename(url.pathname);
    const file = path.join(ROOT, folder, filename);
    const mime = filename.endsWith('.woff2')
      ? 'font/woff2'
      : filename.endsWith('.otf')
        ? 'font/otf'
        : filename.endsWith('.ttf')
          ? 'font/ttf'
          : filename.endsWith('.jpg') || filename.endsWith('.jpeg')
            ? 'image/jpeg'
            : filename.endsWith('.png')
              ? 'image/png'
              : '';
    if (!mime || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000',
    });
    fs.createReadStream(file).pipe(res);
    return;
  }
  const page = url.searchParams.get('page') || 'book';
  const token = url.searchParams.get('token') || '';
  if (page === 'ics') {
    res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8' });
    res.end('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Slotly//JP\r\nEND:VCALENDAR\r\n');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderIndex(page, token));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Slotly preview http://127.0.0.1:' + PORT);
});
