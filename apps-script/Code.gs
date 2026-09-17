const INTERNAL_ID_HEADER = '_internal_response_id';
const REQUIRED_RESPONSE_HEADERS = ['이름', '전화번호', '성별', '주문 상품'];
const SOURCE_SPREADSHEET_ID_PROPERTY = 'SOURCE_SPREADSHEET_ID';
const RESPONSE_SHEET_NAME_PROPERTY = 'RESPONSE_SHEET_NAME';
const WEB_APP_SECRET_PROPERTY = 'WEB_APP_SECRET';
const ID_PROTECTION_DESCRIPTION = 'System-managed _internal_response_id column';

/**
 * Configures the spreadsheet and installs the form-submit trigger once.
 * Run this manually from the Apps Script editor during initial setup.
 */
function setupSourceSheet(spreadsheetId, responseSheetName, webAppSecret) {
  if (!spreadsheetId || !responseSheetName || !webAppSecret) {
    throw new Error('spreadsheetId, responseSheetName, and webAppSecret are required.');
  }

  PropertiesService.getScriptProperties().setProperties({
    [SOURCE_SPREADSHEET_ID_PROPERTY]: spreadsheetId,
    [RESPONSE_SHEET_NAME_PROPERTY]: responseSheetName,
    [WEB_APP_SECRET_PROPERTY]: webAppSecret,
  });

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(responseSheetName);
  if (!sheet) {
    throw new Error(`Response sheet not found: ${responseSheetName}`);
  }

  const idColumn = ensureResponseHeaders_(sheet);
  protectInternalIdColumn_(sheet, idColumn);
  installFormSubmitTrigger_(spreadsheet);
  const result = ensureInternalResponseIds_();

  return {
    spreadsheetId,
    responseSheetName,
    idColumn,
    generatedCount: result.generatedCount,
  };
}

/**
 * Handles new Google Form submissions for the linked response sheet.
 */
function handleFormSubmit(event) {
  if (!event || !event.range) {
    throw new Error('A spreadsheet form-submit event is required.');
  }

  const sheet = event.range.getSheet();
  const idColumn = ensureResponseHeaders_(sheet);
  protectInternalIdColumn_(sheet, idColumn);
  const idCell = sheet.getRange(event.range.getRow(), idColumn);

  if (!idCell.getValue()) {
    idCell.setValue(createInternalResponseId_());
  }
}

/**
 * Receives authenticated requests from the web application.
 */
function doPost(event) {
  try {
    const payload = parseJsonRequest_(event);
    verifyWebAppSecret_(payload.secret);

    if (payload.action === 'ensure_ids') {
      return jsonResponse_({ ok: true, ...ensureInternalResponseIds_() });
    }

    throw new Error(`Unsupported action: ${payload.action || '(missing)'}`);
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message });
  }
}

function doGet() {
  return jsonResponse_({ ok: true, service: 'response-id-script' });
}

function ensureInternalResponseIds_() {
  const sheet = getConfiguredResponseSheet_();
  const idColumn = ensureResponseHeaders_(sheet);
  protectInternalIdColumn_(sheet, idColumn);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { generatedCount: 0, totalResponseCount: 0 };
  }

  const idRange = sheet.getRange(2, idColumn, lastRow - 1, 1);
  const idValues = idRange.getValues();
  let generatedCount = 0;

  for (const row of idValues) {
    if (!row[0]) {
      row[0] = createInternalResponseId_();
      generatedCount += 1;
    }
  }

  if (generatedCount > 0) {
    idRange.setValues(idValues);
  }

  return {
    generatedCount,
    totalResponseCount: idValues.length,
  };
}

function ensureResponseHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const missingHeaders = REQUIRED_RESPONSE_HEADERS.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required response headers: ${missingHeaders.join(', ')}`);
  }

  const existingIdIndex = headers.indexOf(INTERNAL_ID_HEADER);
  if (existingIdIndex >= 0) {
    return existingIdIndex + 1;
  }

  sheet.insertColumnAfter(lastColumn);
  sheet.getRange(1, lastColumn + 1).setValue(INTERNAL_ID_HEADER);
  return lastColumn + 1;
}

function protectInternalIdColumn_(sheet, idColumn) {
  const existingProtection = sheet
    .getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .find((protection) => protection.getDescription() === ID_PROTECTION_DESCRIPTION);

  if (existingProtection) {
    return;
  }

  const protection = sheet
    .getRange(1, idColumn, sheet.getMaxRows(), 1)
    .protect()
    .setDescription(ID_PROTECTION_DESCRIPTION);
  protection.setWarningOnly(false);
}

function installFormSubmitTrigger_(spreadsheet) {
  const hasTrigger = ScriptApp.getProjectTriggers().some(
    (trigger) =>
      trigger.getHandlerFunction() === 'handleFormSubmit' &&
      trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT,
  );

  if (!hasTrigger) {
    ScriptApp.newTrigger('handleFormSubmit')
      .forSpreadsheet(spreadsheet)
      .onFormSubmit()
      .create();
  }
}

function getConfiguredResponseSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(SOURCE_SPREADSHEET_ID_PROPERTY);
  const sheetName = properties.getProperty(RESPONSE_SHEET_NAME_PROPERTY);

  if (!spreadsheetId || !sheetName) {
    throw new Error('The source spreadsheet has not been configured.');
  }

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Response sheet not found: ${sheetName}`);
  }
  return sheet;
}

function verifyWebAppSecret_(secret) {
  const configuredSecret = PropertiesService.getScriptProperties().getProperty(
    WEB_APP_SECRET_PROPERTY,
  );

  if (!configuredSecret || secret !== configuredSecret) {
    throw new Error('Invalid Web App secret.');
  }
}

function parseJsonRequest_(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error('A JSON POST body is required.');
  }
  return JSON.parse(event.postData.contents);
}

function createInternalResponseId_() {
  return `resp_${Utilities.getUuid()}`;
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
