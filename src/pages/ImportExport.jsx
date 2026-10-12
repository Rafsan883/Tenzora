import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { backendApi, ANILIST_URL } from "../services/api";
import { Upload, Loader2 } from "lucide-react";
import AccountShell from "../components/account/AccountShell";

// ─── AniList GraphQL Query ───
const ANILIST_QUERY = `
query ($username: String) {
  MediaListCollection(userName: $username, type: ANIME) {
    lists {
      name
      status
      entries {
        mediaId
        status
        progress
        score(format: POINT_10)
        media {
          title {
            romaji
            english
          }
          coverImage {
            large
          }
        }
      }
    }
  }
}
`;

const ANILIST_STATUS_MAP = {
  CURRENT: "Watching",
  PLANNING: "Planning",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
  PAUSED: "On-Hold",
  REPEATING: "Watching"
};

// ─── MAL XML Parser ───
function parseMALXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  if (doc.querySelector('parsererror')) throw new Error('Invalid MAL XML file.');
  const animeNodes = doc.querySelectorAll("anime");
  const items = [];

  animeNodes.forEach((node) => {
    const getField = (name) => node.querySelector(name)?.textContent || "";
    const malStatus = getField("my_status");

    const statusMap = {
      "Watching": "Watching",
      "Completed": "Completed",
      "On-Hold": "On-Hold",
      "Dropped": "Dropped",
      "Plan to Watch": "Planning",
      "1": "Watching",
      "2": "Completed",
      "3": "On-Hold",
      "4": "Dropped",
      "6": "Planning"
    };

    items.push({
      animeId: getField("series_animedb_id"),
      idSource: 'MAL',
      title: getField("series_title"),
      status: statusMap[malStatus] || "Planning",
      progress: parseInt(getField("my_watched_episodes")) || 0,
      score: parseInt(getField("my_score")) || 0,
      coverImage: ""
    });
  });

  return items;
}

// ─── JSON File Parser ───
function parseJsonFile(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    if (Array.isArray(data)) {
      return data.map(item => ({
        animeId: String(item.animeId || item.id || ""),
        idSource: item.idSource || (item.isMAL ? 'MAL' : 'ANILIST'),
        idMal: item.idMal,
        title: item.title || "",
        coverImage: item.coverImage || "",
        status: item.status || "Planning",
        progress: item.progress || 0,
        score: item.score || 0
      }));
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Text File Parser (Parses our TEXT export format) ───
function parseTextFile(text) {
  const lines = text.split('\n');
  const items = [];
  let currentStatus = "Planning";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const statusMatch = line.match(/^──\s+(.+?)\s+\(\d+\)\s+──$/);
    if (statusMatch) {
      currentStatus = statusMatch[1].trim();
      continue;
    }

    const itemMatch = line.match(/^\d+\.\s+(.+)$/);
    if (itemMatch) {
      let rawString = itemMatch[1].trim();
      const identity = rawString.match(/\s+\[(ANILIST|MAL):(\d+)\]$/);
      if (!identity) throw new Error('This text file does not include anime IDs. Import a JSON/XML backup or create a new text export.');
      rawString = rawString.slice(0, identity.index).trim();
      let score = 0;
      let progress = 0;

      const progressMatch = rawString.match(/\[(\d+)\s+eps\]$/);
      if (progressMatch) {
        progress = parseInt(progressMatch[1], 10);
        rawString = rawString.replace(progressMatch[0], '').trim();
      }

      const scoreMatch = rawString.match(/★(\d+)$/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
        rawString = rawString.replace(scoreMatch[0], '').trim();
      }

      const title = rawString.trim();
      if (title) {
        items.push({
          animeId: identity[2],
          idSource: identity[1],
          title: title,
          coverImage: "",
          status: currentStatus,
          progress: progress,
          score: score
        });
      }
    }
  }
  return items;
}

export default function ImportExport() {
  const { user, globalWatchlist, setGlobalWatchlist } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("import");

  // Import state
  const [importFrom, setImportFrom] = useState("MAL");
  const [username, setUsername] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState("Merge");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState("");

  // Export state
  const [exportFormat, setExportFormat] = useState("TEXT");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  // ─── Fetch from AniList API ───
  const fetchAniListData = async (anilistUsername) => {
    setImportProgress("Fetching anime list from AniList...");
    const response = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { username: anilistUsername }
      })
    });

    const json = await response.json();

    if (json.errors) {
      throw new Error(json.errors[0]?.message || "AniList API error. Make sure your list is public.");
    }

    const lists = json.data?.MediaListCollection?.lists || [];
    const items = [];

    for (const list of lists) {
      for (const entry of list.entries) {
        items.push({
          animeId: String(entry.mediaId),
          idSource: 'ANILIST',
          title: entry.media?.title?.english || entry.media?.title?.romaji || `Anime ${entry.mediaId}`,
          coverImage: entry.media?.coverImage?.large || "",
          status: ANILIST_STATUS_MAP[entry.status] || "Planning",
          progress: entry.progress || 0,
          score: entry.score || 0
        });
      }
    }

    return items;
  };

  // ─── Read file content ───
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  // ─── Main Import Handler ───
  const handleImport = async (e) => {
    e.preventDefault();
    setIsImporting(true);
    setImportResult(null);
    setImportProgress("");

    try {
      let items = [];

      if (importFrom === "AL") {
        // AniList - fetch via username
        if (!username.trim()) throw new Error("Please enter your AniList username.");
        items = await fetchAniListData(username.trim());
      } else if (importFrom === "MAL") {
        // MAL - parse XML file
        if (!importFile) throw new Error("Please select your MAL XML export file.");
        setImportProgress("Parsing MAL XML file...");
        const content = await readFileContent(importFile);
        items = parseMALXml(content);
      } else if (importFrom === "File") {
        // File - parse JSON or TXT
        if (!importFile) throw new Error("Please select a JSON or TXT file to import.");
        setImportProgress("Parsing import file...");
        const content = await readFileContent(importFile);
        
        if (importFile.name.toLowerCase().endsWith(".txt")) {
          items = parseTextFile(content);
        } else {
          items = parseJsonFile(content);
          // Fallback if someone selected a txt file disguised as something else
          if (items.length === 0 && content.includes("TenZora Watchlist Export")) {
            items = parseTextFile(content);
          }
        }
      }

      if (items.length === 0) {
        throw new Error("No anime entries found. Check your username or file format.");
      }

      setImportProgress(`Found ${items.length} entries. Saving to watchlist (${importMode} mode)...`);

      // Send to backend
      const response = await backendApi.post("/watchlist/import", {
        items,
        mode: importMode
      });

      if (response.data.success) {
        setGlobalWatchlist(response.data.watchlist);
        setImportResult({
          success: true,
          message: `✅ Import successful! Imported ${items.length} entries.`
        });
      } else {
        throw new Error(response.data.message || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({
        success: false,
        message: `❌ ${error.response?.data?.message || error.message || "Import failed. Please try again."}`
      });
    } finally {
      setIsImporting(false);
      setImportProgress("");
    }
  };

  // ─── Export Helpers ───
  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateMALXml = (list) => {
    let xml = '<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist>\n';
    xml += '  <myinfo>\n';
    xml += `    <user_export_type>1</user_export_type>\n`;
    xml += '  </myinfo>\n';
    list.forEach((item) => {
      const statusMap = { "Watching": "Watching", "Completed": "Completed", "On-Hold": "On-Hold", "Dropped": "Dropped", "Planning": "Plan to Watch" };
      xml += '  <anime>\n';
      xml += `    <series_animedb_id>${item.animeId || 0}</series_animedb_id>\n`;
      xml += `    <series_title><![CDATA[${String(item.title || item.animeId).replaceAll(']]>', ']]]]><![CDATA[>')}]]></series_title>\n`;
      xml += `    <my_watched_episodes>${item.progress || 0}</my_watched_episodes>\n`;
      xml += `    <my_score>${item.score || 0}</my_score>\n`;
      xml += `    <my_status>${statusMap[item.status] || "Plan to Watch"}</my_status>\n`;
      xml += '  </anime>\n';
    });
    xml += '</myanimelist>';
    return xml;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setImportResult(null);
    try {
    const list = globalWatchlist || [];

    if (exportFormat === "JSON") {
      downloadFile(JSON.stringify(list.map(item => ({ ...item, idSource: 'ANILIST' })), null, 2), "tenzora-watchlist.json", "application/json");
    } else if (exportFormat === "TEXT") {
      const statusGroups = {};
      list.forEach(item => {
        const s = item.status || "Other";
        if (!statusGroups[s]) statusGroups[s] = [];
        statusGroups[s].push(item);
      });
      let text = `TenZora Watchlist Export (${new Date().toLocaleDateString()})\n${"=".repeat(50)}\n\n`;
      Object.entries(statusGroups).forEach(([status, items]) => {
        text += `── ${status} (${items.length}) ──\n`;
        items.forEach((item, i) => {
          text += `  ${i + 1}. ${item.title || item.animeId}${item.score ? ` ★${item.score}` : ""}${item.progress ? ` [${item.progress} eps]` : ""} [ANILIST:${item.animeId}]\n`;
        });
        text += "\n";
      });
      downloadFile(text, "tenzora-watchlist.txt", "text/plain");
    } else if (exportFormat === "MAL XML") {
      const response = await backendApi.get('/watchlist/export/mal');
      downloadFile(generateMALXml(response.data.items), "tenzora-watchlist.xml", "application/xml");
    }
    } catch (error) {
      setImportResult({ success: false, message: error.response?.data?.message || error.message || 'Export failed' });
    } finally { setIsExporting(false); }
  };

  return (
    <AccountShell footer>
        <div className="mb-6 rounded-[20px] border border-white/[0.08] bg-[#151517] px-7 py-7 shadow-[0_20px_60px_rgba(0,0,0,.16)]">
          <p className="mb-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50"><span className="h-2 w-2 rounded-full bg-white/70" /> Account Tools</p>
          <h1 className="text-[25px] font-extrabold tracking-[-0.04em] text-white">IMPORT / EXPORT</h1>
          <p className="mt-1 text-[13px] text-white/45">Move your library between services or create a personal backup.</p>
        </div>

        {/* Import/Export Container */}
        <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] shadow-[0_20px_60px_rgba(0,0,0,.16)]">

          {/* Import / Export Tabs */}
          <div className="m-4 mb-0 flex rounded-xl border border-white/10 bg-black/30 p-1 md:m-6">
            <button
              onClick={() => { setActiveTab("import"); setImportResult(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all ${
                 activeTab === "import" ? "bg-white text-[#111]" : "text-white/40 hover:text-white"
              }`}
            >
              <Upload size={16} />
              Import
            </button>
            <button
              onClick={() => { setActiveTab("export"); setImportResult(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all ${
                 activeTab === "export" ? "bg-white text-[#111]" : "text-white/40 hover:text-white"
              }`}
            >
              <Download size={16} />
              Export
            </button>
          </div>

          {/* ═══ IMPORT TAB ═══ */}
          {activeTab === "import" && (
            <form onSubmit={handleImport} className="space-y-8 p-5 md:p-10">
              {/* Notice */}
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <ul className="space-y-1 text-xs text-white/45">
                  <li>• Your lists must be public</li>
                  <li>• Only matching titles will sync</li>
                  <li>• May take up to a minute</li>
                </ul>
              </div>

              {/* Source Platform */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-left">
                  <h3 className="text-sm font-medium text-white mb-1">Source Platform</h3>
                  <p className="text-xs text-[#666]">Import source preference.</p>
                </div>
                <div className="flex w-full rounded-lg border border-white/10 bg-black/30 p-1 md:w-auto">
                  {['AL', 'MAL', 'File'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setImportFrom(p)}
                        className={`flex-1 rounded-md px-6 py-2 text-xs font-bold transition-all md:flex-none ${
                         importFrom === p ? 'bg-white text-[#111]' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {p === 'AL' ? 'AniList' : p === 'MAL' ? 'MyAnimeList' : 'JSON/File'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Username Input */}
              {importFrom === "AL" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Username</h3>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="AniList Username"
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-white/30"
                  />
                </div>
              )}

              {/* File Upload */}
              {importFrom !== "AL" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Select File</h3>
                  <label className="flex items-center cursor-pointer group">
                    <div className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#0a0a0a] px-4 py-3 transition-all group-hover:bg-white/[0.04]">
                       <span className={`text-sm ${importFile ? 'text-white' : 'text-white/35'}`}>
                        {importFile ? importFile.name : "Choose file..."}
                      </span>
                      <Upload size={16} className="text-white/35" />
                    </div>
                    <input
                      type="file"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Import Mode */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-left">
                  <h3 className="text-sm font-medium text-white mb-1">Import Mode</h3>
                  <p className="text-xs text-[#666]">How to handle existing items.</p>
                </div>
                <div className="flex w-full rounded-lg border border-white/10 bg-black/30 p-1 md:w-auto">
                  {['Merge', 'Replace'].map(mode => <button key={mode} type="button" onClick={() => setImportMode(mode)} className={`flex-1 rounded-md px-6 py-2 text-xs font-bold md:flex-none ${importMode === mode ? 'bg-white text-[#111]' : 'text-white/40'}`}>{mode}</button>)}
                </div>
              </div>

              {/* Progress & Result */}
              {importProgress && (
                <div className="p-4 bg-discord-600/10 border border-discord-600/20 rounded-lg text-xs text-discord-400 text-center">
                  {importProgress}
                </div>
              )}

              {importResult && (
                <div className={`p-4 rounded-lg text-xs text-center ${
                  importResult.success 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-discord-500/10 text-discord-400 border border-discord-500/20'
                }`}>
                  {importResult.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isImporting}
                className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-[#111] transition-all hover:bg-white/90 disabled:opacity-50"
              >
                {isImporting ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Start Import"}
              </button>
            </form>
          )}

          {/* ═══ EXPORT TAB ═══ */}
          {activeTab === "export" && (
            <div className="space-y-10 p-6 md:p-10">
              {importResult && <p role="alert" className="text-red-400 text-sm">{importResult.message}</p>}
              <div className="text-center space-y-2">
                <h3 className="text-base font-medium text-white">Backup Collection</h3>
                <p className="text-xs text-[#666] max-w-xs mx-auto">
                  Download your entire watchlist as a file to keep it safe or move to other services.
                </p>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-sm font-medium text-white">Format</h3>
                <div className="flex rounded-lg border border-white/10 bg-black/30 p-1">
                  {['TEXT', 'JSON', 'MAL XML'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setExportFormat(f)}
                       className={`rounded-md px-5 py-2 text-xs font-bold transition-all ${
                         exportFormat === f ? 'bg-white text-[#111]' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting}
                 className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-[#111] transition-all hover:bg-white/90 disabled:opacity-50"
              >
                {isExporting ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Download Backup"}
              </button>
            </div>
          )}

        </div>
    </AccountShell>
  );
}
