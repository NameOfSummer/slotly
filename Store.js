var BOOKINGS_SHEET = 'bookings';
var BOOKING_HEADERS = [
  'token',
  'eventId',
  'calendarId',
  'guestName',
  'guestEmail',
  'startIso',
  'endIso',
  'durationMin',
  'withMeet',
  'meetUrl',
  'status',
  'note',
  'title',
  'createdAt',
  'cancelledAt',
];

function openDataSpreadsheet_() {
  var id = getScriptProps_().getProperty(SHEET_ID_PROP);
  if (!id) throw new Error('予約データシートがありません。setupSlotly を実行してください。');
  return SpreadsheetApp.openById(id);
}

function ensureBookingsSheet_(ss) {
  ss = ss || openDataSpreadsheet_();
  var sheet = ss.getSheetByName(BOOKINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(BOOKINGS_SHEET);
  }
  var first = sheet.getRange(1, 1, 1, BOOKING_HEADERS.length).getValues()[0];
  var empty = first.every(function (cell) { return cell === ''; });
  if (empty || String(first[0]) !== 'token') {
    sheet.getRange(1, 1, 1, BOOKING_HEADERS.length).setValues([BOOKING_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendBooking_(row) {
  var sheet = ensureBookingsSheet_();
  sheet.appendRow([
    row.token,
    row.eventId,
    row.calendarId,
    row.guestName,
    row.guestEmail,
    row.startIso,
    row.endIso,
    row.durationMin,
    row.withMeet ? 'yes' : 'no',
    row.meetUrl || '',
    row.status,
    row.note || '',
    row.title || '',
    row.createdAt,
    row.cancelledAt || '',
  ]);
  return row;
}

function findBookingRow_(token) {
  if (!token) return null;
  var sheet = ensureBookingsSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var values = sheet.getRange(2, 1, last - 1, BOOKING_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(token)) {
      return { sheet: sheet, rowNumber: i + 2, data: rowToBooking_(values[i]) };
    }
  }
  return null;
}

function rowToBooking_(cells) {
  return {
    token: String(cells[0]),
    eventId: String(cells[1]),
    calendarId: String(cells[2]),
    guestName: String(cells[3]),
    guestEmail: String(cells[4]),
    startIso: String(cells[5]),
    endIso: String(cells[6]),
    durationMin: Number(cells[7]),
    withMeet: String(cells[8]) === 'yes' || cells[8] === true,
    meetUrl: String(cells[9] || ''),
    status: String(cells[10] || 'confirmed'),
    note: String(cells[11] || ''),
    title: String(cells[12] || ''),
    createdAt: String(cells[13] || ''),
    cancelledAt: String(cells[14] || ''),
  };
}

function markBookingCancelled_(rowNumber, whenIso) {
  var sheet = ensureBookingsSheet_();
  sheet.getRange(rowNumber, 11).setValue('cancelled');
  sheet.getRange(rowNumber, 15).setValue(whenIso);
}
