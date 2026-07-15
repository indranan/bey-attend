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
    nickname: player[3],
    role: isAdmin ? "Admin" : "Blader",
    photo: player[4]
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
        foto: row[4]
      };
    });

    // Gabungkan data
    const finalData = boardRows.map(row => {
      const gId = row[0].toString();
      const pInfo = playerMap[gId] || { nickname: "Unknown Blader", foto: "" };

      return {
        googleId: gId,
        status: row[1] || "stay",
        point: Number(row[2]) || 0,
        pointFinish: Number(row[3]) || 0,
        name: pInfo.nickname,
        foto: pInfo.foto
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
    new Date()  // Last Updated
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

    // Helper: POST ke Challonge dengan api_key di dalam payload.
    // Cek getResponseCode() dulu; jika bukan sukses (2xx) jangan JSON.parse (response bisa berupa teks "HTTP Basic...").
    const challongeFetch = (urlPath, bodyObj) => {
      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(Object.assign({ api_key: apiKey }, bodyObj)),
        muteHttpExceptions: true
      };
      const response = UrlFetchApp.fetch('https://api.challonge.com/v1' + urlPath, options);
      const code = response.getResponseCode();
      if (code < 200 || code >= 300) {
        return { __error: true, code: code, text: response.getContentText() };
      }
      return JSON.parse(response.getContentText());
    };

    // 1. Buat turnamen
    const createRes = challongeFetch('/tournaments.json', { tournament: tournamentOptions });
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
      const pRes = challongeFetch('/tournaments/' + tournamentId + '/participants.json', { participant: { name: String(participant.nama).trim() } });
      if (pRes.__error) {
        console.error('Gagal tambah peserta ' + participant.nama + ' (HTTP ' + pRes.code + '): ' + pRes.text);
      } else if (pRes.errors) {
        console.error('Gagal tambah peserta ' + participant.nama + ': ' + JSON.stringify(pRes.errors));
      }
    }

    // 3. Start turnamen
    const startRes = challongeFetch('/tournaments/' + tournamentId + '/start.json', {});
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
