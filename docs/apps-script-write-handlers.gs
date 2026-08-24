/************************************************************************
 * Forge Performance — in-app editing: write handlers
 * ---------------------------------------------------------------------
 * Paste this into the SAME Apps Script project that is already behind
 * your APPS_SCRIPT_URL (the one that returns the sheet data).
 *
 *   • If your project does NOT already have a doPost(e), paste this whole
 *     file in as-is.
 *   • If it DOES already have a doPost(e), copy the body of the doPost
 *     below into your existing one (and paste all the helper functions).
 *
 * Then: Deploy ▸ Manage deployments ▸ (edit your Web App) ▸ Version: New
 * version ▸ Deploy. Keep "Execute as: Me" and "Who has access: Anyone".
 * The /exec URL does NOT change, so nothing in the app needs updating.
 *
 * Security: every write must carry the caller's Firebase ID token. We
 * verify it with Google Identity Toolkit and then confirm the email has a
 * coach/admin Role in your Users sheet. No shared secret is stored.
 ************************************************************************/

var FIREBASE_API_KEY = 'AIzaSyBI3EE638KidKbw4iTk8DOJMCYBSJQoJIE'; // same Web API key as the app

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var email = verifyIdToken_(body.idToken);           // throws if the token is invalid
    if (!email || !isStaffEmail_(email)) {
      return json_({ ok: false, error: 'not_authorized' });
    }
    var out;
    switch (body.action) {
      case 'updateCells': out = updateCells_(body.sheet, body.num, body.data); break;
      case 'addPlayer':   out = addPlayer_(body); break;
      case 'hidePlayer':  out = setActive_(body.num, false); break;
      case 'showPlayer':  out = setActive_(body.num, true); break;
      default:            out = { ok: false, error: 'unknown_action' };
    }
    out.by = email;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Verify a Firebase ID token via Identity Toolkit; returns the user's email. */
function verifyIdToken_(idToken) {
  if (!idToken) throw new Error('no_token');
  var url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY;
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });
  var data = JSON.parse(resp.getContentText() || '{}');
  if (!data.users || !data.users.length) throw new Error('invalid_token');
  return String(data.users[0].email || '').toLowerCase();
}

/* Authorize by reading the Role for this email from the Users sheet. */
function isStaffEmail_(email) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sh) return false;
  var vals = sh.getDataRange().getValues();
  var h = vals[0];
  var e1 = h.indexOf('Email'), e2 = h.indexOf('Email 2'), rc = h.indexOf('Role');
  if (rc < 0) return false;
  email = String(email).toLowerCase();
  for (var r = 1; r < vals.length; r++) {
    var a = e1 > -1 ? String(vals[r][e1]).trim().toLowerCase() : '';
    var b = e2 > -1 ? String(vals[r][e2]).trim().toLowerCase() : '';
    if (a === email || b === email) {
      var role = String(vals[r][rc]).trim().toLowerCase();
      return role === 'coach' || role === 'admin';
    }
  }
  return false;
}

/* Set header:value pairs on the row whose Player Number matches `num`. */
function updateCells_(sheetName, num, data) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sh) return { ok: false, error: 'no_sheet:' + sheetName };
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var numCol = findNumCol_(headers);
  if (numCol < 0) return { ok: false, error: 'no_player_number_col' };
  var rowIdx = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][numCol]) === String(num)) { rowIdx = r; break; }
  }
  if (rowIdx < 0) return { ok: false, error: 'player_not_found:' + num };
  var written = [];
  Object.keys(data).forEach(function (header) {
    var col = headers.indexOf(header);
    if (col === -1) { // create the column if it doesn't exist yet (e.g. "Active")
      col = headers.length;
      sh.getRange(1, col + 1).setValue(header);
      headers.push(header);
    }
    var v = data[header];
    sh.getRange(rowIdx + 1, col + 1).setValue(v === null ? '' : v);
    written.push(header);
  });
  return { ok: true, written: written };
}

function findNumCol_(headers) {
  var cands = ['Player Number', 'Player Num', 'Player #', 'Number', 'Num', '#'];
  for (var i = 0; i < cands.length; i++) {
    var idx = headers.indexOf(cands[i]);
    if (idx > -1) return idx;
  }
  return -1;
}

/* Append a new player to the Players sheet (creating an Active column if needed). */
function addPlayer_(b) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Players');
  if (!sh) return { ok: false, error: 'no_players_sheet' };
  var headers = sh.getDataRange().getValues()[0];
  ensureCol_(sh, headers, 'Active');
  var row = headers.map(function (hh) {
    if (hh === 'Player Number') return b.num;
    if (hh === 'Player Name')   return b.name;
    if (hh === 'Team')          return b.team;
    if (hh === 'Active')        return true;
    return '';
  });
  sh.appendRow(row);
  return { ok: true };
}

function setActive_(num, active) {
  return updateCells_('Players', num, { 'Active': active ? true : false });
}

function ensureCol_(sh, headers, name) {
  if (headers.indexOf(name) === -1) {
    sh.getRange(1, headers.length + 1).setValue(name);
    headers.push(name);
  }
}
