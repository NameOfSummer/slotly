var DURATION_MIN = 15;
var DURATION_MAX = 240;
var DURATION_STEP = 15;

function listDurations_() {
  var list = [];
  for (var m = DURATION_MIN; m <= DURATION_MAX; m += DURATION_STEP) {
    list.push(m);
  }
  return list;
}

function assertDuration_(durationMin) {
  var n = Number(durationMin);
  if (!isFinite(n) || n < DURATION_MIN || n > DURATION_MAX || n % DURATION_STEP !== 0) {
    throw new Error('所要時間は15分刻み、最大4時間で選んでください。');
  }
  return n;
}

function formatDurationJa_(minutes) {
  if (minutes < 60) return minutes + '分';
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  if (m === 0) return h + '時間';
  return h + '時間' + m + '分';
}

function ymdInTz_(date, timeZone) {
  var dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(date);
}

function weekdayInTz_(date, timeZone) {
  var parts = ymdInTz_(date, timeZone).split('-');
  return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0)).getUTCDay();
}

/**
 * 指定タイムゾーンの壁時計時刻を UTC の Date にする。
 */
function zonedTimeToUtc_(year, month, day, hour, minute, timeZone) {
  var utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  var dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  function asUtc(ms) {
    var map = {};
    dtf.formatToParts(new Date(ms)).forEach(function (part) {
      if (part.type !== 'literal') map[part.type] = part.value;
    });
    var hour = Number(map.hour);
    if (hour === 24) hour = 0;
    return Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      hour,
      Number(map.minute),
      Number(map.second),
    );
  }

  var offset = asUtc(utcGuess) - utcGuess;
  var utc = utcGuess - offset;
  var offset2 = asUtc(utc) - utc;
  return new Date(utcGuess - offset2);
}

function parseHm_(hm) {
  var parts = String(hm || '00:00').split(':');
  return { hour: Number(parts[0] || 0), minute: Number(parts[1] || 0) };
}

function addMinutes_(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDaysYmd_(ymd, days) {
  var parts = String(ymd).split('-').map(Number);
  var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function overlaps_(startA, endA, startB, endB) {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

function formatIcsUtc_(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText_(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}
