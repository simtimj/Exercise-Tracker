const SHEET_ID = '1oBtPYDCDiiXms0cqbfiymrAQ-qqLeI5OI7Ojee8Z_IY'; 
const TAB_NAME = 'V5: PT, Compound, Iso';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Exercise Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheetData() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
  return sheet.getDataRange().getDisplayValues();
}