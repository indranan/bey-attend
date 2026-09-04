const SS = SpreadsheetApp.getActiveSpreadsheet();

function res(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- HELPERS ---

function getHeaderMap(sheet) {
  const headers = sheet.getDataRange().getValues()[0] || [];
  const map = {};
  headers.forEach((h, i) => {
    map[String(h).toLowerCase().trim()] = i;
  });
  return map;
}

function getOrCreateSheet(sheetName, headers) {
  let sheet = SS.getSheetByName(sheetName);
  if (!sheet) {
    sheet = SS.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

// ============================================================
// TEMPORARY TOURNAMENT MATCH MAP
// Menyimpan nomor match yang konsisten dengan Challonge
// (suggested_play_order) berdasarkan match_id.
// Sheet ini hanya hidup selama tournament berjalan.
// ============================================================
function getTempMatchMapSheetName(eventId) {
  const safe = String(eventId || '').trim().replace(/[^A-Za-z0-9_-]/g, '_');
  return 'TMP_MATCHMAP_' + (safe || 'UNKNOWN');
}

function ensureTempMatchMapSheet(eventId, tournamentId) {
  const name = getTempMatchMapSheetName(eventId);
  const headers = [
    'event_id',
    'tournament_id',
    'match_id',
    'display_match_number',
    'round',
    'player1_id',
    'player2_id',
    'state',
    'updated_at'
  ];
  return getOrCreateSheet(name, headers);
}

function findEventIdByTournamentId(tournamentId) {
  const eventSheet = SS.getSheetByName('Events');
  if (!eventSheet) return '';
  const values = eventSheet.getDataRange().getValues();
  if (values.length < 2) return '';
  const map = getHeaderMap(eventSheet);
  const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];
  const tournamentIdCol = map['challonge_id'] !== undefined ? map['challonge_id'] : map['challongeid'];
  if (eventIdCol === undefined || tournamentIdCol === undefined) return '';

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][tournamentIdCol] || '').trim() === String(tournamentId || '').trim()) {
      return String(values[i][eventIdCol] || '').trim();
    }
  }
  return '';
}

function upsertTempMatchMap(eventId, tournamentId, matchesRaw) {
  if (!eventId || !tournamentId) return;
  try {
    const sheet = ensureTempMatchMapSheet(eventId, tournamentId);
    const existing = sheet.getDataRange().getValues();
    const rowMap = {};
    for (let i = 1; i < existing.length; i++) {
      const matchId = String(existing[i][2] || '').trim();
      if (matchId) rowMap[matchId] = i + 1;
    }

    const appendRows = [];
    const now = new Date();

    (matchesRaw || []).forEach((m, index) => {
      const attrs = m.attributes || {};
      const points = attrs.points_by_participant || [];
      const matchId = String(m.id || '').trim();
      if (!matchId) return;

      const spo = Number(attrs.suggested_play_order);
      const displayMatchNumber = Number.isFinite(spo) && spo > 0 ? spo : (index + 1);

      const row = [
        String(eventId),
        String(tournamentId),
        matchId,
        displayMatchNumber,
        Number(attrs.round || 0),
        points.length > 0 ? String(points[0].participant_id || '') : '',
        points.length > 1 ? String(points[1].participant_id || '') : '',
        String(attrs.state || ''),
        now
      ];

      if (rowMap[matchId]) {
        sheet.getRange(rowMap[matchId], 1, 1, row.length).setValues([row]);
      } else {
        appendRows.push(row);
      }
    });

    if (appendRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
    }
  } catch (err) {
    console.error('[TEMP MATCHMAP] upsert failed: ' + err.message);
  }
}

function getTempMatchNumberMap(eventId) {
  const map = {};
  if (!eventId) return map;
  try {
    const sheet = SS.getSheetByName(getTempMatchMapSheetName(eventId));
    if (!sheet) return map;
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const matchId = String(values[i][2] || '').trim();
      const displayNumber = Number(values[i][3]);
      if (matchId && Number.isFinite(displayNumber) && displayNumber > 0) {
        map[matchId] = displayNumber;
      }
    }
  } catch (err) {
    console.error('[TEMP MATCHMAP] read failed: ' + err.message);
  }
  return map;
}

function deleteTempMatchMapSheet(eventId) {
  try {
    const name = getTempMatchMapSheetName(eventId);
    const sheet = SS.getSheetByName(name);
    if (sheet) {
      SS.deleteSheet(sheet);
      Logger.log('[TEMP MATCHMAP] deleted ' + name);
      return true;
    }
  } catch (err) {
    console.error('[TEMP MATCHMAP] delete failed: ' + err.message);
  }
  return false;
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getTournamentParticipantMapping(eventId, tournamentId) {
  try {
    const mappingSheet = SS.getSheetByName('TournamentParticipants');
    if (!mappingSheet) return {};

    const mappingValues = mappingSheet.getDataRange().getValues();
    if (mappingValues.length < 2) return {};

    const mappingHeaders = mappingValues[0];
    const mappingRows = mappingValues.slice(1);
    const mappingMap = {};
    mappingHeaders.forEach((h, i) => {
      mappingMap[String(h).toLowerCase().trim()] = i;
    });

    const mapEventIdCol = mappingMap['event_id'];
    const mapTournamentIdCol = mappingMap['tournament_id'];
    const mapParticipantIdCol = mappingMap['challonge_participant_id'];
    const mapGoogleIdCol = mappingMap['google_id'];

    if (mapEventIdCol === undefined || mapParticipantIdCol === undefined || mapGoogleIdCol === undefined) {
      return {};
    }

    const participantMap = {};
    mappingRows.forEach(row => {
      const rid = normalizeKey(row[mapEventIdCol]);
      const rtid = mapTournamentIdCol !== undefined ? normalizeId(row[mapTournamentIdCol]) : '';
      const rpid = normalizeId(row[mapParticipantIdCol]);
      const rgid = normalizeId(row[mapGoogleIdCol]);

      const eventMatch = rid && rid === normalizeKey(eventId);
      const tournamentMatch = rtid && normalizeId(tournamentId) && rtid === normalizeId(tournamentId);

      if ((eventMatch || tournamentMatch) && rpid && rgid) {
        participantMap[rpid] = rgid;
      }
    });

    return participantMap;
  } catch (err) {
    console.error('getTournamentParticipantMapping error: ' + err.message);
    return {};
  }
}

function saveTournamentParticipantMapping(eventId, tournamentId, participants) {
  try {
    const mappingSheet = getOrCreateSheet('TournamentParticipants', [
      'challonge_participant_id',
      'event_id',
      'tournament_id',
      'google_id',
      'nickname',
      'created_at'
    ]);

    const values = mappingSheet.getDataRange().getValues();
    const existingKeys = new Set();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const key = String(row[0] || '') + '|' + String(row[1] || '');
      existingKeys.add(key);
    }

    const now = new Date();
    let inserted = 0;
    const rowsToAppend = [];

    (participants || []).forEach(p => {
      const challongeId = String(p.challongeParticipantId || '').trim();
      const gId = String(p.googleId || '').trim();
      const nick = String(p.nickname || p.nama || '').trim();
      if (!challongeId || !gId) return;

      const key = challongeId + '|' + eventId;
      if (existingKeys.has(key)) return;

      rowsToAppend.push([
        challongeId,
        eventId,
        tournamentId || '',
        gId,
        nick,
        now
      ]);
      existingKeys.add(key);
      inserted++;
    });

    if (rowsToAppend.length > 0) {
      mappingSheet.getRange(mappingSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    return { status: 'success', inserted };
  } catch (err) {
    console.error('saveTournamentParticipantMapping error: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

function repairTournamentParticipantMapping(data) {
  try {
    const eventId = String(data.eventId || '').trim();
    const tournamentId = String(data.tournamentId || '').trim();
    if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });
    if (!tournamentId) return res({ status: 'error', message: 'tournamentId wajib diisi' });

    const participantsUrl = 'https://api.challonge.com/v2.1/tournaments/' + tournamentId + '/participants.json';
    const participantsRes = challongeFetch('get', participantsUrl, undefined, 'v2.1');
    if (participantsRes.__error) {
      return res({ status: 'error', message: 'Gagal fetch participants dari Challonge (HTTP ' + participantsRes.code + '): ' + participantsRes.text });
    }

    const participantsRaw = Array.isArray(participantsRes.data) ? participantsRes.data : (Array.isArray(participantsRes) ? participantsRes : []);
    const challengers = participantsRaw.map(p => {
      const participant = p.participant || p;
      const attr = participant.attributes || participant;
      return {
        id: String(participant.id || ''),
        name: String(attr.name || ('Player ' + participant.id)).trim()
      };
    }).filter(p => p.id && p.name);

    const attendanceSheet = SS.getSheetByName('Attendance');
    let attendanceByNickname = {};
    if (attendanceSheet) {
      const attendanceValues = attendanceSheet.getDataRange().getDisplayValues();
      if (attendanceValues.length >= 2) {
        const attendanceHeaders = attendanceValues[0];
        const attendanceRows = attendanceValues.slice(1);
        const attendanceMap = {};
        attendanceHeaders.forEach((h, i) => {
          attendanceMap[String(h).toLowerCase().trim()] = i;
        });
        const attendanceEventIdCol = attendanceMap['event id'] !== undefined ? attendanceMap['event id'] : attendanceMap['eventid'];
        const attendanceGoogleIdCol = attendanceMap['google id'] !== undefined ? attendanceMap['google id'] : attendanceMap['googleid'];
        const attendanceNicknameCol = attendanceMap['nickname'];

        if (attendanceEventIdCol !== undefined && attendanceGoogleIdCol !== undefined && attendanceNicknameCol !== undefined) {
          attendanceRows.forEach(row => {
            const rowEventId = String(row[attendanceEventIdCol] || '').trim();
            if (rowEventId !== eventId) return;
            const gId = String(row[attendanceGoogleIdCol] || '').trim();
            const nick = String(row[attendanceNicknameCol] || '').trim();
            if (!gId || !nick) return;
            const key = nick.toLowerCase();
            if (!attendanceByNickname[key]) {
              attendanceByNickname[key] = [];
            }
            attendanceByNickname[key].push({ googleId: gId, nickname: nick });
          });
        }
      }
    }

    const mappingSheet = getOrCreateSheet('TournamentParticipants', [
      'challonge_participant_id',
      'event_id',
      'tournament_id',
      'google_id',
      'nickname',
      'created_at'
    ]);

    const mappingValues = mappingSheet.getDataRange().getValues();
    const existingRows = mappingValues.slice(1);
    const existingKeys = new Set();
    const existingByParticipantId = {};
    existingRows.forEach((row, index) => {
      const key = String(row[0] || '') + '|' + String(row[1] || '');
      existingKeys.add(key);
      const pid = String(row[0] || '').trim();
      if (pid) {
        existingByParticipantId[pid] = {
          rowIndex: index,
          googleId: String(row[3] || '').trim(),
          nickname: String(row[4] || '').trim()
        };
      }
    });

    const now = new Date();
    let created = 0;
    let updated = 0;
    let alreadyMapped = 0;
    const mapped = [];
    const warnings = [];
    const rowsToAppend = [];
    const rowsToUpdate = [];

    challengers.forEach(c => {
      const key = c.id + '|' + eventId;
      if (existingKeys.has(key)) {
        alreadyMapped++;
        const existing = existingByParticipantId[c.id];
        if (existing && !existing.googleId) {
          const normName = c.name.toLowerCase();
          const attendanceMatches = attendanceByNickname[normName];
          if (attendanceMatches && attendanceMatches.length === 1) {
            const googleId = attendanceMatches[0].googleId;
            rowsToUpdate.push({
              rowIndex: existing.rowIndex,
              googleId: googleId,
              nickname: c.name
            });
            updated++;
            mapped.push({
              challongeParticipantId: c.id,
              nickname: c.name,
              googleId: googleId
            });
          }
        }
        return;
      }

      const normName = c.name.toLowerCase();
      const attendanceMatches = attendanceByNickname[normName];

      if (!attendanceMatches) {
        warnings.push({
          type: 'no_match',
          message: 'Participant tidak ditemukan di Attendance: ' + c.name + ' (Challonge ID: ' + c.id + ')'
        });
        return;
      }

      if (attendanceMatches.length > 1) {
        warnings.push({
          type: 'ambiguous',
          message: 'Ambiguous participant: ' + c.name + ' cocok dengan ' + attendanceMatches.length + ' attendance records: ' + attendanceMatches.map(a => a.googleId).join(', ')
        });
        return;
      }

      const googleId = attendanceMatches[0].googleId;
      rowsToAppend.push([
        c.id,
        eventId,
        tournamentId,
        googleId,
        c.name,
        now
      ]);
      existingKeys.add(key);
      created++;
      mapped.push({
        challongeParticipantId: c.id,
        nickname: c.name,
        googleId: googleId
      });
    });

    if (rowsToAppend.length > 0) {
      mappingSheet.getRange(mappingSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    rowsToUpdate.forEach(update => {
      const sheetRow = update.rowIndex + 2;
      mappingSheet.getRange(sheetRow, 4).setValue(update.googleId);
      mappingSheet.getRange(sheetRow, 5).setValue(update.nickname);
    });

    return res({
      status: 'success',
      eventId: eventId,
      tournamentId: tournamentId,
      created: created,
      updated: updated,
      alreadyMapped: alreadyMapped,
      mapped: mapped,
      warnings: warnings
    });
  } catch (err) {
    console.error('repairTournamentParticipantMapping error: ' + err.message);
    return res({ status: 'error', message: 'Gagal repair mapping: ' + err.message });
  }
}

function parseWaktuString(waktu) {
  if (!waktu || typeof waktu !== 'string') {
    return { tanggal_event: '', waktu_event: '' };
  }

  const trimmed = waktu.trim();
  const zonaMatch = trimmed.match(/\b(WIB|WITA|WIT)\b/i);
  const zona = zonaMatch ? zonaMatch[1].toUpperCase() : '';

  const timeMatch = trimmed.match(/(\d{1,2}:\d{2})\s*(?:([AP]M)?\s*)?/i);
  let waktu_event = '';
  if (timeMatch) {
    let hours = Number(timeMatch[1].split(':')[0]);
    const minutes = timeMatch[1].split(':')[1];
    if (timeMatch[2] && timeMatch[2].toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (timeMatch[2] && timeMatch[2].toUpperCase() === 'AM' && hours === 12) hours = 0;
    waktu_event = String(hours).padStart(2, '0') + ':' + minutes + (zona ? ' ' + zona : '');
  }

  const bulanMap = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
  };

  const dateMatch = trimmed.match(/(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i);
  let tanggal_event = '';
  if (dateMatch && bulanMap[dateMatch[2].toLowerCase()]) {
    const day = String(dateMatch[1]).padStart(2, '0');
    const month = bulanMap[dateMatch[2].toLowerCase()];
    const year = dateMatch[3];
    tanggal_event = year + '-' + month + '-' + day;
  }

  return { tanggal_event, waktu_event };
}

function generateEventId() {
  const sheet = SS.getSheetByName("Events");
  if (!sheet) return "E1";
  const rows = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const raw = String(rows[i][0] || '');
    const match = raw.match(/^E(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return "E" + (maxNum + 1);
}

function migrateEventsToNewSchema() {
  const sheet = SS.getSheetByName("Events");
  if (!sheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return res({ status: 'error', message: 'Sheet Events kosong' });

  const oldHeaders = data[0];
  const oldRows = data.slice(1);

  if (oldHeaders.length < 10) {
    return res({ status: 'error', message: 'Header Events tidak sesuai ekspektasi (min 10 kolom)' });
  }

  const newHeaders = [
    'event_id', 'nama', 'tanggal_buat', 'lokasi', 'status',
    'challonge_id', 'challonge_url', 'challonge_state', 'created_at',
    'tanggal_event', 'waktu_event', 'rule_id', 'tournament_status'
  ];

  const newRows = [];
  let warnings = 0;
  let errors = 0;
  const warningsList = [];
  const seenIds = {};

  for (let i = 0; i < oldRows.length; i++) {
    const oldRow = oldRows[i];
    const eventId = String(oldRow[0] || '').trim();

    if (!eventId) {
      errors++;
      warningsList.push('Row ' + (i + 2) + ': event_id kosong');
      continue;
    }

    if (seenIds[eventId]) {
      errors++;
      warningsList.push('Duplicate event_id: ' + eventId);
    }
    seenIds[eventId] = true;

    const nama = String(oldRow[1] || '').trim();
    const tanggal_buat = oldRow[2];
    const lokasi = String(oldRow[3] || '').trim();
    const status = String(oldRow[4] || '').toLowerCase().trim();
    const challonge_id = String(oldRow[5] || '').trim();
    const challonge_url = String(oldRow[6] || '').trim();
    const challonge_state = String(oldRow[7] || '').trim();
    const created_at = String(oldRow[8] || '').trim();
    const waktu = String(oldRow[9] || '').trim();

    const parsed = parseWaktuString(waktu);

    let tanggal_event = parsed.tanggal_event;
    let waktu_event = parsed.waktu_event;

    if (!tanggal_event && waktu) {
      warnings++;
      warningsList.push('Row ' + (i + 2) + ' (' + eventId + '): gagal parse waktu "' + waktu + '"');
    }

    newRows.push([
      eventId,
      nama,
      tanggal_buat,
      lokasi,
      status,
      challonge_id,
      challonge_url,
      challonge_state,
      created_at,
      tanggal_event,
      waktu_event,
      ruleId || '',
      'not_started'
    ]);
  }

  if (errors > 0) {
    return res({
      status: 'error',
      message: 'Migration dihentikan karena ada error',
      errors: errors,
      warningsList: warningsList
    });
  }

  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);

  if (oldHeaders.length > 12) {
    sheet.getRange(2, 13, oldRows.length, oldHeaders.length - 12).clearContent();
  }

  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, newHeaders.length).setValues(newRows);
  }

  return res({
    status: 'success',
    message: 'Migration completed',
    migrated: oldRows.length,
    success: newRows.length,
    warnings: warnings,
    errors: errors,
    warningsList: warningsList
  });
}

function backupEventAndSettings() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName("Events");
    const settingsSheet = ss.getSheetByName("Settings");

    if (!eventSheet || !settingsSheet) {
      return res({ status: 'error', message: 'Sheet Events atau Settings tidak ditemukan' });
    }

    const timestamp = new Date();
    const timeStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');

    const backupEventName = 'Events_backup_' + timeStr;
    const backupSettingsName = 'Settings_backup_' + timeStr;

    eventSheet.copyTo(ss).setName(backupEventName);
    settingsSheet.copyTo(ss).setName(backupSettingsName);

    return res({
      status: 'success',
      message: 'Backup berhasil',
      backupEventSheet: backupEventName,
      backupSettingsSheet: backupSettingsName
    });
  } catch (err) {
    return res({ status: 'error', message: 'Gagal backup: ' + err.message });
  }
}

function doGet(e) {
  e = e || {};
  e.parameter = e.parameter || {};
  const path = e.parameter.path;
  const googleId = e.parameter.googleId;
  const nickname = e.parameter.nickname;

  try {
    switch (path) {
      case 'test': return res({ status: 'ok', message: 'GAS connected' });
      case 'getBlader': return getBlader(googleId);
      case 'getBladers': return getBladers();
      case 'checkNickname': return checkNickname(nickname);
      case 'getEvent': return res(fetchActiveEvent());
      case 'getEvents': return getEvents();
      case 'getEventDetail': return getEventDetail(e.parameter.eventId);
      case 'getSettings': return getSettings();
      case 'getRule': return getRule();
      case 'getRules': return getRules();
      case 'getRuleById': return getRuleById(e.parameter.ruleId);
      case 'migrateEventsToNewSchema': return migrateEventsToNewSchema();
      case 'getLeaderboard': return getLeaderboard();
      case 'getOpenMatches': return getOpenMatches(e.parameter.tournament_url);
      case 'getActiveEvent': return getActiveEvent();
      case 'findTournamentResultSheet': return res(findTournamentResultSheet(e.parameter.eventId));
      case 'checkTournamentSyncStatus': return res(checkTournamentSyncStatus(e.parameter.eventId));
      default: return res({ error: "Endpoint GET tidak ditemukan: " + path });
    }
  } catch (err) {
    return res({ error: "GAS doGet error: " + err.toString() });
  }
}

function doPost(e) {
  const path = e.parameter.path;
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (f) {
    return res({ error: "Format JSON tidak valid" });
  }

  try {
    switch (path) {
      case 'createProfile': return createProfile(data);
      case 'updateNickname': return updateNickname(data);
      case 'attendance': return postAttendance(data);
      case 'createEvent': return createEvent(data);
      case 'resetArena': return resetArena();
      case 'startEvent': return startEvent(data);
      case 'endEvent': return endEvent(data);
      case 'updateEvent': return updateEvent(data);
      case 'cancelAttendance': return cancelAttendance(data);
      case 'generateTournament': return generateTournament(data);
      case 'updateBio': return updateBio(data);
      case 'uploadProfilePhoto': return uploadProfilePhoto(data);
      case 'updatePoints': return updatePoints(data);
      case 'toggleNicknameSetting': return toggleNicknameSetting();
      case 'saveRule': return saveRule(data);
      case 'submitMatchScore': return submitMatchScore(data);
      case 'startTournament': return startTournament(data);
      case 'startTournamentStatus': return startTournamentStatus(data);
      case 'finishTournamentStatus': return finishTournamentStatus(data);
      case 'randomizeParticipants': return randomizeParticipants(data);
      case 'updateSwissRounds': return updateSwissRounds(data);
      case 'createTournament': return createTournament(data);
      case 'finishTournament': return finishTournament(data);
      case 'exportStandings': return exportStandings(data);
      case 'getBladerProfile': return getBladerProfile(data);
      case 'repairTournamentParticipantMapping': return repairTournamentParticipantMapping(data);
      case 'previewTournamentResultsToLeaderboard': return previewTournamentResultsToLeaderboard(data);
      case 'applyTournamentResultsToLeaderboard': return applyTournamentResultsToLeaderboard(data);
      case 'rolloverLeaderboard': return rolloverLeaderboard();
      case 'repairLeaderboardAfterFirstSync': return repairLeaderboardAfterFirstSync();
      case 'repairExcludedLeaderboardPlayer': return repairExcludedLeaderboardPlayer(data);
      case 'manualSync': return handleManualSync(data);
      case 'backupEventAndSettings': return backupEventAndSettings();
      case 'migratePublicProfileIds': return ensurePublicProfileId(SS.getSheetByName("Players"));
      case 'getBeybladeParts': return getBeybladeParts();
      case 'getMyDecks': return getMyDecks(data);
      case 'createDeck': return createDeck(data);
      case 'updateDeck': return updateDeck(data);
      case 'deleteDeck': return deleteDeck(data);
      case 'toggleDeckActive': return toggleDeckActive(data);
      case 'migrateLegacyDeckPartIds': return migrateLegacyDeckPartIds();
      case 'fixLegacyDeckRow': return fixLegacyDeckRow(data && data.deckId ? data.deckId : '');
      case 'getBladerDeckSets': return getBladerDeckSets(data);
      case 'createBladerDeckSet': return createBladerDeckSet(data);
      default: return res({ error: "Endpoint POST tidak ditemukan" });
    }
  } catch (err) {
    return res({ error: err.toString() });
  }
}

// --- FUNGSI CORE ---

function fetchActiveEvent() {
  const sheet = SS.getSheetByName("Events");
  if (!sheet) return { error: "Sheet Events tidak ditemukan" };

  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length < 2) return { event: null, participants: [], count: 0 };

  const headers = rows[0];
  const map = {};
  headers.forEach((h, i) => {
    map[String(h).toLowerCase().trim()] = i;
  });

  const statusIdx = map['status'];
  const idIdx = map['event_id'] !== undefined ? map['event_id'] : map['id'];
  const namaIdx = map['nama'];
  const lokasiIdx = map['lokasi'];
  const urlIdx = map['challonge_url'] !== undefined ? map['challonge_url'] : map['challongeurl'];
  const waktuIdx = map['waktu_event'] !== undefined ? map['waktu_event'] : (map['waktu'] !== undefined ? map['waktu'] : -1);
  const tanggalIdx = map['tanggal_event'];
  const ruleIdIdx = map['rule_id'];
  const tournamentStatusIdx = map['tournament_status'];

  const activeEvent = rows.slice(1).find(row => {
    const status = String(row[statusIdx] || '').toLowerCase().trim();
    return status === 'aktif';
  });

  if (!activeEvent) {
    return { event: null, participants: [], count: 0 };
  }

  const attendanceSheet = SS.getSheetByName("Attendance");
  const attendanceRows = attendanceSheet.getDataRange().getValues();
  attendanceRows.shift();

  const eventId = activeEvent[idIdx] || '';
  const participants = attendanceRows
    .filter(row => String(row[1] || '').trim() === String(eventId).trim())
    .map(row => ({
      googleId: row[2],
      nama: row[3],
      foto: row[5],
      email: row[4]
    }));

  const challongeUrl = urlIdx >= 0 ? String(activeEvent[urlIdx] || '').trim() : '';
  const waktu = waktuIdx >= 0 ? String(activeEvent[waktuIdx] || '').trim() : '20.00 WIB';
  const tanggalEvent = tanggalIdx !== undefined ? String(activeEvent[tanggalIdx] || '').trim() : '';
  const ruleId = ruleIdIdx >= 0 ? String(activeEvent[ruleIdIdx] || '').trim() : '';
  const tournamentStatus = tournamentStatusIdx !== undefined ? String(activeEvent[tournamentStatusIdx] || '').toLowerCase().trim() : 'not_started';

  Logger.log('[fetchActiveEvent] eventId=' + eventId + ' status=' + String(activeEvent[statusIdx] || '').toLowerCase().trim() + ' tournament_status=' + tournamentStatus);

  return {
    event: {
      event_id: eventId,
      id: eventId,
      nama: String(activeEvent[namaIdx] || ''),
      lokasi: String(activeEvent[lokasiIdx] || ''),
      challongeUrl: challongeUrl,
      challonge_url: challongeUrl,
      waktu: waktu,
      waktu_event: waktu,
      tanggal_event: tanggalEvent,
      tanggal_buat: String(activeEvent[map['tanggal_buat']] || ''),
      status: String(activeEvent[statusIdx] || '').toLowerCase().trim(),
      rule_id: ruleId,
      tournament_status: tournamentStatus
    },
    participants: participants,
    count: participants.length
  };
}

function getEventDetail(eventId) {
  const eventSheet = SS.getSheetByName("Events");
  if (!eventSheet) return res({ error: "Sheet Events tidak ditemukan" });

  const values = eventSheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1);

  if (rows.length === 0) {
    return res({ event: null, rule: null, participants: [], count: 0, results: [] });
  }

  const map = getHeaderMap(eventSheet);
  const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];

  if (eventIdCol === undefined) {
    return res({ error: "Header event_id/id tidak ditemukan di Events" });
  }

  const targetRow = rows.find(r =>
    String(r[eventIdCol] || '').trim() === String(eventId || '').trim()
  );

  if (!targetRow) {
    return res({ event: null, rule: null, participants: [], count: 0, results: [] });
  }

  const id = String(targetRow[eventIdCol] || '').trim();
  const nama = String(targetRow[map['nama']] || '').trim();
  const lokasi = String(targetRow[map['lokasi']] || '').trim();
  const status = String(targetRow[map['status']] || '').toLowerCase().trim();
  const challongeId = map['challonge_id'] !== undefined ? String(targetRow[map['challonge_id']] || '').trim() : '';
  const challongeUrl = map['challonge_url'] !== undefined ? String(targetRow[map['challonge_url']] || '').trim() : '';
  const challongeState = map['challonge_state'] !== undefined ? String(targetRow[map['challonge_state']] || '').trim() : '';
  const createdAt = map['created_at'] !== undefined ? String(targetRow[map['created_at']] || '').trim() : '';
  const tanggalBuat = map['tanggal_buat'] !== undefined ? String(targetRow[map['tanggal_buat']] || '').trim() : (map['tanggal'] !== undefined ? String(targetRow[map['tanggal']] || '').trim() : '');
  const tanggalEvent = map['tanggal_event'] !== undefined ? String(targetRow[map['tanggal_event']] || '').trim() : '';
  const waktuEvent = map['waktu_event'] !== undefined ? String(targetRow[map['waktu_event']] || '').trim() : (map['waktu'] !== undefined ? String(targetRow[map['waktu']] || '').trim() : '');
  const ruleId = map['rule_id'] !== undefined ? String(targetRow[map['rule_id']] || '').trim() : '';
  const tournamentStatus = map['tournament_status'] !== undefined ? String(targetRow[map['tournament_status']] || '').toLowerCase().trim() : 'not_started';

  Logger.log('[getEventDetail] eventId=' + id + ' status=' + status + ' tournament_status=' + tournamentStatus);

  const event = {
    event_id: id,
    id: id,
    nama: nama,
    lokasi: lokasi,
    status: status,
    challonge_id: challongeId,
    challonge_url: challongeUrl,
    challongeUrl: challongeUrl,
    challonge_state: challongeState,
    created_at: createdAt,
    tanggal_buat: tanggalBuat,
    tanggal_event: tanggalEvent,
    waktu_event: waktuEvent,
    waktu: waktuEvent || '',
    rule_id: ruleId,
    tournament_status: tournamentStatus
  };

  let rule = null;
  const eventRuleId = String(event.rule_id || '').trim();
  if (eventRuleId) {
    const ruleSheet = SS.getSheetByName("Rules");
    if (ruleSheet) {
      const ruleValues = ruleSheet.getDataRange().getDisplayValues();
      if (ruleValues.length >= 2) {
        const ruleHeaders = ruleValues[0];
        const ruleRows = ruleValues.slice(1);
        const ruleMap = {};
        ruleHeaders.forEach((h, i) => {
          ruleMap[String(h).toLowerCase().trim()] = i;
        });
        const targetRule = ruleRows.find(row => String(row[ruleMap['rule_id']] || '').toLowerCase() === eventRuleId.toLowerCase());
        if (targetRule) {
          rule = {
            rule_id: String(targetRule[ruleMap['rule_id']] || ''),
            nama: String(targetRule[ruleMap['nama']] || ''),
            periode: String(targetRule[ruleMap['periode']] || ''),
            title: String(targetRule[ruleMap['title']] || ''),
            image_url: String(targetRule[ruleMap['image_url']] || ''),
            warning: String(targetRule[ruleMap['warning']] || ''),
            details: String(targetRule[ruleMap['details']] || ''),
            status: String(targetRule[ruleMap['status']] || '').toLowerCase().trim()
          };
        }
      }
    }
  }

  const attendanceSheet = SS.getSheetByName("Attendance");
  let participants = [];
  if (attendanceSheet) {
    const attendanceRows = attendanceSheet.getDataRange().getValues();
    attendanceRows.shift();
    participants = attendanceRows
      .filter(row => String(row[1] || '').trim() === String(eventId || '').trim())
      .map(row => ({
        googleId: String(row[2] || ''),
        nama: String(row[3] || ''),
        email: String(row[4] || ''),
        foto: String(row[5] || '')
      }));
  }

  let results = [];
  const sheetName = event.nama.trim();
  const resultSheet = SS.getSheetByName(sheetName);
  if (resultSheet) {
    const resultValues = resultSheet.getDataRange().getDisplayValues();
    if (resultValues.length >= 3) {
      const resultHeaders = resultValues[1];
      const resultMap = {};
      resultHeaders.forEach((h, i) => {
        resultMap[String(h).toLowerCase().trim()] = i;
      });

      if (resultMap['nama'] === undefined) {
        console.error('getEventDetail: header Nama tidak ditemukan di sheet ' + sheetName + ' headers=' + JSON.stringify(resultMap));
      } else {
        const isNewFormat = resultMap['google_id'] !== undefined || resultMap['google id'] !== undefined;
        const rankIdx = resultMap['rank'];
        const pointIdx = resultMap['point'];
        const namaIdx = resultMap['nama'];
        const winLossIdx = resultMap['win - lose'] !== undefined ? resultMap['win - lose'] : resultMap['win-lose'];
        const totalWinIdx = resultMap['total win'] !== undefined ? resultMap['total win'] : resultMap['totalwin'];
        const pointFinishIdx = resultMap['point finish'] !== undefined ? resultMap['point finish'] : resultMap['pointfinish'];
        const optionalPointIdx = resultMap['optional points'] !== undefined ? resultMap['optional points'] : resultMap['optionalpoint'];

        if (rankIdx !== undefined && pointIdx !== undefined && namaIdx !== undefined) {
          results = resultValues.slice(2).map(row => ({
            rank: String(row[rankIdx] || ''),
            point: String(row[pointIdx] || ''),
            nama: String(row[namaIdx] || ''),
            winLoss: winLossIdx !== undefined ? String(row[winLossIdx] || '') : '',
            totalWin: totalWinIdx !== undefined ? String(row[totalWinIdx] || '') : '',
            pointFinish: pointFinishIdx !== undefined ? String(row[pointFinishIdx] || '') : '',
            optionalPoint: optionalPointIdx !== undefined ? String(row[optionalPointIdx] || '') : ''
          }));
        }
      }
    }
  }

  return res({
    event,
    rule,
    participants,
    count: participants.length,
    results
  });
}

function getEvents() {
  const eventSheet = SS.getSheetByName("Events");
  if (!eventSheet) return res({ status: 'error', events: [] });

  const values = eventSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return res({ status: 'success', events: [] });

  const headers = values[0];
  const rows = values.slice(1);
  const map = getHeaderMap(eventSheet);

  const events = rows.map(row => {
    const id = map['event_id'] !== undefined ? map['event_id'] : map['id'];
    const nama = map['nama'];
    const lokasi = map['lokasi'];
    const status = map['status'];
    const challongeId = map['challonge_id'] !== undefined ? map['challonge_id'] : map['challongeid'];
    const challongeUrl = map['challonge_url'] !== undefined ? map['challonge_url'] : map['challongeurl'];
    const challongeState = map['challonge_state'] !== undefined ? map['challonge_state'] : map['challongestate'];
    const createdAt = map['created_at'];
    const tanggalBuat = map['tanggal_buat'] !== undefined ? map['tanggal_buat'] : map['tanggal'];
    const tanggalEvent = map['tanggal_event'];
    const waktuEvent = map['waktu_event'] !== undefined ? map['waktu_event'] : map['waktu'];
    const ruleId = map['rule_id'];
    const tournamentStatus = map['tournament_status'];

    const challongeUrlVal = challongeUrl !== undefined ? String(row[challongeUrl] || '').trim() : '';
    const waktuEventVal = waktuEvent !== undefined ? String(row[waktuEvent] || '').trim() : '';
    const tanggalEventVal = tanggalEvent !== undefined ? String(row[tanggalEvent] || '').trim() : '';
    const tournamentStatusVal = tournamentStatus !== undefined ? String(row[tournamentStatus] || '').toLowerCase().trim() : 'not_started';

    return {
      event_id: String(row[id] || '').trim(),
      id: String(row[id] || '').trim(),
      nama: String(row[nama] || '').trim(),
      lokasi: String(row[lokasi] || '').trim(),
      status: String(row[status] || '').toLowerCase().trim(),
      challonge_id: challongeId !== undefined ? String(row[challongeId] || '').trim() : '',
      challonge_url: challongeUrlVal,
      challongeUrl: challongeUrlVal,
      challonge_state: challongeState !== undefined ? String(row[challongeState] || '').trim() : '',
      created_at: createdAt !== undefined ? String(row[createdAt] || '').trim() : '',
      tanggal_buat: tanggalBuat !== undefined ? String(row[tanggalBuat] || '').trim() : '',
      tanggal_event: tanggalEventVal,
      waktu_event: waktuEventVal,
      waktu: waktuEventVal,
      rule_id: ruleId !== undefined ? String(row[ruleId] || '').trim() : '',
      tournament_status: tournamentStatusVal
    };
  });

  Logger.log('[getEvents] sample=' + JSON.stringify(events.slice(0, 3)));

  const statusOrder = { 'aktif': 0, 'selesai': 1, 'draft': 2, 'upcoming': 3 };
  events.sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 99;
    const orderB = statusOrder[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    const dateA = a.tanggal_event || a.tanggal_buat || '';
    const dateB = b.tanggal_event || b.tanggal_buat || '';
    if (dateA && dateB) return dateB.localeCompare(dateA);
    if (dateA) return -1;
    if (dateB) return 1;
    return b.event_id.localeCompare(a.event_id);
  });

  return res({ status: 'success', events });
}

function buildTournamentResultSheetIndex() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const index = {};
  const skipSheets = ['Events', 'Players', 'Attendance', 'Leaderboard', 'Rules', 'Settings', 'TEMPLATE', 'TournamentParticipants', 'TournamentLeaderboardSync'];

  for (const sheet of sheets) {
    const sheetName = sheet.getName();
    if (skipSheets.indexOf(sheetName) >= 0) continue;

    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 3) continue;

    const row1 = values[0];
    const row2 = values[1];
    const row2Headers = row2.map(h => String(h || '').toLowerCase().trim());

    const hasKlasemen = row1.some(cell => String(cell || '').toLowerCase().trim() === 'klasemen');
    const hasRank = row2Headers.indexOf('rank') >= 0;
    const hasPoint = row2Headers.indexOf('point') >= 0;
    const hasNama = row2Headers.indexOf('nama') >= 0;

    if (!hasKlasemen || !hasRank || !hasPoint || !hasNama) continue;

    const eventIdCol = row2Headers.indexOf('event id');
    if (eventIdCol < 0) continue;

    for (let i = 2; i < values.length; i++) {
      const rowEventId = String(values[i][eventIdCol] || '').trim();
      if (rowEventId) {
        index[rowEventId] = sheetName;
      }
    }
  }

  return index;
}

function getTournamentResultSheetIndex() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'tournamentResultSheetIndex';
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // fallback to rebuild
    }
  }

  const index = buildTournamentResultSheetIndex();
  try {
    cache.put(cacheKey, JSON.stringify(index), 300);
  } catch (e) {
    // cache full or unavailable, continue without cache
  }
  return index;
}

function invalidateTournamentResultSheetIndex() {
  try {
    CacheService.getScriptCache().remove('tournamentResultSheetIndex');
  } catch (e) {
    // ignore
  }
}

function findTournamentResultSheet(eventId) {
  const index = getTournamentResultSheetIndex();
  if (index[eventId]) {
    return index[eventId];
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  let eventName = '';
  try {
    const eventSheet = SS.getSheetByName("Events");
    if (eventSheet) {
      const eventValues = eventSheet.getDataRange().getDisplayValues();
      const eventHeaders = eventValues[0];
      const eventRows = eventValues.slice(1);
      const eventMap = {};
      eventHeaders.forEach((h, i) => {
        eventMap[String(h).toLowerCase().trim()] = i;
      });
      const eventIdCol = eventMap['event_id'] !== undefined ? eventMap['event_id'] : eventMap['id'];
      const namaCol = eventMap['nama'];
      if (eventIdCol !== undefined && namaCol !== undefined) {
        for (let i = 0; i < eventRows.length; i++) {
          if (String(eventRows[i][eventIdCol] || '').trim() === eventId) {
            eventName = String(eventRows[i][namaCol] || '').trim();
            break;
          }
        }
      }
    }
  } catch (e) {
    console.error('Gagal baca event name untuk findTournamentResultSheet: ' + e.message);
  }

  const skipSheets = ['Events', 'Players', 'Attendance', 'Leaderboard', 'Rules', 'Settings', 'TEMPLATE', 'TournamentParticipants', 'TournamentLeaderboardSync'];

  for (const sheet of sheets) {
    const sheetName = sheet.getName();
    if (skipSheets.indexOf(sheetName) >= 0) continue;

    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 3) continue;

    const row1 = values[0];
    const row2 = values[1];
    const row2Headers = row2.map(h => String(h || '').toLowerCase().trim());

    const hasKlasemen = row1.some(cell => String(cell || '').toLowerCase().trim() === 'klasemen');
    const hasRank = row2Headers.indexOf('rank') >= 0;
    const hasPoint = row2Headers.indexOf('point') >= 0;
    const hasNama = row2Headers.indexOf('nama') >= 0;

    if (!hasKlasemen || !hasRank || !hasPoint || !hasNama) continue;

    const eventIdCol = row2Headers.indexOf('event id');

    if (eventIdCol >= 0) {
      for (let i = 2; i < values.length; i++) {
        const rowEventId = String(values[i][eventIdCol] || '').trim();
        if (rowEventId === eventId) {
          return sheetName;
        }
      }
    } else if (eventName && sheetName === eventName) {
      return sheetName;
    }
  }

  return null;
}

function getBlader(googleId) {
  const playerSheet = SS.getSheetByName("Players");
  const adminSheet = SS.getSheetByName("Admins");

  if (!playerSheet) return res({ registered: false });

  const playerValues = playerSheet.getDataRange().getDisplayValues();
  if (playerValues.length < 2) return res({ registered: false });

  const playerHeaders = playerValues[0];
  const playerRows = playerValues.slice(1);

  const playerMap = {};
  playerHeaders.forEach((h, i) => {
    playerMap[String(h).toLowerCase().trim()] = i;
  });

  const googleIdCol = playerMap['google_id'] !== undefined ? playerMap['google_id'] : playerMap['googleid'];
  const emailCol = playerMap['email'];
  const nicknameCol = playerMap['nickname'];
  const photoCol = playerMap['photo_url'] !== undefined ? playerMap['photo_url'] : (playerMap['foto'] !== undefined ? playerMap['foto'] : playerMap['photo']);
  const sloganCol = playerMap['slogan'];
  const catatanCol = playerMap['catatan'];
  const ostCol = playerMap['ost_url'];

  const normalizeId = (value) => String(value ?? '').trim();

  const targetGoogleId = normalizeId(googleId);
  const matchedRow = playerRows.find(row => {
    if (googleIdCol !== undefined) {
      const rowId = normalizeId(row[googleIdCol]);
      if (rowId && rowId === targetGoogleId) {
        return true;
      }
    }
    return false;
  });

  let matchedBy = 'none';
  let player = null;

  if (matchedRow) {
    player = matchedRow;
    matchedBy = 'google_id';
  } else {
    const email = String(googleId || '');
    const emailMatch = playerRows.find(row => {
      if (emailCol === undefined) return false;
      const rowEmail = normalizeId(row[emailCol]);
      return rowEmail && rowEmail.toLowerCase() === email.toLowerCase();
    });
    if (emailMatch) {
      player = emailMatch;
      matchedBy = 'email';
    }
  }

  Logger.log('[getBlader] googleId=' + targetGoogleId + ' matchedBy=' + matchedBy);

  if (!player) return res({ registered: false });

  const admins = adminSheet ? adminSheet.getDataRange().getDisplayValues().flat().map(a => a.toString().toLowerCase()) : [];
  const userEmail = emailCol !== undefined ? normalizeId(player[emailCol]) : '';
  const isAdmin = admins.some(a => a && a === userEmail.toLowerCase());

  return res({
    registered: true,
    googleId: googleIdCol !== undefined ? normalizeId(player[googleIdCol]) : targetGoogleId,
    email: emailCol !== undefined ? normalizeId(player[emailCol]) : '',
    nickname: nicknameCol !== undefined ? String(player[nicknameCol] || '') : '',
    role: isAdmin ? "Admin" : "Blader",
    photo: photoCol !== undefined ? String(player[photoCol] || '') : '',
    photoUrl: photoCol !== undefined ? String(player[photoCol] || '') : '',
    slogan: sloganCol !== undefined ? String(player[sloganCol] || '') : '',
    catatan: catatanCol !== undefined ? String(player[catatanCol] || '') : '',
    ost_url: ostCol !== undefined ? String(player[ostCol] || '') : ''
  });
}

function cancelAttendance(data) {
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const eventSheet = SS.getSheetByName("Events");
  if (!eventSheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

  const eventValues = eventSheet.getDataRange().getDisplayValues();
  const eventHeaders = eventValues[0];
  const eventRows = eventValues.slice(1);
  const eventMap = {};
  eventHeaders.forEach((h, i) => {
    eventMap[String(h).toLowerCase().trim()] = i;
  });

  const eventIdCol = eventMap['event_id'] !== undefined ? eventMap['event_id'] : eventMap['id'];
  const statusCol = eventMap['status'];
  const tournamentStatusCol = eventMap['tournament_status'];

  const targetEvent = eventRows.find(r =>
    String(r[eventIdCol] || '').trim() === eventId
  );

  if (!targetEvent) {
    return res({ status: 'error', message: 'Event tidak ditemukan' });
  }

  const eventStatus = String(targetEvent[statusCol] || '').toLowerCase().trim();
  if (eventStatus !== 'aktif') {
    return res({ status: 'error', message: 'Pembatalan absensi hanya bisa dilakukan saat event sedang aktif.' });
  }

  const tournamentStatus = tournamentStatusCol !== undefined
    ? String(targetEvent[tournamentStatusCol] || '').toLowerCase().trim()
    : 'not_started';

  if (tournamentStatus === 'running' || tournamentStatus === 'finished') {
    return res({ status: 'error', message: 'Attendance sudah ditutup karena tournament sudah dimulai.' });
  }

  const sheet = SS.getSheetByName("Attendance");
  const rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1].toString() === eventId &&
      rows[i][2].toString() === data.googleId.toString()) {

      sheet.deleteRow(i + 1);
      return res({ status: "success", message: "Kehadiran dibatalkan" });
    }
  }

  return res({ status: "error", message: "Data tidak ditemukan" });
}

function getLeaderboard() {
  try {
    const playerSheet = SS.getSheetByName("Players");
    const boardSheet = SS.getSheetByName("Leaderboard");

    if (!playerSheet || !boardSheet) return res([]);

    const boardValues = boardSheet.getDataRange().getDisplayValues();
    if (boardValues.length < 2) return res([]);

    const boardHeaders = boardValues[0];
    const boardRows = boardValues.slice(1);
    const boardMap = {};
    boardHeaders.forEach((h, i) => {
      boardMap[String(h).toLowerCase().trim()] = i;
    });

    const idCol = boardMap['google_id'] !== undefined ? boardMap['google_id'] : boardMap['googleid'];
    const statusCol = boardMap['status'];
    const pointCol = boardMap['point'];
    const pointFinishCol = boardMap['point_finish'] !== undefined ? boardMap['point_finish'] : boardMap['pointfinish'];
    const prevRankCol = boardMap['previous_rank'];

    const entries = [];
    boardRows.forEach(row => {
      const gId = idCol !== undefined ? String(row[idCol] || '').trim() : '';
      if (!gId) return;
      entries.push({
        googleId: gId,
        status: statusCol !== undefined ? String(row[statusCol] || '').trim() : 'stay',
        point: pointCol !== undefined ? Number(row[pointCol]) || 0 : 0,
        pointFinish: pointFinishCol !== undefined ? Number(row[pointFinishCol]) || 0 : 0,
        previousRank: prevRankCol !== undefined ? (String(row[prevRankCol] || '').trim() ? Number(row[prevRankCol]) : null) : null
      });
    });

    entries.sort((a, b) => {
      if (b.point !== a.point) return b.point - a.point;
      return b.pointFinish - a.pointFinish;
    });

    const players = playerSheet.getDataRange().getValues();
    const playerMap = {};
    players.forEach(row => {
      playerMap[row[0].toString()] = {
        nickname: row[3],
        foto: row[4],
        slogan: row[8] ? String(row[8]) : "",
        catatan: row[9] ? String(row[9]) : ""
      };
    });

    const finalData = entries.map((entry, index) => {
      const currentRank = index + 1;
      const pInfo = playerMap[entry.googleId] || { nickname: "Unknown Blader", foto: "", slogan: "", catatan: "" };
      let status = String(entry.status || '').toLowerCase().trim();
      // Leaderboard sheet 'status' is the source of truth.
      // Only derive it when the cell is empty for backward compatibility.
      if (!status) {
        if (entry.previousRank === null || entry.previousRank === undefined || String(entry.previousRank) === '') {
          status = 'new';
        } else if (entry.previousRank > currentRank) {
          status = 'up';
        } else if (entry.previousRank < currentRank) {
          status = 'down';
        } else {
          status = 'stay';
        }
      }

      return {
        googleId: entry.googleId,
        status: status,
        previousRank: entry.previousRank,
        rank: currentRank,
        point: entry.point,
        pointFinish: entry.pointFinish,
        name: pInfo.nickname,
        foto: pInfo.foto,
        slogan: pInfo.slogan,
        catatan: pInfo.catatan
      };
    });

    return res(finalData);
  } catch (err) {
    console.error('getLeaderboard error: ' + err.message);
    return res([]);
  }
}

function generateShortId() {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getCurrentUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return null;

    const playerSheet = SS.getSheetByName('Players');
    if (!playerSheet) return null;

    const values = playerSheet.getDataRange().getDisplayValues();
    if (values.length < 2) return null;

    const headers = values[0];
    const rows = values.slice(1);
    const headerMap = {};
    headers.forEach((h, i) => {
      headerMap[String(h).toLowerCase().trim()] = i;
    });

    const emailCol = headerMap['email'];
    const googleIdCol = headerMap['google_id'] !== undefined ? headerMap['google_id'] : headerMap['googleid'];
    const nicknameCol = headerMap['nickname'];

    if (emailCol === undefined) return null;

    const matchedRow = rows.find(row => {
      const rowEmail = String(row[emailCol] || '').trim().toLowerCase();
      return rowEmail === email.toLowerCase();
    });

    if (!matchedRow) return null;

    return {
      email: email,
      googleId: googleIdCol !== undefined ? String(matchedRow[googleIdCol] || '').trim() : '',
      nickname: nicknameCol !== undefined ? String(matchedRow[nicknameCol] || '') : ''
    };
  } catch (e) {
    return null;
  }
}

function generateShortDeckId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getBeybladeParts() {
  const partSheet = SS.getSheetByName('BeybladeParts');
  if (!partSheet) return res({ status: 'success', parts: [] });

  const values = partSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return res({ status: 'success', parts: [] });

  const headers = values[0];
  const rows = values.slice(1);
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const partIdCol = headerMap['part_id'];
  const systemCol = headerMap['system'];
  const partTypeCol = headerMap['part_type'];
  const nameCol = headerMap['name'];
  const isActiveCol = headerMap['is_active'];

  const parts = rows.map(row => {
    const partId = partIdCol !== undefined ? String(row[partIdCol] || '').trim() : '';
    const system = systemCol !== undefined ? String(row[systemCol] || '').trim() : '';
    const partType = partTypeCol !== undefined ? String(row[partTypeCol] || '').trim() : '';
    const name = nameCol !== undefined ? String(row[nameCol] || '').trim() : '';
    const isActive = isActiveCol !== undefined ? String(row[isActiveCol] || '').toLowerCase().trim() === 'true' : true;

    return {
      partId,
      system,
      partType,
      name,
      isActive
    };
  }).filter(p => p.partId);

  return res({ status: 'success', parts });
}

function getBeybladePartsMap() {
  const partSheet = SS.getSheetByName('BeybladeParts');
  if (!partSheet) return {};

  const values = partSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return {};

  const headers = values[0];
  const rows = values.slice(1);
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const partIdCol = headerMap['part_id'];
  const systemCol = headerMap['system'];
  const partTypeCol = headerMap['part_type'];
  const nameCol = headerMap['name'];
  const isActiveCol = headerMap['is_active'];

  const map = {};
  const seen = {};
  const duplicates = [];
  rows.forEach(row => {
    const partId = partIdCol !== undefined ? String(row[partIdCol] || '').trim() : '';
    if (!partId) return;
    const system = systemCol !== undefined ? String(row[systemCol] || '').trim() : '';
    const partType = partTypeCol !== undefined ? String(row[partTypeCol] || '').trim() : '';
    const name = nameCol !== undefined ? String(row[nameCol] || '').trim() : '';
    const isActive = isActiveCol !== undefined ? String(row[isActiveCol] || '').toLowerCase().trim() === 'true' : true;

    if (seen[partId]) {
      duplicates.push(partId);
    }
    seen[partId] = true;

    map[partId] = {
      partId,
      system,
      partType,
      name,
      isActive
    };
  });

  if (duplicates.length > 0) {
    Logger.log('[BEYBLADE PARTS DUPLICATES]', { duplicates });
  }

  return map;
}

function getMyDecks(data) {
  const auth = resolveDeckOwner(data);
  if (!auth.authorized) return res({ status: 'error', message: auth.error });

  const userGoogleId = auth.googleId;
  const deckSheet = SS.getSheetByName('BladerDecks');
  if (!deckSheet) return res({ status: 'success', decks: [] });

  const values = deckSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return res({ status: 'success', decks: [] });

  const headers = values[0];
  const rows = values.slice(1);
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const deckIdCol = headerMap['deck_id'];
  const googleIdCol = headerMap['google_id'];
  const deckNameCol = headerMap['deck_name'];
  const systemCol = headerMap['system'];
  const lockChipCol = headerMap['lock_chip'];
  const bladeCol = headerMap['blade'];
  const assistBladeCol = headerMap['assist_blade'];
  const ratchetCol = headerMap['ratchet'];
  const bitCol = headerMap['bit'];
  const descriptionCol = headerMap['description'];
  const isActiveCol = headerMap['is_active'];
  const createdAtCol = headerMap['created_at'];
  const updatedAtCol = headerMap['updated_at'];

  const partsMap = getBeybladePartsMap();

  const filter = String(data?.filter || 'active').toLowerCase().trim();

  const decks = [];
  let activeCount = 0;
  let reserveCount = 0;

  rows.forEach(row => {
    const rowGoogleId = googleIdCol !== undefined ? String(row[googleIdCol] || '').trim() : '';
    if (rowGoogleId !== userGoogleId) return;

    const deckId = deckIdCol !== undefined ? String(row[deckIdCol] || '').trim() : '';
    if (!deckId) return;

    const lockChipId = lockChipCol !== undefined ? String(row[lockChipCol] || '').trim() : '';
    const bladeId = bladeCol !== undefined ? String(row[bladeCol] || '').trim() : '';
    const assistBladeId = assistBladeCol !== undefined ? String(row[assistBladeCol] || '').trim() : '';
    const ratchetId = ratchetCol !== undefined ? String(row[ratchetCol] || '').trim() : '';
    const bitId = bitCol !== undefined ? String(row[bitCol] || '').trim() : '';

    const system = systemCol !== undefined ? String(row[systemCol] || '').trim() : '';
    const isBxOrUx = system === 'BX' || system === 'UX';
    const isActive = isActiveCol !== undefined ? String(row[isActiveCol] || '').toLowerCase().trim() === 'true' : true;

    Logger.log('[DECK MATCH]', { deckId, googleId: rowGoogleId, isActive });

    if (isActive) activeCount++;
    else reserveCount++;

    if (filter === 'active' && !isActive) return;
    if (filter === 'reserve' && isActive) return;

    const resolvePart = (partId, partType, expectedSystem) => {
      if (!partId) return null;
      const fromId = partsMap[partId];
      if (fromId) {
        Logger.log('[DECK PART RESOLVE]', { deckId, field: partType, partId, partType, system: expectedSystem, resolvedName: fromId.name });
        return { partId: fromId.partId, name: fromId.name };
      }
      Logger.log('[DECK PART RESOLVE]', { deckId, field: partType, partId, partType, system: expectedSystem, resolvedName: partId });
      Logger.log('[DECK PART IMAGE MISSING]', { deckId, partId, name: partId });
      return { partId, name: partId };
    };

    decks.push({
      deckId,
      deckName: deckNameCol !== undefined ? String(row[deckNameCol] || '').trim() : '',
      system,
      lockChip: (!isBxOrUx && lockChipId) ? resolvePart(lockChipId, 'LOCK_CHIP', 'CX') : null,
      blade: (bladeId) ? resolvePart(bladeId, 'BLADE', system) : null,
      assistBlade: (!isBxOrUx && assistBladeId) ? resolvePart(assistBladeId, 'ASSIST_BLADE', 'CX') : null,
      ratchet: (ratchetId) ? resolvePart(ratchetId, 'RATCHET', system) : null,
      bit: (bitId) ? resolvePart(bitId, 'BIT', system) : null,
      description: descriptionCol !== undefined ? String(row[descriptionCol] || '').trim() : '',
      isActive,
      createdAt: createdAtCol !== undefined ? String(row[createdAtCol] || '').trim() : '',
      updatedAt: updatedAtCol !== undefined ? String(row[updatedAtCol] || '').trim() : ''
    });
  });

  Logger.log('[DECK OWNER RESULT]', {
    matchingDeckCount: decks.length,
    activeCount,
    reserveCount
  });

  Logger.log('[DECK LOAD]', { total: decks.length, active: activeCount, reserve: reserveCount });
  return res({ status: 'success', decks, counts: { active: activeCount, reserve: reserveCount, total: activeCount + reserveCount } });
}

function resolveDeckOwner(data) {
  const googleId = String(data.googleId || '').trim();
  const sessionEmail = '';
  let authenticated = false;

  try {
    const email = Session.getActiveUser().getEmail();
    if (email) {
      sessionEmail = email;
      authenticated = true;
    }
  } catch (e) {
    // Session unavailable
  }

  const authorized = !!googleId;

  Logger.log('[DECK CREATE AUTH]', {
    email: sessionEmail,
    googleId: googleId,
    authenticated,
    authorized
  });

  if (!googleId) {
    return { authorized: false, error: 'Unauthorized: googleId tidak diberikan' };
  }

  const playerSheet = SS.getSheetByName('Players');
  if (!playerSheet) {
    return { authorized: false, error: 'Sheet Players tidak ditemukan' };
  }

  const playerValues = playerSheet.getDataRange().getDisplayValues();
  if (playerValues.length < 2) {
    return { authorized: false, error: 'Data player tidak ditemukan' };
  }

  const playerHeaders = playerValues[0];
  const playerRows = playerValues.slice(1);
  const playerHeaderMap = {};
  playerHeaders.forEach((h, i) => {
    playerHeaderMap[String(h).toLowerCase().trim()] = i;
  });

  const playerGoogleIdCol = playerHeaderMap['google_id'] !== undefined ? playerHeaderMap['google_id'] : playerHeaderMap['googleid'];
  if (playerGoogleIdCol === undefined) {
    return { authorized: false, error: 'Kolom google_id tidak ditemukan di Players' };
  }

  const playerExists = playerRows.some(row => {
    const rowGoogleId = String(row[playerGoogleIdCol] || '').trim();
    return rowGoogleId === googleId;
  });

  Logger.log('[DECK OWNER RESOLUTION]', {
    email: sessionEmail,
    googleId: googleId,
    authenticated,
    playerExists
  });

  if (!playerExists) {
    return { authorized: false, error: 'Unauthorized: Player tidak ditemukan' };
  }

  return { authorized: true, googleId };
}

function createDeck(data) {
  const auth = resolveDeckOwner(data);
  if (!auth.authorized) return res({ status: 'error', message: auth.error });

  const userGoogleId = auth.googleId;
  const deckSheet = SS.getSheetByName('BladerDecks');
  if (!deckSheet) return res({ status: 'error', message: 'Sheet BladerDecks tidak ditemukan' });

  const deckHeaders = deckSheet.getDataRange().getDisplayValues()[0];
  const deckHeaderMap = {};
  deckHeaders.forEach((h, i) => {
    deckHeaderMap[String(h).toLowerCase().trim()] = i;
  });
  const isActiveCol = deckHeaderMap['is_active'];
  const googleIdCol = deckHeaderMap['google_id'];

  const deckName = String(data.deckName || '').trim();
  const system = String(data.system || '').toUpperCase().trim();
  const lockChip = String(data.lockChip || '').trim();
  const blade = String(data.blade || '').trim();
  const assistBlade = String(data.assistBlade || '').trim();
  const ratchet = String(data.ratchet || '').trim();
  const bit = String(data.bit || '').trim();
  const description = String(data.description || '').trim();

  if (!deckName) return res({ status: 'error', message: 'Deck name wajib diisi' });
  if (!['BX', 'UX', 'CX'].includes(system)) return res({ status: 'error', message: 'System harus BX, UX, atau CX' });

  const partsMap = getBeybladePartsMap();

  const validation = validateDeckPartIds(data, partsMap);
  if (!validation.valid) {
    return res({ status: 'error', message: 'Invalid part selection. Expected part_id.' });
  }

  const validatePart = (partId, expectedType, expectedSystems) => {
    const part = partsMap[partId];
    if (!part) return false;
    if (!part.isActive) return false;
    if (expectedType && part.partType !== expectedType) return false;
    if (expectedSystems && !expectedSystems.includes(part.system)) return false;
    return true;
  };

  if (system === 'CX') {
    if (!validatePart(lockChip, 'LOCK_CHIP', ['CX'])) return res({ status: 'error', message: 'Lock Chip tidak valid untuk CX' });
    if (!validatePart(blade, 'BLADE', ['CX'])) return res({ status: 'error', message: 'Blade tidak valid untuk CX' });
    if (!validatePart(assistBlade, 'ASSIST_BLADE', ['CX'])) return res({ status: 'error', message: 'Assist Blade tidak valid untuk CX' });
    if (!validatePart(ratchet, 'RATCHET', ['ALL', 'CX'])) return res({ status: 'error', message: 'Ratchet tidak valid untuk CX' });
    if (!validatePart(bit, 'BIT', ['ALL', 'CX'])) return res({ status: 'error', message: 'Bit tidak valid untuk CX' });
  } else {
    if (!validatePart(blade, 'BLADE', [system])) return res({ status: 'error', message: 'Blade tidak valid untuk ' + system });
    if (!validatePart(ratchet, 'RATCHET', ['ALL', system])) return res({ status: 'error', message: 'Ratchet tidak valid untuk ' + system });
    if (!validatePart(bit, 'BIT', ['ALL', system])) return res({ status: 'error', message: 'Bit tidak valid untuk ' + system });
  }

  const isActive = String(data.isActive || '').toLowerCase().trim() !== 'false';
  const activeDecks = deckSheet.getDataRange().getDisplayValues().slice(1).filter(row => {
    const rowGoogleId = googleIdCol !== undefined ? String(row[googleIdCol] || '').trim() : '';
    const rowActive = isActiveCol !== undefined ? String(row[isActiveCol] || '').toLowerCase().trim() : 'true';
    return rowGoogleId === userGoogleId && rowActive === 'true';
  });

  if (isActive && activeDecks.length >= 3) {
    return res({ status: 'error', message: 'Maximum 3 active decks. Deactivate one active deck first.' });
  }

  let deckId;
  const existingIds = new Set();
  const allRows = deckSheet.getDataRange().getDisplayValues();
  allRows.slice(1).forEach(row => {
    const id = String(row[0] || '').trim();
    if (id) existingIds.add(id);
  });

  do {
    deckId = generateShortDeckId();
  } while (existingIds.has(deckId));

  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  const isActiveValue = isActive ? 'TRUE' : 'FALSE';

  Logger.log('[DECK CREATE PARTS]', {
    deckId,
    system,
    lockChip: lockChip || '',
    blade: blade || '',
    assistBlade: assistBlade || '',
    ratchet: ratchet || '',
    bit: bit || ''
  });

  deckSheet.appendRow([
    deckId,
    userGoogleId,
    deckName,
    system,
    lockChip || '',
    blade || '',
    assistBlade || '',
    ratchet || '',
    bit || '',
    description,
    isActiveValue,
    timestamp,
    timestamp
  ]);

  return res({ status: 'success', deckId, message: 'Deck berhasil dibuat' });
}

function validateDeckPartIds(data, partsMap) {
  const fields = [
    { key: 'lockChip', expectedType: 'LOCK_CHIP', expectedSystems: ['CX'] },
    { key: 'blade', expectedType: 'BLADE', expectedSystems: ['BX', 'UX', 'CX', 'ALL'] },
    { key: 'assistBlade', expectedType: 'ASSIST_BLADE', expectedSystems: ['CX'] },
    { key: 'ratchet', expectedType: 'RATCHET', expectedSystems: ['BX', 'UX', 'CX', 'ALL'] },
    { key: 'bit', expectedType: 'BIT', expectedSystems: ['BX', 'UX', 'CX', 'ALL'] }
  ];

  const invalidFields = [];

  fields.forEach(field => {
    const value = String(data[field.key] || '').trim();
    if (!value) return;

    const part = partsMap[value];
    if (!part) {
      invalidFields.push({
        field: field.key,
        value,
        reason: 'Part ID tidak ditemukan di BeybladeParts'
      });
      return;
    }
    if (part.partType !== field.expectedType) {
      invalidFields.push({
        field: field.key,
        value,
        reason: `Expected type ${field.expectedType}, got ${part.partType}`
      });
    }
  });

  return {
    valid: invalidFields.length === 0,
    invalidFields
  };
}

function updateDeck(data) {
  const auth = resolveDeckOwner(data);
  if (!auth.authorized) return res({ status: 'error', message: auth.error });

  const userGoogleId = auth.googleId;
  const deckSheet = SS.getSheetByName('BladerDecks');
  if (!deckSheet) return res({ status: 'error', message: 'Sheet BladerDecks tidak ditemukan' });

  const deckId = String(data.deckId || '').trim();
  if (!deckId) return res({ status: 'error', message: 'deckId wajib diisi' });

  const values = deckSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return res({ status: 'error', message: 'Data deck tidak ditemukan' });

  const headers = values[0];
  const rows = values.slice(1);
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const deckIdCol = headerMap['deck_id'];
  const googleIdCol = headerMap['google_id'];
  const deckNameCol = headerMap['deck_name'];
  const systemCol = headerMap['system'];
  const lockChipCol = headerMap['lock_chip'];
  const bladeCol = headerMap['blade'];
  const assistBladeCol = headerMap['assist_blade'];
  const ratchetCol = headerMap['ratchet'];
  const bitCol = headerMap['bit'];
  const descriptionCol = headerMap['description'];
  const updatedAtCol = headerMap['updated_at'];

  let targetRowIndex = -1;
  let targetRow = null;
  for (let i = 0; i < rows.length; i++) {
    const rowDeckId = deckIdCol !== undefined ? String(rows[i][deckIdCol] || '').trim() : '';
    const rowGoogleId = googleIdCol !== undefined ? String(rows[i][googleIdCol] || '').trim() : '';
    if (rowDeckId === deckId && rowGoogleId === userGoogleId) {
      targetRowIndex = i + 2;
      targetRow = rows[i];
      break;
    }
  }

  if (!targetRow || targetRowIndex < 0) return res({ status: 'error', message: 'Deck tidak ditemukan atau bukan milik Anda' });

  const deckName = String(data.deckName || '').trim();
  const system = String(data.system || '').toUpperCase().trim();
  const lockChip = String(data.lockChip || '').trim();
  const blade = String(data.blade || '').trim();
  const assistBlade = String(data.assistBlade || '').trim();
  const ratchet = String(data.ratchet || '').trim();
  const bit = String(data.bit || '').trim();
  const description = String(data.description || '').trim();

  if (!deckName) return res({ status: 'error', message: 'Deck name wajib diisi' });
  if (!['BX', 'UX', 'CX'].includes(system)) return res({ status: 'error', message: 'System harus BX, UX, atau CX' });

  const partsMap = getBeybladePartsMap();

  const validation = validateDeckPartIds(data, partsMap);
  if (!validation.valid) {
    return res({ status: 'error', message: 'Invalid part selection. Expected part_id.' });
  }

  const validatePart = (partId, expectedType, expectedSystems) => {
    const part = partsMap[partId];
    if (!part) return false;
    if (!part.isActive) return false;
    if (expectedType && part.partType !== expectedType) return false;
    if (expectedSystems && !expectedSystems.includes(part.system)) return false;
    return true;
  };

  if (system === 'CX') {
    if (!validatePart(lockChip, 'LOCK_CHIP', ['CX'])) return res({ status: 'error', message: 'Lock Chip tidak valid untuk CX' });
    if (!validatePart(blade, 'BLADE', ['CX'])) return res({ status: 'error', message: 'Blade tidak valid untuk CX' });
    if (!validatePart(assistBlade, 'ASSIST_BLADE', ['CX'])) return res({ status: 'error', message: 'Assist Blade tidak valid untuk CX' });
    if (!validatePart(ratchet, 'RATCHET', ['ALL', 'CX'])) return res({ status: 'error', message: 'Ratchet tidak valid untuk CX' });
    if (!validatePart(bit, 'BIT', ['ALL', 'CX'])) return res({ status: 'error', message: 'Bit tidak valid untuk CX' });
  } else {
    if (!validatePart(blade, 'BLADE', [system])) return res({ status: 'error', message: 'Blade tidak valid untuk ' + system });
    if (!validatePart(ratchet, 'RATCHET', ['ALL', system])) return res({ status: 'error', message: 'Ratchet tidak valid untuk ' + system });
    if (!validatePart(bit, 'BIT', ['ALL', system])) return res({ status: 'error', message: 'Bit tidak valid untuk ' + system });
  }

  Logger.log('[DECK UPDATE PARTS]', {
    deckId,
    system,
    lockChip: lockChip || '',
    blade: blade || '',
    assistBlade: assistBlade || '',
    ratchet: ratchet || '',
    bit: bit || ''
  });

  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );

  const updates = {
    [deckNameCol]: deckName,
    [systemCol]: system,
    [lockChipCol]: lockChip || '',
    [bladeCol]: blade || '',
    [assistBladeCol]: assistBlade || '',
    [ratchetCol]: ratchet || '',
    [bitCol]: bit || '',
    [descriptionCol]: description,
    [updatedAtCol]: timestamp
  };

  for (const [colKey, value] of Object.entries(updates)) {
    if (colKey === 'undefined' || colKey === 'null') continue;
    const colNum = parseInt(colKey, 10);
    if (!isNaN(colNum) && colNum >= 0) {
      deckSheet.getRange(targetRowIndex, colNum + 1).setValue(value);
    }
  }

  return res({ status: 'success', message: 'Deck berhasil diperbarui' });
}

function toggleDeckActive(data) {
  const auth = resolveDeckOwner(data);
  if (!auth.authorized) return res({ status: 'error', message: auth.error });

  const userGoogleId = auth.googleId;
  const deckSheet = SS.getSheetByName('BladerDecks');
  if (!deckSheet) return res({ status: 'error', message: 'Sheet BladerDecks tidak ditemukan' });

  const deckId = String(data.deckId || '').trim();
  if (!deckId) return res({ status: 'error', message: 'deckId wajib diisi' });

  const values = deckSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return res({ status: 'error', message: 'Data deck tidak ditemukan' });

  const headers = values[0];
  const rows = values.slice(1);
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const deckIdCol = headerMap['deck_id'];
  const googleIdCol = headerMap['google_id'];
  const isActiveCol = headerMap['is_active'];

  let targetRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowDeckId = deckIdCol !== undefined ? String(rows[i][deckIdCol] || '').trim() : '';
    const rowGoogleId = googleIdCol !== undefined ? String(rows[i][googleIdCol] || '').trim() : '';
    if (rowDeckId === deckId && rowGoogleId === userGoogleId) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (targetRowIndex < 0) return res({ status: 'error', message: 'Deck tidak ditemukan atau bukan milik Anda' });

  const currentActive = isActiveCol !== undefined ? String(values[targetRowIndex - 1][isActiveCol] || '').toLowerCase().trim() : 'true';
  const newActive = currentActive === 'true' ? 'FALSE' : 'TRUE';

  if (isActiveCol !== undefined) {
    deckSheet.getRange(targetRowIndex, isActiveCol + 1).setValue(newActive);
  }

  return res({ status: 'success', isActive: newActive === 'TRUE', message: newActive === 'TRUE' ? 'Deck diaktifkan' : 'Deck dinonaktifkan' });
}

function deleteDeck(data) {
  const auth = resolveDeckOwner(data);
  if (!auth.authorized) return res({ status: 'error', message: auth.error });

  const deckSheet = SS.getSheetByName('BladerDecks');
  if (!deckSheet) return res({ status: 'error', message: 'Sheet tidak ditemukan' });

  const values = deckSheet.getDataRange().getDisplayValues();
  const headers = values[0];
  let deckIdCol = -1, googleIdCol = -1;

  headers.forEach((h, i) => {
    const headerName = String(h).toLowerCase().trim();
    if (headerName === 'deck_id') deckIdCol = i;
    if (headerName === 'google_id') googleIdCol = i;
  });

  let targetRowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][deckIdCol]).trim() === data.deckId && String(values[i][googleIdCol]).trim() === auth.googleId) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex > -1) {
    deckSheet.deleteRow(targetRowIndex);
    return res({ status: 'success', message: 'Deck berhasil dihapus' });
  }

  return res({ status: 'error', message: 'Deck tidak ditemukan atau bukan milik Anda' });
}

function migrateLegacyDeckPartIds() {
  const deckSheet = SS.getSheetByName('BladerDecks');
  const partSheet = SS.getSheetByName('BeybladeParts');
  if (!deckSheet || !partSheet) return res({ status: 'error', message: 'Sheet tidak ditemukan' });

  const deckValues = deckSheet.getDataRange().getDisplayValues();
  const partValues = partSheet.getDataRange().getDisplayValues();
  if (deckValues.length < 2 || partValues.length < 2) return res({ status: 'success', migrated: 0, skipped: 0, unresolved: [] });

  const partHeaders = partValues[0];
  const partRows = partValues.slice(1);
  const partHeaderMap = {};
  partHeaders.forEach((h, i) => {
    partHeaderMap[String(h).toLowerCase().trim()] = i;
  });

  const partIdCol = partHeaderMap['part_id'];
  const partTypeCol = partHeaderMap['part_type'];
  const partSystemCol = partHeaderMap['system'];
  const partNameCol = partHeaderMap['name'];

  if (partIdCol === undefined || partTypeCol === undefined || partSystemCol === undefined || partNameCol === undefined) {
    return res({ status: 'error', message: 'Header BeybladeParts tidak lengkap' });
  }

  const partsByName = {};
  partRows.forEach(row => {
    const pid = String(row[partIdCol] || '').trim();
    const type = String(row[partTypeCol] || '').trim().toLowerCase();
    const system = String(row[partSystemCol] || '').trim().toUpperCase();
    const name = String(row[partNameCol] || '').trim();
    if (!pid || !name) return;
    const key = `${type}::${system}::${name.toLowerCase()}`;
    partsByName[key] = pid;
  });

  const deckHeaders = deckValues[0];
  const deckRows = deckValues.slice(1);
  const deckHeaderMap = {};
  deckHeaders.forEach((h, i) => {
    deckHeaderMap[String(h).toLowerCase().trim()] = i;
  });

  const deckIdCol = deckHeaderMap['deck_id'];
  const systemCol = deckHeaderMap['system'];
  const lockChipCol = deckHeaderMap['lock_chip'];
  const bladeCol = deckHeaderMap['blade'];
  const assistBladeCol = deckHeaderMap['assist_blade'];
  const ratchetCol = deckHeaderMap['ratchet'];
  const bitCol = deckHeaderMap['bit'];

  const updates = [];
  const unresolved = [];
  let migrated = 0;
  let skipped = 0;

  deckRows.forEach((row, index) => {
    const deckId = deckIdCol !== undefined ? String(row[deckIdCol] || '').trim() : '';
    if (!deckId) return;

    const system = systemCol !== undefined ? String(row[systemCol] || '').toUpperCase().trim() : '';
    const fields = [
      { col: lockChipCol, type: 'lock_chip', partType: 'lock_chip', expectedSystem: 'CX' },
      { col: bladeCol, type: 'blade', partType: 'blade', expectedSystem: system },
      { col: assistBladeCol, type: 'assist_blade', partType: 'assist_blade', expectedSystem: 'CX' },
      { col: ratchetCol, type: 'ratchet', partType: 'ratchet', expectedSystem: system },
      { col: bitCol, type: 'bit', partType: 'bit', expectedSystem: system }
    ];

    let rowChanged = false;

    fields.forEach(field => {
      if (field.col === undefined) return;
      const currentValue = String(row[field.col] || '').trim();
      if (!currentValue) return;

      const isAlreadyPartId = /^[A-Z]{2}\d{3}$/i.test(currentValue);
      if (isAlreadyPartId) {
        skipped++;
        return;
      }

      const compatibleSystems = [field.expectedSystem, 'ALL'];
      let matchedPid = null;

      for (const sys of compatibleSystems) {
        const key = `${field.partType}::${sys}::${currentValue.toLowerCase()}`;
        if (partsByName[key]) {
          matchedPid = partsByName[key];
          break;
        }
      }

      if (matchedPid) {
        updates.push({ rowIndex: index + 2, colIndex: field.col + 1, value: matchedPid });
        rowChanged = true;
        migrated++;
      } else {
        unresolved.push({ deckId, field: field.type, value: currentValue });
      }
    });
  });

  updates.forEach(u => {
    deckSheet.getRange(u.rowIndex, u.colIndex).setValue(u.value);
  });

  Logger.log('[DECK MIGRATION]', { migrated, skipped, unresolved: unresolved.length });
  return res({ status: 'success', migrated, skipped, unresolved });
}

function fixLegacyDeckRow(deckId) {
  const deckSheet = SS.getSheetByName('BladerDecks');
  const partSheet = SS.getSheetByName('BeybladeParts');
  if (!deckSheet || !partSheet) return res({ status: 'error', message: 'Sheet tidak ditemukan' });

  const partsMap = getBeybladePartsMap();
  const partValues = partSheet.getDataRange().getDisplayValues();
  const partHeaders = partValues[0];
  const partHeaderMap = {};
  partHeaders.forEach((h, i) => { partHeaderMap[String(h).toLowerCase().trim()] = i; });
  const partNameCol = partHeaderMap['name'];
  const partIdCol = partHeaderMap['part_id'];

  const partsByName = {};
  partValues.slice(1).forEach(row => {
    const pid = String(row[partIdCol] || '').trim();
    const name = String(row[partNameCol] || '').trim().toLowerCase();
    if (pid && name) partsByName[name] = pid;
  });

  const deckValues = deckSheet.getDataRange().getDisplayValues();
  const deckHeaders = deckValues[0];
  const deckHeaderMap = {};
  deckHeaders.forEach((h, i) => { deckHeaderMap[String(h).toLowerCase().trim()] = i; });
  const deckIdCol = deckHeaderMap['deck_id'];
  const lockChipCol = deckHeaderMap['lock_chip'];
  const bladeCol = deckHeaderMap['blade'];
  const assistBladeCol = deckHeaderMap['assist_blade'];
  const ratchetCol = deckHeaderMap['ratchet'];
  const bitCol = deckHeaderMap['bit'];

  const fieldMap = [
    { col: lockChipCol, name: 'lockChip' },
    { col: bladeCol, name: 'blade' },
    { col: assistBladeCol, name: 'assistBlade' },
    { col: ratchetCol, name: 'ratchet' },
    { col: bitCol, name: 'bit' }
  ];

  let targetRowIndex = -1;
  let rowChanged = false;
  const updates = [];

  deckValues.slice(1).forEach((row, index) => {
    const rowDeckId = deckIdCol !== undefined ? String(row[deckIdCol] || '').trim() : '';
    if (rowDeckId !== deckId) return;
    targetRowIndex = index + 2;

    fieldMap.forEach(field => {
      if (field.col === undefined) return;
      const currentValue = String(row[field.col] || '').trim();
      if (!currentValue) return;
      const isAlreadyPartId = /^[A-Z]{2}\d{3}$/i.test(currentValue);
      if (isAlreadyPartId) return;
      const matchedPid = partsByName[currentValue.toLowerCase()];
      if (matchedPid) {
        updates.push({ rowIndex: targetRowIndex, colIndex: field.col + 1, value: matchedPid, field: field.name, oldValue: currentValue });
        rowChanged = true;
      }
    });
  });

  if (targetRowIndex < 0) return res({ status: 'error', message: 'Deck tidak ditemukan' });

  updates.forEach(u => deckSheet.getRange(u.rowIndex, u.colIndex).setValue(u.value));

  Logger.log('[DECK FIX ROW]', { deckId, rowIndex: targetRowIndex, updates, rowChanged });
  return res({ status: 'success', deckId, rowIndex: targetRowIndex, updates, rowChanged });
}

function getBladerDeckSets(data) {
  const auth = resolveDeckOwner(data);
  if (!auth.authorized) return res({ status: 'error', message: auth.error });

  const userGoogleId = auth.googleId;
  const sheet = SS.getSheetByName('BladerDeckSets');
  if (!sheet) return res({ status: 'success', deckSets: [] });

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return res({ status: 'success', deckSets: [] });

  const headers = values[0];
  const rows = values.slice(1);
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const deckSets = rows.map(row => ({
    deckSetId: String(row[0] || '').trim(),
    googleId: String(row[1] || '').trim(),
    setName: String(row[2] || '').trim(),
    deck1Id: String(row[3] || '').trim(),
    deck2Id: String(row[4] || '').trim(),
    deck3Id: String(row[5] || '').trim(),
    isActive: String(row[6] || '').toLowerCase().trim() === 'true',
    createdAt: String(row[7] || '').trim(),
    updatedAt: String(row[8] || '').trim()
  })).filter(ds => ds.googleId === userGoogleId);

  return res({ status: 'success', deckSets });
}

function createBladerDeckSet(data) {
  const auth = resolveDeckOwner(data);
  if (!auth.authorized) return res({ status: 'error', message: auth.error });

  const userGoogleId = auth.googleId;
  const sheet = SS.getSheetByName('BladerDeckSets');
  if (!sheet) return res({ status: 'error', message: 'Sheet BladerDeckSets tidak ditemukan' });

  const deck1Id = String(data.deck1Id || '').trim();
  const deck2Id = String(data.deck2Id || '').trim();
  const deck3Id = String(data.deck3Id || '').trim();

  if (!deck1Id || !deck2Id || !deck3Id) {
    return res({ status: 'error', message: '3 deck ID wajib diisi untuk deck set' });
  }

  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([
    generateShortDeckId(),
    userGoogleId,
    data.setName || '',
    deck1Id,
    deck2Id,
    deck3Id,
    'TRUE',
    timestamp,
    timestamp
  ]);

  return res({ status: 'success', message: 'Deck set berhasil dibuat' });
}

function ensurePublicProfileId(playerSheet) {
  if (!playerSheet) return res({ status: 'error', message: 'Sheet Players tidak ditemukan' });
  const values = playerSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return res({ status: 'success', updated: 0, skipped: 0 });

  const headers = values[0];
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const publicProfileIdCol = headerMap['public_profile_id'];
  if (publicProfileIdCol === undefined) return res({ status: 'error', message: 'Kolom public_profile_id tidak ditemukan' });

  const existingIds = new Set();
  const updates = [];
  let skipped = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const currentId = String(row[publicProfileIdCol] || '').trim();
    if (currentId) {
      existingIds.add(currentId);
      skipped++;
      continue;
    }

    let newId;
    do {
      newId = generateShortId();
    } while (existingIds.has(newId));

    existingIds.add(newId);
    updates.push({ rowIndex: i + 1, colIndex: publicProfileIdCol + 1, value: newId });
  }

  updates.forEach(u => {
    playerSheet.getRange(u.rowIndex, u.colIndex).setValue(u.value);
  });

  return res({ status: 'success', updated: updates.length, skipped });
}

function getPlayerByPublicProfileId(profileId) {
  const playerSheet = SS.getSheetByName("Players");
  if (!playerSheet) return null;

  const values = playerSheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const headers = values[0];
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const publicProfileIdCol = headerMap['public_profile_id'];
  const googleIdCol = headerMap['google_id'] !== undefined ? headerMap['google_id'] : headerMap['googleid'];
  const emailCol = headerMap['email'];
  const nicknameCol = headerMap['nickname'];
  const photoCol = headerMap['photo_url'] !== undefined ? headerMap['photo_url'] : (headerMap['foto'] !== undefined ? headerMap['foto'] : headerMap['photo']);
  const roleCol = headerMap['role'];
  const sloganCol = headerMap['slogan'];

  if (publicProfileIdCol === undefined) return null;

  const targetRow = values.slice(1).find(row => {
    return String(row[publicProfileIdCol] || '').trim() === String(profileId || '').trim();
  });

  if (!targetRow) return null;

  return {
    row: targetRow,
    googleId: googleIdCol !== undefined ? String(targetRow[googleIdCol] || '').trim() : '',
    email: emailCol !== undefined ? String(targetRow[emailCol] || '').trim() : '',
    nickname: nicknameCol !== undefined ? String(targetRow[nicknameCol] || '') : '',
    photo: photoCol !== undefined ? String(targetRow[photoCol] || '') : '',
    role: roleCol !== undefined ? String(targetRow[roleCol] || '') : '',
    slogan: sloganCol !== undefined ? String(targetRow[sloganCol] || '') : ''
  };
}

function getBladers() {
  try {
    const playerSheet = SS.getSheetByName("Players");
    const boardSheet = SS.getSheetByName("Leaderboard");
    const adminSheet = SS.getSheetByName("Admins");

    if (!playerSheet) return res({ status: 'success', bladers: [] });

    const playerValues = playerSheet.getDataRange().getDisplayValues();
    if (playerValues.length < 2) return res({ status: 'success', bladers: [] });

    const playerHeaders = playerValues[0];
    const playerRows = playerValues.slice(1);

    const playerMap = {};
    playerHeaders.forEach((h, i) => {
      playerMap[String(h).toLowerCase().trim()] = i;
    });

    const googleIdCol = playerMap['google_id'] !== undefined ? playerMap['google_id'] : playerMap['googleid'];
    const emailCol = playerMap['email'];
    const nicknameCol = playerMap['nickname'];
    const photoCol = playerMap['photo_url'] !== undefined ? playerMap['photo_url'] : (playerMap['foto'] !== undefined ? playerMap['foto'] : playerMap['photo']);
    const publicProfileIdCol = playerMap['public_profile_id'];

    const admins = adminSheet ? adminSheet.getDataRange().getDisplayValues().flat().map(a => a.toString().toLowerCase()) : [];

    const players = playerRows.map(row => {
      const gId = googleIdCol !== undefined ? String(row[googleIdCol] || '').trim() : '';
      const email = emailCol !== undefined ? String(row[emailCol] || '').trim() : '';
      const isAdmin = admins.some(a => a && a === email.toLowerCase());
      return {
        googleId: gId,
        nickname: nicknameCol !== undefined ? String(row[nicknameCol] || '') : '',
        foto: photoCol !== undefined ? String(row[photoCol] || '') : '',
        role: isAdmin ? 'Admin' : 'Blader',
        public_profile_id: publicProfileIdCol !== undefined ? String(row[publicProfileIdCol] || '').trim() : ''
      };
    }).filter(b => b.googleId);

    let leaderboardMap = {};
    if (boardSheet) {
      const boardValues = boardSheet.getDataRange().getDisplayValues();
      if (boardValues.length >= 2) {
        const boardHeaders = boardValues[0];
        const boardRows = boardValues.slice(1);
        const boardHeaderMap = {};
        boardHeaders.forEach((h, i) => {
          boardHeaderMap[String(h).toLowerCase().trim()] = i;
        });

        const boardIdCol = boardHeaderMap['google_id'] !== undefined ? boardHeaderMap['google_id'] : boardHeaderMap['googleid'];
        const statusCol = boardHeaderMap['status'];
        const pointCol = boardHeaderMap['point'];
        const pointFinishCol = boardHeaderMap['point_finish'] !== undefined ? boardHeaderMap['point_finish'] : boardHeaderMap['pointfinish'];
        const prevRankCol = boardHeaderMap['previous_rank'];

        const entries = [];
        boardRows.forEach(row => {
          const gId = boardIdCol !== undefined ? String(row[boardIdCol] || '').trim() : '';
          if (!gId) return;
          const point = pointCol !== undefined ? Number(row[pointCol]) || 0 : 0;
          const pointFinish = pointFinishCol !== undefined ? Number(row[pointFinishCol]) || 0 : 0;
          const previousRank = prevRankCol !== undefined ? (String(row[prevRankCol] || '').trim() ? Number(row[prevRankCol]) : null) : null;
          const sheetStatus = statusCol !== undefined ? String(row[statusCol] || '').toLowerCase().trim() : '';
          entries.push({ googleId: gId, point, pointFinish, previousRank, sheetStatus });
        });

        entries.sort((a, b) => {
          if (b.point !== a.point) return b.point - a.point;
          return b.pointFinish - a.pointFinish;
        });

        entries.forEach((entry, index) => {
          const currentRank = index + 1;
          let status = entry.sheetStatus || '';
          if (!status) {
            status = 'stay';
            if (entry.previousRank === null || entry.previousRank === undefined || String(entry.previousRank) === '') {
              status = 'new';
            } else if (entry.previousRank > currentRank) {
              status = 'up';
            } else if (entry.previousRank < currentRank) {
              status = 'down';
            }
          }
          leaderboardMap[entry.googleId] = {
            point: entry.point,
            pointFinish: entry.pointFinish,
            rank: currentRank,
            status: status
          };
        });
      }
    }

    const bladers = players.map(b => {
      const lb = leaderboardMap[b.googleId];
      return {
        googleId: b.googleId,
        public_profile_id: b.public_profile_id,
        nickname: b.nickname,
        foto: b.foto,
        role: b.role,
        point: lb ? lb.point : 0,
        pointFinish: lb ? lb.pointFinish : 0,
        rank: lb ? lb.rank : null,
        leaderboardStatus: lb ? lb.status : ''
      };
    });

    bladers.sort((a, b) => {
      if (a.rank === null && b.rank === null) return 0;
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank;
    });

    return res({ status: 'success', bladers });
  } catch (err) {
    console.error('getBladers error: ' + err.message);
    return res({ status: 'error', message: 'Gagal memuat daftar blader', bladers: [] });
  }
}

function getBladerProfile(data) {
  const profileId = String(data.profileId || '').trim();
  if (!profileId) return res({ status: 'error', message: 'profileId wajib diisi' });

  Logger.log('[PROFILE] START ' + profileId);

  const player = getPlayerByPublicProfileId(profileId);
  if (!player) {
    return res({ status: 'error', message: 'BLADER NOT FOUND' });
  }

  const googleId = player.googleId;
  const nickname = player.nickname;
  const photo = player.photo;
  const role = player.role;
  const slogan = player.slogan;

  const boardSheet = SS.getSheetByName("Leaderboard");
  let leaderboard = null;
  if (boardSheet) {
    const boardValues = boardSheet.getDataRange().getDisplayValues();
    if (boardValues.length >= 2) {
      const boardHeaders = boardValues[0];
      const boardRows = boardValues.slice(1);
      const boardHeaderMap = {};
      boardHeaders.forEach((h, i) => {
        boardHeaderMap[String(h).toLowerCase().trim()] = i;
      });

      const boardIdCol = boardHeaderMap['google_id'] !== undefined ? boardHeaderMap['google_id'] : boardHeaderMap['googleid'];
      const statusCol = boardHeaderMap['status'];
      const pointCol = boardHeaderMap['point'];
      const pointFinishCol = boardHeaderMap['point_finish'] !== undefined ? boardHeaderMap['point_finish'] : boardHeaderMap['pointfinish'];
      const prevRankCol = boardHeaderMap['previous_rank'];

      const allEntries = [];
      boardRows.forEach(row => {
        const gId = boardIdCol !== undefined ? String(row[boardIdCol] || '').trim() : '';
        if (!gId) return;
        const point = pointCol !== undefined ? Number(row[pointCol]) || 0 : 0;
        const pointFinish = pointFinishCol !== undefined ? Number(row[pointFinishCol]) || 0 : 0;
        const previousRank = prevRankCol !== undefined ? (String(row[prevRankCol] || '').trim() ? Number(row[prevRankCol]) : null) : null;
        const sheetStatus = statusCol !== undefined ? String(row[statusCol] || '').toLowerCase().trim() : '';
        allEntries.push({ googleId: gId, point, pointFinish, previousRank, sheetStatus });
      });

      allEntries.sort((a, b) => {
        if (b.point !== a.point) return b.point - a.point;
        return b.pointFinish - a.pointFinish;
      });

      const playerEntry = allEntries.find(e => e.googleId === googleId);
      if (playerEntry) {
        const rank = allEntries.findIndex(e => e === playerEntry) + 1;
        let status = playerEntry.sheetStatus || '';
        if (!status) {
          status = 'stay';
          if (playerEntry.previousRank === null || playerEntry.previousRank === undefined || String(playerEntry.previousRank) === '') {
            status = 'new';
          } else if (playerEntry.previousRank > rank) {
            status = 'up';
          } else if (playerEntry.previousRank < rank) {
            status = 'down';
          }
        }
        leaderboard = {
          rank: rank,
          point: playerEntry.point,
          pointFinish: playerEntry.pointFinish,
          status: status
        };
      }
    }
  }

  const eventSheet = SS.getSheetByName("Events");
  let events = [];
  if (eventSheet) {
    const eventValues = eventSheet.getDataRange().getValues();
    if (eventValues.length >= 2) {
      const eventHeaders = eventValues[0];
      const eventRows = eventValues.slice(1);
      const eventHeaderMap = {};
      eventHeaders.forEach((h, i) => {
        eventHeaderMap[String(h).toLowerCase().trim()] = i;
      });

      const eventIdCol = eventHeaderMap['event_id'] !== undefined ? eventHeaderMap['event_id'] : eventHeaderMap['id'];
      const eventNamaCol = eventHeaderMap['nama'];
      const eventDateCol = eventHeaderMap['tanggal_event'];
      const eventStatusCol = eventHeaderMap['status'];

      const tz = Session.getScriptTimeZone();
      events = eventRows.map(row => {
        const rawDate = eventDateCol !== undefined ? row[eventDateCol] : '';
        let eventDateTimestamp = 0;
        let eventDateDisplay = '';

        if (rawDate instanceof Date) {
          eventDateTimestamp = rawDate.getTime();
          eventDateDisplay = Utilities.formatDate(rawDate, tz, "d MMMM yyyy");
        } else if (rawDate) {
          eventDateDisplay = String(rawDate).trim();
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            eventDateTimestamp = parsed.getTime();
          }
        }

        return {
          eventId: String(row[eventIdCol] || '').trim(),
          nama: String(row[eventNamaCol] || '').trim(),
          tanggal_event: eventDateDisplay,
          tanggal_event_timestamp: eventDateTimestamp,
          status: String(row[eventStatusCol] || '').toLowerCase().trim()
        };
      }).filter(e => e.eventId);
    }
  }

  events.sort((a, b) => {
    const tsA = a.tanggal_event_timestamp || 0;
    const tsB = b.tanggal_event_timestamp || 0;
    if (tsB !== tsA) return tsB - tsA;
    return b.eventId.localeCompare(a.eventId);
  });

  Logger.log('[PROFILE] INDEX READY');
  Logger.log('[PROFILE] EVENTS=' + events.length);

  const resultSheetIndex = getTournamentResultSheetIndex();
  const recentResults = [];
  let tournamentsPlayed = 0;

  try {
    for (const event of events) {
      const resultSheetName = resultSheetIndex[event.eventId];
      if (!resultSheetName) continue;

      const resultSheet = SS.getSheetByName(resultSheetName);
      if (!resultSheet) continue;

      const resultValues = resultSheet.getDataRange().getDisplayValues();
      if (resultValues.length < 3) continue;

      const row2Headers = resultValues[1].map(h => String(h || '').toLowerCase().trim());
      const googleIdColIdx = row2Headers.indexOf('google id');
      const rankColIdx = row2Headers.indexOf('rank');
      const pointColIdx = row2Headers.indexOf('point');
      const pointFinishColIdx = row2Headers.indexOf('point finish');

      if (googleIdColIdx < 0 || rankColIdx < 0) continue;

      let found = false;
      for (let i = 2; i < resultValues.length; i++) {
        const rowGoogleId = String(resultValues[i][googleIdColIdx] || '').trim();
        if (rowGoogleId !== googleId) continue;

        found = true;
        tournamentsPlayed++;

        if (recentResults.length < 5) {
          const rank = String(resultValues[i][rankColIdx] || '').trim();
          const point = pointColIdx >= 0 ? String(resultValues[i][pointColIdx] || '').trim() : '';
          const pointFinish = pointFinishColIdx >= 0 ? String(resultValues[i][pointFinishColIdx] || '').trim() : '';

          recentResults.push({
            eventId: event.eventId,
            eventName: event.nama,
            eventDate: event.tanggal_event,
            rank: rank,
            point: point,
            pointFinish: pointFinish
          });
        }
        break;
      }
    }
  } catch (e) {
    Logger.log('[PROFILE] RECENT RESULTS FALLBACK: ' + e.toString());
  }

  Logger.log('[PROFILE] RESULTS FOUND=' + tournamentsPlayed);
  Logger.log('[PROFILE] END');

  return res({
    status: 'success',
    player: {
      profileId: profileId,
      nickname: nickname,
      photoUrl: photo,
      role: role,
      slogan: slogan
    },
    leaderboard: leaderboard || {
      rank: null,
      point: 0,
      pointFinish: 0,
      status: ''
    },
    tournamentSummary: {
      tournamentsPlayed: tournamentsPlayed
    },
    recentResults: recentResults
  });
}

function rolloverLeaderboard() {
  try {
    const boardSheet = SS.getSheetByName("Leaderboard");
    if (!boardSheet) return res({ status: 'error', message: 'Sheet Leaderboard tidak ditemukan' });

    const values = boardSheet.getDataRange().getDisplayValues();
    if (values.length < 2) return res({ status: 'success', message: 'Leaderboard kosong' });

    const headers = values[0];
    const rows = values.slice(1);
    const map = {};
    headers.forEach((h, i) => {
      map[String(h).toLowerCase().trim()] = i;
    });

    const idCol = map['google_id'] !== undefined ? map['google_id'] : map['googleid'];
    const pointCol = map['point'];
    const pointFinishCol = map['point_finish'] !== undefined ? map['point_finish'] : map['pointfinish'];
    const prevRankCol = map['previous_rank'];
    const statusCol = map['status'];

    if (idCol === undefined || pointCol === undefined || pointFinishCol === undefined) {
      return res({ status: 'error', message: 'Header Leaderboard tidak lengkap' });
    }

    const entries = [];
    rows.forEach(row => {
      const gId = String(row[idCol] || '').trim();
      if (!gId) return;
      entries.push({
        googleId: gId,
        point: Number(row[pointCol]) || 0,
        pointFinish: Number(row[pointFinishCol]) || 0
      });
    });

    entries.sort((a, b) => {
      if (b.point !== a.point) return b.point - a.point;
      return b.pointFinish - a.pointFinish;
    });

    entries.forEach((entry, index) => {
      const currentRank = index + 1;
      const rowIndex = rows.findIndex(r => String(r[idCol] || '').trim() === entry.googleId);
      if (rowIndex === -1) return;

      const sheetRow = rowIndex + 2;
      if (prevRankCol !== undefined) {
        boardSheet.getRange(sheetRow, prevRankCol + 1).setValue(currentRank);
      }
      if (pointCol !== undefined) {
        boardSheet.getRange(sheetRow, pointCol + 1).setValue(0);
      }
      if (pointFinishCol !== undefined) {
        boardSheet.getRange(sheetRow, pointFinishCol + 1).setValue(0);
      }
      if (statusCol !== undefined) {
        boardSheet.getRange(sheetRow, statusCol + 1).setValue('new');
      }
    });

    return res({ status: 'success', message: 'Rollover leaderboard berhasil', affected: entries.length });
  } catch (err) {
    console.error('rolloverLeaderboard error: ' + err.message);
    return res({ status: 'error', message: 'Gagal rollover leaderboard: ' + err.message });
  }
}

function repairLeaderboardAfterFirstSync() {
  try {
    const boardSheet = SS.getSheetByName("Leaderboard");
    if (!boardSheet) return res({ status: 'error', message: 'Sheet Leaderboard tidak ditemukan' });

    const values = boardSheet.getDataRange().getDisplayValues();
    if (values.length < 2) return res({ status: 'success', message: 'Leaderboard kosong', repaired: 0 });

    const headers = values[0];
    const rows = values.slice(1);
    const map = {};
    headers.forEach((h, i) => {
      map[String(h).toLowerCase().trim()] = i;
    });

    const idCol = map['google_id'] !== undefined ? map['google_id'] : map['googleid'];
    const prevRankCol = map['previous_rank'];
    const statusCol = map['status'];

    if (idCol === undefined) {
      return res({ status: 'error', message: 'Header google_id tidak ditemukan di Leaderboard' });
    }

    let repaired = 0;
    rows.forEach((row, index) => {
      const gId = String(row[idCol] || '').trim();
      if (!gId) return;

      const sheetRow = index + 2;
      let changed = false;

      if (prevRankCol !== undefined) {
        const currentPrevRank = String(row[prevRankCol] || '').trim();
        if (currentPrevRank !== '') {
          boardSheet.getRange(sheetRow, prevRankCol + 1).clearContent();
          changed = true;
        }
      }

      if (statusCol !== undefined) {
        const currentStatus = String(row[statusCol] || '').toLowerCase().trim();
        if (currentStatus !== 'new') {
          boardSheet.getRange(sheetRow, statusCol + 1).setValue('new');
          changed = true;
        }
      }

      if (changed) {
        repaired++;
      }
    });

    return res({ status: 'success', message: 'Leaderboard repaired', repaired });
  } catch (err) {
    console.error('repairLeaderboardAfterFirstSync error: ' + err.message);
    return res({ status: 'error', message: 'Gagal repair leaderboard: ' + err.message });
  }
}

function repairExcludedLeaderboardPlayer(eventId, googleId) {
  try {
    const boardSheet = SS.getSheetByName("Leaderboard");
    if (!boardSheet) return res({ status: 'error', message: 'Sheet Leaderboard tidak ditemukan' });

    const syncSheet = getOrCreateSyncSheet();
    const syncValues = syncSheet.getDataRange().getValues();
    if (syncValues.length < 2) return res({ status: 'success', message: 'Tidak ada sync record', removed: 0 });

    const syncHeaders = syncValues[0];
    const syncMap = {};
    syncHeaders.forEach((h, i) => {
      syncMap[String(h).toLowerCase().trim()] = i;
    });

    const syncEventIdCol = syncMap['event_id'];
    const syncGoogleIdCol = syncMap['google_id'];
    if (syncEventIdCol === undefined || syncGoogleIdCol === undefined) {
      return res({ status: 'error', message: 'Header sync sheet tidak lengkap' });
    }

    let syncRowIndex = -1;
    for (let i = 1; i < syncValues.length; i++) {
      const sid = String(syncValues[i][syncEventIdCol] || '').trim();
      const sgid = String(syncValues[i][syncGoogleIdCol] || '').trim();
      if (sid === eventId && sgid === googleId) {
        syncRowIndex = i;
        break;
      }
    }

    if (syncRowIndex === -1) {
      return res({ status: 'success', message: 'Tidak ada sync record untuk event ini', removed: 0 });
    }

    const eventPoint = Number(syncValues[syncRowIndex][syncMap['point_added']]) || 0;
    const eventPointFinish = Number(syncValues[syncRowIndex][syncMap['point_finish_added']]) || 0;

    syncSheet.deleteRow(syncRowIndex + 1);

    if (!boardSheet) return res({ status: 'success', message: 'Sync record dihapus', removed: 1 });

    const boardValues = boardSheet.getDataRange().getDisplayValues();
    if (boardValues.length < 2) return res({ status: 'success', message: 'Sync record dihapus, leaderboard kosong', removed: 1 });

    const boardHeaders = boardValues[0];
    const boardRows = boardValues.slice(1);
    const boardMap = {};
    boardHeaders.forEach((h, i) => {
      boardMap[String(h).toLowerCase().trim()] = i;
    });

    const idCol = boardMap['google_id'] !== undefined ? boardMap['google_id'] : boardMap['googleid'];
    const pointCol = boardMap['point'];
    const pointFinishCol = boardMap['point_finish'] !== undefined ? boardMap['point_finish'] : boardMap['pointfinish'];
    const prevRankCol = boardMap['previous_rank'];

    if (idCol === undefined) {
      return res({ status: 'success', message: 'Sync record dihapus', removed: 1 });
    }

    let targetRowIndex = -1;
    for (let i = 0; i < boardRows.length; i++) {
      const gId = String(boardRows[i][idCol] || '').trim();
      if (gId === googleId) {
        targetRowIndex = i;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return res({ status: 'success', message: 'Sync record dihapus, player tidak ditemukan di leaderboard', removed: 1 });
    }

    const targetRow = boardRows[targetRowIndex];
    const currentPoint = Number(targetRow[pointCol]) || 0;
    const currentPointFinish = Number(targetRow[pointFinishCol]) || 0;
    const currentPrevRank = prevRankCol !== undefined ? String(targetRow[prevRankCol] || '').trim() : '';

    const otherSyncs = [];
    for (let i = 1; i < syncValues.length; i++) {
      if (i === syncRowIndex) continue;
      const sid = String(syncValues[i][syncEventIdCol] || '').trim();
      const sgid = String(syncValues[i][syncGoogleIdCol] || '').trim();
      if (sgid === googleId && sid !== eventId) {
        otherSyncs.push(sid);
      }
    }

    const isExactMatch = currentPoint === eventPoint && currentPointFinish === eventPointFinish;
    const hasOtherSyncs = otherSyncs.length > 0;
    const isEmptyPrevRank = currentPrevRank === '';

    if (isExactMatch && !hasOtherSyncs && isEmptyPrevRank) {
      const sheetRow = targetRowIndex + 2;
      boardSheet.deleteRow(sheetRow);
      return res({
        status: 'success',
        message: 'Row leaderboard dihapus karena berasal dari sync event ini',
        removed: 1,
        action: 'deleted_row',
        googleId: googleId
      });
    }

    if (isExactMatch && !hasOtherSyncs) {
      const sheetRow = targetRowIndex + 2;
      if (pointCol !== undefined) {
        boardSheet.getRange(sheetRow, pointCol + 1).setValue(0);
      }
      if (pointFinishCol !== undefined) {
        boardSheet.getRange(sheetRow, pointFinishCol + 1).setValue(0);
      }
      return res({
        status: 'success',
        message: 'Point direset karena kemungkinan berasal dari sync event ini',
        removed: 1,
        action: 'reset_points',
        googleId: googleId
      });
    }

    return res({
      status: 'success',
      message: 'Sync record dihapus. Player memiliki data sebelumnya atau nilai tidak cocok, leaderboard tidak diubah.',
      removed: 1,
      action: 'sync_only',
      googleId: googleId
    });
  } catch (err) {
    console.error('repairExcludedLeaderboardPlayer error: ' + err.message);
    return res({ status: 'error', message: 'Gagal repair excluded player: ' + err.message });
  }
}

function checkTournamentSyncStatus(eventId) {
  try {
    const syncSheet = SS.getSheetByName('TournamentLeaderboardSync');
    if (!syncSheet) {
      return res({ status: 'success', synced: false, message: 'Sheet sync tidak ditemukan' });
    }

    const values = syncSheet.getDataRange().getValues();
    if (values.length < 2) {
      return res({ status: 'success', synced: false, message: 'Belum ada sync record' });
    }

    const headers = values[0];
    const rows = values.slice(1);
    const map = {};
    headers.forEach((h, i) => {
      map[String(h).toLowerCase().trim()] = i;
    });

    const eventIdCol = map['event_id'];
    const googleIdCol = map['google_id'];

    if (eventIdCol === undefined || googleIdCol === undefined) {
      return res({ status: 'error', message: 'Header sync sheet tidak lengkap' });
    }

    const syncedPlayers = [];
    rows.forEach(row => {
      const sid = String(row[eventIdCol] || '').trim();
      if (sid === eventId) {
        syncedPlayers.push({
          googleId: String(row[googleIdCol] || '').trim(),
          point_added: Number(row[map['point_added']]) || 0,
          point_finish_added: Number(row[map['point_finish_added']]) || 0
        });
      }
    });

    return res({
      status: 'success',
      synced: syncedPlayers.length > 0,
      count: syncedPlayers.length,
      players: syncedPlayers
    });
  } catch (err) {
    console.error('checkTournamentSyncStatus error: ' + err.message);
    return res({ status: 'error', message: 'Gagal cek sync status: ' + err.message });
  }
}

function getOrCreateSheet(sheetName, headers) {
  let sheet = SS.getSheetByName(sheetName);
  if (!sheet) {
    sheet = SS.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function getOrCreateSyncSheet() {
  return getOrCreateSheet('TournamentLeaderboardSync', [
    'event_id',
    'google_id',
    'point_added',
    'point_finish_added',
    'synced_at'
  ]);
}

function isAlreadySynced(eventId, googleId) {
  try {
    const syncSheet = SS.getSheetByName('TournamentLeaderboardSync');
    if (!syncSheet) return false;

    const values = syncSheet.getDataRange().getValues();
    if (values.length < 2) return false;

    const headers = values[0];
    const map = {};
    headers.forEach((h, i) => {
      map[String(h).toLowerCase().trim()] = i;
    });

    const eventIdCol = map['event_id'];
    const googleIdCol = map['google_id'];

    if (eventIdCol === undefined || googleIdCol === undefined) return false;

    for (let i = 1; i < values.length; i++) {
      const rowEventId = String(values[i][eventIdCol] || '').trim();
      const rowGoogleId = String(values[i][googleIdCol] || '').trim();
      if (rowEventId === String(eventId || '').trim() && rowGoogleId === String(googleId || '').trim()) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('isAlreadySynced error: ' + err.message);
    return false;
  }
}

function recordSync(eventId, googleId, pointAdded, pointFinishAdded) {
  try {
    const syncSheet = getOrCreateSyncSheet();
    const now = new Date();
    syncSheet.appendRow([
      String(eventId || '').trim(),
      String(googleId || '').trim(),
      Number(pointAdded) || 0,
      Number(pointFinishAdded) || 0,
      now
    ]);
    return true;
  } catch (err) {
    console.error('recordSync error: ' + err.message);
    return false;
  }
}

function readTournamentResultSheet(sheetName, expectedEventId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { status: 'error', message: 'Sheet hasil tournament tidak ditemukan: ' + sheetName };
    }

    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 3) {
      return { status: 'error', message: 'Sheet hasil tournament kosong atau format tidak sesuai' };
    }

    const resultHeaders = values[1];
    const resultRows = values.slice(2);
    const map = {};
    resultHeaders.forEach((h, i) => {
      map[String(h || '').trim().toLowerCase()] = i;
    });

    Logger.log('[PREVIEW RESULT HEADER] ' + JSON.stringify(resultHeaders));
    Logger.log('[PREVIEW RESULT ROWS] ' + resultRows.length);

    const requiredHeaders = ['rank', 'point', 'google id', 'nama', 'win - lose', 'total win', 'point finish', 'event id'];
    const missingHeaders = requiredHeaders.filter(h => map[h] === undefined);
    if (missingHeaders.length > 0) {
      return { status: 'error', message: 'Header tidak ditemukan di sheet: ' + missingHeaders.join(', ') };
    }

    const rankCol = map['rank'];
    const pointCol = map['point'];
    const googleIdCol = map['google id'];
    const namaCol = map['nama'];
    const pointFinishCol = map['point finish'];
    const eventIdCol = map['event id'];

    const results = [];
    const warnings = [];

    resultRows.forEach((row, index) => {
      const rowEventId = String(row[eventIdCol] || '').trim();
      const googleId = String(row[googleIdCol] || '').trim();

      if (!rowEventId && !googleId) {
        return;
      }

      if (expectedEventId && rowEventId && rowEventId !== String(expectedEventId).trim()) {
        warnings.push({
          row: index + 3,
          message: 'Event ID berbeda: expect=' + expectedEventId + ', actual=' + rowEventId
        });
        return;
      }

      if (!googleId) {
        warnings.push({
          row: index + 3,
          message: 'Google ID kosong pada row ' + (index + 3)
        });
        return;
      }

      const rank = Number(row[rankCol]) || 0;
      const point = Number(row[pointCol]) || 0;
      const pointFinish = Number(row[pointFinishCol]) || 0;
      const nama = String(row[namaCol] || '').trim();

      results.push({
        googleId,
        nama,
        rank,
        point,
        pointFinish,
        row: index + 3
      });
    });

    return {
      status: 'success',
      results,
      warnings,
      totalRows: resultRows.length,
      processedRows: results.length
    };
  } catch (err) {
    console.error('readTournamentResultSheet error: ' + err.message);
    return { status: 'error', message: 'Gagal membaca sheet hasil tournament: ' + err.message };
  }
}

function getPlayerNickname(googleId) {
  try {
    const playerSheet = SS.getSheetByName("Players");
    if (!playerSheet) return '';

    const values = playerSheet.getDataRange().getDisplayValues();
    if (values.length < 2) return '';

    const headers = values[0];
    const rows = values.slice(1);
    const map = {};
    headers.forEach((h, i) => {
      map[String(h).toLowerCase().trim()] = i;
    });

    const googleIdCol = map['google_id'] !== undefined ? map['google_id'] : map['googleid'];
    const nicknameCol = map['nickname'] !== undefined ? map['nickname'] : map['nama'];

    if (googleIdCol === undefined || nicknameCol === undefined) return '';

    for (let i = 0; i < rows.length; i++) {
      const rowGoogleId = String(rows[i][googleIdCol] || '').trim();
      if (rowGoogleId === googleId) {
        return String(rows[i][nicknameCol] || '').trim();
      }
    }
  } catch (e) {
    console.error('Gagal baca nickname: ' + e.message);
  }
  return '';
}

function calculateLeaderboardPreview(leaderboardRows, headerMap, tournamentResults, expectedEventId) {
  try {
    const idCol = headerMap['google_id'] !== undefined ? headerMap['google_id'] : headerMap['googleid'];
    const pointCol = headerMap['point'];
    const pointFinishCol = headerMap['point_finish'] !== undefined ? headerMap['point_finish'] : headerMap['pointfinish'];
    const prevRankCol = headerMap['previous_rank'];
    const statusCol = headerMap['status'];

    const existingPlayers = {};
    leaderboardRows.forEach((row, index) => {
      const gId = String(row[idCol] || '').trim();
      if (!gId) return;
      existingPlayers[gId] = {
        rowIndex: index,
        oldPoint: Number(row[pointCol]) || 0,
        oldPointFinish: Number(row[pointFinishCol]) || 0,
        previousRank: prevRankCol !== undefined ? (String(row[prevRankCol] || '').trim() ? Number(row[prevRankCol]) : null) : (index + 1)
      };
    });

    const simulatedPlayers = JSON.parse(JSON.stringify(existingPlayers));

    tournamentResults.forEach(r => {
      const gId = String(r.googleId || '').trim();
      if (!gId) return;
      if (!simulatedPlayers[gId]) {
        simulatedPlayers[gId] = {
          rowIndex: -1,
          oldPoint: 0,
          oldPointFinish: 0,
          previousRank: null
        };
      }
      simulatedPlayers[gId].addedPoint = Number(r.point) || 0;
      simulatedPlayers[gId].addedPointFinish = Number(r.pointFinish) || 0;
      simulatedPlayers[gId].newPoint = (simulatedPlayers[gId].oldPoint || 0) + simulatedPlayers[gId].addedPoint;
      simulatedPlayers[gId].newPointFinish = (simulatedPlayers[gId].oldPointFinish || 0) + simulatedPlayers[gId].addedPointFinish;
      simulatedPlayers[gId].nama = r.nama || '';
    });

    Object.keys(simulatedPlayers).forEach(gId => {
      if (simulatedPlayers[gId].addedPoint === undefined) {
        simulatedPlayers[gId].addedPoint = 0;
      }
      if (simulatedPlayers[gId].addedPointFinish === undefined) {
        simulatedPlayers[gId].addedPointFinish = 0;
      }
      if (simulatedPlayers[gId].newPoint === undefined) {
        simulatedPlayers[gId].newPoint = simulatedPlayers[gId].oldPoint || 0;
      }
      if (simulatedPlayers[gId].newPointFinish === undefined) {
        simulatedPlayers[gId].newPointFinish = simulatedPlayers[gId].oldPointFinish || 0;
      }
    });

    const sortedEntries = Object.keys(simulatedPlayers).map(gId => ({
      googleId: gId,
      ...simulatedPlayers[gId]
    }));

    sortedEntries.sort((a, b) => {
      if (b.newPoint !== a.newPoint) return b.newPoint - a.newPoint;
      if (b.newPointFinish !== a.newPointFinish) return b.newPointFinish - a.newPointFinish;
      return a.googleId.localeCompare(b.googleId);
    });

    const changes = [];
    sortedEntries.forEach((entry, index) => {
      const newRank = index + 1;
      const prevRank = entry.previousRank;
      let movement = 'stay';
      if (prevRank === null || prevRank === undefined || String(prevRank) === '') {
        movement = 'new';
      } else if (newRank < prevRank) {
        movement = 'up';
      } else if (newRank > prevRank) {
        movement = 'down';
      }

      changes.push({
        googleId: entry.googleId,
        nama: entry.nama || '',
        oldPoint: entry.oldPoint,
        addedPoint: entry.addedPoint || 0,
        newPoint: entry.newPoint,
        oldPointFinish: entry.oldPointFinish,
        addedPointFinish: entry.addedPointFinish || 0,
        newPointFinish: entry.newPointFinish,
        previousRank: prevRank,
        newRank: newRank,
        movement: movement
      });
    });

    return { status: 'success', changes };
  } catch (err) {
    console.error('calculateLeaderboardPreview error: ' + err.message);
    return { status: 'error', message: 'Gagal menghitung preview: ' + err.message };
  }
}

function previewTournamentResultsToLeaderboard(data) {
  try {
    const eventId = String(data.eventId || '').trim();
    const sheetName = String(data.sheetName || '').trim();
    if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });
    if (!sheetName) return res({ status: 'error', message: 'sheetName wajib diisi' });

    const excludedGoogleIds = new Set((data.excludedGoogleIds || []).map(id => String(id || '').trim()).filter(Boolean));

    const boardSheet = SS.getSheetByName("Leaderboard");
    if (!boardSheet) return res({ status: 'error', message: 'Sheet Leaderboard tidak ditemukan' });

    const boardValues = boardSheet.getDataRange().getDisplayValues();
    if (boardValues.length < 2) return res({ status: 'error', message: 'Leaderboard kosong' });

    const boardHeaders = boardValues[0];
    const boardRows = boardValues.slice(1);
    const boardMap = {};
    boardHeaders.forEach((h, i) => {
      boardMap[String(h).toLowerCase().trim()] = i;
    });

    const idCol = boardMap['google_id'] !== undefined ? boardMap['google_id'] : boardMap['googleid'];
    const pointCol = boardMap['point'];
    const pointFinishCol = boardMap['point_finish'] !== undefined ? boardMap['point_finish'] : boardMap['pointfinish'];
    const prevRankCol = boardMap['previous_rank'];
    const statusCol = boardMap['status'];

    if (idCol === undefined || pointCol === undefined || pointFinishCol === undefined) {
      return res({ status: 'error', message: 'Header Leaderboard tidak lengkap' });
    }

    const syncSheet = SS.getSheetByName('TournamentLeaderboardSync');
    const alreadySynced = [];
    if (syncSheet) {
      const syncValues = syncSheet.getDataRange().getValues();
      if (syncValues.length >= 2) {
        const syncHeaders = syncValues[0];
        const syncMap = {};
        syncHeaders.forEach((h, i) => {
          syncMap[String(h).toLowerCase().trim()] = i;
        });
        const syncEventIdCol = syncMap['event_id'];
        const syncGoogleIdCol = syncMap['google_id'];
        if (syncEventIdCol !== undefined && syncGoogleIdCol !== undefined) {
          syncValues.slice(1).forEach(row => {
            const sid = String(row[syncEventIdCol] || '').trim();
            const sgid = String(row[syncGoogleIdCol] || '').trim();
            if (sid === eventId) {
              alreadySynced.push({ eventId: sid, googleId: sgid });
            }
          });
        }
      }
    }

    const sheetReadResult = readTournamentResultSheet(sheetName, eventId);
    if (sheetReadResult.status === 'error') {
      return res(sheetReadResult);
    }

    const filteredResults = sheetReadResult.results.filter(r => {
      const gId = String(r.googleId || '').trim();
      if (!gId) return false;
      if (excludedGoogleIds.has(gId)) return false;
      return !alreadySynced.some(s => s.eventId === eventId && s.googleId === gId);
    });

    const excludedFromResults = sheetReadResult.results.filter(r => {
      const gId = String(r.googleId || '').trim();
      return excludedGoogleIds.has(gId);
    });

    const alreadySyncedInResults = sheetReadResult.results.filter(r => {
      const gId = String(r.googleId || '').trim();
      if (!gId) return false;
      return alreadySynced.some(s => s.eventId === eventId && s.googleId === gId);
    }).map(r => r.googleId);

    const preview = calculateLeaderboardPreview(boardRows, boardMap, filteredResults, eventId);
    if (preview.status === 'error') {
      return res(preview);
    }

    const tournamentParticipantIds = new Set((filteredResults || []).map(r => String(r.googleId || '').trim()).filter(Boolean));

    const enrichedChanges = (preview.changes || []).map(c => {
      const nickname = getPlayerNickname(c.googleId);
      const isTournamentParticipant = tournamentParticipantIds.has(String(c.googleId || '').trim());
      const isExcluded = excludedGoogleIds.has(String(c.googleId || '').trim());
      return {
        ...c,
        nickname: nickname || c.nama || '',
        displayName: nickname || c.nama || c.googleId,
        isTournamentParticipant: isTournamentParticipant,
        isExcluded: isExcluded
      };
    });

    const tournamentParticipants = enrichedChanges.filter(c => c.isTournamentParticipant && !c.isExcluded);
    const excludedPlayers = enrichedChanges.filter(c => c.isExcluded);
    const unchangedPlayers = enrichedChanges.filter(c => !c.isTournamentParticipant && !c.isExcluded);

    return res({
      status: 'success',
      dryRun: true,
      eventId: eventId,
      sheetName: sheetName,
      changes: enrichedChanges,
      tournamentParticipants: tournamentParticipants,
      excludedPlayers: excludedPlayers,
      unchangedPlayers: unchangedPlayers,
      summary: {
        totalRows: sheetReadResult.totalRows,
        processedRows: sheetReadResult.processedRows,
        tournamentParticipants: sheetReadResult.processedRows,
        playersToSync: tournamentParticipants.length,
        excludedPlayers: excludedPlayers.length,
        leaderboardAfterUpdate: enrichedChanges.length,
        playersReceivingPoints: filteredResults.length,
        unchangedPlayers: unchangedPlayers.length
      },
      warnings: sheetReadResult.warnings,
      alreadySynced: alreadySyncedInResults
    });
  } catch (err) {
    console.error('previewTournamentResultsToLeaderboard error: ' + err.message);
    return res({ status: 'error', message: 'Gagal preview tournament results: ' + err.message });
  }
}

function applyTournamentResultsToLeaderboard(data) {
  try {
    const eventId = String(data.eventId || '').trim();
    const sheetName = String(data.sheetName || '').trim();
    if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });
    if (!sheetName) return res({ status: 'error', message: 'sheetName wajib diisi' });

    const excludedGoogleIds = new Set((data.excludedGoogleIds || []).map(id => String(id || '').trim()).filter(Boolean));

    const boardSheet = SS.getSheetByName("Leaderboard");
    if (!boardSheet) return res({ status: 'error', message: 'Sheet Leaderboard tidak ditemukan' });

    const boardValues = boardSheet.getDataRange().getDisplayValues();
    if (boardValues.length < 2) return res({ status: 'error', message: 'Leaderboard kosong' });

    const boardHeaders = boardValues[0];
    const boardRows = boardValues.slice(1);
    const boardMap = {};
    boardHeaders.forEach((h, i) => {
      boardMap[String(h).toLowerCase().trim()] = i;
    });

    const idCol = boardMap['google_id'] !== undefined ? boardMap['google_id'] : boardMap['googleid'];
    const pointCol = boardMap['point'];
    const pointFinishCol = boardMap['point_finish'] !== undefined ? boardMap['point_finish'] : boardMap['pointfinish'];
    const prevRankCol = boardMap['previous_rank'];
    const statusCol = boardMap['status'];

    if (idCol === undefined || pointCol === undefined || pointFinishCol === undefined) {
      return res({ status: 'error', message: 'Header Leaderboard tidak lengkap' });
    }

    const sheetReadResult = readTournamentResultSheet(sheetName, eventId);
    if (sheetReadResult.status === 'error') {
      return res(sheetReadResult);
    }

    const resultsToApply = [];
    const skippedSynced = [];
    const skippedNoGoogleId = [];
    const skippedExcluded = [];

    sheetReadResult.results.forEach(r => {
      const gId = String(r.googleId || '').trim();
      if (!gId) {
        skippedNoGoogleId.push({ row: r.row, googleId: r.googleId });
        return;
      }
      if (excludedGoogleIds.has(gId)) {
        skippedExcluded.push(r.googleId);
        return;
      }
      if (isAlreadySynced(eventId, gId)) {
        skippedSynced.push(gId);
        return;
      }
      resultsToApply.push(r);
    });

    if (resultsToApply.length === 0) {
      return res({
        status: 'success',
        message: 'Tidak ada data baru untuk di-apply',
        skippedSynced: skippedSynced,
        skippedNoGoogleId: skippedNoGoogleId,
        skippedExcluded: skippedExcluded,
        warnings: sheetReadResult.warnings
      });
    }

    const rowMap = {};
    boardRows.forEach((row, index) => {
      const gId = String(row[idCol] || '').trim();
      if (gId) {
        rowMap[gId] = {
          rowIndex: index,
          point: Number(row[pointCol]) || 0,
          pointFinish: Number(row[pointFinishCol]) || 0,
          previousRank: prevRankCol !== undefined ? (String(row[prevRankCol] || '').trim() ? Number(row[prevRankCol]) : null) : null
        };
      }
    });

    const updates = [];
    const newRows = [];

    resultsToApply.forEach(r => {
      const gId = String(r.googleId || '').trim();
      if (!gId) return;

      const addedPoint = Number(r.point) || 0;
      const addedPointFinish = Number(r.pointFinish) || 0;

      if (rowMap[gId]) {
        rowMap[gId].point += addedPoint;
        rowMap[gId].pointFinish += addedPointFinish;
      } else {
        rowMap[gId] = {
          rowIndex: -1,
          point: addedPoint,
          pointFinish: addedPointFinish,
          previousRank: null
        };
      }
    });

    const sortedEntries = Object.keys(rowMap).map(gId => ({
      googleId: gId,
      ...rowMap[gId]
    }));

    sortedEntries.sort((a, b) => {
      if (b.point !== a.point) return b.point - a.point;
      if (b.pointFinish !== a.pointFinish) return b.pointFinish - a.pointFinish;
      return a.googleId.localeCompare(b.googleId);
    });

    sortedEntries.forEach((entry, index) => {
      const currentRank = index + 1;
      const prevRank = entry.previousRank;
      let status = 'stay';
      if (prevRank === null || prevRank === undefined || String(prevRank) === '') {
        status = 'new';
      } else if (prevRank > currentRank) {
        status = 'up';
      } else if (prevRank < currentRank) {
        status = 'down';
      }

      updates.push({
        googleId: entry.googleId,
        rank: currentRank,
        previousRank: prevRank,
        status: status,
        point: entry.point,
        pointFinish: entry.pointFinish,
        addedPoint: entry.addedPoint || 0,
        addedPointFinish: entry.addedPointFinish || 0
      });
    });

    updates.forEach(update => {
      if (rowMap[update.googleId] && rowMap[update.googleId].rowIndex >= 0) {
        const sheetRow = rowMap[update.googleId].rowIndex + 2;
        if (pointCol !== undefined) {
          boardSheet.getRange(sheetRow, pointCol + 1).setValue(update.point);
        }
        if (pointFinishCol !== undefined) {
          boardSheet.getRange(sheetRow, pointFinishCol + 1).setValue(update.pointFinish);
        }
        if (statusCol !== undefined) {
          boardSheet.getRange(sheetRow, statusCol + 1).setValue(update.status);
        }
      } else {
        newRows.push([
          update.googleId,
          update.rank,
          update.status,
          update.point,
          update.pointFinish,
          ''
        ]);
      }
    });

    if (newRows.length > 0) {
      const startRow = boardSheet.getLastRow() + 1;
      boardSheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    resultsToApply.forEach(r => {
      recordSync(eventId, r.googleId, r.point, r.pointFinish);
    });

    return res({
      status: 'success',
      message: 'Berhasil apply tournament results',
      updates: updates,
      newRows: newRows.length,
      skippedSynced: skippedSynced,
      skippedNoGoogleId: skippedNoGoogleId,
      skippedExcluded: skippedExcluded,
      warnings: sheetReadResult.warnings
    });
  } catch (err) {
    console.error('applyTournamentResultsToLeaderboard error: ' + err.message);
    return res({ status: 'error', message: 'Gagal apply tournament results: ' + err.message });
  }
}

function checkNickname(nickname) {
  const sheet = SS.getSheetByName("Players");
  const data = sheet.getDataRange().getValues();
  // Case insensitive check
  const exists = data.some(row => row[3].toString().toLowerCase() === nickname.toLowerCase().trim());
  return res({ available: !exists });
}

function createProfile(data) {
  const sheet = SS.getSheetByName("Players");
  const nicknameTrimmed = data.nickname.trim();

  // Proteksi ganda agar nickname tetap unik
  const dataRows = sheet.getDataRange().getValues();
  if (dataRows.some(row => row[3].toString().toLowerCase() === nicknameTrimmed.toLowerCase())) {
    return res({ status: "error", message: "Nickname sudah diambil!" });
  }

  const publicProfileId = generateShortId();

  sheet.appendRow([
    data.googleId,
    data.email,
    data.googleName,
    nicknameTrimmed,
    data.photoUrl,
    "Blader",
    new Date(), // Join Date
    new Date(), // Last Updated
    "",          // slogan
    "",          // catatan
    publicProfileId
  ]);
  return res({ status: "success", public_profile_id: publicProfileId });
}

function postAttendance(data) {
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const eventSheet = SS.getSheetByName("Events");
  if (!eventSheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

  const eventValues = eventSheet.getDataRange().getDisplayValues();
  const eventHeaders = eventValues[0];
  const eventRows = eventValues.slice(1);
  const eventMap = {};
  eventHeaders.forEach((h, i) => {
    eventMap[String(h).toLowerCase().trim()] = i;
  });

  const eventIdCol = eventMap['event_id'] !== undefined ? eventMap['event_id'] : eventMap['id'];
  const statusCol = eventMap['status'];
  const tournamentStatusCol = eventMap['tournament_status'];

  const targetEvent = eventRows.find(r =>
    String(r[eventIdCol] || '').trim() === eventId
  );

  if (!targetEvent) {
    return res({ status: 'error', message: 'Event tidak ditemukan' });
  }

  const eventStatus = String(targetEvent[statusCol] || '').toLowerCase().trim();
  if (eventStatus !== 'aktif') {
    return res({ status: 'error', message: 'Absensi hanya bisa dilakukan saat event sedang aktif.' });
  }

  const tournamentStatus = tournamentStatusCol !== undefined
    ? String(targetEvent[tournamentStatusCol] || '').toLowerCase().trim()
    : 'not_started';

  if (tournamentStatus === 'running' || tournamentStatus === 'finished') {
    return res({ status: 'error', message: 'Check-in sudah ditutup karena tournament sudah dimulai.' });
  }

  const sheet = SS.getSheetByName("Attendance");
  const values = sheet.getDataRange().getValues();

  const isDuplicate = values.some(row => row[1] == data.eventId && row[2] == data.googleId);

  if (isDuplicate) {
    return res({ status: "exists", message: "Anda sudah absen di event ini!" });
  }

  sheet.appendRow([
    new Date(),
    data.eventId,
    data.googleId,
    data.nickname,
    data.email,
    data.foto
  ]);

  return res({ status: "success" });
}

function updateNickname(data) {
  const sheet = SS.getSheetByName("Players");
  if (!sheet) return res({ status: "error", message: "Sheet Players tidak ditemukan" });

  if (!data || !data.googleId || !data.newNickname) {
    return res({ status: "error", message: "Data tidak lengkap" });
  }

  const newNick = String(data.newNickname).trim();
  if (newNick.length < 3 || newNick.length > 20) {
    return res({ status: "error", message: "Nickname harus 3-20 karakter!" });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(newNick)) {
    return res({ status: "error", message: "Nickname hanya boleh huruf, angka, dan underscore!" });
  }

  // Guard: cek izin ganti nickname dari sheet Settings
  const settingsSheet = SS.getSheetByName("Settings");
  if (settingsSheet) {
    const sRows = settingsSheet.getDataRange().getValues();
    const sIdx = sRows.findIndex(r => String(r[0]).toLowerCase() === "allow_nickname_change");
    const allowed = sIdx !== -1 && String(sRows[sIdx][1]).toLowerCase() === "true";
    if (!allowed) {
      return res({ status: "error", message: "Ganti nickname sedang dinonaktifkan oleh Admin" });
    }
  }

  const rows = sheet.getDataRange().getValues();
  // Gunakan .toString() agar ID dari Google (string) cocok dengan ID di Sheet
  const rowIndex = rows.findIndex(row => row[0].toString() === data.googleId.toString());

  if (rowIndex === -1) {
    return res({ status: "error", message: "Profil tidak ditemukan di database" });
  }

  // Validasi: Cek apakah nickname baru sudah dipakai orang lain
  const isTaken = rows.some((row, index) => index !== rowIndex && row[3].toString().toLowerCase() === newNick.toLowerCase());

  if (isTaken) {
    return res({ status: "error", message: "Nickname sudah digunakan Blader lain!" });
  }

  // Tidak perlu update jika nickname sama dengan yang lama
  if (rows[rowIndex][3].toString() === newNick) {
    return res({ status: "success", message: "Nickname tidak berubah" });
  }

  // Update kolom D (4) untuk Nickname dan H (8) untuk Last Updated
  sheet.getRange(rowIndex + 1, 4).setValue(newNick);
  sheet.getRange(rowIndex + 1, 8).setValue(new Date());

  return res({ status: "success" });
}

function createEvent(data) {
  const sheet = SS.getSheetByName("Events");
  if (!sheet) return res({ status: "error", message: "Sheet Events tidak ditemukan" });

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const statusIdx = headers.findIndex(h => String(h).toLowerCase().trim() === 'status');

  const ruleId = String(data.rule_id || '').trim();
  if (ruleId) {
    const rulesSheet = SS.getSheetByName("Rules");
    if (rulesSheet) {
      const ruleRows = rulesSheet.getDataRange().getValues();
      if (ruleRows.length >= 2) {
        const ruleHeaders = ruleRows[0];
        const ruleDataRows = ruleRows.slice(1);
        const ruleMap = {};
        ruleHeaders.forEach((h, i) => {
          ruleMap[String(h).toLowerCase().trim()] = i;
        });
        const ruleExists = ruleDataRows.some(row => String(row[ruleMap['rule_id']] || '').toLowerCase() === ruleId.toLowerCase());
        if (!ruleExists) {
          return res({ status: 'error', message: 'Rule ID "' + ruleId + '" tidak ditemukan di sheet Rules' });
        }
      }
    }
  }

  // 1. Akhiri semua event aktif menggunakan endEvent logic
  if (statusIdx >= 0) {
    const eventValues = sheet.getDataRange().getDisplayValues();
    const eventHeaders = eventValues[0];
    const eventRows = eventValues.slice(1);
    const eventMap = {};
    eventHeaders.forEach((h, i) => {
      eventMap[String(h).toLowerCase().trim()] = i;
    });
    const eventIdCol = eventMap['event_id'] !== undefined ? eventMap['event_id'] : eventMap['id'];
    const eventStatusCol = eventMap['status'];

    for (let i = 0; i < eventRows.length; i++) {
      const rowEventId = String(eventRows[i][eventIdCol] || '').trim();
      const rowStatus = String(eventRows[i][eventStatusCol] || '').toLowerCase().trim();
      if (rowStatus === 'aktif') {
        updateEventStatus(rowEventId, 'selesai');
      }
    }
  }

  // 2. Generate event ID
  const newId = generateEventId();

  // 3. Tentukan tanggal_event dan waktu_event
  let tanggal_event = String(data.tanggal_event || '').trim();
  let waktu_event = String(data.waktu_event || '').trim();

  if (!tanggal_event || !waktu_event) {
    const waktu = data.waktu || "20:00 WIB";
    const parsed = parseWaktuString(waktu);
    if (!tanggal_event) tanggal_event = parsed.tanggal_event || '';
    if (!waktu_event) waktu_event = parsed.waktu_event || waktu;
  }

  // 4. Tambah event baru dengan 12 kolom
  sheet.appendRow([
    newId,
    data.nama || '',
    new Date(),
    data.lokasi || '',
    "upcoming",
    "",
    "",
    "",
    "",
    tanggal_event,
    waktu_event,
    ruleId,
    "not_started"
  ]);

  return res({ status: "success", message: "Event berhasil dibuat!", event_id: newId });
}

function updateEventStatus(eventId, targetStatus) {
  const sheet = SS.getSheetByName("Events");
  if (!sheet) return { status: 'error', message: 'Sheet Events tidak ditemukan' };

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1);

  if (rows.length === 0) {
    return { status: 'error', message: 'Tidak ada event' };
  }

  const map = getHeaderMap(sheet);
  const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];
  const statusCol = map['status'];

  if (eventIdCol === undefined || statusCol === undefined) {
    return { status: 'error', message: 'Header event_id/status tidak ditemukan di Events' };
  }

  const targetRowIndex = rows.findIndex(r =>
    String(r[eventIdCol] || '').trim() === String(eventId || '').trim()
  );

  if (targetRowIndex === -1) {
    return { status: 'error', message: 'Event tidak ditemukan' };
  }

  const currentStatus = String(rows[targetRowIndex][statusCol] || '').toLowerCase().trim();
  const normalizedTarget = String(targetStatus || '').toLowerCase().trim();

  const allowedTransitions = {
    'upcoming': ['aktif'],
    'aktif': ['selesai'],
    'selesai': []
  };

  if (currentStatus === normalizedTarget) {
    if (normalizedTarget === 'aktif') {
      return { status: 'error', message: 'Event sudah aktif.', code: 'already_active' };
    } else if (normalizedTarget === 'selesai') {
      return { status: 'error', message: 'Event sudah selesai.', code: 'already_ended' };
    } else if (normalizedTarget === 'upcoming') {
      return { status: 'error', message: 'Event sudah dalam status upcoming.', code: 'already_upcoming' };
    }
  }

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(normalizedTarget)) {
    if (currentStatus === 'aktif' && normalizedTarget === 'upcoming') {
      return { status: 'error', message: 'Event sudah aktif dan tidak dapat diubah menjadi upcoming.', code: 'transition_not_allowed' };
    }
    if (currentStatus === 'selesai' && normalizedTarget === 'aktif') {
      return { status: 'error', message: 'Event sudah selesai dan tidak dapat diaktifkan kembali.', code: 'transition_not_allowed' };
    }
    if (currentStatus === 'selesai' && normalizedTarget === 'upcoming') {
      return { status: 'error', message: 'Event sudah selesai dan tidak dapat diubah menjadi upcoming.', code: 'transition_not_allowed' };
    }
    if (currentStatus === 'upcoming' && normalizedTarget === 'selesai') {
      return { status: 'error', message: 'Event belum dimulai.', code: 'transition_not_allowed' };
    }
    return { status: 'error', message: 'Transisi status tidak diizinkan: ' + currentStatus + ' → ' + normalizedTarget, code: 'transition_not_allowed' };
  }

  sheet.getRange(targetRowIndex + 2, statusCol + 1).setValue(normalizedTarget);

  return { status: 'success', data: { event_id: eventId, new_status: normalizedTarget } };
}

function startEvent(data) {
  const eventId = String(data.eventId || '').trim();
  Logger.log('[START EVENT] eventId=' + eventId);
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const result = updateEventStatus(eventId, 'aktif');
  if (result.status === 'success') {
    return res({ status: 'success', message: 'Event berhasil dimulai!', event_id: eventId });
  }
  return res(result);
}

function endEvent(data) {
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const result = updateEventStatus(eventId, 'selesai');
  if (result.status === 'success') {
    return res({ status: 'success', message: 'Event berhasil diakhiri!', event_id: eventId });
  }
  return res(result);
}

function startTournamentStatus(data) {
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const sheet = SS.getSheetByName("Events");
  if (!sheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1);

  if (rows.length === 0) {
    return res({ status: 'error', message: 'Tidak ada event' });
  }

  const map = getHeaderMap(sheet);
  const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];
  const tournamentStatusCol = map['tournament_status'];

  if (eventIdCol === undefined) {
    return res({ status: 'error', message: 'Header event_id tidak ditemukan di Events' });
  }

  const targetRowIndex = rows.findIndex(r =>
    String(r[eventIdCol] || '').trim() === eventId
  );

  if (targetRowIndex === -1) {
    return res({ status: 'error', message: 'Event tidak ditemukan' });
  }

  const currentTournamentStatus = tournamentStatusCol !== undefined
    ? String(rows[targetRowIndex][tournamentStatusCol] || '').toLowerCase().trim()
    : 'not_started';

  if (currentTournamentStatus === 'running') {
    return res({ status: 'error', message: 'Tournament sudah berjalan.', code: 'already_running' });
  }

  if (currentTournamentStatus === 'finished') {
    return res({ status: 'error', message: 'Tournament sudah selesai.', code: 'already_finished' });
  }

  if (tournamentStatusCol !== undefined) {
    sheet.getRange(targetRowIndex + 2, tournamentStatusCol + 1).setValue('running');
  }

  return res({ status: 'success', message: 'Tournament berhasil dimulai!', event_id: eventId, tournament_status: 'running' });
}

function finishTournamentStatus(data) {
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const sheet = SS.getSheetByName("Events");
  if (!sheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1);

  if (rows.length === 0) {
    return res({ status: 'error', message: 'Tidak ada event' });
  }

  const map = getHeaderMap(sheet);
  const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];
  const tournamentStatusCol = map['tournament_status'];

  if (eventIdCol === undefined) {
    return res({ status: 'error', message: 'Header event_id tidak ditemukan di Events' });
  }

  const targetRowIndex = rows.findIndex(r =>
    String(r[eventIdCol] || '').trim() === eventId
  );

  if (targetRowIndex === -1) {
    return res({ status: 'error', message: 'Event tidak ditemukan' });
  }

  const currentTournamentStatus = tournamentStatusCol !== undefined
    ? String(rows[targetRowIndex][tournamentStatusCol] || '').toLowerCase().trim()
    : 'not_started';

  if (currentTournamentStatus === 'finished') {
    return res({ status: 'error', message: 'Tournament sudah selesai.', code: 'already_finished' });
  }

  if (currentTournamentStatus !== 'running') {
    return res({ status: 'error', message: 'Tournament belum dimulai. Tidak dapat diselesaikan.', code: 'not_running' });
  }

  if (tournamentStatusCol !== undefined) {
    sheet.getRange(targetRowIndex + 2, tournamentStatusCol + 1).setValue('finished');
  }

  deleteTempMatchMapSheet(eventId);

  return res({ status: 'success', message: 'Tournament berhasil diselesaikan!', event_id: eventId, tournament_status: 'finished' });
}

function updateEvent(data) {
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const sheet = SS.getSheetByName("Events");
  if (!sheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1);

  if (rows.length === 0) {
    return res({ status: 'error', message: 'Tidak ada event' });
  }

  const map = getHeaderMap(sheet);
  const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];

  if (eventIdCol === undefined) {
    return res({ status: 'error', message: 'Header event_id tidak ditemukan di Events' });
  }

  const targetRowIndex = rows.findIndex(r =>
    String(r[eventIdCol] || '').trim() === String(eventId || '').trim()
  );

  if (targetRowIndex === -1) {
    return res({ status: 'error', message: 'Event tidak ditemukan' });
  }

  const updatableFields = ['nama', 'lokasi', 'tanggal_event', 'waktu_event'];
  const updatedFields = [];

  updatableFields.forEach(field => {
    if (data[field] !== undefined && data[field] !== null) {
      const colIndex = map[field];
      if (colIndex !== undefined) {
        const newValue = String(data[field] || '').trim();
        sheet.getRange(targetRowIndex + 2, colIndex + 1).setValue(newValue);
        updatedFields.push(field);
      }
    }
  });

  if (data.rule_id !== undefined && data.rule_id !== null && String(data.rule_id || '').trim() !== '') {
    const ruleId = String(data.rule_id).trim();
    const rulesSheet = SS.getSheetByName("Rules");
    if (rulesSheet) {
      const ruleRows = rulesSheet.getDataRange().getValues();
      if (ruleRows.length >= 2) {
        const ruleHeaders = ruleRows[0];
        const ruleDataRows = ruleRows.slice(1);
        const ruleMap = {};
        ruleHeaders.forEach((h, i) => {
          ruleMap[String(h).toLowerCase().trim()] = i;
        });
        const ruleExists = ruleDataRows.some(row => String(row[ruleMap['rule_id']] || '').toLowerCase() === ruleId.toLowerCase());
        if (!ruleExists) {
          return res({ status: 'error', message: 'Rule ID "' + ruleId + '" tidak ditemukan di sheet Rules' });
        }
      }
    }
    const colIndex = map['rule_id'];
    if (colIndex !== undefined) {
      sheet.getRange(targetRowIndex + 2, colIndex + 1).setValue(ruleId);
      updatedFields.push('rule_id');
    }
  }

  if (updatedFields.length === 0) {
    return res({ status: 'error', message: 'Tidak ada field yang diupdate' });
  }

  return res({
    status: 'success',
    message: 'Event berhasil diperbarui',
    event_id: eventId,
    updated_fields: updatedFields
  });
}

function resetArena() {
  const sheet = SS.getSheetByName("Events");
  if (!sheet) return res({ status: "error", message: "Sheet Events tidak ditemukan" });

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1);

  if (rows.length === 0) {
    return res({ status: "success", message: "Arena berhasil dikosongkan!" });
  }

  const map = getHeaderMap(sheet);
  const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];
  const statusCol = map['status'];

  if (eventIdCol === undefined || statusCol === undefined) {
    return res({ status: "error", message: "Header event_id/status tidak ditemukan di Events" });
  }

  let endedCount = 0;
  let errors = [];

  for (let i = 0; i < rows.length; i++) {
    const rowEventId = String(rows[i][eventIdCol] || '').trim();
    const rowStatus = String(rows[i][statusCol] || '').toLowerCase().trim();

    if (rowStatus === 'aktif') {
      const result = updateEventStatus(rowEventId, 'selesai');
      if (result.status === 'success') {
        endedCount++;
      } else {
        errors.push(rowEventId + ': ' + result.message);
      }
    }
  }

  if (errors.length > 0) {
    return res({
      status: 'error',
      message: 'Beberapa event gagal diakhiri: ' + errors.join('; '),
      ended_count: endedCount,
      errors: errors
    });
  }

  return res({ status: "success", message: "Arena berhasil dikosongkan!", ended_count: endedCount });
}

function getSettings() {
  const sheet = SS.getSheetByName("Settings");
  if (!sheet) return res({});
  const rows = sheet.getDataRange().getValues();
  const settings = {};
  const seenKeys = new Set();
  // Iterasi dari BAWAH ke ATAS agar nilai terbaru (yang biasanya di bawah)
  // yang menang bila ada duplikat key
  for (let i = rows.length - 1; i >= 0; i--) {
    const key = rows[i][0];
    if (!key) continue;
    const normalizedKey = String(key).trim();
    if (!normalizedKey || seenKeys.has(normalizedKey.toLowerCase())) continue;
    seenKeys.add(normalizedKey.toLowerCase());
    let value = rows[i][1];
    if (typeof value === 'string') value = value.trim();
    settings[normalizedKey] = value;
  }
  return res(settings);
}

// ============================================
// PROFIL: BIO (Slogan + Catatan)
// ============================================
function updateBio(data) {
  const sheet = SS.getSheetByName("Players");
  if (!sheet) return res({ status: "error", message: "Sheet Players tidak ditemukan" });

  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex(row => row[0].toString() === String(data.googleId));
  if (rowIndex === -1) return res({ status: "error", message: "Profil tidak ditemukan" });

  const slogan = String(data.slogan || "").slice(0, 50);
  const catatan = String(data.catatan || "").slice(0, 150);

  // Kolom: 9 = slogan (index 8), 10 = catatan (index 9)
  sheet.getRange(rowIndex + 1, 9).setValue(slogan);
  sheet.getRange(rowIndex + 1, 10).setValue(catatan);

  return res({ status: "success", slogan: slogan, catatan: catatan });
}

// ============================================
// PROFIL: UPLOAD FOTO KE GOOGLE DRIVE
// ============================================
function getLalapanFolder_() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty("LALAPAN_DRIVE_FOLDER_ID");
  let folder = null;
  if (folderId) {
    try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; }
  }
  if (!folder) {
    folder = DriveApp.createFolder("Lalapan Profile Photos");
    props.setProperty("LALAPAN_DRIVE_FOLDER_ID", folder.getId());
  }
  return folder;
}

function uploadProfilePhoto(data) {
  try {
    const googleId = String(data.googleId || "");
    const base64 = String(data.base64 || "");
    if (!googleId) return res({ status: "error", message: "googleId kosong" });
    if (!base64) return res({ status: "error", message: "Data foto kosong" });

    const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return res({ status: "error", message: "Format foto tidak valid" });

    const mime = matches[1];
    const ext = mime.split("/")[1];
    const bytes = Utilities.base64Decode(matches[2]);
    const fileName = googleId + "_profile.png"; // nama spesifik per user (tidak duplikat)
    const blob = Utilities.newBlob(bytes, mime, fileName);

    const folder = getLalapanFolder_();

    // Hapus file lama (jika ada) agar tidak menumpuk duplikat di Drive
    const existing = folder.getFilesByName(fileName);
    while (existing.hasNext()) {
      existing.next().setTrashed(true);
    }

    const file = folder.createFile(blob);
    // File dapat diakses siapa saja via link -> bisa ditampilkan di <img>
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // Pakai endpoint thumbnail (lebih aman untuk di-embed di <img>)
    const photoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";

    // Update kolom photoUrl (index 4) di sheet Players
    const pSheet = SS.getSheetByName("Players");
    const prows = pSheet.getDataRange().getValues();
    const pIdx = prows.findIndex(r => r[0].toString() === googleId);
    if (pIdx !== -1) pSheet.getRange(pIdx + 1, 5).setValue(photoUrl);

    // Update kolom foto di sheet Leaderboard (jika ada)
    const lSheet = SS.getSheetByName("Leaderboard");
    if (lSheet) {
      const lrows = lSheet.getDataRange().getValues();
      const fcol = lrows[0].findIndex(h => String(h).toLowerCase() === "foto");
      if (fcol >= 0) {
        const lIdx = lrows.slice(1).findIndex(r => r[0].toString() === googleId);
        if (lIdx !== -1) lSheet.getRange(lIdx + 2, fcol + 1).setValue(photoUrl);
      }
    }

    // Update kolom foto di sheet Attendance (semua baris milik user)
    // Struktur Attendance: 0=date,1=eventId,2=googleId,3=nickname,4=email,5=foto
    const aSheet = SS.getSheetByName("Attendance");
    if (aSheet) {
      const arows = aSheet.getDataRange().getValues();
      for (let i = 1; i < arows.length; i++) {
        if (String(arows[i][2]) === googleId) {
          aSheet.getRange(i + 1, 6).setValue(photoUrl);
        }
      }
    }

    return res({ status: "success", photoUrl: photoUrl });
  } catch (err) {
    return res({ status: "error", message: "Gagal upload foto: " + err.message });
  }
}

// ============================================
// ADMIN: UPDATE POIN PEMAIN
// ============================================
function updatePoints(data) {
  const lSheet = SS.getSheetByName("Leaderboard");
  if (!lSheet) return res({ status: "error", message: "Sheet Leaderboard tidak ditemukan" });

  let googleId = String(data.googleId || "");
  // Boleh cari via nickname (identifier) lewat sheet Players
  if (!googleId && data.identifier) {
    const pSheet = SS.getSheetByName("Players");
    const prows = pSheet.getDataRange().getValues();
    const found = prows.find(r => String(r[3]).toLowerCase() === String(data.identifier).toLowerCase());
    if (found) googleId = String(found[0]);
  }
  if (!googleId) return res({ status: "error", message: "Pemain tidak ditemukan" });

  const rows = lSheet.getDataRange().getValues();
  const idx = rows.findIndex(r => r[0].toString() === googleId);
  if (idx === -1) return res({ status: "error", message: "Pemain tidak ada di leaderboard" });

  const point = Number(data.point) || 0;
  const pointFinish = Number(data.pointFinish) || 0;

  // Kolom: 3 = point (index 2), 4 = pointFinish (index 3)
  lSheet.getRange(idx + 1, 3).setValue(point);
  lSheet.getRange(idx + 1, 4).setValue(pointFinish);

  return res({ status: "success", googleId: googleId, point: point, pointFinish: pointFinish });
}

// ============================================
// ADMIN: TOGGLE IZIN GANTI NICKNAME (global)
// ============================================
function toggleNicknameSetting() {
  const sheet = SS.getSheetByName("Settings");
  if (!sheet) return res({ status: "error", message: "Sheet Settings tidak ditemukan" });

  const values = sheet.getDataRange().getValues();
  const idx = values.findIndex(r => String(r[0]).toLowerCase() === "allow_nickname_change");

  if (idx === -1) {
    sheet.appendRow(["allow_nickname_change", "false"]);
    return res({ status: "success", allow_nickname_change: "false" });
  }

  const current = String(values[idx][1]).toLowerCase() === "true";
  const next = current ? "false" : "true";
  sheet.getRange(idx + 1, 2).setValue(next);
  return res({ status: "success", allow_nickname_change: next });
}

// ============================================
// ADMIN: GET/SET RULE OF THE MONTH
// ============================================
function getRule() {
  const rulesSheet = SS.getSheetByName("Rules");
  if (rulesSheet) {
    const rows = rulesSheet.getDataRange().getValues();
    if (rows.length >= 2) {
      const headers = rows[0];
      const dataRows = rows.slice(1);
      const map = {};
      headers.forEach((h, i) => {
        map[String(h).toLowerCase().trim()] = i;
      });

      const activeRule = dataRows.find(row => String(row[map['status']] || '').toLowerCase().trim() === 'aktif');
      if (activeRule) {
        const rule_id = String(activeRule[map['rule_id']] || '');
        const nama = String(activeRule[map['nama']] || '');
        const periode = String(activeRule[map['periode']] || '');
        const title = String(activeRule[map['title']] || '');
        const image_url = String(activeRule[map['image_url']] || '');
        const warning = String(activeRule[map['warning']] || '');
        const details = String(activeRule[map['details']] || '');

        return res({
          rule_id: rule_id,
          rule_nama: nama,
          rule_periode: periode,
          rule_title: title,
          rule_image_url: image_url,
          rule_warning: warning,
          rule_details: details,
          rule_status: 'aktif'
        });
      }
    }
  }

  const sheet = SS.getSheetByName("Settings");
  if (!sheet) return res({});
  const rows = sheet.getDataRange().getValues();
  const rule = {};
  const ruleKeys = ['rule_title', 'rule_image_url', 'rule_warning', 'rule_details'];
  rows.forEach(r => {
    if (r[0]) {
      const key = String(r[0]).toLowerCase();
      if (ruleKeys.includes(key)) {
        rule[key] = r[1];
      }
    }
  });
  return res(rule);
}

function saveRule(data) {
  const rulesSheet = initRulesSheet();
  if (!rulesSheet) return res({ status: "error", message: "Sheet Rules tidak ditemukan" });

  const headers = rulesSheet.getDataRange().getValues()[0] || [];
  const map = {};
  headers.forEach((h, i) => {
    map[String(h).toLowerCase().trim()] = i;
  });

  const requiredCols = ['rule_id', 'nama', 'periode', 'title', 'image_url', 'warning', 'details', 'status'];
  const missing = requiredCols.filter(c => map[c] === undefined);
  if (missing.length > 0) {
    return res({ status: 'error', message: 'Header Rules tidak lengkap: ' + missing.join(', ') });
  }

  const ruleId = String(data.rule_id || '').trim();
  const nama = String(data.nama || 'Rule of the Month').trim();
  const periode = String(data.periode || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM')).trim();
  const title = String(data.title || data.rule_title || '').trim();
  const image_url = String(data.image_url || data.rule_image_url || '').trim();
  const warning = String(data.warning || data.rule_warning || '').trim();
  const details = String(data.details || data.rule_details || '').trim();
  const status = String(data.status || 'aktif').toLowerCase().trim();

  const validStatuses = ['aktif', 'arsip', 'draft'];
  if (!validStatuses.includes(status)) {
    return res({ status: 'error', message: 'Status tidak valid. Gunakan: aktif, arsip, draft' });
  }

  const existingRows = rulesSheet.getDataRange().getValues();
  const dataRows = existingRows.slice(1);

  if (ruleId) {
    const rowIndex = dataRows.findIndex(row => String(row[map['rule_id']] || '').toLowerCase() === ruleId.toLowerCase());
    if (rowIndex >= 0) {
      const sheetRow = rowIndex + 2;
      rulesSheet.getRange(sheetRow, map['nama'] + 1).setValue(nama);
      rulesSheet.getRange(sheetRow, map['periode'] + 1).setValue(periode);
      rulesSheet.getRange(sheetRow, map['title'] + 1).setValue(title);
      rulesSheet.getRange(sheetRow, map['image_url'] + 1).setValue(image_url);
      rulesSheet.getRange(sheetRow, map['warning'] + 1).setValue(warning);
      rulesSheet.getRange(sheetRow, map['details'] + 1).setValue(details);
      rulesSheet.getRange(sheetRow, map['status'] + 1).setValue(status);
      return res({ status: 'success', message: 'Rule berhasil diperbarui', rule_id: ruleId });
    }
  }

  let newRuleId = ruleId;
  if (!newRuleId) {
    let maxNum = 0;
    dataRows.forEach(row => {
      const id = String(row[map['rule_id']] || '');
      const match = id.match(/^R(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    newRuleId = 'R' + String(maxNum + 1).padStart(3, '0');
  }

  rulesSheet.appendRow([newRuleId, nama, periode, title, image_url, warning, details, status]);
  return res({ status: 'success', message: 'Rule berhasil dibuat', rule_id: newRuleId });
}

// ============================================
// RULES SHEET
// ============================================

function initRulesSheet() {
  const sheet = SS.getSheetByName("Rules");
  if (!sheet) {
    const newSheet = SS.insertSheet("Rules");
    newSheet.appendRow(['rule_id', 'nama', 'periode', 'title', 'image_url', 'warning', 'details', 'status']);
    return newSheet;
  }
  return sheet;
}

function migrateRulesFromSettings() {
  const settingsSheet = SS.getSheetByName("Settings");
  const rulesSheet = initRulesSheet();

  if (!settingsSheet || !rulesSheet) {
    return res({ status: 'error', message: 'Sheet Settings atau Rules tidak ditemukan' });
  }

  const settingsRows = settingsSheet.getDataRange().getValues();
  const ruleKeys = ['rule_title', 'rule_image_url', 'rule_warning', 'rule_details'];
  const ruleData = {};

  settingsRows.forEach(r => {
    const key = String(r[0] || '').toLowerCase();
    if (ruleKeys.includes(key)) {
      ruleData[key] = String(r[1] || '');
    }
  });

  if (!ruleData.rule_title && !ruleData.rule_details) {
    return res({ status: 'success', message: 'Tidak ada rule untuk dimigrasi' });
  }

  const existingRules = rulesSheet.getDataRange().getValues();
  let nextId = 1;
  for (let i = 1; i < existingRules.length; i++) {
    const id = String(existingRules[i][0] || '');
    const match = id.match(/^R(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= nextId) nextId = num + 1;
    }
  }

  const ruleId = 'R' + String(nextId).padStart(3, '0');
  const now = new Date();
  const periode = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');

  rulesSheet.appendRow([
    ruleId,
    'Rule of the Month',
    periode,
    ruleData.rule_title || '',
    ruleData.rule_image_url || '',
    ruleData.rule_warning || '',
    ruleData.rule_details || '',
    'aktif'
  ]);

  return res({
    status: 'success',
    message: 'Rule migrated to ' + ruleId,
    rule_id: ruleId
  });
}

function getRules() {
  const sheet = SS.getSheetByName("Rules");
  if (!sheet) return res([]);

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return res([]);

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const map = {};
  headers.forEach((h, i) => {
    map[String(h).toLowerCase().trim()] = i;
  });

  const result = [];
  dataRows.forEach(row => {
    const rule_id = String(row[map['rule_id']] || '');
    if (!rule_id) return;
    result.push({
      rule_id: rule_id,
      nama: String(row[map['nama']] || ''),
      periode: String(row[map['periode']] || ''),
      title: String(row[map['title']] || ''),
      image_url: String(row[map['image_url']] || ''),
      warning: String(row[map['warning']] || ''),
      details: String(row[map['details']] || ''),
      status: String(row[map['status']] || '').toLowerCase().trim()
    });
  });

  const statusOrder = { 'aktif': 0, 'draft': 1, 'arsip': 2 };
  result.sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 99;
    const orderB = statusOrder[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.rule_id.localeCompare(b.rule_id);
  });

  return res(result);
}

function getRuleById(ruleId) {
  const sheet = SS.getSheetByName("Rules");
  if (!sheet) return res({ status: 'error', message: 'Sheet Rules tidak ditemukan' });

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return res({ status: 'error', message: 'Rule tidak ditemukan' });

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const map = {};
  headers.forEach((h, i) => {
    map[String(h).toLowerCase().trim()] = i;
  });

  const target = dataRows.find(row => String(row[map['rule_id']] || '').toLowerCase() === String(ruleId || '').toLowerCase());

  if (!target) return res({ status: 'error', message: 'Rule tidak ditemukan' });

  return res({
    rule_id: String(target[map['rule_id']] || ''),
    nama: String(target[map['nama']] || ''),
    periode: String(target[map['periode']] || ''),
    title: String(target[map['title']] || ''),
    image_url: String(target[map['image_url']] || ''),
    warning: String(target[map['warning']] || ''),
    details: String(target[map['details']] || ''),
    status: String(target[map['status']] || '').toLowerCase().trim()
  });
}

// ============================================
// CHALLONGE SHARED HELPER
// ============================================
function challongeFetch(method, urlPath, bodyObj, version) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('CHALLONGE_API_KEY');
  const username = props.getProperty('CHALLONGE_USERNAME') || apiKey;

  if (!apiKey) {
    throw new Error('Challonge API Key belum di-set di Script Properties GAS');
  }

  // Default v1 agar fungsi lama (getOpenMatches, submitMatchScore, dll) tetap works.
  // Gunakan version='v2.1' untuk fitur baru (createTournament, startTournament).
  const useV2 = String(version || 'v1').toLowerCase() === 'v2.1';
  const baseUrl = useV2 ? 'https://api.challonge.com/v2.1' : 'https://api.challonge.com/v1';
  const fullUrl = urlPath.startsWith('http') ? urlPath : baseUrl + urlPath;

  // Header wajib untuk Challonge API v2.1 (Authorization-Type: v1 agar API key v1 tetap berlaku).
  const options = useV2
    ? {
      "method": method,
      "headers": {
        "Authorization": apiKey,
        "Authorization-Type": "v1",
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/json"
      },
      "muteHttpExceptions": true
    }
    : {
      "method": method,
      "headers": {
        "Authorization": 'Basic ' + Utilities.base64Encode(username + ':' + apiKey)
      },
      "muteHttpExceptions": true
    };

  if (bodyObj !== undefined && bodyObj !== null) {
    options.payload = JSON.stringify(bodyObj);
  }

  const isGetRequest = method.toLowerCase() === 'get';
  const cache = CacheService.getScriptCache();
  const cacheKey = isGetRequest ? 'challonge_' + Utilities.base64Encode(fullUrl) : null;

  if (isGetRequest) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      Logger.log('[CACHE HIT] Returning cached data for: ' + fullUrl);
      return JSON.parse(cachedData);
    }
  }

  Logger.log('==========================');
  Logger.log('CHALLONGE REQUEST');
  Logger.log('==========================');
  Logger.log('FULL URL: ' + fullUrl);
  Logger.log('METHOD: ' + method);
  Logger.log('HEADERS: ' + JSON.stringify(options.headers));
  Logger.log('BODY: ' + (options.payload || '(none)'));
  Logger.log('==========================');

  try {
    const response = UrlFetchApp.fetch(fullUrl, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    Logger.log('==========================');
    Logger.log('CHALLONGE RESPONSE');
    Logger.log('==========================');
    Logger.log('STATUS: ' + code);
    Logger.log('RESPONSE: ' + text);
    Logger.log('==========================');

    if (code < 200 || code >= 300) {
      console.error('Challonge API error (HTTP ' + code + '): ' + text);
      let errorDetail = text;
      try {
        const parsed = JSON.parse(text);
        errorDetail = parsed.errors ? JSON.stringify(parsed.errors) : (parsed.error ? parsed.error : text);
      } catch (e) {
        // keep original text if not JSON
      }
      return { __error: true, code: code, text: errorDetail, url: fullUrl };
    }

    if (isGetRequest) {
      cache.put(cacheKey, text, 180);
      Logger.log('[CACHE SAVED] Saved response for: ' + fullUrl);
    }

    return JSON.parse(text);
  } catch (e) {
    console.error('Challonge fetch failed: ' + e.message);
    throw new Error('Gagal terhubung ke Challonge (' + fullUrl + '): ' + e.message);
  }
}

// ============================================
// MANUAL SYNC: Hapus cache turnamen secara manual
// ============================================
function handleManualSync(data) {
  try {
    const tournamentUrl = String(data.tournamentUrl || '');
    if (!tournamentUrl) {
      return res({ status: 'error', message: 'tournamentUrl wajib diisi' });
    }

    const matchIdMatch = tournamentUrl.match(/tournaments\/([^\/]+)/);
    if (matchIdMatch && matchIdMatch[1]) {
      clearTournamentCache(matchIdMatch[1]);
    }

    return res({ status: 'success', message: 'Cache berhasil dibersihkan, data disinkronkan!' });
  } catch (err) {
    return res({ status: 'error', message: 'Gagal sync: ' + err.message });
  }
}

// ============================================
// CACHE INVALIDATION: Hapus cache tournament setelah mutasi
// ============================================
function clearTournamentCache(tournamentId) {
  if (!tournamentId) return;
  const cache = CacheService.getScriptCache();
  const baseUrl = 'https://api.challonge.com/v2.1/tournaments/' + tournamentId;
  const urlsToClear = [
    baseUrl + '.json',
    baseUrl + '/participants.json',
    baseUrl + '/matches.json'
  ];
  urlsToClear.forEach(url => {
    const cacheKey = 'challonge_' + Utilities.base64Encode(url);
    cache.remove(cacheKey);
    Logger.log('[CACHE CLEARED] Dihapus paksa karena ada update: ' + url);
  });
}

// ============================================
// CHALLONGE TOURNAMENT GENERATOR
// ============================================
function generateTournament(payload) {
  try {
    const eventId = String(payload.eventId);

    const eventData = fetchActiveEvent();
    if (eventData.error || !eventData.event) {
      return res({ status: 'error', message: 'Tidak ada event aktif' });
    }
    if (eventData.event.id !== eventId) {
      return res({ status: 'error', message: 'Event tidak aktif' });
    }

    Logger.log('[CHALLONGE CONSISTENCY] eventId=' + eventId +
      ' challonge_id=' + (eventData.event.challonge_id || '') +
      ' challonge_url=' + (eventData.event.challonge_url || '') +
      ' challonge_state=' + (eventData.event.challonge_state || '') +
      ' tournament_status=' + (eventData.event.tournament_status || ''));

    if (eventData.event.challongeUrl && String(eventData.event.challongeUrl).trim() !== '') {
      return res({ status: 'success', challongeUrl: eventData.event.challongeUrl, alreadyGenerated: true });
    }

    if (!eventData.participants || eventData.participants.length < 2) {
      return res({ status: 'error', message: 'Minimal 2 peserta untuk membuat turnamen' });
    }

    const apiKey = PropertiesService.getScriptProperties().getProperty('CHALLONGE_API_KEY');
    if (!apiKey) {
      return res({ status: 'error', message: 'Challonge API Key belum di-set di Script Properties GAS' });
    }

    const format = String(payload.format || 'weekly').toLowerCase();
    const isFinal = format === 'final';

    const safeUrl = 'lalapan_bey_' + eventId + '_' + Date.now();

    const attributes = {
      name: eventData.event.nama + ' - Liga ' + new Date().getFullYear() + (isFinal ? ' (Final)' : ' (Weekly)'),
      url: safeUrl,
      description: 'Game: Beyblade X',
      tournament_type: isFinal ? 'double elimination' : 'swiss',
      private: false
    };

    if (isFinal) {
      attributes.double_elimination_options = {
        split_participants: true,
        grand_finals_modifier: 'single match'
      };
    } else {
      attributes.swiss_options = {
        rounds: 3,
        pts_for_match_win: 1,
        pts_for_match_tie: 0.5,
        pts_for_game_win: 1,
        pts_for_game_tie: 0,
        pts_for_bye: 0
      };
    }

    const createRes = challongeFetch('post', '/tournaments.json', { data: { type: 'tournament', attributes: attributes } }, 'v2.1');
    if (createRes.__error) {
      return res({ status: 'error', message: 'Gagal buat turnamen di Challonge (HTTP ' + createRes.code + '): ' + createRes.text });
    }
    if (createRes.errors) {
      return res({ status: 'error', message: 'Gagal buat turnamen di Challonge: ' + JSON.stringify(createRes.errors) });
    }

    const tournamentId = createRes.data.id;
    const challongeUrl = 'https://challonge.com/' + createRes.data.attributes.url;
    ensureTempMatchMapSheet(eventId, tournamentId);

    const validParticipants = eventData.participants.filter(p => p && p.nama && String(p.nama).trim() !== '');
    const mappingPromises = [];
    for (const participant of validParticipants) {
      const pRes = challongeFetch('post', '/tournaments/' + tournamentId + '/participants.json', {
        data: { type: 'participant', attributes: { name: String(participant.nama).trim() } }
      }, 'v2.1');
      if (pRes.__error) {
        console.error('Gagal tambah peserta ' + participant.nama + ' (HTTP ' + pRes.code + '): ' + pRes.text);
      } else if (pRes.errors) {
        console.error('Gagal tambah peserta ' + participant.nama + ': ' + JSON.stringify(pRes.errors));
      } else if (pRes.data && pRes.data.id) {
        mappingPromises.push({
          challongeParticipantId: String(pRes.data.id),
          googleId: String(participant.googleId || '').trim(),
          nickname: String(participant.nama || '').trim()
        });
      }
    }

    if (mappingPromises.length > 0) {
      saveTournamentParticipantMapping(eventId, tournamentId, mappingPromises);
    }

    const startRes = challongeFetch('put', '/tournaments/' + tournamentId + '/change_state.json', {
      data: { type: 'TournamentState', attributes: { state: 'start' } }
    }, 'v2.1');
    if (startRes.__error) {
      return res({ status: 'error', message: 'Turnamen dibuat tapi gagal dimulai (HTTP ' + startRes.code + '): ' + startRes.text });
    }
    if (startRes.errors) {
      return res({ status: 'error', message: 'Turnamen dibuat tapi gagal dimulai: ' + JSON.stringify(startRes.errors) });
    }

    const eventSheet = SS.getSheetByName("Events");
    const eventValues = eventSheet.getDataRange().getValues();
    const eventHeaders = eventValues[0];
    const eventRows = eventValues.slice(1);

    const headerMap = {};
    eventHeaders.forEach((h, i) => {
      headerMap[String(h).toLowerCase().trim()] = i;
    });

    const challongeCol = headerMap['challonge_url'] !== undefined ? headerMap['challonge_url'] : (headerMap['challongeurl'] !== undefined ? headerMap['challongeurl'] : -1);
    const idCol = headerMap['challonge_id'] !== undefined ? headerMap['challonge_id'] : (headerMap['challongeid'] !== undefined ? headerMap['challongeid'] : -1);
    const eventIdCol = headerMap['event_id'] !== undefined ? headerMap['event_id'] : (headerMap['id'] !== undefined ? headerMap['id'] : -1);
    const stateCol = headerMap['challonge_state'] !== undefined ? headerMap['challonge_state'] : (headerMap['challongestate'] !== undefined ? headerMap['challongestate'] : -1);
    const createdCol = headerMap['created_at'] !== undefined ? headerMap['created_at'] : -1;

    if (eventIdCol >= 0) {
      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][eventIdCol]) === eventId) {
          if (challongeCol >= 0) eventSheet.getRange(i + 2, challongeCol + 1).setValue(challongeUrl);
          if (idCol >= 0) eventSheet.getRange(i + 2, idCol + 1).setValue(tournamentId);
          if (stateCol >= 0) eventSheet.getRange(i + 2, stateCol + 1).setValue('pending');
          if (createdCol >= 0) {
            const now = new Date();
            eventSheet.getRange(i + 2, createdCol + 1).setValue(now.toISOString());
          }
          break;
        }
      }
    } else {
      const headerMap = {};
      eventHeaders.forEach((h, i) => {
        headerMap[String(h).toLowerCase().trim()] = i;
      });
      const fallbackIdCol = headerMap['event_id'] !== undefined ? headerMap['event_id'] : (headerMap['id'] !== undefined ? headerMap['id'] : 0);
      const fallbackUrlCol = headerMap['challonge_url'] !== undefined ? headerMap['challonge_url'] : (headerMap['challongeurl'] !== undefined ? headerMap['challongeurl'] : 6);
      const fallbackIdTournamentCol = headerMap['challonge_id'] !== undefined ? headerMap['challonge_id'] : (headerMap['challongeid'] !== undefined ? headerMap['challongeid'] : 5);
      const fallbackStateCol = headerMap['challonge_state'] !== undefined ? headerMap['challonge_state'] : (headerMap['challongestate'] !== undefined ? headerMap['challongestate'] : 7);

      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][fallbackIdCol]) === eventId) {
          eventSheet.getRange(i + 2, fallbackUrlCol + 1).setValue(challongeUrl);
          eventSheet.getRange(i + 2, fallbackIdTournamentCol + 1).setValue(tournamentId);
          eventSheet.getRange(i + 2, fallbackStateCol + 1).setValue('pending');
          break;
        }
      }
    }

    return res({ status: 'success', challongeUrl: challongeUrl });

  } catch (err) {
    return res({ status: 'error', message: 'Gagal membuat turnamen: ' + err.message });
  }
}

// ============================================
// CHALLONGE: CREATE TOURNAMENT (v2.1, tanpa auto-start)
// Frontend hanya kirim { eventId }. Semua preset Challonge di-handle GAS.
// Flow: create -> add participants -> simpan challonge_url/id/state/created_at -> success.
// Tidak memanggil start (admin akan start via tombol terpisah).
// ============================================
function createTournament(data) {
  try {
    const eventId = String(data.eventId || '').trim();

    const eventData = fetchActiveEvent();
    if (eventData.error || !eventData.event) {
      return res({ status: 'error', message: 'Tidak ada event aktif' });
    }
    if (eventData.event.id !== eventId) {
      return res({ status: 'error', message: 'Event tidak aktif' });
    }

    // GUARD: cegah admin generate berulang.
    if (
      eventData.event.challongeUrl &&
      String(eventData.event.challongeUrl).trim() !== ''
    ) {
      return res({
        status: 'success',
        challongeUrl: eventData.event.challongeUrl,
        challongeId: '',
        challongeState: 'pending',
        alreadyGenerated: true
      });
    }

    const apiKey = PropertiesService
      .getScriptProperties()
      .getProperty('CHALLONGE_API_KEY');

    if (!apiKey) {
      return res({
        status: 'error',
        message: 'Challonge API Key belum di-set di Script Properties GAS'
      });
    }

    // --- FORMAT TOURNAMENT ---
    // Frontend mengirim: "weekly" | "final"
    const formatRaw = String(data.format || 'weekly').toLowerCase().trim();
    const isFinal =
      formatRaw.indexOf('double') !== -1 ||
      formatRaw.indexOf('final') !== -1;

    const tournamentType = isFinal ? 'double elimination' : 'swiss';

    const baseName =
      eventData.event.nama +
      ' - Liga ' +
      new Date().getFullYear() +
      (isFinal ? ' (Final)' : ' (Weekly)');

    // --- URL / SLUG ---
    const slugBase = 'lalapan_bey_' + eventId + '_' + Date.now();
    let finalSlug = slugBase;
    let suffix = 1;

    while (true) {
      const check = challongeFetch(
        'get',
        '/tournaments/' + finalSlug + '.json',
        undefined,
        'v2.1'
      );

      if (check.__error && check.code === 404) break;

      if (check.__error) {
        return res({
          status: 'error',
          message:
            'Gagal cek ketersediaan slug (HTTP ' +
            check.code +
            '): ' +
            check.text
        });
      }

      suffix++;
      finalSlug = slugBase + '_' + suffix;
    }

    // --- PRESET CHALLONGE ---
    const attributes = {
      name: baseName,
      url: finalSlug,
      tournament_type: tournamentType,
      description: 'Lalapan Beyblade Lamongan Tournament',
      game_name: 'Beyblade X',
      private: false,
      tie_breaks: ['match wins', 'points scored', 'points difference']
    };

    if (isFinal) {
      // FINAL:
      // Seed 1-8  -> Upper / Winners
      // Seed 9-16 -> Lower / Losers
      // Grand Final -> 1 match
      attributes.double_elimination_options = {
        split_participants: true,
        grand_finals_modifier: 'single match'
      };
    } else {
      // WEEKLY tetap Swiss dan tetap memakai shuffle.
      const swissRounds = Number(data.swiss_rounds);
      const rounds =
        !isNaN(swissRounds) && swissRounds >= 1 ? swissRounds : 3;

      Logger.log(
        '[CREATE WEEKLY] Jumlah ronde Swiss: ' + rounds
      );

      attributes.swiss_options = {
        rounds: rounds,
        pts_for_match_win: 1,
        pts_for_match_tie: 0.5,
        pts_for_game_win: 1,
        pts_for_game_tie: 0,
        pts_for_bye: 0
      };
    }

    // 1. CREATE TOURNAMENT
    const createRes = challongeFetch(
      'post',
      '/tournaments.json',
      {
        data: {
          type: 'tournament',
          attributes: attributes
        }
      },
      'v2.1'
    );

    if (createRes.__error) {
      return res({
        status: 'error',
        message:
          'Gagal buat turnamen di Challonge (HTTP ' +
          createRes.code +
          '): ' +
          createRes.text
      });
    }

    if (createRes.errors) {
      return res({
        status: 'error',
        message:
          'Gagal buat turnamen di Challonge: ' +
          JSON.stringify(createRes.errors)
      });
    }

    const tournamentId = createRes.data.id;
    const challongeUrl =
      'https://challonge.com/' + createRes.data.attributes.url;
    const createdAt = new Date();

    // Dipakai untuk penyimpanan nomor match sementara.
    ensureTempMatchMapSheet(eventId, tournamentId);

    // 2. SIAPKAN PESERTA
    let validParticipants = [];

    if (isFinal) {
      // FINAL TIDAK memakai urutan Attendance.
      // Ambil leaderboard bulan/periode aktif, lalu gunakan urutannya
      // sebagai seed 1-16.
      let leaderboardPayload;

      try {
        const leaderboardResponse = getLeaderboard();
        leaderboardPayload =
          leaderboardResponse &&
          typeof leaderboardResponse.getContent === 'function'
            ? JSON.parse(leaderboardResponse.getContent())
            : leaderboardResponse;
      } catch (leaderboardError) {
        return res({
          status: 'error',
          message:
            'Gagal membaca leaderboard untuk Final: ' +
            leaderboardError.message
        });
      }

      if (!Array.isArray(leaderboardPayload)) {
        return res({
          status: 'error',
          message:
            'Data leaderboard tidak valid. Final membutuhkan leaderboard berbentuk array.'
        });
      }

      // getLeaderboard() diharapkan sudah mengembalikan urutan ranking aktif.
      // Kita tetap sort defensif berdasarkan beberapa kemungkinan nama field.
      const rankedPlayers = leaderboardPayload
        .map((player, originalIndex) => {
          const rank = Number(
            player.rank ??
            player.ranking ??
            player.position ??
            player.posisi ??
            originalIndex + 1
          );

          const points = Number(
            player.point ??
            player.points ??
            player.total_point ??
            player.total_points ??
            0
          );

          const pointFinish = Number(
            player.pointFinish ??
            player.point_finish ??
            player.pointfinish ??
            0
          );

          const nickname = String(
            player.nickname ??
            player.nama ??
            player.name ??
            player.nick ??
            ''
          ).trim();

          const googleId = String(
            player.googleId ??
            player.google_id ??
            player.googleid ??
            player.id ??
            ''
          ).trim();

          return {
            raw: player,
            rank: Number.isFinite(rank) && rank > 0
              ? rank
              : originalIndex + 1,
            points: Number.isFinite(points) ? points : 0,
            pointFinish: Number.isFinite(pointFinish) ? pointFinish : 0,
            nama: nickname,
            googleId: googleId
          };
        })
        .filter(player => player.nama);

      rankedPlayers.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (b.points !== a.points) return b.points - a.points;
        return b.pointFinish - a.pointFinish;
      });

      if (rankedPlayers.length < 16) {
        return res({
          status: 'error',
          message:
            'Final membutuhkan minimal 16 pemain pada leaderboard bulan berjalan. Ditemukan: ' +
            rankedPlayers.length
        });
      }

      validParticipants = rankedPlayers.slice(0, 16).map((player, index) => ({
        googleId: player.googleId,
        nama: player.nama,
        seed: index + 1,
        leaderboard_rank: index + 1
      }));

      Logger.log(
        '[CREATE FINAL] Seed 1-16=' +
        JSON.stringify(
          validParticipants.map(p => ({
            seed: p.seed,
            nama: p.nama,
            googleId: p.googleId
          })),
          null,
          2
        )
      );
    } else {
      // WEEKLY tetap mengambil peserta dari Attendance.
      validParticipants = (eventData.participants || [])
        .filter(
          p =>
            p &&
            p.nama &&
            String(p.nama).trim() !== ''
        )
        .map(p => ({
          googleId: String(p.googleId || '').trim(),
          nama: String(p.nama || '').trim()
        }));
    }

    if (validParticipants.length < 2) {
      return res({
        status: 'error',
        message: 'Minimal 2 peserta untuk membuat turnamen'
      });
    }

    if (isFinal && validParticipants.length !== 16) {
      return res({
        status: 'error',
        message:
          'Final harus memiliki tepat 16 peserta dari leaderboard. Saat ini: ' +
          validParticipants.length
      });
    }

    // 3. ADD PARTICIPANTS
    const mappingPromises = [];

    for (const participant of validParticipants) {
      const participantAttributes = {
        name: String(participant.nama).trim()
      };

      // Hanya Final yang mengunci seed.
      if (isFinal && participant.seed) {
        participantAttributes.seed = Number(participant.seed);
      }

      const pRes = challongeFetch(
        'post',
        '/tournaments/' + tournamentId + '/participants.json',
        {
          data: {
            type: 'participant',
            attributes: participantAttributes
          }
        },
        'v2.1'
      );

      if (pRes.__error) {
        console.error(
          'Gagal tambah peserta ' +
          participant.nama +
          ' (HTTP ' +
          pRes.code +
          '): ' +
          pRes.text
        );
      } else if (pRes.errors) {
        console.error(
          'Gagal tambah peserta ' +
          participant.nama +
          ': ' +
          JSON.stringify(pRes.errors)
        );
      } else if (pRes.data && pRes.data.id) {
        mappingPromises.push({
          challongeParticipantId: String(pRes.data.id),
          googleId: String(participant.googleId || '').trim(),
          nickname: String(participant.nama || '').trim()
        });
      }
    }

    if (mappingPromises.length > 0) {
      saveTournamentParticipantMapping(
        eventId,
        tournamentId,
        mappingPromises
      );
    }

    // 4. RANDOMIZE HANYA UNTUK WEEKLY
    // FINAL tidak boleh diacak karena seed 1-16 berasal dari leaderboard.
    if (!isFinal) {
      const randomizeRes = challongeFetch(
        'post',
        '/tournaments/' +
          tournamentId +
          '/participants/randomize.json'
      );

      if (randomizeRes.__error) {
        return res({
          status: 'error',
          message:
            'Turnamen Weekly dibuat tapi gagal mengacak peserta (HTTP ' +
            randomizeRes.code +
            '): ' +
            randomizeRes.text
        });
      }
    } else {
      Logger.log(
        '[CREATE FINAL] Randomize dilewati karena Final memakai seed leaderboard.'
      );
    }

    // 5. START TOURNAMENT
    const startRes = challongeFetch(
      'put',
      '/tournaments/' + tournamentId + '/change_state.json',
      {
        data: {
          type: 'TournamentState',
          attributes: {
            state: 'start'
          }
        }
      },
      'v2.1'
    );

    if (startRes.__error) {
      return res({
        status: 'error',
        message:
          'Turnamen dibuat tapi gagal dimulai (HTTP ' +
          startRes.code +
          '): ' +
          startRes.text
      });
    }

    if (startRes.errors) {
      return res({
        status: 'error',
        message:
          'Turnamen dibuat tapi gagal dimulai: ' +
          JSON.stringify(startRes.errors)
      });
    }

    // 6. SIMPAN KE SHEET EVENTS
    const eventSheet = SS.getSheetByName('Events');
    const eventValues = eventSheet.getDataRange().getValues();
    const eventHeaders = eventValues[0];
    const eventRows = eventValues.slice(1);

    const headerMap = {};
    eventHeaders.forEach((h, i) => {
      headerMap[String(h).toLowerCase().trim()] = i;
    });

    const challongeCol =
      headerMap['challonge_url'] !== undefined
        ? headerMap['challonge_url']
        : headerMap['challongeurl'] !== undefined
          ? headerMap['challongeurl']
          : -1;

    const idCol =
      headerMap['challonge_id'] !== undefined
        ? headerMap['challonge_id']
        : headerMap['challongeid'] !== undefined
          ? headerMap['challongeid']
          : -1;

    const eventIdCol =
      headerMap['event_id'] !== undefined
        ? headerMap['event_id']
        : headerMap['id'] !== undefined
          ? headerMap['id']
          : -1;

    const stateCol =
      headerMap['challonge_state'] !== undefined
        ? headerMap['challonge_state']
        : headerMap['challongestate'] !== undefined
          ? headerMap['challongestate']
          : -1;

    const createdCol =
      headerMap['created_at'] !== undefined
        ? headerMap['created_at']
        : -1;

    const tournamentStatusCol = headerMap['tournament_status'];

    let targetRowNumber = -1;

    if (eventIdCol >= 0) {
      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][eventIdCol]) === eventId) {
          targetRowNumber = i + 2;

          if (challongeCol >= 0) {
            eventSheet
              .getRange(targetRowNumber, challongeCol + 1)
              .setValue(challongeUrl);
          }

          if (idCol >= 0) {
            eventSheet
              .getRange(targetRowNumber, idCol + 1)
              .setValue(tournamentId);
          }

          if (stateCol >= 0) {
            eventSheet
              .getRange(targetRowNumber, stateCol + 1)
              .setValue('started');
          }

          if (createdCol >= 0) {
            eventSheet
              .getRange(targetRowNumber, createdCol + 1)
              .setValue(createdAt.toISOString());
          }

          break;
        }
      }
    } else {
      const fallbackIdCol =
        headerMap['event_id'] !== undefined
          ? headerMap['event_id']
          : headerMap['id'] !== undefined
            ? headerMap['id']
            : 0;

      const fallbackUrlCol =
        headerMap['challonge_url'] !== undefined
          ? headerMap['challonge_url']
          : headerMap['challongeurl'] !== undefined
            ? headerMap['challongeurl']
            : 6;

      const fallbackIdTournamentCol =
        headerMap['challonge_id'] !== undefined
          ? headerMap['challonge_id']
          : headerMap['challongeid'] !== undefined
            ? headerMap['challongeid']
            : 5;

      const fallbackStateCol =
        headerMap['challonge_state'] !== undefined
          ? headerMap['challonge_state']
          : headerMap['challongestate'] !== undefined
            ? headerMap['challongestate']
            : 7;

      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][fallbackIdCol]) === eventId) {
          targetRowNumber = i + 2;

          eventSheet
            .getRange(targetRowNumber, fallbackUrlCol + 1)
            .setValue(challongeUrl);

          eventSheet
            .getRange(targetRowNumber, fallbackIdTournamentCol + 1)
            .setValue(tournamentId);

          eventSheet
            .getRange(targetRowNumber, fallbackStateCol + 1)
            .setValue('started');

          break;
        }
      }
    }

    if (targetRowNumber < 1 || tournamentStatusCol === undefined) {
      return res({
        status: 'error',
        message:
          'Gagal menemukan baris atau kolom tournament_status untuk event ' +
          eventId +
          '. Pastikan header Events memiliki kolom tournament_status.'
      });
    }

    eventSheet
      .getRange(targetRowNumber, tournamentStatusCol + 1)
      .setValue('running');

    const readBackValue = eventSheet
      .getRange(targetRowNumber, tournamentStatusCol + 1)
      .getDisplayValue();

    Logger.log(
      '[GENERATE BRACKET STATUS] eventId=' +
        eventId +
        ' tournament_status=' +
        readBackValue
    );

    if (
      String(readBackValue || '').toLowerCase().trim() !== 'running'
    ) {
      return res({
        status: 'error',
        message:
          'Gagal menulis tournament_status=running untuk event ' +
          eventId +
          '. Nilai terbaca: ' +
          readBackValue
      });
    }

    return res({
      status: 'success',
      challongeUrl: challongeUrl,
      challongeId: tournamentId,
      challongeState: 'started',
      tournament_status: 'running',
      format: isFinal ? 'final' : 'weekly',
      participants: validParticipants.map(p => ({
        name: p.nama,
        googleId: p.googleId || '',
        seed: p.seed || null
      })),
      createdAt: createdAt
    });
  } catch (err) {
    return res({
      status: 'error',
      message: 'Gagal membuat turnamen: ' + err.message
    });
  }
}

function finishTournament(data) {
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return res({ status: 'error', message: 'eventId wajib diisi' });

  const eventSheet = SS.getSheetByName("Events");
  if (!eventSheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

  const eventValues = eventSheet.getDataRange().getValues();
  const eventHeaders = eventValues[0];
  const eventRows = eventValues.slice(1);
  const eventMap = {};
  eventHeaders.forEach((h, i) => {
    eventMap[String(h).toLowerCase().trim()] = i;
  });

  const eventIdCol = eventMap['event_id'] !== undefined ? eventMap['event_id'] : eventMap['id'];
  const statusCol = eventMap['status'];
  const tournamentStatusCol = eventMap['tournament_status'];

  if (eventIdCol === undefined) {
    return res({ status: 'error', message: 'Header event_id tidak ditemukan di Events' });
  }

  const targetRowIndex = eventRows.findIndex(r =>
    String(r[eventIdCol] || '').trim() === eventId
  );

  if (targetRowIndex === -1) {
    return res({ status: 'error', message: 'Event tidak ditemukan' });
  }

  const currentStatus = statusCol !== undefined
    ? String(eventRows[targetRowIndex][statusCol] || '').toLowerCase().trim()
    : '';

  if (currentStatus !== 'aktif') {
    return res({ status: 'error', message: 'Event tidak aktif. Tidak dapat menyelesaikan tournament.' });
  }

  const currentTournamentStatus = tournamentStatusCol !== undefined
    ? String(eventRows[targetRowIndex][tournamentStatusCol] || '').toLowerCase().trim()
    : 'not_started';

  if (currentTournamentStatus !== 'running') {
    return res({ status: 'error', message: 'Tournament belum berjalan. Tidak dapat diselesaikan.', code: 'not_running' });
  }

  if (tournamentStatusCol >= 0) {
    eventSheet.getRange(targetRowIndex + 2, tournamentStatusCol + 1).setValue('finished');
  }

  deleteTempMatchMapSheet(eventId);

  return res({
    status: 'success',
    eventId: eventId,
    tournament_status: 'finished'
  });
}

// ============================================
// HELPER: LOOKUP NUMERIC TOURNAMENT ID FROM SLUG
// ============================================
function lookupTournamentId(slug) {
  const eventSheet = SS.getSheetByName("Events");
  if (!eventSheet) return null;
  const eventValues = eventSheet.getDataRange().getValues();
  const eventHeaders = eventValues[0];
  const eventRows = eventValues.slice(1);

  const headerMap = {};
  eventHeaders.forEach((h, i) => {
    headerMap[String(h).toLowerCase().trim()] = i;
  });

  const urlCol = headerMap['challonge_url'] !== undefined ? headerMap['challonge_url'] : (headerMap['challongeurl'] !== undefined ? headerMap['challongeurl'] : 6);
  const idCol = headerMap['challonge_id'] !== undefined ? headerMap['challonge_id'] : (headerMap['challongeid'] !== undefined ? headerMap['challongeid'] : 5);

  for (let i = 0; i < eventRows.length; i++) {
    const rowUrl = String(eventRows[i][urlCol] || '');
    const rowUrlSlug = rowUrl.indexOf('challonge.com') !== -1
      ? rowUrl.replace(/\/+$/, '').substring(rowUrl.replace(/\/+$/, '').lastIndexOf('/') + 1)
      : rowUrl;
    if (rowUrlSlug === slug || rowUrl === slug) {
      const id = String(eventRows[i][idCol] || '').trim();
      return id || null;
    }
  }
  return null;
}

// ============================================
// CHALLONGE: AMBIL PERTANDINGAN OPEN
// ============================================
function getOpenMatches(tournamentUrl) {
  try {
    let slug = String(tournamentUrl || '').trim();
    if (slug.indexOf('challonge.com') !== -1) {
      const clean = slug.replace(/\/+$/, '');
      const idx = clean.lastIndexOf('/');
      slug = idx !== -1 ? clean.substring(idx + 1) : clean;
    }

    const tournamentId = lookupTournamentId(slug);
    if (!tournamentId) {
      return res({ status: 'error', message: 'Tournament ID tidak ditemukan di sheet untuk slug="' + slug + '". Pastikan event sudah dibuat via createTournament.' });
    }

    // Endpoint wajib Challonge API v2.1 (base https://api.challonge.com/v2.1)
    // PENTING: HANYA 1x fetch untuk matches (bulk index, tanpa filter state, tanpa match_id di ujung URL)
    // agar tidak menghabiskan kuota API Challonge (500 req/bulan). Pemrosesan state
    // (open / complete) dilakukan di memory GAS, BUKAN dengan memanggil API lagi.
    const participantsUrl = 'https://api.challonge.com/v2.1/tournaments/' + tournamentId + '/participants.json';
    const matchesUrl = 'https://api.challonge.com/v2.1/tournaments/' + tournamentId + '/matches.json';
    const tournamentUrlFull = 'https://api.challonge.com/v2.1/tournaments/' + tournamentId + '.json';

    const participantsRes = challongeFetch('get', participantsUrl, undefined, 'v2.1');
    if (participantsRes.__error) {
      console.error('Gagal fetch participants: ' + participantsRes.text);
      return res({ status: 'error', message: 'Gagal fetch participants (HTTP ' + participantsRes.code + '): ' + participantsRes.text + ' | URL: ' + participantsUrl });
    }

    Logger.log('[getOpenMatches] RAW PARTICIPANTS RESPONSE=' + JSON.stringify(participantsRes));

    // LANGKAH 1: X-RAY struktur participant mentah dari Challonge
    if (participantsRes.data && participantsRes.data.length > 0) {
      Logger.log(JSON.stringify(participantsRes.data[0], null, 2));
    }

    const participantsRaw = Array.isArray(participantsRes.data) ? participantsRes.data : (Array.isArray(participantsRes) ? participantsRes : []);
    const participantList = participantsRaw.map(p => {
      const participant = p.participant || p;
      const attr = participant.attributes || participant;
      const num = (...cands) => {
        for (const c of cands) {
          if (c != null && !isNaN(Number(c))) return Number(c);
        }
        return 0;
      };
      return {
        id: String(participant.id || ''),
        name: attr.name || ('Player ' + participant.id),
        points: num(attr.points, attr.stats && attr.stats.points, attr.ranking && attr.ranking.points),
        match_wins: num(attr.match_wins, attr.stats && attr.stats.match_wins),
        match_losses: num(attr.match_losses, attr.stats && attr.stats.match_losses),
        buchholz: num(attr.buchholz, attr.stats && attr.stats.buchholz),
        points_diff: num(attr.points_diff, attr.stats && attr.stats.points_diff, attr.ranking && attr.ranking.points_diff),
        final_rank: num(attr.final_rank, attr.rank, attr.final_rank)
      };
    });

    const mappingSheet = SS.getSheetByName('TournamentParticipants');
    let participantMapping = {};
    if (mappingSheet && tournamentId) {
      const mappingValues = mappingSheet.getDataRange().getValues();
      if (mappingValues.length >= 2) {
        mappingValues.slice(1).forEach(row => {
          const pid = String(row[0] || '').trim();
          const tid = String(row[2] || '').trim();
          const gid = String(row[3] || '').trim();
          if (pid && tid === String(tournamentId) && gid) {
            participantMapping[pid] = gid;
          }
        });
      }
    }

    participantList.forEach(participant => {
      if (participant && participant.id && participantMapping[participant.id]) {
        participant.googleId = participantMapping[participant.id];
      }
    });

    // LANGKAH 3 & 4: participantMap lengkap (bukan hanya name)
    const participantMap = {};
    participantList.forEach(participant => {
      if (participant && participant.id) {
        participantMap[participant.id] = {
          id: participant.id,
          name: participant.name,
          googleId: participant.googleId || '',
          points: participant.points,
          match_wins: participant.match_wins,
          match_losses: participant.match_losses,
          buchholz: participant.buchholz,
          points_diff: participant.points_diff,
          final_rank: participant.final_rank
        };
      }
    });

    // LANGKAH 5: log isi akhir participantMap
    Logger.log(JSON.stringify(participantMap, null, 2));

    Logger.log('[getOpenMatches] participantList=' + JSON.stringify(participantList));
    Logger.log('[getOpenMatches] participantMap(short)=' + JSON.stringify(Object.keys(participantMap)));

    // 1x FETCH BULK: ambil SEMUA match sekaligus (open + complete + pending) dalam 1 panggilan API.
    // Pemrosesan state dilakukan di memory di bawah ini (tidak ada lagi pemanggilan API per state).
    const matchesRes = challongeFetch('get', matchesUrl, undefined, 'v2.1');
    if (matchesRes.__error) {
      console.error('Gagal fetch matches: ' + matchesRes.text);
      return res({ status: 'error', message: 'Gagal fetch matches (HTTP ' + matchesRes.code + '): ' + matchesRes.text + ' | URL: ' + matchesUrl });
    }

    Logger.log('[getOpenMatches] RAW MATCHES RESPONSE=' + JSON.stringify(matchesRes));
    const matchesRaw = Array.isArray(matchesRes.data) ? matchesRes.data : (Array.isArray(matchesRes) ? matchesRes : []);
    Logger.log('[getOpenMatches] matchesRaw count=' + matchesRaw.length);

    const eventIdForTempMap = findEventIdByTournamentId(tournamentId);
    if (eventIdForTempMap) {
      upsertTempMatchMap(eventIdForTempMap, tournamentId, matchesRaw);
    }
    const tempMatchNumberMap = eventIdForTempMap
      ? getTempMatchNumberMap(eventIdForTempMap)
      : {};

    if (matchesRaw.length > 0) {
      Logger.log('[getOpenMatches] matchesRaw[0]=' + JSON.stringify(matchesRaw[0], null, 2));
      Logger.log('[getOpenMatches] matchesRaw[0].relationships=' + JSON.stringify(matchesRaw[0].relationships, null, 2));
      Logger.log('[getOpenMatches] matchesRaw[0].attributes=' + JSON.stringify(matchesRaw[0].attributes, null, 2));
    }
    Logger.log('[getOpenMatches] ALL MATCHES BEFORE FILTER=' + JSON.stringify(matchesRaw.map(m => ({ id: m.id, state: m.attributes && m.attributes.state, player1_id: m.relationships && m.relationships.player1 && m.relationships.player1.data && m.relationships.player1.data.id, player2_id: m.relationships && m.relationships.player2 && m.relationships.player2.data && m.relationships.player2.data.id })), null, 2));

    // Proses SELURUH match di memory (1 fetch sudah cukup).
    // ID pemain diambil LANGSUNG dari points_by_participant (relationships sering null di v2.1).
    const allMatches = matchesRaw.map((m, index) => {
      var attrs = m.attributes;
      var points = attrs.points_by_participant || [];

      var p1Id = points.length > 0 ? String(points[0].participant_id) : null;
      var p2Id = points.length > 1 ? String(points[1].participant_id) : null;

      var p1Score = 0;
      var p2Score = 0;
      if (points.length > 0 && points[0].scores) {
        p1Score = points[0].scores.reduce((a, b) => a + b, 0);
      }
      if (points.length > 1 && points[1].scores) {
        p2Score = points[1].scores.reduce((a, b) => a + b, 0);
      }

      const suggestedPlayOrder = Number(attrs.suggested_play_order);
      const fallbackNumber = (Number.isFinite(suggestedPlayOrder) && suggestedPlayOrder > 0)
        ? suggestedPlayOrder
        : (index + 1);
      const displayMatchNumber = Number(tempMatchNumberMap[String(m.id)] || fallbackNumber);

      return {
        match_id: String(m.id),
        round: attrs.round || 1,
        identifier: String(displayMatchNumber),
        display_match_number: displayMatchNumber,
        suggested_play_order: Number.isFinite(suggestedPlayOrder) ? suggestedPlayOrder : null,
        player1_id: p1Id,
        player2_id: p2Id,
        state: attrs.state,
        winner_id: attrs.winner_id ? String(attrs.winner_id) : null,
        player1_score: p1Score,
        player2_score: p2Score,
        scores_csv: attrs.scores || "0-0"
      };
    });

    // Filter di memory: HANYA ambil match dengan state 'open' atau 'pending'.
    // Jangan pernah meloloskan match 'complete' meskipun winner_id kosong.
    const openMatches = allMatches.filter(match => match.state === 'open' || match.state === 'pending');
    const completedMatches = allMatches.filter(m => String(m.state || '').toLowerCase() === 'complete');

    Logger.log('[getOpenMatches] openMatches=' + JSON.stringify(openMatches));
    Logger.log('[getOpenMatches] completedMatches=' + JSON.stringify(completedMatches));

    const tournamentRes = challongeFetch('get', tournamentUrlFull, undefined, 'v2.1');
    let tournamentState = '';
    let swissRounds = '';
    let tournamentType = '';
    if (!tournamentRes.__error) {
      Logger.log('[getOpenMatches] RAW TOURNAMENT RESPONSE=' + JSON.stringify(tournamentRes));
      const tData = tournamentRes.data || tournamentRes;
      const tAttr = tData.attributes || tData;
      if (tAttr.state) tournamentState = tAttr.state;
      if (tAttr.swiss_rounds != null) swissRounds = tAttr.swiss_rounds;
      if (tAttr.tournament_type) tournamentType = tAttr.tournament_type;
    }
    Logger.log('[getOpenMatches] tournamentState=' + tournamentState + ' swissRounds=' + swissRounds + ' tournamentType=' + tournamentType);

    if (String(tournamentState || '').toLowerCase() === 'complete' && eventIdForTempMap) {
      deleteTempMatchMapSheet(eventIdForTempMap);
    }

    const finalRes = { status: 'success', participants: participantList, matches: openMatches, completedMatches: completedMatches, tournamentState: tournamentState, swissRounds: swissRounds, tournamentType: tournamentType };
    Logger.log('[getOpenMatches] finalRes=' + JSON.stringify(finalRes));
    return res(finalRes);
  } catch (err) {
    console.error('getOpenMatches error: ' + err.message);
    return res({ status: 'error', message: 'Gagal getOpenMatches: ' + err.message });
  }
}

// ============================================
// CHALLONGE: SUBMIT MATCH SCORE (V1 - STABLE)
// ============================================
function submitMatchScore(data) {
  try {
    const tournamentUrl = String(data.tournament_url || '');
    const matchId = String(data.match_id || '');
    const scoresCsv = String(data.scores_csv || '');
    const winnerId = String(data.winner_id || '');

    if (!tournamentUrl || !matchId || !scoresCsv) {
      return res({ status: 'error', message: 'tournament_url, match_id, dan scores_csv wajib diisi' });
    }

    let slug = tournamentUrl.trim();
    if (slug.indexOf('challonge.com') !== -1) {
      const clean = slug.replace(/\/+$/, '');
      const idx = clean.lastIndexOf('/');
      slug = idx !== -1 ? clean.substring(idx + 1) : clean;
    }

    const tournamentId = lookupTournamentId(slug);
    if (!tournamentId) {
      return res({ status: 'error', message: 'Tournament ID tidak ditemukan di sheet untuk slug="' + slug + '". Pastikan event sudah dibuat via createTournament.' });
    }

    const apiKey = PropertiesService.getScriptProperties().getProperty('CHALLONGE_API_KEY');
    if (!apiKey) {
      return res({ status: 'error', message: 'Challonge API Key belum di-set di Script Properties GAS' });
    }

    const url = 'https://api.challonge.com/v1/tournaments/' + encodeURIComponent(tournamentId) + '/matches/' + encodeURIComponent(matchId) + '.json';
    const payload = {
      match: {
        scores_csv: scoresCsv,
        winner_id: Number(winnerId) || undefined
      }
    };

    const options = {
      method: 'put',
      contentType: 'application/json',
      headers: {
        Authorization: 'Basic ' + Utilities.base64Encode('api_key:' + apiKey)
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    Logger.log('[submitMatchScore] FULL URL=' + url);
    Logger.log('[submitMatchScore] METHOD=PUT');
    Logger.log('[submitMatchScore] HEADERS=' + JSON.stringify(options.headers));
    Logger.log('[submitMatchScore] BODY=' + JSON.stringify(payload));
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();
    Logger.log('[submitMatchScore] STATUS=' + code);
    Logger.log('[submitMatchScore] RESPONSE=' + text);

    if (code < 200 || code >= 300) {
      return res({ status: 'error', message: 'Gagal submit score (HTTP ' + code + '): ' + text + ' | URL: ' + url });
    }

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(text);
    } catch (e) {
      jsonResponse = { match: {} };
    }

    clearTournamentCache(tournamentId);

    if (jsonResponse.match && jsonResponse.match.state === 'complete') {
      return res({ status: 'success', match: jsonResponse.match });
    }

    return res({ status: 'success', match: jsonResponse.match || jsonResponse });
  } catch (err) {
    console.error('submitMatchScore error: ' + err.message);
    return res({ status: 'error', message: 'Gagal submitMatchScore: ' + err.message });
  }
}

// ============================================
// CHALLONGE: START TOURNAMENT (v2.1)
// Mengupdate challonge_state = "started" di sheet Events.
// ============================================
function startTournament(data) {
  try {
    const tournamentUrl = String(data.tournament_url || '');
    if (!tournamentUrl) {
      return res({ status: 'error', message: 'tournament_url wajib diisi' });
    }

    // Extract slug dari URL jika perlu
    let slug = tournamentUrl.trim();
    if (slug.indexOf('challonge.com') !== -1) {
      const clean = slug.replace(/\/+$/, '');
      const idx = clean.lastIndexOf('/');
      slug = idx !== -1 ? clean.substring(idx + 1) : clean;
    }

    // AMBIL challonge_id DARI SHEET EVENTS (bukan pakai slug sebagai identifier).
    let challongeId = '';
    let challongeUrlSheet = '';
    try {
      const eventSheet = SS.getSheetByName("Events");
      const eventValues = eventSheet.getDataRange().getValues();
      const eventHeaders = eventValues[0];
      const eventRows = eventValues.slice(1);

      const headerMap = {};
      eventHeaders.forEach((h, i) => {
        headerMap[String(h).toLowerCase().trim()] = i;
      });

      const urlCol = headerMap['challonge_url'] !== undefined ? headerMap['challonge_url'] : (headerMap['challongeurl'] !== undefined ? headerMap['challongeurl'] : 6);
      const idCol = headerMap['challonge_id'] !== undefined ? headerMap['challonge_id'] : (headerMap['challongeid'] !== undefined ? headerMap['challongeid'] : 5);

      for (let i = 0; i < eventRows.length; i++) {
        const rowUrl = String(eventRows[i][urlCol] || '');
        const rowUrlSlug = rowUrl.indexOf('challonge.com') !== -1
          ? rowUrl.replace(/\/+$/, '').substring(rowUrl.replace(/\/+$/, '').lastIndexOf('/') + 1)
          : rowUrl;
        if (rowUrlSlug === slug || rowUrl === slug) {
          challongeId = String(eventRows[i][idCol] || '').trim();
          challongeUrlSheet = rowUrl;
          break;
        }
      }
    } catch (e) {
      console.error('Gagal baca challonge_id dari sheet: ' + e.message);
    }

    // DEBUG LOG sementara
    Logger.log('==========================');
    Logger.log('START TOURNAMENT DEBUG');
    Logger.log('==========================');
    Logger.log('Nilai challonge_id dari Spreadsheet: ' + challongeId);
    Logger.log('Nilai challonge_url dari Spreadsheet: ' + challongeUrlSheet);
    Logger.log('Slug yang diterima dari frontend: ' + slug);
    Logger.log('Identifier yang dipakai: ' + (challongeId || slug));
    Logger.log('==========================');

    if (!challongeId) {
      return res({
        status: 'error',
        message: 'challonge_id TIDAK DITEMUKAN di sheet Events untuk slug="' + slug + '". ' +
          'Pastikan event sudah dibuat via createTournament (Reset Arena & generate ulang jika perlu).'
      });
    }

    const identifier = challongeId;

    // PRE-CHECK: pastikan turnamen ada di akun Challonge (API key GAS) sebelum start.
    const checkRes = challongeFetch('get', '/tournaments/' + identifier + '.json', undefined, 'v2.1');
    if (checkRes.__error) {
      if (checkRes.code === 404) {
        return res({
          status: 'error',
          message: 'Turnamen (id="' + identifier + '") TIDAK DITEMUKAN di akun Challonge (HTTP 404). ' +
            'challonge_id di sheet="' + challongeId + '". ' +
            'Kemungkinan: (1) API key di Script Properties GAS bukan milik akun yang membuat bracket, ' +
            '(2) bracket sudah dihapus, atau (3) challonge_id di sheet tidak sama dengan yang ada di Challonge. ' +
            'Cek: pastikan API key GAS = akun pemilik bracket, lalu Reset Arena & generate ulang.'
        });
      }
      return res({ status: 'error', message: 'Gagal mengecek turnamen (HTTP ' + checkRes.code + '): ' + checkRes.text });
    }

    const url = "/tournaments/" + identifier + "/change_state.json";
    Logger.log('[startTournament] endpoint=' + url);
    const response = challongeFetch('put', url, {
      data: {
        type: "TournamentState",
        attributes: {
          state: "start"
        }
      }
    }, 'v2.1');

    if (response.__error) {
      if (response.code === 404) {
        return res({
          status: 'error',
          message: 'Gagal start: turnamen (id="' + identifier + '") tiba-tiba tidak ditemukan di Challonge (HTTP 404). ' +
            'Pastikan API key GAS cocok dengan akun pemilik bracket.'
        });
      }
      return res({ status: 'error', message: 'Gagal start tournament (HTTP ' + response.code + '): ' + response.text + ' | URL: ' + url });
    }

    // Simpan challonge_state = started ke sheet Events (cari via challonge_url)
    try {
      const eventSheet = SS.getSheetByName("Events");
      const eventValues = eventSheet.getDataRange().getValues();
      const eventHeaders = eventValues[0];
      const eventRows = eventValues.slice(1);

      const headerMap = {};
      eventHeaders.forEach((h, i) => {
        headerMap[String(h).toLowerCase().trim()] = i;
      });

      const urlCol = headerMap['challonge_url'] !== undefined ? headerMap['challonge_url'] : (headerMap['challongeurl'] !== undefined ? headerMap['challongeurl'] : -1);
      const stateCol = headerMap['challonge_state'] !== undefined ? headerMap['challonge_state'] : (headerMap['challongestate'] !== undefined ? headerMap['challongestate'] : -1);

      if (urlCol >= 0 && stateCol >= 0) {
        const fullUrl = 'https://challonge.com/' + slug;
        for (let i = 0; i < eventRows.length; i++) {
          if (String(eventRows[i][urlCol]) === fullUrl || String(eventRows[i][urlCol]) === slug) {
            eventSheet.getRange(i + 2, stateCol + 1).setValue('started');
            break;
          }
        }
      }
    } catch (e) {
      console.error('Gagal update challonge_state: ' + e.message);
    }

    clearTournamentCache(identifier);

    return res({ status: 'success', tournament: response.data || response });
  } catch (err) {
    console.error('startTournament error: ' + err.message);
    return res({ status: 'error', message: 'Gagal startTournament: ' + err.message });
  }
}

// ============================================
// CHALLONGE: RANDOMIZE PARTICIPANTS (v2.1)
// ============================================
function randomizeParticipants(data) {
  try {
    const tournamentUrl = String(data.tournament_url || '');
    if (!tournamentUrl) {
      return res({ status: 'error', message: 'tournament_url wajib diisi' });
    }

    let slug = tournamentUrl.trim();
    if (slug.indexOf('challonge.com') !== -1) {
      const clean = slug.replace(/\/+$/, '');
      const idx = clean.lastIndexOf('/');
      slug = idx !== -1 ? clean.substring(idx + 1) : clean;
    }

    let challongeId = '';
    try {
      const eventSheet = SS.getSheetByName("Events");
      const eventValues = eventSheet.getDataRange().getValues();
      const eventHeaders = eventValues[0];
      const eventRows = eventValues.slice(1);

      const headerMap = {};
      eventHeaders.forEach((h, i) => {
        headerMap[String(h).toLowerCase().trim()] = i;
      });

      const urlCol = headerMap['challonge_url'] !== undefined ? headerMap['challonge_url'] : (headerMap['challongeurl'] !== undefined ? headerMap['challongeurl'] : 6);
      const idCol = headerMap['challonge_id'] !== undefined ? headerMap['challonge_id'] : (headerMap['challongeid'] !== undefined ? headerMap['challongeid'] : 5);

      for (let i = 0; i < eventRows.length; i++) {
        const rowUrl = String(eventRows[i][urlCol] || '');
        const rowUrlSlug = rowUrl.indexOf('challonge.com') !== -1
          ? rowUrl.replace(/\/+$/, '').substring(rowUrl.replace(/\/+$/, '').lastIndexOf('/') + 1)
          : rowUrl;
        if (rowUrlSlug === slug || rowUrl === slug) {
          challongeId = String(eventRows[i][idCol] || '').trim();
          break;
        }
      }
    } catch (e) {
      console.error('Gagal baca challonge_id dari sheet: ' + e.message);
    }

    if (!challongeId) {
      return res({
        status: 'error',
        message: 'challonge_id TIDAK DITEMUKAN di sheet Events untuk slug="' + slug + '".'
      });
    }

    const identifier = challongeId;

    const response = challongeFetch('post', '/tournaments/' + identifier + '/participants/randomize.json');

    if (response.__error) {
      if (response.code === 404) {
        return res({
          status: 'error',
          message: 'Turnamen (id="' + identifier + '") TIDAK DITEMUKAN di akun Challonge (HTTP 404).'
        });
      }
      return res({ status: 'error', message: 'Gagal randomize peserta (HTTP ' + response.code + '): ' + response.text });
    }

    clearTournamentCache(identifier);

    return res({ status: 'success', tournament: response.data || response });
  } catch (err) {
    console.error('randomizeParticipants error: ' + err.message);
    return res({ status: 'error', message: 'Gagal randomizeParticipants: ' + err.message });
  }
}

// ============================================
// CHALLONGE: UPDATE SWISS ROUNDS (v2.1)
// ============================================
function updateSwissRounds(data) {
  try {
    const tournamentUrl = String(data.tournament_url || '');
    const swissRounds = Number(data.swiss_rounds);

    if (!tournamentUrl || isNaN(swissRounds) || swissRounds < 1) {
      return res({ status: 'error', message: 'tournament_url dan swiss_rounds (min 1) wajib diisi' });
    }

    let slug = tournamentUrl.trim();
    if (slug.indexOf('challonge.com') !== -1) {
      const clean = slug.replace(/\/+$/, '');
      const idx = clean.lastIndexOf('/');
      slug = idx !== -1 ? clean.substring(idx + 1) : clean;
    }

    const tournamentId = lookupTournamentId(slug);
    if (!tournamentId) {
      return res({ status: 'error', message: 'Tournament ID tidak ditemukan di sheet untuk slug="' + slug + '". Pastikan event sudah dibuat via createTournament.' });
    }

    const url = '/tournaments/' + tournamentId + '.json';
    const response = challongeFetch('put', url, {
      data: {
        type: 'tournament',
        attributes: {
          swiss_rounds: swissRounds
        }
      }
    }, 'v2.1');

    if (response.__error) {
      return res({ status: 'error', message: 'Gagal update swiss rounds (HTTP ' + response.code + '): ' + response.text + ' | URL: ' + url });
    }

    const tournamentData = response.data || response;
    return res({ status: 'success', tournament: tournamentData });
  } catch (err) {
    console.error('updateSwissRounds error: ' + err.message);
    return res({ status: 'error', message: 'Gagal updateSwissRounds: ' + err.message });
  }
}

// ============================================
// EXPORT STANDINGS KE GOOGLE SPREADSHEET
// ============================================
function exportStandings(data) {
  const result = performExportStandings(data);
  return res(result);
}

function performExportStandings(data) {
  Logger.log('EXPORT_STANDINGS_VERSION=V4A4-FINAL');
  try {
    const sheetName = String(data.sheetName || '').trim();
    const eventId = String(data.eventId || '').trim();
    if (!sheetName) {
      return { status: 'error', message: 'Nama sheet tidak boleh kosong' };
    }
    if (!eventId) {
      return { status: 'error', message: 'eventId wajib diisi untuk export standings' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      const templateSheet = ss.getSheetByName("TEMPLATE");
      if (templateSheet) {
        sheet = templateSheet.copyTo(ss);
        sheet.setName(sheetName);
      } else {
        sheet = ss.insertSheet(sheetName);
      }
    }

    const LEAGUE_POINTS_DISTRIBUTION = [
      25, 20, 16, 13, 11, 10, 9, 8,
      7, 6, 5, 4, 3, 2, 1, 1
    ];

    const payload = data.payload || [];

    const suffix = (n) => {
      const j = n % 10, k = n % 100;
      if (j === 1 && k !== 11) return n + 'st';
      if (j === 2 && k !== 12) return n + 'nd';
      if (j === 3 && k !== 13) return n + 'rd';
      return n + 'th';
    };

    const getLeaguePoints = (rank) => {
      const numericRank = Number(rank);
      if (!Number.isFinite(numericRank) || numericRank < 1) {
        return 0;
      }
      if (numericRank >= 15) {
        return 1;
      }
      return LEAGUE_POINTS_DISTRIBUTION[numericRank - 1] || 1;
    };

    let tournamentId = '';
    try {
      const eventSheet = SS.getSheetByName("Events");
      if (eventSheet) {
        const eventValues = eventSheet.getDataRange().getValues();
        const eventHeaders = eventValues[0];
        const eventRows = eventValues.slice(1);
        const eventMap = {};
        eventHeaders.forEach((h, i) => {
          eventMap[String(h).toLowerCase().trim()] = i;
        });
        const eventIdCol = eventMap['event_id'] !== undefined ? eventMap['event_id'] : eventMap['id'];
        const challongeIdCol = eventMap['challonge_id'] !== undefined ? eventMap['challonge_id'] : eventMap['challongeid'];
        if (eventIdCol !== undefined && challongeIdCol !== undefined) {
          for (let i = 0; i < eventRows.length; i++) {
            if (String(eventRows[i][eventIdCol] || '').trim() === eventId) {
              tournamentId = String(eventRows[i][challongeIdCol] || '').trim();
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error('Gagal baca tournamentId dari sheet Events: ' + e.message);
    }

    const attendanceSheet = SS.getSheetByName('Attendance');
    let attendanceMap = {};
    let duplicateNicknames = [];
    let attendanceMeta = {
      sheetName: '',
      headers: [],
      totalRows: 0,
      eventRows: 0,
      legendringRow: null
    };
    if (attendanceSheet) {
      const attendanceValues = attendanceSheet.getDataRange().getValues();
      attendanceMeta.sheetName = attendanceSheet.getName();
      attendanceMeta.headers = attendanceValues[0] || [];
      attendanceMeta.totalRows = attendanceValues.length;
      if (attendanceValues.length >= 2) {
        const attendanceHeaders = attendanceValues[0];
        const attendanceRows = attendanceValues.slice(1);
        const attendanceHeaderMap = {};
        attendanceHeaders.forEach((h, i) => {
          attendanceHeaderMap[String(h).toLowerCase().trim()] = i;
        });
        Logger.log('EXPORT_STANDINGS_VERSION=V4A4-FINAL');
        Logger.log('ATTENDANCE HEADERS EXACT: ' + JSON.stringify(attendanceHeaderMap));
        const attendanceEventIdCol = attendanceHeaderMap['event_id'];
        const attendanceGoogleIdCol = attendanceHeaderMap['google_id'];
        const attendanceNamaCol = attendanceHeaderMap['nama'];

        if (attendanceEventIdCol !== undefined && attendanceGoogleIdCol !== undefined && attendanceNamaCol !== undefined) {
          const tempMap = {};
          attendanceRows.forEach(row => {
            const rowEventId = normalizeId(row[attendanceEventIdCol]);
            if (rowEventId !== normalizeId(eventId)) {
              return;
            }
            attendanceMeta.eventRows++;
            const gId = normalizeId(row[attendanceGoogleIdCol]);
            const nick = normalizeKey(row[attendanceNamaCol]);
            if (!gId || !nick) return;
            if (tempMap[nick]) {
              duplicateNicknames.push({
                nama: row[attendanceNamaCol],
                googleId: gId
              });
            }
            tempMap[nick] = gId;
            if (nick === 'lgendring') {
              attendanceMeta.legendringRow = {
                nama: row[attendanceNamaCol],
                googleId: gId,
                eventId: rowEventId
              };
            }
          });
          attendanceMap = tempMap;
        }
      }
    }

    if (duplicateNicknames.length > 0) {
      return {
        status: 'error',
        message: 'Duplicate nama di Attendance untuk event ' + eventId + ': ' + duplicateNicknames.map(d => d.nama + ' (' + d.googleId + ')').join(', ')
      };
    }

    Logger.log(
      'ATTENDANCE MAP COUNT=' +
      Object.keys(attendanceMap).length
    );

    Logger.log(
      'ATTENDANCE E9 TEST | eventId=' +
      eventId +
      ' | Lgendring=' +
      (attendanceMap['lgendring'] || 'NOT_FOUND')
    );

    if (!attendanceMap['lgendring']) {
      Logger.log('ATTENDANCE DEBUG META | ' + JSON.stringify(attendanceMeta));
      return {
        status: 'error',
        message: 'Attendance E9 tidak terbaca. Cek log DEBUG META.'
      };
    }

    const missingGoogleIds = [];
    const data2D = payload.map((p, index) => {
      const name = String(p.name || '').trim();
      const normalizedName = normalizeKey(name);
      const googleId = attendanceMap[normalizedName] || '';
      Logger.log({
        name: p.name,
        normalizedName: normalizedName,
        googleId: googleId
      });
      if (!googleId) {
        missingGoogleIds.push({
          index: index + 1,
          nama: name
        });
      }
      return [
        suffix(index + 1),
        getLeaguePoints(index + 1),
        googleId,
        p.name || 'Unknown',
        (p.wins || 0) + '-' + (p.losses || 0),
        p.wins || 0,
        p.pointFinish || 0,
        eventId
      ];
    });

    if (missingGoogleIds.length > 0) {
      return {
        status: 'error',
        message: 'Google ID tidak ditemukan melalui Attendance:\n' + missingGoogleIds.map(m => 'event=' + eventId + ' nama=' + m.nama).join('\n')
      };
    }

    sheet.getRange(3, 1, 20, 8).clearContent();

    if (data2D.length > 0) {
      sheet.getRange(3, 1, data2D.length, 8).setValues(data2D);
    }

    invalidateTournamentResultSheetIndex();
    return { status: 'success', message: 'Berhasil rekap ke sheet "' + sheetName + '" (' + data2D.length + ' baris)', eventId: eventId, tournamentId: tournamentId };
  } catch (err) {
    console.error('exportStandings error: ' + err.message);
    return { status: 'error', message: 'Gagal exportStandings: ' + err.message };
  }
}
function getActiveEvent() {
  try {
    const sheet = SS.getSheetByName("Events");
    if (!sheet) return res({ status: 'error', message: 'Sheet Events tidak ditemukan' });

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const map = {};
    headers.forEach((h, i) => {
      map[String(h).toLowerCase().trim()] = i;
    });

    let activeEvent = null;
    const statusIdx = map['status'];
    const idIdx = map['event_id'] !== undefined ? map['event_id'] : map['id'];
    const namaIdx = map['nama'];
    const urlIdx = map['challonge_url'] !== undefined ? map['challonge_url'] : map['challongeurl'];
    const waktuIdx = map['waktu_event'] !== undefined ? map['waktu_event'] : (map['waktu'] !== undefined ? map['waktu'] : -1);
    const tournamentStatusIdx = map['tournament_status'];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = String(row[statusIdx] || '').toLowerCase().trim();
      if (status === 'aktif') {
        activeEvent = {
          event_id: String(row[idIdx] || ''),
          eventName: String(row[namaIdx] || ''),
          rawUrl: String(row[urlIdx] || ''),
          waktu: waktuIdx >= 0 ? String(row[waktuIdx] || '').trim() : '',
          status: String(row[statusIdx] || '').toLowerCase().trim(),
          tournament_status: tournamentStatusIdx !== undefined ? String(row[tournamentStatusIdx] || '').toLowerCase().trim() : 'not_started'
        };
        break;
      }
    }

    if (!activeEvent) {
      Logger.log('[getActiveEvent] TIDAK ADA EVENT AKTIF');
      return res({ status: 'error', message: 'TIDAK ADA EVENT AKTIF' });
    }

    if (!activeEvent.rawUrl) {
      Logger.log('[getActiveEvent] eventId=' + activeEvent.event_id + ' status=' + activeEvent.status + ' challonge_url kosong');
      return res({ status: 'error', message: 'TIDAK ADA EVENT AKTIF' });
    }

    let extractedId = activeEvent.rawUrl.trim();
    if (extractedId.indexOf('challonge.com') !== -1) {
      const clean = extractedId.replace(/\/+$/, '');
      const idx = clean.lastIndexOf('/');
      let slug = idx !== -1 ? clean.substring(idx + 1) : clean;
      const dashIdx = slug.indexOf('-');
      if (slug.indexOf('.') !== -1 && dashIdx !== -1) {
        slug = slug.substring(dashIdx + 1);
      }
      extractedId = slug;
    }

    Logger.log('[getActiveEvent] eventId=' + activeEvent.event_id + ' status=' + activeEvent.status + ' tournament_status=' + activeEvent.tournament_status);

    return res({
      status: 'success',
      eventName: activeEvent.eventName,
      challongeUrl: extractedId,
      waktu: activeEvent.waktu,
      event_id: activeEvent.event_id,
      status: activeEvent.status,
      tournament_status: activeEvent.tournament_status
    });
  } catch (err) {
    console.error('getActiveEvent error: ' + err.message);
    return res({ status: 'error', message: 'Gagal getActiveEvent: ' + err.message });
  }
}

function runPhase3ATests() {
  const results = [];

  function log(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? '[PASS]' : '[FAIL]') + ' ' + name + (detail ? ' - ' + detail : ''));
  }

  try {
    const eventSheet = SS.getSheetByName("Events");
    if (!eventSheet) {
      log('Sheet Events exists', false, 'Sheet Events tidak ditemukan');
      return res({ tests: results, summary: { total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length } });
    }

    const values = eventSheet.getDataRange().getDisplayValues();
    const headers = values[0];
    const rows = values.slice(1);
    const map = getHeaderMap(eventSheet);
    const eventIdCol = map['event_id'] !== undefined ? map['event_id'] : map['id'];
    const statusCol = map['status'];

    if (eventIdCol === undefined || statusCol === undefined) {
      log('Headers valid', false, 'event_id/status tidak ditemukan');
      return res({ tests: results, summary: { total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length } });
    }

    let testEventId = 'E_TEST';
    let testRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][eventIdCol] || '').trim() === testEventId) {
        testRowIndex = i;
        break;
      }
    }

    if (testRowIndex === -1) {
      eventSheet.appendRow([testEventId, 'Test Event', new Date(), 'Test Lokasi', 'upcoming', '', '', '', '', '2025-01-01', '20:00', '']);
      const newValues = eventSheet.getDataRange().getDisplayValues();
      const newRows = newValues.slice(1);
      testRowIndex = newRows.findIndex(r => String(r[eventIdCol] || '').trim() === testEventId);
      log('Create test event', true, 'Event ' + testEventId + ' dibuat');
    }

    const currentTestStatus = String(values[testRowIndex + 1][statusCol] || '').toLowerCase().trim();
    log('Test event initial status is upcoming', currentTestStatus === 'upcoming', 'status=' + currentTestStatus);

    const startResult = updateEventStatus(testEventId, 'aktif');
    log('Transition upcoming -> aktif', startResult.status === 'success', startResult.message);

    const startAgainResult = updateEventStatus(testEventId, 'aktif');
    log('Transition aktif -> aktif rejected', startAgainResult.status === 'error' && startAgainResult.code === 'already_active', startAgainResult.message);

    const badStartResult = updateEventStatus(testEventId, 'upcoming');
    log('Transition aktif -> upcoming rejected', badStartResult.status === 'error', badStartResult.message);

    const endResult = updateEventStatus(testEventId, 'selesai');
    log('Transition aktif -> selesai', endResult.status === 'success', endResult.message);

    const endAgainResult = updateEventStatus(testEventId, 'selesai');
    log('Transition selesai -> selesai rejected', endAgainResult.status === 'error' && endAgainResult.code === 'already_ended', endAgainResult.message);

    const reactivateResult = updateEventStatus(testEventId, 'aktif');
    log('Transition selesai -> aktif rejected', reactivateResult.status === 'error' && reactivateResult.code === 'transition_not_allowed', reactivateResult.message);

    const upcomingAfterEndResult = updateEventStatus(testEventId, 'upcoming');
    log('Transition selesai -> upcoming rejected', upcomingAfterEndResult.status === 'error' && upcomingAfterEndResult.code === 'transition_not_allowed', upcomingAfterEndResult.message);

    updateEventStatus(testEventId, 'aktif');
    const upcomingToSelesaiResult = updateEventStatus(testEventId, 'selesai');
    eventSheet.getRange(testRowIndex + 2, statusCol + 1).setValue('upcoming');
    log('Transition upcoming -> selesai rejected', upcomingToSelesaiResult.status === 'error' && upcomingToSelesaiResult.code === 'transition_not_allowed', upcomingToSelesaiResult.message);

    const cleanupResult = updateEventStatus(testEventId, 'selesai');
    log('Cleanup test event to selesai', cleanupResult.status === 'success', cleanupResult.message);

  } catch (err) {
    log('Test runner error', false, err.message);
  }

  return res({ tests: results, summary: { total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length } });
}
