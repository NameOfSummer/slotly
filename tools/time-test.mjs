const { DateTimeFormat } = Intl;

function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const dtf = new DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const asUtc = (ms) => {
    const map = {};
    dtf.formatToParts(new Date(ms)).forEach((part) => {
      if (part.type !== 'literal') map[part.type] = part.value;
    });
    let h = Number(map.hour);
    if (h === 24) h = 0;
    return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), h, Number(map.minute), Number(map.second));
  };
  const offset = asUtc(utcGuess) - utcGuess;
  const utc = utcGuess - offset;
  const offset2 = asUtc(utc) - utc;
  return new Date(utcGuess - offset2);
}

const tokyo = zonedTimeToUtc(2026, 8, 26, 10, 0, 'Asia/Tokyo');
if (tokyo.toISOString() !== '2026-08-26T01:00:00.000Z') {
  console.error('Tokyo 10:00 failed', tokyo.toISOString());
  process.exit(1);
}
const ny = zonedTimeToUtc(2026, 8, 26, 10, 0, 'America/New_York');
if (ny.toISOString() !== '2026-08-26T14:00:00.000Z') {
  console.error('NY 10:00 failed', ny.toISOString());
  process.exit(1);
}
console.log('time conversion ok');
