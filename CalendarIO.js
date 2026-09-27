/**
 * カレンダーに予定を入れる。
 * @param opts 予定の内容。
 * @returns 予定 ID と Meet URL。
 */
function insertCalendarEvent_(opts) {
  var calendarId = opts.calendarId || 'primary';
  if (typeof Calendar !== 'undefined' && Calendar.Events) {
    try {
      return insertViaCalendarApi_(opts, calendarId);
    } catch (err) {
      console.error(err);
      if (opts.withMeet) {
        try {
          return insertViaCalendarApi_(Object.assign({}, opts, { withMeet: false }), calendarId);
        } catch (err2) {
          console.error(err2);
        }
      }
    }
  }
  return insertViaCalendarApp_(opts, calendarId);
}

/**
 * Calendar API で予定を入れる。
 * @param opts 予定の内容。
 * @param calendarId 書き込み先。
 * @returns 予定 ID と Meet URL。
 */
function insertViaCalendarApi_(opts, calendarId) {
  var resource = {
    summary: opts.title,
    description: opts.description,
    start: { dateTime: opts.start.toISOString(), timeZone: opts.timeZone },
    end: { dateTime: opts.end.toISOString(), timeZone: opts.timeZone },
    attendees: [{ email: opts.email }],
    guestsCanModify: false,
  };
  if (opts.withMeet) {
    resource.conferenceData = {
      createRequest: {
        requestId: Utilities.getUuid(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
    resource.location = 'Google Meet';
  }

  var event = Calendar.Events.insert(resource, calendarId, {
    conferenceDataVersion: opts.withMeet ? 1 : 0,
    sendUpdates: 'all',
  });

  return {
    eventId: event.id,
    calendarId: calendarId,
    meetUrl: extractMeetUrl_(event),
  };
}

/**
 * CalendarApp で予定を入れる。
 * @param opts 予定の内容。
 * @param calendarId 書き込み先。
 * @returns 予定 ID。
 */
function insertViaCalendarApp_(opts, calendarId) {
  var cal = calendarId === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('書き込み先カレンダーが見つかりません。');
  var event = cal.createEvent(opts.title, opts.start, opts.end, {
    description: opts.description,
    guests: opts.email,
    sendInvites: true,
    location: opts.withMeet ? 'Google Meet' : '',
  });
  return {
    eventId: event.getId().replace(/@google.com$/, ''),
    calendarId: cal.getId(),
    meetUrl: '',
  };
}

/**
 * 予定から Meet URL を取る。
 * @param event カレンダー予定。
 * @returns Meet URL。なければ空。
 */
function extractMeetUrl_(event) {
  var points = (((event || {}).conferenceData || {}).entryPoints) || [];
  for (var i = 0; i < points.length; i++) {
    if (points[i].entryPointType === 'video' && points[i].uri) return points[i].uri;
  }
  return event.hangoutLink || '';
}

/**
 * カレンダー予定を消す。
 * @param calendarId カレンダー。
 * @param eventId 予定。
 * @returns {void}
 */
function cancelCalendarEvent_(calendarId, eventId) {
  if (!eventId) return;
  if (typeof Calendar !== 'undefined' && Calendar.Events) {
    try {
      Calendar.Events.remove(calendarId, eventId, { sendUpdates: 'all' });
      return;
    } catch (err) {
      console.error(err);
    }
  }
  var cal = calendarId === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(calendarId);
  if (!cal) return;
  var ev = cal.getEventById(eventId) || cal.getEventById(eventId + '@google.com');
  if (ev) ev.deleteEvent();
}
