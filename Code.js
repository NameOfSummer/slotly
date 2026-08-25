var APP_NAME = 'Slotly';

function doGet(e) {
  e = e || { parameter: {} };
  var page = e.parameter.page || 'book';
  var token = e.parameter.token || '';

  if (page === 'ics') {
    return serveIcs_(token);
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.bootstrapJson = JSON.stringify({
    page: page,
    token: token,
    adminKey: page === 'admin' ? e.parameter.key || '' : '',
  });

  return template
    .evaluate()
    .setTitle(APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * エディタから一度だけ実行する。管理キーと予約データシートを作る。
 */
function setupSlotly() {
  var result = initializeSlotly_();
  Logger.log('===== Slotly セットアップ完了 =====');
  Logger.log('管理キー: ' + result.adminKey);
  Logger.log('予約データ: ' + result.spreadsheetUrl);
  Logger.log('Webアプリをデプロイしたあと、次のURLで管理画面を開く:');
  Logger.log('(デプロイURL)?page=admin&key=' + result.adminKey);
  return result;
}

function getPublicConfig() {
  ensureConfigured_();
  var settings = getSettings_();
  return {
    configured: true,
    appName: APP_NAME,
    hostName: settings.hostName || '',
    timezone: settings.timezone,
    durations: listDurations_(),
    maxDaysAhead: settings.maxDaysAhead,
    minNoticeMin: settings.minNoticeMin,
  };
}

function getSlots(durationMin) {
  ensureConfigured_();
  return listAvailableStarts_(Number(durationMin));
}

function createBooking(payload) {
  ensureConfigured_();
  return createBooking_(payload);
}

function getBooking(token) {
  return getPublicBooking_(token);
}

function cancelBooking(token) {
  return cancelBooking_(token);
}

function adminGetState(key) {
  assertAdminKey_(key);
  var settings = getSettings_();
  return {
    settings: settings,
    calendars: listCalendarsForAdmin_(),
    adminUrlHint: '?page=admin&key=' + key,
  };
}

function adminSaveSettings(key, patch) {
  assertAdminKey_(key);
  return saveSettings_(patch);
}
