const DB_NAME = "meu-caixa-local-v3";
const DB_VERSION = 1;
const STORE = "lancamentos";
const BACKUP_VERSION = 1;

const state = {
  db: null,
  lancamentos: [],
  messages: [],
  pending: null,
  editingMessageId: null,
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const els = {
  monthLabel: document.querySelector("#monthLabel"),
  monthBalance: document.querySelector("#monthBalance"),
  monthResume: document.querySelector("#monthResume"),
  monthCard: document.querySelector(".month-card"),
  messages: document.querySelector("#messages"),
  entryForm: document.querySelector("#entryForm"),
  entryInput: document.querySelector("#entryInput"),
  filterStart: document.querySelector("#filterStart"),
  filterEnd: document.querySelector("#filterEnd"),
  filterType: document.querySelector("#filterType"),
  reportIncome: document.querySelector("#reportIncome"),
  reportExpense: document.querySelector("#reportExpense"),
  reportBalance: document.querySelector("#reportBalance"),
  transactionsList: document.querySelector("#transactionsList"),
  pdfButton: document.querySelector("#pdfButton"),
  backupButton: document.querySelector("#backupButton"),
  backupDialog: document.querySelector("#backupDialog"),
  exportBackupButton: document.querySelector("#exportBackupButton"),
  importBackupInput: document.querySelector("#importBackupInput"),
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(mode = "readonly") {
  return state.db.transaction(STORE, mode).objectStore(STORE);
}

function getAllLancamentos() {
  return new Promise((resolve, reject) => {
    const request = tx().getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function saveLancamentos(items) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    items.forEach((item) => store.put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function replaceLancamentos(items) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    store.clear();
    items.forEach((item) => store.put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function today() {
  return new Date();
}

function toDateInputValue(date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return local.toISOString().slice(0, 10);
}

function parseInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCurrency(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.]/g, "");
  if (!cleaned) return 0;
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  if (comma > dot) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return Number(cleaned.replace(/,/g, ""));
}

function formatDate(dateString) {
  const date = parseInputDate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function monthName(date = today()) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function inferTipo(text) {
  const normalized = normalizeText(text);
  const entradaWords = ["recebi", "receber", "ganhei", "ganho", "entrou", "entrada", "salario", "pix recebido", "deposito"];
  const saidaWords = ["gastei", "paguei", "comprei", "saida", "saiu", "despesa", "conta", "parcelei", "cartao"];
  if (entradaWords.some((word) => normalized.includes(word))) return "entrada";
  if (saidaWords.some((word) => normalized.includes(word))) return "saida";
  return "saida";
}

function inferDate(text) {
  const normalized = normalizeText(text);
  const base = today();

  if (normalized.includes("ontem")) {
    base.setDate(base.getDate() - 1);
    return toDateInputValue(base);
  }
  if (normalized.includes("amanha")) {
    base.setDate(base.getDate() + 1);
    return toDateInputValue(base);
  }
  if (normalized.includes("hoje")) {
    return toDateInputValue(base);
  }

  const slashMatch = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]) - 1;
    const year = slashMatch[3]
      ? Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : base.getFullYear();
    return toDateInputValue(new Date(year, month, day));
  }

  const dayMatch = normalized.match(/\bdia\s+(\d{1,2})\b/);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    return toDateInputValue(new Date(base.getFullYear(), base.getMonth(), day));
  }

  return toDateInputValue(base);
}

function inferInstallments(text) {
  const normalized = normalizeText(text);
  const match =
    normalized.match(/\b(\d{1,2})\s*x\b/) ||
    normalized.match(/\b(\d{1,2})\s*(vezes|parcelas)\b/) ||
    normalized.match(/\bem\s+(\d{1,2})\b/);
  const total = match ? Number(match[1]) : 1;
  return Number.isFinite(total) && total > 1 ? Math.min(total, 72) : 1;
}

function inferAmount(text) {
  const normalized = normalizeText(text);
  const moneyMatch =
    normalized.match(/r\$\s*([\d.,]+)/) ||
    normalized.match(/\b([\d.,]+)\s*(reais|real)\b/) ||
    normalized.match(/\b(\d+(?:[,.]\d{1,2})?)\b/);
  return parseCurrency(moneyMatch?.[1]);
}

function inferNote(text) {
  let note = text;
  note = note.replace(/r\$\s*[\d.,]+/gi, " ");
  note = note.replace(/\b[\d.,]+\s*(reais|real)\b/gi, " ");
  note = note.replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrou|entrada|saida|despesa|parcelei|lancei|lançar|lancar)\b/gi, " ");
  note = note.replace(/\b(hoje|ontem|amanha|amanhã)\b/gi, " ");
  note = note.replace(/\bdia\s+\d{1,2}\b/gi, " ");
  note = note.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ");
  note = note.replace(/\b\d+(?:[,.]\d{1,2})?\b/, " ");
  note = note.replace(/\bem\s+\d{1,2}\s*(x|vezes|parcelas)?/gi, " ");
  note = note.replace(/\b\d{1,2}\s*(x|vezes|parcelas)\b/gi, " ");
  note = note.replace(/\b(no|na|em|de|do|da|para|por|com)\b/gi, " ");
  return note.replace(/\s+/g, " ").trim() || "sem nota";
}

function parseLancamento(text) {
  const tipo = inferTipo(text);
  const valorTotal = inferAmount(text);
  const parcelasTotal = inferInstallments(text);
  const valor = parcelasTotal > 1 ? roundMoney(valorTotal / parcelasTotal) : valorTotal;
  return {
    tipo,
    valor,
    nota: inferNote(text),
    dataOperacao: inferDate(text),
    parcelasTotal,
    valorTotalParcelado: parcelasTotal > 1 ? valorTotal : undefined,
    textoOriginal: text.trim(),
  };
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildLancamentosFromDraft(draft) {
  const now = new Date().toISOString();
  const total = Number(draft.parcelasTotal || 1);
  const groupId = total > 1 ? id("parc") : undefined;
  const firstDate = parseInputDate(draft.dataOperacao);
  return Array.from({ length: total }, (_, index) => ({
    id: id("lan"),
    tipo: draft.tipo,
    valor: roundMoney(draft.valor),
    nota: draft.nota || "sem nota",
    dataOperacao: toDateInputValue(addMonths(firstDate, index)),
    dataCriacao: now,
    textoOriginal: draft.textoOriginal,
    parcelasTotal: total > 1 ? total : undefined,
    parcelaNumero: total > 1 ? index + 1 : undefined,
    grupoParcelamentoId: groupId,
    valorTotalParcelado: total > 1 ? roundMoney(draft.valorTotalParcelado || draft.valor * total) : undefined,
  }));
}

function addMessage(message) {
  state.messages.push({
    id: id("msg"),
    createdAt: new Date().toISOString(),
    ...message,
  });
  renderMessages();
}

function summaryText(draft) {
  const lines = [
    `${draft.tipo === "entrada" ? "Entrada" : "Saida"}: ${money.format(draft.valor)}`,
    `Data: ${formatDate(draft.dataOperacao)}`,
    `Nota: ${draft.nota}`,
  ];
  if (draft.parcelasTotal > 1) {
    lines.push(`Parcelas: ${draft.parcelasTotal}x`);
    lines.push(`Total parcelado: ${money.format(draft.valorTotalParcelado)}`);
  }
  return lines.join("\n");
}

function renderMessages() {
  els.messages.innerHTML = "";
  if (!state.messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Escreva ou dite pelo teclado do iPhone. Eu confirmo antes de salvar.";
    els.messages.append(empty);
    return;
  }

  state.messages.forEach((message) => {
    const item = document.createElement("div");
    item.className = `message ${message.sender}`;
    item.dataset.id = message.id;

    if (message.kind === "confirm") {
      item.append(renderConfirmCard(message));
    } else if (message.kind === "edit") {
      item.append(renderEditForm(message));
    } else {
      const p = document.createElement("p");
      p.textContent = message.text;
      item.append(p);
      if (message.sender === "user") attachLongPressEdit(item, message);
    }

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(message.createdAt));
    item.append(time);
    els.messages.append(item);
  });

  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderConfirmCard(message) {
  const card = document.createElement("div");
  card.className = "confirm-card";
  const title = document.createElement("p");
  title.textContent = "Entendi. Vou salvar:";
  card.append(title);

  const grid = document.createElement("div");
  grid.className = "confirm-grid";
  [
    ["Tipo", message.draft.tipo === "entrada" ? "Entrada" : "Saida"],
    ["Valor", money.format(message.draft.valor)],
    ["Data", formatDate(message.draft.dataOperacao)],
    ["Nota", message.draft.nota],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "confirm-row";
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    grid.append(row);
  });

  if (message.draft.parcelasTotal > 1) {
    const row = document.createElement("div");
    row.className = "confirm-row";
    row.innerHTML = `<span>Parcelas</span><strong>${message.draft.parcelasTotal}x de ${money.format(message.draft.valor)}</strong>`;
    grid.append(row);
  }
  card.append(grid);

  const actions = document.createElement("div");
  actions.className = "confirm-actions";
  actions.append(
    button("Confirmar", "small-button", () => confirmPending(message.id)),
    button("Editar", "small-button", () => editPending(message.id)),
    button("Cancelar", "small-button danger", () => cancelPending(message.id))
  );
  card.append(actions);
  return card;
}

function renderEditForm(message) {
  const form = document.createElement("form");
  form.className = "edit-form";
  form.innerHTML = `
    <label>Tipo
      <select name="tipo">
        <option value="entrada">Entrada</option>
        <option value="saida">Saida</option>
      </select>
    </label>
    <label>Valor da parcela/lancamento
      <input name="valor" inputmode="decimal" required />
    </label>
    <label>Data da operacao
      <input name="dataOperacao" type="date" required />
    </label>
    <label>Nota
      <input name="nota" required />
    </label>
    <label>Parcelas
      <input name="parcelasTotal" inputmode="numeric" min="1" max="72" type="number" />
    </label>
    <label>Total parcelado
      <input name="valorTotalParcelado" inputmode="decimal" />
    </label>
    <div class="edit-actions"></div>
  `;
  form.tipo.value = message.draft.tipo;
  form.valor.value = String(message.draft.valor).replace(".", ",");
  form.dataOperacao.value = message.draft.dataOperacao;
  form.nota.value = message.draft.nota;
  form.parcelasTotal.value = message.draft.parcelasTotal || 1;
  form.valorTotalParcelado.value = message.draft.valorTotalParcelado
    ? String(message.draft.valorTotalParcelado).replace(".", ",")
    : "";

  const actions = form.querySelector(".edit-actions");
  actions.append(
    button("Salvar alteracao", "small-button", null, "submit"),
    button("Cancelar", "small-button danger", () => cancelPending(message.id))
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const parcelasTotal = Math.max(1, Math.min(72, Number(form.parcelasTotal.value || 1)));
    const nextDraft = {
      ...message.draft,
      tipo: form.tipo.value,
      valor: roundMoney(parseCurrency(form.valor.value)),
      dataOperacao: form.dataOperacao.value,
      nota: form.nota.value.trim() || "sem nota",
      parcelasTotal,
      valorTotalParcelado: parcelasTotal > 1
        ? roundMoney(parseCurrency(form.valorTotalParcelado.value) || parseCurrency(form.valor.value) * parcelasTotal)
        : undefined,
    };
    state.pending = nextDraft;
    state.messages = state.messages.filter((item) => item.id !== message.id);
    addMessage({
      sender: "bot",
      kind: "confirm",
      draft: nextDraft,
    });
  });
  return form;
}

function button(text, className, onClick, type = "button") {
  const btn = document.createElement("button");
  btn.type = type;
  btn.className = className;
  btn.textContent = text;
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}

function attachLongPressEdit(element, message) {
  let timer;
  const start = () => {
    timer = window.setTimeout(() => {
      els.entryInput.value = message.text;
      els.entryInput.focus();
    }, 650);
  };
  const stop = () => window.clearTimeout(timer);
  element.addEventListener("pointerdown", start);
  element.addEventListener("pointerup", stop);
  element.addEventListener("pointerleave", stop);
}

async function confirmPending(messageId) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message?.draft) return;
  const nextItems = buildLancamentosFromDraft(message.draft);
  await saveLancamentos(nextItems);
  state.lancamentos = [...state.lancamentos, ...nextItems];
  state.pending = null;
  state.messages = state.messages.filter((item) => item.id !== messageId);
  addMessage({
    sender: "bot",
    kind: "text",
    text: nextItems.length > 1
      ? `Salvo. Lancei ${nextItems.length} parcelas nos meses corretos.`
      : "Lancamento salvo.",
  });
  refresh();
}

function editPending(messageId) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message?.draft) return;
  state.messages = state.messages.filter((item) => item.id !== messageId);
  addMessage({
    sender: "bot",
    kind: "edit",
    draft: message.draft,
  });
}

function cancelPending(messageId) {
  state.messages = state.messages.filter((item) => item.id !== messageId);
  state.pending = null;
  addMessage({ sender: "bot", kind: "text", text: "Cancelado. Nada foi salvo." });
}

function filteredLancamentos() {
  const start = els.filterStart.value ? parseInputDate(els.filterStart.value) : null;
  const end = els.filterEnd.value ? parseInputDate(els.filterEnd.value) : null;
  if (end) end.setHours(23, 59, 59, 999);
  const type = els.filterType.value;

  return state.lancamentos
    .filter((item) => {
      const date = parseInputDate(item.dataOperacao);
      const byStart = !start || date >= start;
      const byEnd = !end || date <= end;
      const byType = type === "todos" || item.tipo === type;
      return byStart && byEnd && byType;
    })
    .sort((a, b) => b.dataOperacao.localeCompare(a.dataOperacao));
}

function calcTotals(items) {
  return items.reduce(
    (acc, item) => {
      if (item.tipo === "entrada") acc.entrada += item.valor;
      else acc.saida += item.valor;
      acc.saldo = acc.entrada - acc.saida;
      return acc;
    },
    { entrada: 0, saida: 0, saldo: 0 }
  );
}

function renderMonthCard() {
  const current = today();
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  const items = state.lancamentos.filter((item) => {
    const date = parseInputDate(item.dataOperacao);
    return date >= monthStart && date <= monthEnd;
  });
  const totals = calcTotals(items);
  els.monthLabel.textContent = `Saldo de ${monthName(current)}`;
  els.monthBalance.textContent = money.format(totals.saldo);
  els.monthResume.textContent = items.length
    ? `${money.format(totals.entrada)} entrando, ${money.format(totals.saida)} saindo.`
    : "Sem lancamentos neste mes.";
  els.monthCard.classList.toggle("positive", totals.saldo > 0);
  els.monthCard.classList.toggle("negative", totals.saldo < 0);
}

function renderReport() {
  const items = filteredLancamentos();
  const totals = calcTotals(items);
  els.reportIncome.textContent = money.format(totals.entrada);
  els.reportExpense.textContent = money.format(totals.saida);
  els.reportBalance.textContent = money.format(totals.saldo);
  els.transactionsList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhum lancamento nesse filtro.";
    els.transactionsList.append(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "transaction-item";
    const parcela = item.parcelasTotal ? ` ${item.parcelaNumero}/${item.parcelasTotal}` : "";
    row.innerHTML = `
      <div>
        <strong>${item.nota}</strong>
        <small>${formatDate(item.dataOperacao)}${parcela}</small>
      </div>
      <strong class="${item.tipo}">${item.tipo === "entrada" ? "+" : "-"} ${money.format(item.valor)}</strong>
    `;
    els.transactionsList.append(row);
  });
}

function refresh() {
  renderMonthCard();
  renderReport();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  const payload = {
    app: "Meu Caixa",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    lancamentos: state.lancamentos,
    settings: {},
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `meu-caixa-backup-${toDateInputValue(today())}.json`);
}

async function importBackup(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (payload.app !== "Meu Caixa" || !Array.isArray(payload.lancamentos)) {
    throw new Error("Backup invalido");
  }
  await replaceLancamentos(payload.lancamentos);
  state.lancamentos = payload.lancamentos;
  addMessage({ sender: "bot", kind: "text", text: "Backup restaurado." });
  refresh();
}

function escapePdfText(text) {
  return String(text).replace(/[\\()]/g, "\\$&");
}

function makePdf(lines) {
  const objects = [];
  const add = (content) => {
    objects.push(content);
    return objects.length;
  };
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const contentLines = ["BT", "/F1 12 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    if (index > 0) contentLines.push("0 -18 Td");
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const page = add(`<< /Type /Page /Parent 4 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
  const pages = add(`<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pages} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function exportPdf() {
  const items = filteredLancamentos();
  const totals = calcTotals(items);
  const lines = [
    "Meu Caixa - Relatorio",
    `Periodo: ${els.filterStart.value || "inicio"} ate ${els.filterEnd.value || "hoje"}`,
    `Tipo: ${els.filterType.options[els.filterType.selectedIndex].text}`,
    `Entradas: ${money.format(totals.entrada)}`,
    `Saidas: ${money.format(totals.saida)}`,
    `Saldo: ${money.format(totals.saldo)}`,
    "",
    "Lancamentos:",
    ...items.slice(0, 35).map((item) => {
      const parcela = item.parcelasTotal ? ` ${item.parcelaNumero}/${item.parcelasTotal}` : "";
      const sign = item.tipo === "entrada" ? "+" : "-";
      return `${formatDate(item.dataOperacao)} | ${item.tipo}${parcela} | ${sign}${money.format(item.valor)} | ${item.nota}`;
    }),
  ];
  const blob = makePdf(lines);
  downloadBlob(blob, `meu-caixa-relatorio-${toDateInputValue(today())}.pdf`);
}

function setDefaultFilters() {
  const now = today();
  els.filterStart.value = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  els.filterEnd.value = toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function bindEvents() {
  document.querySelectorAll(".tab-button").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".screen").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#${tab.dataset.screen}Screen`).classList.add("active");
    });
  });

  els.entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = els.entryInput.value.trim();
    if (!text) return;
    els.entryInput.value = "";
    addMessage({ sender: "user", kind: "text", text });
    const draft = parseLancamento(text);
    if (!draft.valor) {
      addMessage({
        sender: "bot",
        kind: "text",
        text: "Nao encontrei o valor. Tente algo como: gastei 80 reais no mercado.",
      });
      return;
    }
    state.pending = draft;
    addMessage({ sender: "bot", kind: "confirm", draft });
  });

  [els.filterStart, els.filterEnd, els.filterType].forEach((input) => {
    input.addEventListener("change", renderReport);
  });

  els.pdfButton.addEventListener("click", exportPdf);
  els.backupButton.addEventListener("click", () => els.backupDialog.showModal());
  els.exportBackupButton.addEventListener("click", exportBackup);
  els.importBackupInput.addEventListener("change", async () => {
    const file = els.importBackupInput.files?.[0];
    if (!file) return;
    try {
      await importBackup(file);
      els.backupDialog.close();
    } catch {
      alert("Nao consegui restaurar esse backup.");
    } finally {
      els.importBackupInput.value = "";
    }
  });
}

async function init() {
  state.db = await openDb();
  state.lancamentos = await getAllLancamentos();
  setDefaultFilters();
  bindEvents();
  refresh();
  renderMessages();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init().catch(() => {
  document.body.innerHTML = "<main class='empty-state'>Nao consegui abrir o Meu Caixa neste navegador.</main>";
});
