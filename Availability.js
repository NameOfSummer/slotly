function cacheStamp_() {
  return getScriptProps_().getProperty('BUSY_GEN') || '1';
}

function listAvailableStarts_(durationMin) {
  durationMin = assertDuration_(durationMin);
  var settings = getSettings_();
  var tz = settings.timezone || 'Asia/Tokyo';
  var now = new Date();
  var windowStart = addMinutes_(now, settings.minNoticeMin || 0);
  var windowEnd = addMinutes_(now, (settings.maxDaysAhead || 28) * 24 * 60);
  var busy = getBusyBlocks_(settings, windowStart, windowEnd);
  var starts = [];
  var ymd = ymdInTz_(windowStart, tz);
  var endYmd = ymdInTz_(windowEnd, tz);
  var guard = 0;
  while (ymd <= endYmd && guard < 100) {
    guard++;
    var parts = ymd.split('-').map(Number);
    var weekday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0)).getUTCDay();
    var ranges = settings.weekHours[String(weekday)] || [];
    for (var r = 0; r < ranges.length; r++) {
      var hours = ranges[r];
      if (!hours || !hours.start || !hours.end) continue;
      var startHm = parseHm_(hours.start);
      var endHm = parseHm_(hours.end);
      var dayStart = zonedTimeToUtc_(parts[0], parts[1], parts[2], startHm.hour, startHm.minute, tz);
      var dayEnd = zonedTimeToUtc_(parts[0], parts[1], parts[2], endHm.hour, endHm.minute, tz);
      var slot = new Date(dayStart.getTime());
      var interval = settings.slotIntervalMin || DURATION_STEP;
      while (addMinutes_(slot, durationMin).getTime() <= dayEnd.getTime()) {
        var slotEnd = addMinutes_(slot, durationMin);
        if (slot.getTime() >= windowStart.getTime() && !isBlocked_(slot, slotEnd, busy, settings.bufferMin || 0)) {
          starts.push(slot.toISOString());
        }
        slot = addMinutes_(slot, interval);
      }
    }
    ymd = addDaysYmd_(ymd, 1);
  }

  return { timezone: tz, durationMin: durationMin, starts: starts };
}

function isBlocked_(start, end, busy, bufferMin) {
  var pad = (bufferMin || 0) * 60 * 1000;
  for (var i = 0; i < busy.length; i++) {
    var blockedStart = new Date(busy[i].start.getTime() - pad);
    var blockedEnd = new Date(busy[i].end.getTime() + pad);
    if (overlaps_(start, end, blockedStart, blockedEnd)) return true;
  }
  return false;
}

function shortCacheKey_(raw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, raw);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i];
    if (v < 0) v += 256;
    var part = v.toString(16);
    hex += part.length === 1 ? '0' + part : part;
  }
  return 'busy:' + hex;
}

function getBusyBlocks_(settings, windowStart, windowEnd) {
  var ids = settings.busyCalendarIds || [];
  var cache = CacheService.getScriptCache();
  var cacheKey = shortCacheKey_(
    cacheStamp_() + ':' + ids.join(',') + ':' + windowStart.toISOString() + ':' + windowEnd.toISOString(),
  );
  try {
    var cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached).map(function (b) {
        return { start: new Date(b.start), end: new Date(b.end) };
      });
    }
  } catch (ignore) {}

  var busy = queryBusy_(ids, windowStart, windowEnd);
  try {
    cache.put(
      cacheKey,
      JSON.stringify(busy.map(function (b) {
        return { start: b.start.toISOString(), end: b.end.toISOString() };
      })),
      45,
    );
  } catch (ignore) {}
  return busy;
}

function queryBusy_(calendarIds, windowStart, windowEnd) {
  if (typeof Calendar !== 'undefined' && Calendar.Freebusy) {
    try {
      return queryFreeBusy_(calendarIds, windowStart, windowEnd);
    } catch (err) {
      console.error(err);
    }
  }
  return queryBusyViaCalendarApp_(calendarIds, windowStart, windowEnd);
}

function queryFreeBusy_(calendarIds, windowStart, windowEnd) {
  var res = Calendar.Freebusy.query({
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
    items: calendarIds.map(function (id) { return { id: id }; }),
  });
  var busy = [];
  var calendars = res.calendars || {};
  Object.keys(calendars).forEach(function (id) {
    (calendars[id].busy || []).forEach(function (block) {
      busy.push({ start: new Date(block.start), end: new Date(block.end) });
    });
  });
  return busy;
}

function queryBusyViaCalendarApp_(calendarIds, windowStart, windowEnd) {
  var busy = [];
  calendarIds.forEach(function (id) {
    var cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
    if (!cal) return;
    cal.getEvents(windowStart, windowEnd).forEach(function (ev) {
      if (ev.getTransparency && ev.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT) {
        return;
      }
      busy.push({ start: ev.getStartTime(), end: ev.getEndTime() });
    });
  });
  return busy;
}

function slotStillFree_(durationMin, startIso) {
  var starts = listAvailableStarts_(durationMin).starts;
  return starts.indexOf(startIso) !== -1;
}
