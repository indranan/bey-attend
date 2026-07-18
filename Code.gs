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
      case 'exportStandings': return exportStandings(data);
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

  // Ambil challongeUrl jika ada (kolom ke-6, index 5)
  const challongeUrl = activeEvent[5] ? String(activeEvent[5]).trim() : '';

  return {
    event: {
      id: activeEvent[0],
      nama: activeEvent[1],
      lokasi: activeEvent[3],
      challongeUrl: challongeUrl
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
    catatan: player[9] ? String(player[9]) : ""
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
  const newId = "E" + (rows.length);
  sheet.appendRow([newId, data.nama, new Date(), data.lokasi, "aktif", ""]); // kolom 6 = challongeUrl

  return res({ status: "success", message: "Event berhasil dibuat!" });
}

function resetArena() {
  const sheet = SS.getSheetByName("Events");
  const rows = sheet.getDataRange().getValues();

  // Ubah semua event yang "aktif" menjadi "selesai"
  for (let i = 1; i < rows.length; i++) {
    sheet.getRange(i + 1, 5).setValue("selesai");
    // Clear challongeUrl (kolom 6) jika ada
    if (rows[i].length > 5) {
      sheet.getRange(i + 1, 6).setValue("");
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
function challongeFetch(method, urlPath, bodyObj) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('CHALLONGE_API_KEY');
  const username = props.getProperty('CHALLONGE_USERNAME') || apiKey;

  if (!apiKey) {
    throw new Error('Challonge API Key belum di-set di Script Properties GAS');
  }

  const baseUrl = 'https://api.challonge.com/v1';
  const fullUrl = urlPath.startsWith('http') ? urlPath : baseUrl + urlPath;
  const authHeader = 'Basic ' + Utilities.base64Encode(username + ':' + apiKey);

  const options = {
    method: method,
    contentType: 'application/json',
    headers: {
      'Authorization': authHeader
    },
    muteHttpExceptions: true
  };

  if (bodyObj !== undefined && bodyObj !== null) {
    options.payload = JSON.stringify(bodyObj);
  }

  try {
    const response = UrlFetchApp.fetch(fullUrl, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

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

    return JSON.parse(text);
  } catch (e) {
    console.error('Challonge fetch failed: ' + e.message);
    throw new Error('Gagal terhubung ke Challonge (' + fullUrl + '): ' + e.message);
  }
}

// ============================================
// CHALLONGE TOURNAMENT GENERATOR
// ============================================
function generateTournament(payload) {
  try {
    const eventId = String(payload.eventId);

    // Ambil event aktif via fungsi internal (langsung object, tanpa .getContentText)
    const eventData = fetchActiveEvent();

    // Jika getActiveEvent mengembalikan error (bukan struktur event)
    if (eventData.error || !eventData.event) {
      return res({ status: 'error', message: 'Tidak ada event aktif' });
    }
    if (eventData.event.id !== eventId) {
      return res({ status: 'error', message: 'Event tidak aktif' });
    }

    // GUARD: kalau bracket sudah pernah digenerate, langsung kembalikan url-nya
    // (cegah admin klik berulang-ulang bikin turnamen Challonge baru terus menerus)
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

    // Format: 'weekly' (Swiss) | 'final' (Double Elimination + grand finals 1 match)
    const format = String(payload.format || 'weekly').toLowerCase();
    const isFinal = format === 'final';

    // Aturan turnamen sesuai preferensi komunitas Beyblade Lamongan
    // URL hanya boleh huruf, angka, underscore (tanpa spasi/strip)
    const safeUrl = 'lalapan_bey_' + eventId + '_' + Date.now();

    const tournamentOptions = {
      name: eventData.event.nama + ' - Liga ' + new Date().getFullYear() + (isFinal ? ' (Final)' : ' (Weekly)'),
      url: safeUrl,
      description: 'Game: Beyblade X',
      tournament_type: isFinal ? 'double elimination' : 'swiss'
    };

    if (isFinal) {
      // Grand finals = 1 match (single match)
      tournamentOptions.grand_finals_modifier = 'single match';
    }
    // Pengaturan tie break Swiss sengaja dihapus agar Challonge memakai
    // default rules-nya (menghindari error "Tie breaks must be valid
    // Challonge stats" dari enum yang tidak dikenali).

    // 1. Buat turnamen
    const createRes = challongeFetch('post', '/tournaments.json', { tournament: tournamentOptions });
    if (createRes.__error) {
      return res({ status: 'error', message: 'Gagal buat turnamen di Challonge (HTTP ' + createRes.code + '): ' + createRes.text });
    }
    if (createRes.errors) {
      return res({ status: 'error', message: 'Gagal buat turnamen di Challonge: ' + JSON.stringify(createRes.errors) });
    }

    const tournamentId = createRes.tournament.id;
    const challongeUrl = 'https://challonge.com/' + createRes.tournament.url;

    // 2. Tambahkan peserta (skip nama kosong)
    const validParticipants = eventData.participants.filter(p => p && p.nama && String(p.nama).trim() !== '');
    for (const participant of validParticipants) {
      const pRes = challongeFetch('post', '/tournaments/' + tournamentId + '/participants.json', { participant: { name: String(participant.nama).trim() } });
      if (pRes.__error) {
        console.error('Gagal tambah peserta ' + participant.nama + ' (HTTP ' + pRes.code + '): ' + pRes.text);
      } else if (pRes.errors) {
        console.error('Gagal tambah peserta ' + participant.nama + ': ' + JSON.stringify(pRes.errors));
      }
    }

    // 3. Start turnamen
    const startRes = challongeFetch('post', '/tournaments/' + tournamentId + '/start.json', {});
    if (startRes.__error) {
      return res({ status: 'error', message: 'Turnamen dibuat tapi gagal dimulai (HTTP ' + startRes.code + '): ' + startRes.text });
    }
    if (startRes.errors) {
      return res({ status: 'error', message: 'Turnamen dibuat tapi gagal dimulai: ' + JSON.stringify(startRes.errors) });
    }

    // 4. Simpan challongeUrl ke kolom challongeUrl di sheet Events (cari via header)
    const eventSheet = SS.getSheetByName("Events");
    const eventValues = eventSheet.getDataRange().getValues();
    const eventHeaders = eventValues[0];
    const eventRows = eventValues.slice(1);

    const challongeCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'challongeurl');
    const eventIdCol = eventHeaders.findIndex(h => String(h).toLowerCase() === 'id');

    if (challongeCol >= 0 && eventIdCol >= 0) {
      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][eventIdCol]) === eventId) {
          eventSheet.getRange(i + 2, challongeCol + 1).setValue(challongeUrl);
          break;
        }
      }
    } else {
      // Fallback: tulis di kolom ke-6 (index 5) jika header challongeUrl belum ada
      for (let i = 0; i < eventRows.length; i++) {
        if (String(eventRows[i][0]) === eventId) {
          eventSheet.getRange(i + 2, 6).setValue(challongeUrl);
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
// CHALLONGE: AMBIL PERTANDINGAN OPEN
// ============================================
function getOpenMatches(tournamentUrl) {
  try {
    const participantsUrl = "https://api.challonge.com/v1/tournaments/" + encodeURIComponent(tournamentUrl) + "/participants.json";
    const matchesUrl = "https://api.challonge.com/v1/tournaments/" + encodeURIComponent(tournamentUrl) + "/matches.json?state=open";
    const completedMatchesUrl = "https://api.challonge.com/v1/tournaments/" + encodeURIComponent(tournamentUrl) + "/matches.json?state=complete&include_scores=1";
    const tournamentUrlFull = "https://api.challonge.com/v1/tournaments/" + encodeURIComponent(tournamentUrl) + ".json";

    const participantsRes = challongeFetch('get', participantsUrl);
    if (participantsRes.__error) {
      console.error('Gagal fetch participants: ' + participantsRes.text);
      return res({ status: 'error', message: 'Gagal fetch participants (HTTP ' + participantsRes.code + '): ' + participantsRes.text + ' | URL: ' + participantsUrl });
    }

    const participantsRaw = Array.isArray(participantsRes) ? participantsRes : [];
    console.log('Raw participants response type: ' + Array.isArray(participantsRaw));
    console.log('Raw participants count: ' + participantsRaw.length);
    console.log('Raw participants sample: ' + JSON.stringify(participantsRaw.slice(0, 2)));

    const participantMap = {};
    const participantList = participantsRaw.map(p => p.participant);
    participantList.forEach(participant => {
      if (participant && participant.id) {
        participantMap[participant.id] = participant.name || ('Player ' + participant.id);
      }
    });

    const matchesRes = challongeFetch('get', matchesUrl);
    if (matchesRes.__error) {
      console.error('Gagal fetch matches: ' + matchesRes.text);
      return res({ status: 'error', message: 'Gagal fetch matches (HTTP ' + matchesRes.code + '): ' + matchesRes.text + ' | URL: ' + matchesUrl });
    }

    const matchesRaw = Array.isArray(matchesRes) ? matchesRes : [];
    console.log('Raw matches count: ' + matchesRaw.length);

    const openMatches = matchesRaw
      .filter(m => m && m.match && String(m.match.state).toLowerCase() === 'open')
      .map(m => {
        const match = m.match;
        return {
          match_id: match.id,
          player1_id: match.player1_id,
          player2_id: match.player2_id,
          player1_name: participantMap[match.player1_id] || ('Player ' + match.player1_id),
          player2_name: participantMap[match.player2_id] || ('Player ' + match.player2_id),
          round: match.round,
          suggested_play_order: match.suggested_play_order
        };
      });

    const completedMatchesRes = challongeFetch('get', completedMatchesUrl);
    let completedMatches = [];
    if (!completedMatchesRes.__error) {
      const completedRaw = Array.isArray(completedMatchesRes) ? completedMatchesRes : [];
      completedMatches = completedRaw
        .filter(m => m && m.match && String(m.match.state).toLowerCase() === 'complete')
        .map(m => {
          const match = m.match;
          return {
            match_id: match.id,
            player1_id: match.player1_id,
            player2_id: match.player2_id,
            scores_csv: match.scores_csv,
            state: match.state
          };
        });
    }

    const tournamentRes = challongeFetch('get', tournamentUrlFull);
    let tournamentState = '';
    let swissRounds = '';
    if (!tournamentRes.__error && tournamentRes.tournament) {
      if (tournamentRes.tournament.state) {
        tournamentState = tournamentRes.tournament.state;
      }
      if (tournamentRes.tournament.swiss_rounds != null) {
        swissRounds = tournamentRes.tournament.swiss_rounds;
      }
    }

    return res({ status: 'success', participants: participantList, matches: openMatches, completedMatches: completedMatches, tournamentState: tournamentState, swissRounds: swissRounds });
  } catch (err) {
    console.error('getOpenMatches error: ' + err.message);
    return res({ status: 'error', message: 'Gagal getOpenMatches: ' + err.message });
  }
}

// ============================================
// CHALLONGE: SUBMIT MATCH SCORE
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

    const url = "https://api.challonge.com/v1/tournaments/" + encodeURIComponent(tournamentUrl) + "/matches/" + encodeURIComponent(matchId) + ".json";
    const response = challongeFetch('put', url, {
      match: {
        scores_csv: scoresCsv,
        winner_id: Number(winnerId) || undefined
      }
    });

    if (response.__error) {
      return res({ status: 'error', message: 'Gagal submit score (HTTP ' + response.code + '): ' + response.text + ' | URL: ' + url });
    }

    return res({ status: 'success', match: response.match || response });
  } catch (err) {
    console.error('submitMatchScore error: ' + err.message);
    return res({ status: 'error', message: 'Gagal submitMatchScore: ' + err.message });
  }
}

// ============================================
// CHALLONGE: START TOURNAMENT
// ============================================
function startTournament(data) {
  try {
    const tournamentUrl = String(data.tournament_url || '');
    if (!tournamentUrl) {
      return res({ status: 'error', message: 'tournament_url wajib diisi' });
    }

    const url = "https://api.challonge.com/v1/tournaments/" + encodeURIComponent(tournamentUrl) + "/start.json";
    const response = challongeFetch('post', url, {});

    if (response.__error) {
      return res({ status: 'error', message: 'Gagal start tournament (HTTP ' + response.code + '): ' + response.text + ' | URL: ' + url });
    }

    return res({ status: 'success', tournament: response.tournament || response });
  } catch (err) {
    console.error('startTournament error: ' + err.message);
    return res({ status: 'error', message: 'Gagal startTournament: ' + err.message });
  }
}

// ============================================
// CHALLONGE: UPDATE SWISS ROUNDS
// ============================================
function updateSwissRounds(data) {
  try {
    const tournamentUrl = String(data.tournament_url || '');
    const swissRounds = Number(data.swiss_rounds);

    if (!tournamentUrl || isNaN(swissRounds) || swissRounds < 1) {
      return res({ status: 'error', message: 'tournament_url dan swiss_rounds (min 1) wajib diisi' });
    }

    const url = "https://api.challonge.com/v1/tournaments/" + encodeURIComponent(tournamentUrl) + ".json";
    const response = challongeFetch('put', url, {
      tournament: {
        swiss_rounds: swissRounds
      }
    });

    if (response.__error) {
      return res({ status: 'error', message: 'Gagal update swiss rounds (HTTP ' + response.code + '): ' + response.text + ' | URL: ' + url });
    }

    return res({ status: 'success', tournament: response.tournament || response });
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

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return res({ status: 'error', message: 'Sheet tidak ditemukan!' });
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
          rawUrl: String(row[5] || '')
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

    return res({ status: 'success', eventName: activeEvent.eventName, challongeUrl: extractedId });
  } catch (err) {
    console.error('getActiveEvent error: ' + err.message);
    return res({ status: 'error', message: 'Gagal getActiveEvent: ' + err.message });
  }
}
