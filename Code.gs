const SS = SpreadsheetApp.getActiveSpreadsheet();

function res(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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
      case 'checkNickname': return checkNickname(nickname);
      case 'getEvent': return res(fetchActiveEvent());
      case 'getSettings': return getSettings();
      case 'getLeaderboard': return getLeaderboard();
      case 'getOpenMatches': return getOpenMatches(e.parameter.tournament_url);
      case 'getActiveEvent': return getActiveEvent();
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
      case 'cancelAttendance': return cancelAttendance(data);
      case 'generateTournament': return generateTournament(data);
      case 'updateBio': return updateBio(data);
      case 'uploadProfilePhoto': return uploadProfilePhoto(data);
      case 'updatePoints': return updatePoints(data);
      case 'toggleNicknameSetting': return toggleNicknameSetting();
      case 'submitMatchScore': return submitMatchScore(data);
      case 'startTournament': return startTournament(data);
      case 'updateSwissRounds': return updateSwissRounds(data);
      case 'createTournament': return createTournament(data);
      case 'exportStandings': return exportStandings(data);
      case 'manualSync': return handleManualSync(data);
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
  rows.shift(); // Hapus Header

  // Mencari baris yang kolom ke-5 (index 4) bernilai "aktif"
  const activeEvent = rows.find(row => row[4] && row[4].toString().toLowerCase().trim() === "aktif");

  if (!activeEvent) {
    return { event: null, participants: [], count: 0 };
  }

  // Ambil data peserta yang sudah absen untuk event ini (pakai kolom "nama")
  const attendanceSheet = SS.getSheetByName("Attendance");
  const attendanceRows = attendanceSheet.getDataRange().getValues();
  attendanceRows.shift(); // Hapus Header

  const participants = attendanceRows
    .filter(row => row[1] == activeEvent[0]) // Kolom event_id
    .map(row => ({
      googleId: row[2], // Google ID peserta
      nama: row[3], // Nickname dari attendance (kolom "nama")
      foto: row[5], // Photo URL
      email: row[4]
    }));

  // Ambil challongeUrl jika ada (kolom G = index 6)
  const challongeUrl = activeEvent[6] ? String(activeEvent[6]).trim() : '';
  // Ambil waktu event dari kolom J = index 9
  const waktu = activeEvent[9] ? String(activeEvent[9]).trim() : '20.00 WIB';

  return {
    event: {
      id: activeEvent[0],
      nama: activeEvent[1],
      lokasi: activeEvent[3],
      challongeUrl: challongeUrl,
      waktu: waktu
    },
    participants: participants,
    count: participants.length
  };
}

function getBlader(googleId) {
  const playerSheet = SS.getSheetByName("Players");
  const adminSheet = SS.getSheetByName("Admins");

  const players = playerSheet.getDataRange().getValues();
  const admins = adminSheet.getDataRange().getValues().flat().map(a => a.toString().toLowerCase());

  const player = players.find(row => row[0].toString() === googleId.toString());

  if (!player) return res({ registered: false });

  // Jika email user ada di tab Admins, kasih role "Admin", jika tidak "Blader"
  const userEmail = player[1].toString().toLowerCase();
  const isAdmin = admins.includes(userEmail);

  return res({
    registered: true,
    googleId: player[0].toString(),
    nickname: player[3],
    role: isAdmin ? "Admin" : "Blader",
    photo: player[4],
    photoUrl: player[4],
    slogan: player[8] ? String(player[8]) : "",
    catatan: player[9] ? String(player[9]) : "",
    ost_url: player[10] ? String(player[10]) : ""
  });
}

function cancelAttendance(data) {
  const sheet = SS.getSheetByName("Attendance");
  const rows = sheet.getDataRange().getValues();

  // Cari baris yang cocok dengan eventId dan googleId
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1].toString() === data.eventId.toString() &&
      rows[i][2].toString() === data.googleId.toString()) {

      // Hapus baris tersebut (i + 1 karena index array mulai dari 0, baris sheet mulai dari 1)
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

    // Proteksi jika sheet tidak ada
    if (!playerSheet || !boardSheet) return res([]);

    const players = playerSheet.getDataRange().getValues();
    const boardRows = boardSheet.getDataRange().getValues();

    // Proteksi jika data kosong (hanya header)
    if (boardRows.length < 2) return res([]);

    boardRows.shift(); // Hapus header leaderboard

    // Buat Map Player
    const playerMap = {};
    players.forEach(row => {
      playerMap[row[0].toString()] = {
        nickname: row[3],
        foto: row[4],
        slogan: row[8] ? String(row[8]) : "",
        catatan: row[9] ? String(row[9]) : ""
      };
    });

    // Gabungkan data
    const finalData = boardRows.map(row => {
      const gId = row[0].toString();
      const pInfo = playerMap[gId] || { nickname: "Unknown Blader", foto: "", slogan: "", catatan: "" };

      return {
        googleId: gId,
        status: row[1] || "stay",
        point: Number(row[2]) || 0,
        pointFinish: Number(row[3]) || 0,
        name: pInfo.nickname,
        foto: pInfo.foto,
        slogan: pInfo.slogan,
        catatan: pInfo.catatan
      };
    });

    // Urutkan: point tertinggi dulu, kalau sama bandingkan pointFinish
    finalData.sort((a, b) => {
      if (b.point !== a.point) return b.point - a.point;
      return b.pointFinish - a.pointFinish;
    });

    // Kirim data yang sudah diurutkan
    return res(finalData);

  } catch (err) {
    // Jika terjadi error sistem, kirim array kosong agar React tidak crash
    return res([]);
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
    ""           // catatan
  ]);
  return res({ status: "success" });
}

function postAttendance(data) {
  const sheet = SS.getSheetByName("Attendance");
  const values = sheet.getDataRange().getValues();

  // Validasi Duplikat: GoogleID + EventID
  const isDuplicate = values.some(row => row[1] == data.eventId && row[2] == data.googleId);

  if (isDuplicate) {
    return res({ status: "exists", message: "Anda sudah absen di event ini!" });
  }

  sheet.appendRow([
    new Date(),
    data.eventId,
    data.googleId,
    data.nickname, // Menggunakan Nickname dari profile
    data.email,
    data.foto
  ]);

  return res({ status: "success" });
}

function updateNickname(data) {
  const sheet = SS.getSheetByName("Players");
  if (!sheet) return res({ status: "error", message: "Sheet Players tidak ditemukan" });

  const rows = sheet.getDataRange().getValues();
  // Gunakan .toString() agar ID dari Google (string) cocok dengan ID di Sheet
  const rowIndex = rows.findIndex(row => row[0].toString() === data.googleId.toString());

  if (rowIndex === -1) {
    return res({ status: "error", message: "Profil tidak ditemukan di database" });
  }

  // Validasi: Cek apakah nickname baru sudah dipakai orang lain
  const newNick = data.newNickname.trim();
  const isTaken = rows.some((row, index) => index !== rowIndex && row[3].toString().toLowerCase() === newNick.toLowerCase());

  if (isTaken) {
    return res({ status: "error", message: "Nickname sudah digunakan Blader lain!" });
  }

  // Update kolom D (4) untuk Nickname dan H (8) untuk Last Updated
  sheet.getRange(rowIndex + 1, 4).setValue(newNick);
  sheet.getRange(rowIndex + 1, 8).setValue(new Date());

  return res({ status: "success" });
}

function createEvent(data) {
  const sheet = SS.getSheetByName("Events");
  const rows = sheet.getDataRange().getValues();

  // 1. Ubah semua event lama menjadi "selesai"
  for (let i = 1; i < rows.length; i++) {
    sheet.getRange(i + 1, 5).setValue("selesai");
  }

  // 2. Tambah event baru dengan status "aktif"
  // Struktur 10 kolom: id | nama | tanggal | lokasi | status | challonge_id | challonge_url | challonge_state | created_at | waktu
  const newId = "E" + (rows.length);
  sheet.appendRow([newId, data.nama, new Date(), data.lokasi, "aktif", "", "", "", "", data.waktu || "20.00 WIB"]);

  return res({ status: "success", message: "Event berhasil dibuat!" });
}

function resetArena() {
  const sheet = SS.getSheetByName("Events");
  const rows = sheet.getDataRange().getValues();

  // Ubah semua event yang "aktif" menjadi "selesai"
  for (let i = 1; i < rows.length; i++) {
    sheet.getRange(i + 1, 5).setValue("selesai");
    // Clear challonge_url (kolom G = index 6) dan challonge_id (index 5) jika ada
    if (rows[i].length > 5) {
      sheet.getRange(i + 1, 6).setValue("");
    }
    if (rows[i].length > 6) {
      sheet.getRange(i + 1, 7).setValue("");
    }
  }

  return res({ status: "success", message: "Arena berhasil dikosongkan!" });
}

function getSettings() {
  const sheet = SS.getSheetByName("Settings");
  if (!sheet) return res({});
  const rows = sheet.getDataRange().getValues();
  const settings = {};
  rows.forEach(r => {
    if (r[0]) settings[r[0]] = r[1];
  });
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
      attributes.double_elimination_options = { grand_finals_modifier: 'single match' };
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

    const validParticipants = eventData.participants.filter(p => p && p.nama && String(p.nama).trim() !== '');
    for (const participant of validParticipants) {
      const pRes = challongeFetch('post', '/tournaments/' + tournamentId + '/participants.json', {
        data: { type: 'participant', attributes: { name: String(participant.nama).trim() } }
      }, 'v2.1');
      if (pRes.__error) {
        console.error('Gagal tambah peserta ' + participant.nama + ' (HTTP ' + pRes.code + '): ' + pRes.text);
      } else if (pRes.errors) {
        console.error('Gagal tambah peserta ' + participant.nama + ': ' + JSON.stringify(pRes.errors));
      }
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

    const challongeCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeurl');
    const idCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeid');
    const eventIdCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'id');

    if (challongeCol >= 0 && eventIdCol >= 0) {
      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][eventIdCol]) === eventId) {
          eventSheet.getRange(i + 2, challongeCol + 1).setValue(challongeUrl);
          if (idCol >= 0) {
            eventSheet.getRange(i + 2, idCol + 1).setValue(tournamentId);
          }
          break;
        }
      }
    } else {
      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][0]) === eventId) {
          eventSheet.getRange(i + 2, 6).setValue(challongeUrl);
          eventSheet.getRange(i + 2, 5).setValue(tournamentId);
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
    const eventId = String(data.eventId);

    const eventData = fetchActiveEvent();
    if (eventData.error || !eventData.event) {
      return res({ status: 'error', message: 'Tidak ada event aktif' });
    }
    if (eventData.event.id !== eventId) {
      return res({ status: 'error', message: 'Event tidak aktif' });
    }

    // GUARD: cegah admin generate berulang (sama seperti generateTournament)
    if (eventData.event.challongeUrl && String(eventData.event.challongeUrl).trim() !== '') {
      return res({ status: 'success', challongeUrl: eventData.event.challongeUrl, challongeId: '', challongeState: 'pending', alreadyGenerated: true });
    }

    if (!eventData.participants || eventData.participants.length < 2) {
      return res({ status: 'error', message: 'Minimal 2 peserta untuk membuat turnamen' });
    }

    const apiKey = PropertiesService.getScriptProperties().getProperty('CHALLONGE_API_KEY');
    if (!apiKey) {
      return res({ status: 'error', message: 'Challonge API Key belum di-set di Script Properties GAS' });
    }

    // --- PRESET CHALLONGE (tanggung jawab GAS, bukan frontend) ---
    // Hanya parameter resmi v2.1 (audit: ✅ Supported). Tidak ada mark_as_tentative /
    // require_team_registration / auto_start / custom_theme (semua NOT SUPPORTED).
    // Frontend kirim format: "weekly" | "final" (atau "swiss" | "double elimination").
    // Default swiss/weekly jika kosong.
    const formatRaw = String(data.format || 'weekly').toLowerCase();
    const isFinal = formatRaw.indexOf('double') !== -1 || formatRaw.indexOf('final') !== -1;
    const tournamentType = isFinal ? 'double elimination' : 'swiss';
    const baseName = eventData.event.nama + ' - Liga ' + new Date().getFullYear() + (isFinal ? ' (Final)' : ' (Weekly)');

    // URL otomatis dari event, aman untuk slug. GAS tangani suffix anti-duplikat.
    const slugBase = 'lalapan_bey_' + eventId + '_' + Date.now();
    let finalSlug = slugBase;
    let suffix = 1;
    while (true) {
      const check = challongeFetch('get', '/tournaments/' + finalSlug + '.json', undefined, 'v2.1');
      if (check.__error && check.code === 404) break; // slug tersedia
      if (check.__error) {
        return res({ status: 'error', message: 'Gagal cek ketersediaan slug (HTTP ' + check.code + '): ' + check.text });
      }
      // slug sudah dipakai -> tambah suffix
      suffix++;
      finalSlug = slugBase + '_' + suffix;
    }

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
      // Double Elimination: grand finals = 1 match (single match)
      attributes.double_elimination_options = { grand_finals_modifier: 'single match' };
    } else {
      // Swiss: rounds + poin (hanya valid untuk swiss)
      // Gunakan nilai dari form Admin (data.swiss_rounds). Default 3 jika kosong/salah.
      const swissRounds = Number(data.swiss_rounds);
      const rounds = (!isNaN(swissRounds) && swissRounds >= 1) ? swissRounds : 3;
      Logger.log("Debug: Jumlah ronde yang dikirim ke Challonge adalah: " + rounds);
      // pts_for_bye wajib diisi (API v2.1 mewajibkan field ini, lihat error 422).
      attributes.swiss_options = {
        rounds: rounds,
        pts_for_match_win: 1,
        pts_for_match_tie: 0.5,
        pts_for_game_win: 1,
        pts_for_game_tie: 0,
        pts_for_bye: 0
      };
    }

    // 1. CREATE (v2.1, JSON:API)
    const createRes = challongeFetch('post', '/tournaments.json', { data: { type: 'tournament', attributes: attributes } }, 'v2.1');
    if (createRes.__error) {
      return res({ status: 'error', message: 'Gagal buat turnamen di Challonge (HTTP ' + createRes.code + '): ' + createRes.text });
    }
    if (createRes.errors) {
      return res({ status: 'error', message: 'Gagal buat turnamen di Challonge: ' + JSON.stringify(createRes.errors) });
    }

    const tournamentId = createRes.data.id;
    const challongeUrl = 'https://challonge.com/' + createRes.data.attributes.url;
    const createdAt = new Date();

    // 2. ADD PARTICIPANTS (v2.1, JSON:API)
    const validParticipants = eventData.participants.filter(p => p && p.nama && String(p.nama).trim() !== '');
    for (const participant of validParticipants) {
      const pRes = challongeFetch('post', '/tournaments/' + tournamentId + '/participants.json', {
        data: { type: 'participant', attributes: { name: String(participant.nama).trim() } }
      }, 'v2.1');
      if (pRes.__error) {
        console.error('Gagal tambah peserta ' + participant.nama + ' (HTTP ' + pRes.code + '): ' + pRes.text);
      } else if (pRes.errors) {
        console.error('Gagal tambah peserta ' + participant.nama + ': ' + JSON.stringify(pRes.errors));
      }
    }

    // 3. SIMPAN ke sheet Events — posisi kolom di-hardcode sesuai struktur sheet:
    // id(0) nama(1) tanggal(2) lokasi(3) status(4) challonge_id(5) challonge_url(6) challonge_state(7) created_at(8)
    const eventSheet = SS.getSheetByName("Events");
    const eventValues = eventSheet.getDataRange().getValues();
    const eventRows = eventValues.slice(1);

    const eventIdCol = 0;   // id
    const idCol = 5;        // challonge_id
    const urlCol = 6;       // challonge_url
    const stateCol = 7;     // challonge_state
    const createdCol = 8;   // created_at

    let savedRow = -1;
    for (let i = 0; i < eventRows.length; i++) {
      if (String(eventRows[i][eventIdCol]) === eventId) {
        savedRow = i + 2; // +1 header, +1 karena array 0-based
        break;
      }
    }

    if (savedRow === -1) {
      console.error('createTournament: baris event tidak ditemukan di sheet Events untuk eventId=' + eventId);
    } else {
      eventSheet.getRange(savedRow, urlCol + 1).setValue(challongeUrl);
      eventSheet.getRange(savedRow, idCol + 1).setValue(tournamentId);
      eventSheet.getRange(savedRow, stateCol + 1).setValue('pending');
      eventSheet.getRange(savedRow, createdCol + 1).setValue(createdAt);
    }

    // 4. TIDAK start — kembalikan success
    return res({
      status: 'success',
      challongeUrl: challongeUrl,
      challongeId: tournamentId,
      challongeState: 'pending',
      createdAt: createdAt
    });

  } catch (err) {
    return res({ status: 'error', message: 'Gagal membuat turnamen: ' + err.message });
  }
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
  const urlCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeurl');
  const idCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeid');
  const uCol = urlCol >= 0 ? urlCol : 6;
  const iCol = idCol >= 0 ? idCol : 5;
  for (let i = 0; i < eventRows.length; i++) {
    const rowUrl = String(eventRows[i][uCol] || '');
    const rowUrlSlug = rowUrl.indexOf('challonge.com') !== -1
      ? rowUrl.replace(/\/+$/, '').substring(rowUrl.replace(/\/+$/, '').lastIndexOf('/') + 1)
      : rowUrl;
    if (rowUrlSlug === slug || rowUrl === slug) {
      const id = String(eventRows[i][iCol] || '').trim();
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
      // LANGKAH 2: baca field dari response runtime, jangan asumsi.
      // Cek beberapa kemungkinan lokasi sebelum fallback 0.
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
        points_diff: num(attr.points_diff, attr.stats && attr.stats.points_diff),
        final_rank: num(attr.final_rank, attr.rank, attr.final_rank)
      };
    });

    // LANGKAH 3 & 4: participantMap lengkap (bukan hanya name)
    const participantMap = {};
    participantList.forEach(participant => {
      if (participant && participant.id) {
        participantMap[participant.id] = {
          id: participant.id,
          name: participant.name,
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

      return {
        match_id: String(m.id),
        round: attrs.round || 1,
        identifier: String(index + 1),
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
    // Struktur: id(0) nama(1) tanggal(2) lokasi(3) status(4) challonge_id(5) challonge_url(6) challonge_state(7) created_at(8)
    let challongeId = '';
    let challongeUrlSheet = '';
    try {
      const eventSheet = SS.getSheetByName("Events");
      const eventValues = eventSheet.getDataRange().getValues();
      const eventHeaders = eventValues[0];
      const eventRows = eventValues.slice(1);
      const urlCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeurl');
      const idCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeid');
      const norm = (s) => String(s || '').toLowerCase().replace(/[_\s]/g, '');
      const findCol = (name, fallback) => {
        const i = eventHeaders.findIndex(h => norm(h) === norm(name));
        return i >= 0 ? i : fallback;
      };
      const uCol = urlCol >= 0 ? urlCol : 6;
      const iCol = idCol >= 0 ? idCol : 5;
      for (let i = 0; i < eventRows.length; i++) {
        const rowUrl = String(eventRows[i][uCol] || '');
        const rowUrlSlug = rowUrl.indexOf('challonge.com') !== -1
          ? rowUrl.replace(/\/+$/, '').substring(rowUrl.replace(/\/+$/, '').lastIndexOf('/') + 1)
          : rowUrl;
        if (rowUrlSlug === slug || rowUrl === slug) {
          challongeId = String(eventRows[i][iCol] || '').trim();
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
      const urlCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeurl');
      const stateCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongestate');
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
  try {
    const sheetName = String(data.sheetName || '').trim();
    if (!sheetName) {
      return res({ status: 'error', message: 'Nama sheet tidak boleh kosong' });
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

    const LEAGUE_POINTS_DISTRIBUTION = [20, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1];
    const payload = data.payload || [];
    const optionalPoints = data.optionalPoints || {};

    const suffix = (n) => {
      const j = n % 10, k = n % 100;
      if (j === 1 && k !== 11) return n + 'st';
      if (j === 2 && k !== 12) return n + 'nd';
      if (j === 3 && k !== 13) return n + 'rd';
      return n + 'th';
    };

    const data2D = payload.map((p, index) => {
      const opt = optionalPoints[p.id] != null ? optionalPoints[p.id] : '';
      return [
        suffix(index + 1),
        LEAGUE_POINTS_DISTRIBUTION[index] || 0,
        p.name || 'Unknown',
        (p.wins || 0) + '-' + (p.losses || 0),
        p.wins || 0,
        p.pointFinish || 0,
        opt
      ];
    });

    sheet.getRange(3, 1, 20, 7).clearContent();

    if (data2D.length > 0) {
      sheet.getRange(3, 1, data2D.length, 7).setValues(data2D);
    }

    return res({ status: 'success', message: 'Berhasil rekap ke sheet "' + sheetName + '" (' + data2D.length + ' baris)' });
  } catch (err) {
    console.error('exportStandings error: ' + err.message);
    return res({ status: 'error', message: 'Gagal exportStandings: ' + err.message });
  }
}
function getActiveEvent() {
  try {
    const sheet = SS.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    let activeEvent = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = String(row[4] || '').toLowerCase();
      if (status === 'aktif') {
        activeEvent = {
          eventName: String(row[1] || ''),
          rawUrl: String(row[6] || ''), // kolom G = challonge_url
          waktu: String(row[9] || '').trim() // kolom J = waktu
        };
        break;
      }
    }

    if (!activeEvent || !activeEvent.rawUrl) {
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

    return res({ status: 'success', eventName: activeEvent.eventName, challongeUrl: extractedId, waktu: activeEvent.waktu });
  } catch (err) {
    console.error('getActiveEvent error: ' + err.message);
    return res({ status: 'error', message: 'Gagal getActiveEvent: ' + err.message });
  }
}
