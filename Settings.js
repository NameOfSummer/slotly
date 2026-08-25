var SETTINGS_KEY = 'SLOTL_SETTINGS';
var ADMIN_KEY_PROP = 'ADMIN_KEY';
var SHEET_ID_PROP = 'SPREADSHEET_ID';

function defaultSettings_() {
  var weekHours = {
    '0': null,
    '1': [{ start: '10:00', end: '18:00' }],
    '2': [{ start: '10:00', end: '18:00' }],
    '3': [{ start: '10:00', end: '18:00' }],
    '4': [{ start: '10:00', end: '18:00' }],
    '5': [{ start: '10:00', end: '18:00' }],
    '6': null,
  };
  return {
    hostName: '',
    timezone: 'Asia/Tokyo',
    weekHours: weekHours,
    bufferMin: 15,
    minNoticeMin: 120,
    maxDaysAhead: 28,
    slotIntervalMin: DURATION_STEP,
    writeCalendarId: 'primary',
    busyCalendarIds: ['primary'],
  };
}

function getScriptProps_() {
  return PropertiesService.getScriptProperties();
}

function getSettings_() {
  var raw = getScriptProps_().getProperty(SETTINGS_KEY);
  var parsed = raw ? JSON.parse(raw) : {};
  var merged = Object.assign(defaultSettings_(), parsed);
  merged.weekHours = normalizeWeekHours_(merged.weekHours);
  return merged;
}

function saveSettings_(patch) {
  var current = getSettings_();
  var next = Object.assign({}, current, patch || {});
  if (!next.writeCalendarId) {
    throw new Error('予定を書き込むカレンダーを選んでください。');
  }
  if (!next.busyCalendarIds || !next.busyCalendarIds.length) {
    throw new Error('空き判定に使うカレンダーを1つ以上選んでください。');
  }
  next.bufferMin = Math.max(0, Number(next.bufferMin) || 0);
  next.minNoticeMin = Math.max(0, Number(next.minNoticeMin) || 0);
  next.maxDaysAhead = Math.min(90, Math.max(1, Number(next.maxDaysAhead) || 28));
  next.timezone = next.timezone || 'Asia/Tokyo';
  assertWeekHoursValid_(next.weekHours);
  next.weekHours = normalizeWeekHours_(next.weekHours);
  getScriptProps_().setProperty(SETTINGS_KEY, JSON.stringify(next));
  clearBusyCache_();
  return next;
}

function assertAdminKey_(key) {
  var expected = getScriptProps_().getProperty(ADMIN_KEY_PROP);
  if (!expected || String(key || '') !== expected) {
    throw new Error('管理キーが正しくありません。setupSlotly をエディタから実行してください。');
  }
}

function ensureConfigured_() {
  var settings = getSettings_();
  var sheetId = getScriptProps_().getProperty(SHEET_ID_PROP);
  var adminKey = getScriptProps_().getProperty(ADMIN_KEY_PROP);
  if (!sheetId || !adminKey || !settings.writeCalendarId) {
    throw new Error('まだ準備できていません。Apps Script エディタで setupSlotly を実行してください。');
  }
}

function initializeSlotly_() {
  var props = getScriptProps_();
  var adminKey = props.getProperty(ADMIN_KEY_PROP);
  if (!adminKey) {
    adminKey = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty(ADMIN_KEY_PROP, adminKey);
  }

  var sheetId = props.getProperty(SHEET_ID_PROP);
  var ss;
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (err) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Slotly 予約データ');
    props.setProperty(SHEET_ID_PROP, ss.getId());
  }
  ensureBookingsSheet_(ss);

  var primary = CalendarApp.getDefaultCalendar();
  var primaryId = primary.getId();
  var settings = getSettings_();
  settings.writeCalendarId = settings.writeCalendarId || primaryId;
  settings.busyCalendarIds = settings.busyCalendarIds && settings.busyCalendarIds.length
    ? settings.busyCalendarIds
    : [primaryId];
  saveSettings_(settings);

  return {
    adminKey: adminKey,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: ss.getId(),
  };
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function assertWeekHoursValid_(weekHours) {
  var names = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
  var src = weekHours || {};
  for (var d = 0; d <= 6; d++) {
    var hours = src[String(d)];
    if (!hours) continue;
    var list = [];
    if (Object.prototype.toString.call(hours) === '[object Array]') {
      list = hours;
    } else if (hours.ranges && Object.prototype.toString.call(hours.ranges) === '[object Array]') {
      list = hours.ranges;
    } else if (hours.start && hours.end) {
      list = [{ start: hours.start, end: hours.end }];
    }
    var cleaned = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r || !r.start || !r.end) {
        throw new Error(names[d] + 'の時間帯が不正です。');
      }
      var a = parseHm_(r.start);
      var b = parseHm_(r.end);
      var startMin = a.hour * 60 + a.minute;
      var endMin = b.hour * 60 + b.minute;
      if (endMin <= startMin) {
        throw new Error(names[d] + 'の終了時刻は開始より後にしてください。');
      }
      cleaned.push({ start: startMin, end: endMin });
    }
    cleaned.sort(function (x, y) { return x.start - y.start; });
    for (var j = 1; j < cleaned.length; j++) {
      if (cleaned[j].start < cleaned[j - 1].end) {
        throw new Error(names[d] + 'の時間帯が重なっています。');
      }
    }
  }
}

function normalizeDayHours_(hours) {
  if (!hours) return null;
  var list = [];
  if (Object.prototype.toString.call(hours) === '[object Array]') {
    list = hours;
  } else if (hours.ranges && Object.prototype.toString.call(hours.ranges) === '[object Array]') {
    list = hours.ranges;
  } else if (hours.start && hours.end) {
    list = [{ start: hours.start, end: hours.end }];
  }
  var cleaned = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (!r || !r.start || !r.end) continue;
    var a = parseHm_(r.start);
    var b = parseHm_(r.end);
    if (b.hour * 60 + b.minute <= a.hour * 60 + a.minute) continue;
    cleaned.push({
      start: pad2_(a.hour) + ':' + pad2_(a.minute),
      end: pad2_(b.hour) + ':' + pad2_(b.minute),
    });
  }
  return cleaned.length ? cleaned : null;
}

function normalizeWeekHours_(weekHours) {
  var src = weekHours || {};
  var next = {};
  for (var d = 0; d <= 6; d++) {
    next[String(d)] = normalizeDayHours_(src[String(d)]);
  }
  return next;
}

function listCalendarsForAdmin_() {
  return CalendarApp.getAllCalendars().map(function (cal) {
    return {
      id: cal.getId(),
      name: cal.getName(),
      primary: cal.isMyPrimaryCalendar(),
      owned: typeof cal.isOwnedByMe === 'function' ? cal.isOwnedByMe() : true,
    };
  });
}
