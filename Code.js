var APP_NAME = 'Slotly';

function pageTitle_(page) {
  var suffix = '予約';
  if (page === 'done') suffix = '予約確定';
  else if (page === 'cancel') suffix = 'キャンセル';
  else if (page === 'admin') suffix = '管理';
  return APP_NAME + ' - ' + suffix;
}

function doGet(e) {
  e = e || { parameter: {} };
  var page = e.parameter.page || 'book';
  var token = e.parameter.token || '';

  if (page === 'ics') {
    return serveIcs_(token);
  }

  var template = HtmlService.createTemplateFromFile('Index');
  var title = pageTitle_(page);
  template.pageTitle = title;
  template.bootstrapJson = JSON.stringify({
    page: page,
    token: token,
    adminKey: page === 'admin' ? e.parameter.key || '' : '',
  });

  return template
    .evaluate()
    .setTitle(title)
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
    allowedEmailDomains: settings.allowedEmailDomains || [],
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
