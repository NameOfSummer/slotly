function createBooking_(payload) {
  payload = payload || {};
  var durationMin = assertDuration_(payload.durationMin);
  var withMeet = !!payload.withMeet;
  var name = String(payload.name || '').trim();
  var eventTitle = String(payload.eventTitle || '').trim();
  var email = String(payload.email || '').trim();
  var note = String(payload.note || '').trim();
  var startIso = String(payload.startIso || '');

  if (!name || name.length > 80) throw new Error('お名前を入力してください。');
  if (eventTitle.length > 80) throw new Error('予定のタイトルは80文字以内にしてください。');
  if (!isValidEmail_(email)) throw new Error('メールアドレスの形式が正しくありません。');
  if (note.length > 1000) throw new Error('メモは1000文字以内にしてください。');
  if (!startIso) throw new Error('日時を選んでください。');

  var start = new Date(startIso);
  if (isNaN(start.getTime())) throw new Error('日時が正しくありません。');
  var end = addMinutes_(start, durationMin);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('混み合っています。少し待ってからもう一度お試しください。');
  }

  try {
    if (!slotStillFree_(durationMin, start.toISOString())) {
      throw new Error('その時間は埋まりました。別の時間を選んでください。');
    }

    var settings = getSettings_();
    var title = eventTitle || buildEventTitle_(settings, name);
    var token = Utilities.getUuid();
    var webUrl = ScriptApp.getService().getUrl() || '';
    var cancelUrl = webUrl ? webUrl + '?page=cancel&token=' + token : '';
    var icsUrl = webUrl ? webUrl + '?page=ics&token=' + token : '';
    var description = buildEventDescription_({
      name: name,
      email: email,
      note: note,
      durationMin: durationMin,
      withMeet: withMeet,
      cancelUrl: cancelUrl,
    });

    var created = insertCalendarEvent_({
      calendarId: settings.writeCalendarId,
      title: title,
      description: description,
      start: start,
      end: end,
      email: email,
      withMeet: withMeet,
      timeZone: settings.timezone,
    });

    clearBusyCache_();

    var booking = appendBooking_({
      token: token,
      eventId: created.eventId,
      calendarId: created.calendarId,
      guestName: name,
      guestEmail: email,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      durationMin: durationMin,
      withMeet: withMeet,
      meetUrl: created.meetUrl || '',
      status: 'confirmed',
      note: note,
      title: title,
      createdAt: new Date().toISOString(),
    });

    sendGuestEmail_(booking, {
      cancelUrl: cancelUrl,
      icsUrl: icsUrl,
      googleUrl: googleTemplateUrl_(booking),
      timeZone: settings.timezone,
      hostName: settings.hostName,
    });

    return publicBookingView_(booking, {
      cancelUrl: cancelUrl,
      icsUrl: icsUrl,
      googleUrl: googleTemplateUrl_(booking),
    });
  } finally {
    lock.releaseLock();
  }
}

function getPublicBooking_(token) {
  var found = findBookingRow_(token);
  if (!found) throw new Error('予約が見つかりません。');
  var webUrl = ScriptApp.getService().getUrl() || '';
  return publicBookingView_(found.data, {
    cancelUrl: webUrl ? webUrl + '?page=cancel&token=' + found.data.token : '',
    icsUrl: webUrl ? webUrl + '?page=ics&token=' + found.data.token : '',
    googleUrl: googleTemplateUrl_(found.data),
  });
}

function cancelBooking_(token) {
  var found = findBookingRow_(token);
  if (!found) throw new Error('予約が見つかりません。');
  if (found.data.status === 'cancelled') {
    return publicBookingView_(found.data, {});
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('混み合っています。少し待ってからもう一度お試しください。');
  }
  try {
    found = findBookingRow_(token);
    if (!found) throw new Error('予約が見つかりません。');
    if (found.data.status === 'cancelled') {
      return publicBookingView_(found.data, {});
    }
    cancelCalendarEvent_(found.data.calendarId, found.data.eventId);
    markBookingCancelled_(found.rowNumber, new Date().toISOString());
    clearBusyCache_();
    var cancelled = findBookingRow_(token).data;
    sendCancelEmail_(cancelled);
    return publicBookingView_(cancelled, {});
  } finally {
    lock.releaseLock();
  }
}

function publicBookingView_(booking, urls) {
  urls = urls || {};
  return {
    token: booking.token,
    status: booking.status,
    title: booking.title,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    startIso: booking.startIso,
    endIso: booking.endIso,
    durationMin: booking.durationMin,
    withMeet: booking.withMeet,
    meetUrl: booking.meetUrl,
    note: booking.note,
    cancelUrl: urls.cancelUrl || '',
    icsUrl: urls.icsUrl || '',
    googleUrl: urls.googleUrl || googleTemplateUrl_(booking),
  };
}

function buildEventTitle_(settings, guestName) {
  var host = settings.hostName ? settings.hostName + ' / ' : '';
  return host + guestName + ' さん（Slotly）';
}

function buildEventDescription_(info) {
  var lines = [
    'Slotly からの予約です。',
    '予約者: ' + info.name,
    'メール: ' + info.email,
    '所要時間: ' + formatDurationJa_(info.durationMin),
    'Google Meet: ' + (info.withMeet ? 'あり' : 'なし'),
  ];
  if (info.note) lines.push('メモ: ' + info.note);
  if (info.cancelUrl) {
    lines.push('');
    lines.push('キャンセル: ' + info.cancelUrl);
  }
  return lines.join('\n');
}

function googleTemplateUrl_(booking) {
  var start = new Date(booking.startIso);
  var end = new Date(booking.endIso);
  var params = [
    'action=TEMPLATE',
    'text=' + encodeURIComponent(booking.title || APP_NAME),
    'dates=' + formatIcsUtc_(start) + '/' + formatIcsUtc_(end),
    'details=' + encodeURIComponent(buildGoogleDetails_(booking)),
  ];
  if (booking.meetUrl) {
    params.push('location=' + encodeURIComponent(booking.meetUrl));
  } else if (booking.withMeet) {
    params.push('location=' + encodeURIComponent('Google Meet'));
  }
  return 'https://calendar.google.com/calendar/render?' + params.join('&');
}

function buildGoogleDetails_(booking) {
  var lines = [];
  if (booking.meetUrl) lines.push('Meet: ' + booking.meetUrl);
  if (booking.note) lines.push(booking.note);
  lines.push('予約システム: Slotly');
  return lines.join('\n');
}

function serveIcs_(token) {
  var found = findBookingRow_(token);
  if (!found || found.data.status === 'cancelled') {
    return ContentService.createTextOutput('予約が見つかりません。').setMimeType(ContentService.MimeType.TEXT);
  }
  return ContentService.createTextOutput(buildIcs_(found.data))
    .setMimeType(ContentService.MimeType.ICAL)
    .downloadAsFile('slotly.ics');
}

function buildIcs_(booking) {
  var start = new Date(booking.startIso);
  var end = new Date(booking.endIso);
  var desc = buildGoogleDetails_(booking);
  var location = booking.meetUrl || (booking.withMeet ? 'Google Meet' : '');
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slotly//JP',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + booking.token + '@slotly',
    'DTSTAMP:' + formatIcsUtc_(new Date()),
    'DTSTART:' + formatIcsUtc_(start),
    'DTEND:' + formatIcsUtc_(end),
    'SUMMARY:' + escapeIcsText_(booking.title || APP_NAME),
    'DESCRIPTION:' + escapeIcsText_(desc),
    'LOCATION:' + escapeIcsText_(location),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

function sendGuestEmail_(booking, urls) {
  var when = formatRangeJa_(booking.startIso, booking.endIso);
  var meetLine = booking.withMeet
    ? (booking.meetUrl ? '<p>Google Meet: <a href="' + escapeHtml_(booking.meetUrl) + '">' + escapeHtml_(booking.meetUrl) + '</a></p>' : '<p>Google Meet 付きの予定です。招待メールのリンクから参加できます。</p>')
    : '<p>この予約に Google Meet はありません。</p>';
  var html = [
    '<p>' + escapeHtml_(booking.guestName) + ' さん</p>',
    '<p>Slotly で予約が確定しました。</p>',
    booking.title ? '<p>予定: ' + escapeHtml_(booking.title) + '</p>' : '',
    '<p><strong>' + escapeHtml_(when) + '</strong>（' + escapeHtml_(formatDurationJa_(booking.durationMin)) + '）</p>',
    meetLine,
    '<p><a href="' + escapeHtml_(urls.googleUrl) + '">Google カレンダーに追加</a></p>',
    urls.icsUrl ? '<p><a href="' + escapeHtml_(urls.icsUrl) + '">その他のカレンダー用にファイルをダウンロード</a></p>' : '',
    urls.cancelUrl ? '<p><a href="' + escapeHtml_(urls.cancelUrl) + '">この予約をキャンセルする</a></p>' : '',
  ].join('');
  try {
    MailApp.sendEmail({
      to: booking.guestEmail,
      subject: '【Slotly】予約が確定しました ' + when,
      htmlBody: html,
    });
  } catch (err) {
    console.error(err);
  }
}

function sendCancelEmail_(booking) {
  var when = formatRangeJa_(booking.startIso, booking.endIso);
  try {
    MailApp.sendEmail({
      to: booking.guestEmail,
      subject: '【Slotly】予約をキャンセルしました ' + when,
      htmlBody:
        '<p>' + escapeHtml_(booking.guestName) + ' さん</p>' +
        '<p>次の予約をキャンセルしました。</p>' +
        '<p><strong>' + escapeHtml_(when) + '</strong></p>',
    });
  } catch (err) {
    console.error(err);
  }
}

function formatRangeJa_(startIso, endIso) {
  var start = new Date(startIso);
  var end = new Date(endIso);
  var tz = getSettings_().timezone || 'Asia/Tokyo';
  var dtf = new Intl.DateTimeFormat('ja-JP', {
    timeZone: tz,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  var endTime = new Intl.DateTimeFormat('ja-JP', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return dtf.format(start) + ' – ' + endTime.format(end);
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearBusyCache_() {
  getScriptProps_().setProperty('BUSY_GEN', String(Date.now()));
}
