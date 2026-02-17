const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpGMmSzi1mnAJVSLc4da4xKL3bCnSjmxRotuEGEUt6PDvmE_CZfz91DUjtMY6H8BNtc9XyYQj1uB7R/pub?output=csv";

init();

async function init() {
  try {
    const events = await loadEventsFromCSV(CSV_URL);
    renderList(events);
  } catch (err) {
    console.error(err);
  }
}

async function loadEventsFromCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить CSV");
  const csvText = await res.text();

  const rows = parseCSV(csvText);

  //   const header = rows[0].map((h) => h.trim());
  //   const idx = (name) => header.indexOf(name);

  const events = rowsToEvents(rows);

  events.sort((a, b) => {
    const aKey = `${a.dateISO}T${a.time || "00:00"}`;
    const bKey = `${b.dateISO}T${b.time || "00:00"}`;
    return aKey.localeCompare(bKey);
  });

  return events.filter((e) => !e.hidden);
}

const ul = document.querySelector("#events");

function renderList(events) {
  ul.innerHTML = "";

  events.forEach((e) => {
    const li = document.createElement("li");
    li.className = "table_item";

    li.innerHTML = `
            <p>${e.dow}</p>
            <p>${formatDateHuman(e.dateISO)}<br>${e.time}</p>
            <p><span>${escapeHtml(e.title)}</span><br>${escapeHtml(e.subtitle)}</p>
        `;

    ul.appendChild(li);
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      cell = "";

      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((v) => v !== "")) rows.push(row);
  }

  return rows;
}

function rowsToEvents(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);

  const iDate = idx("dateISO");
  const iTime = idx("time");
  const iTitle = idx("title");
  const iSubtitle = idx("subtitle");
  const iHidden = idx("hidden");

  if (iDate === -1 || iTime === -1 || iTitle === -1) {
    throw new Error("Нужны колонки: dateISO,time,title");
  }

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const dateISO = row[iDate] || "";
    const time = row[iTime] || "";
    const title = row[iTitle] || "";
    if (!dateISO || !title) continue;

    const subtitle = iSubtitle !== -1 ? row[iSubtitle] || "" : "";
    const hiddenRaw = iHidden !== -1 ? row[iHidden] || "" : "";

    out.push({
      id: `${dateISO}-${time}-${r}`,
      dateISO,
      time,
      dow: getDowShortRu(dateISO),
      title,
      subtitle,
      hidden: toBool(hiddenRaw),
    });
  }
  return out;
}

function toBool(value) {
  const v = String(value).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "да";
}

function getDowShortRu(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
  return fmt.format(d).replace(".", "");
}
