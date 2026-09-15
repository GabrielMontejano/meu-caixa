const DB_NAME = "meu-caixa-local-v3";
const DB_VERSION = 1;
const STORE = "lancamentos";
const BACKUP_VERSION = 1;

const state = {
  db: null,
  lancamentos: [],
  activeLaunchType: "saida",
  messages: {
    saida: [],
    entrada: [],
  },
};

const subtitles = {
  home: "Controle simples, privado e direto.",
  launch: "Lance de forma simples.",
  report: "Consulte e exporte.",
  edit: "Corrija lancamentos salvos.",
};

const launchModes = {
  saida: {
    label: "Gasto",
    title: "Novo gasto",
    subtitle: "Anote dinheiro que saiu.",
    placeholder: "500 almoco",
    helperTitle: "Digite o gasto direto",
    helperText: "Valor primeiro, depois a descricao. A data e opcional.",
    examples: ["500 almoco", "300 gasolina ontem", "1000 pneu 4x"],
    missingValue: "Nao encontrei o valor. Tente algo como: 80 mercado.",
  },
  entrada: {
    label: "Entrada",
    title: "Nova entrada",
    subtitle: "Anote dinheiro que entrou.",
    placeholder: "2000 salario",
    helperTitle: "Digite a entrada direto",
    helperText: "Valor primeiro, depois a descricao. A data e opcional.",
    examples: ["2000 salario", "150 pix ontem"],
    missingValue: "Nao encontrei o valor. Tente algo como: 150 pix ontem.",
  },
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const els = {
  backButton: document.querySelector("#backButton"),
  screenSubtitle: document.querySelector("#screenSubtitle"),
  monthLabel: document.querySelector("#monthLabel"),
  monthBalance: document.querySelector("#monthBalance"),
  monthResume: document.querySelector("#monthResume"),
  monthCard: document.querySelector(".month-card"),
  launchLabel: document.querySelector("#launchLabel"),
  launchTitle: document.querySelector("#launchTitle"),
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
  editFilterStart: document.querySelector("#editFilterStart"),
  editFilterEnd: document.querySelector("#editFilterEnd"),
  editFilterType: document.querySelector("#editFilterType"),
  editFilterMin: document.querySelector("#editFilterMin"),
  editFilterMax: document.querySelector("#editFilterMax"),
  clearEditFilters: document.querySelector("#clearEditFilters"),
  editList: document.querySelector("#editList"),
  editDialog: document.querySelector("#editDialog"),
  closeEditDialog: document.querySelector("#closeEditDialog"),
  editParcelWarning: document.querySelector("#editParcelWarning"),
  savedEditForm: document.querySelector("#savedEditForm"),
  editId: document.querySelector("#editId"),
  editType: document.querySelector("#editType"),
  editAmount: document.querySelector("#editAmount"),
  parcelMasterFields: document.querySelector("#parcelMasterFields"),
  editTotalAmount: document.querySelector("#editTotalAmount"),
  editInstallments: document.querySelector("#editInstallments"),
  editDate: document.querySelector("#editDate"),
  editNote: document.querySelector("#editNote"),
  cancelSavedEdit: document.querySelector("#cancelSavedEdit"),
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

function deleteLancamentos(ids) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    ids.forEach((itemId) => store.delete(itemId));
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
  if (comma > dot) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(cleaned.replace(/,/g, ""));
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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
  const entradas = ["recebi", "receber", "ganhei", "ganho", "entrou", "entrada", "salario", "deposito", "vendi"];
  const saidas = ["gastei", "paguei", "comprei", "saida", "saiu", "despesa", "conta", "parcelei", "cartao"];
  if (entradas.some((word) => normalized.includes(word))) return "entrada";
  if (saidas.some((word) => normalized.includes(word))) return "saida";
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
  if (normalized.includes("hoje")) return toDateInputValue(base);

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
    return toDateInputValue(new Date(base.getFullYear(), base.getMonth(), Number(dayMatch[1])));
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

function normalizeNote(note) {
  return normalizeText(note).replace(/\s+/g, " ").trim() || "sem nota";
}

function inferNote(text) {
  let note = text;
  note = note.replace(/r\$\s*[\d.,]+/gi, " ");
  note = note.replace(/\b[\d.,]+\s*(reais|real)\b/gi, " ");
  note = note.replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrou|entrada|saida|despesa|parcelei|lancei|lançar|lancar|vendi)\b/gi, " ");
  note = note.replace(/\b(hoje|ontem|amanha|amanhã)\b/gi, " ");
  note = note.replace(/\bdia\s+\d{1,2}\b/gi, " ");
  note = note.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ");
  note = note.replace(/\b\d+(?:[,.]\d{1,2})?\b/, " ");
  note = note.replace(/\bem\s+\d{1,2}\s*(x|vezes|parcelas)?/gi, " ");
  note = note.replace(/\b\d{1,2}\s*(x|vezes|parcelas)\b/gi, " ");
  note = note.replace(/(^|[^\p{L}\p{N}])(no|na|em|de|do|da|para|por|com|o|a)(?=$|[^\p{L}\p{N}])/giu, "$1 ");
  return normalizeNote(note);
}

function parseLancamento(text, forcedTipo) {
  const tipo = forcedTipo || inferTipo(text);
  const valorTotal = inferAmount(text);
  const parcelasTotal = tipo === "entrada" ? 1 : inferInstallments(text);
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

function buildLancamentosFromDraft(draft) {
  const now = new Date().toISOString();
  const total = Number(draft.parcelasTotal || 1);
  const groupId = total > 1 ? draft.grupoParcelamentoId || id("parc") : undefined;
  const firstDate = parseInputDate(draft.dataOperacao);
  return Array.from({ length: total }, (_, index) => ({
    id: draft.ids?.[index] || id("lan"),
    tipo: draft.tipo,
    valor: roundMoney(draft.valor),
    nota: draft.nota || "sem nota",
    dataOperacao: toDateInputValue(addMonths(firstDate, index)),
    dataCriacao: draft.createdAtByIndex?.[index] || now,
    dataAtualizacao: draft.updatedAt || null,
    textoOriginal: draft.textoOriginal,
    parcelasTotal: total > 1 ? total : undefined,
    parcelaNumero: total > 1 ? index + 1 : undefined,
    grupoParcelamentoId: groupId,
    valorTotalParcelado: total > 1 ? roundMoney(draft.valorTotalParcelado || draft.valor * total) : undefined,
  }));
}

function isParcelChild(item) {
  return Boolean(item.grupoParcelamentoId && item.parcelaNumero && item.parcelaNumero > 1);
}

function isParcelMaster(item) {
  return Boolean(item.grupoParcelamentoId && item.parcelaNumero === 1);
}

function parcelGroup(groupId) {
  return state.lancamentos
    .filter((entry) => entry.grupoParcelamentoId === groupId)
    .sort((a, b) => (a.parcelaNumero || 0) - (b.parcelaNumero || 0));
}

function parcelMaster(item) {
  if (!item.grupoParcelamentoId) return item;
  return parcelGroup(item.grupoParcelamentoId).find((entry) => entry.parcelaNumero === 1) || item;
}

function activeLaunchMode() {
  return launchModes[state.activeLaunchType] || launchModes.saida;
}

function navigate(screen, options = {}) {
  document.querySelectorAll(".screen").forEach((item) => item.classList.remove("active"));
  document.querySelector(`#${screen}Screen`).classList.add("active");
  els.backButton.classList.toggle("hidden", screen === "home");
  els.screenSubtitle.textContent = subtitles[screen] || subtitles.home;

  if (screen === "launch") {
    const mode = activeLaunchMode();
    els.screenSubtitle.textContent = mode.subtitle;
    els.launchLabel.textContent = mode.label;
    els.launchTitle.textContent = mode.title;
    els.entryInput.placeholder = mode.placeholder;
    renderMessages();
    setTimeout(() => els.entryInput.focus(), 50);
  }
  if (screen === "edit") {
    renderEditList();
    if (options.editId) openSavedEdit(options.editId);
  }
}

function addMessage(message) {
  state.messages[state.activeLaunchType].push({
    id: id("msg"),
    createdAt: new Date().toISOString(),
    ...message,
  });
  renderMessages();
}

function savedText(items) {
  const first = items[0];
  const lines = [
    "Salvo.",
    `${first.tipo === "entrada" ? "Entrada" : "Saida"}: ${money.format(first.valor)}`,
    `Data: ${formatDate(first.dataOperacao)}`,
    `Nota: ${first.nota}`,
  ];
  if (items.length > 1) {
    lines.push(`Parcelas: ${items.length}x`);
    lines.push(`Total: ${money.format(first.valorTotalParcelado)}`);
  }
  return lines.join("\n");
}

function renderMessages() {
  const messages = state.messages[state.activeLaunchType] || [];
  els.messages.innerHTML = "";
  if (!messages.length) {
    const empty = document.createElement("div");
    const mode = activeLaunchMode();
    empty.className = "empty-state chat-helper";
    const title = document.createElement("strong");
    title.textContent = mode.helperTitle;
    const text = document.createElement("span");
    text.textContent = mode.helperText;
    const examples = document.createElement("div");
    examples.className = "helper-examples";
    mode.examples.forEach((example) => {
      const item = document.createElement("small");
      item.textContent = example;
      examples.append(item);
    });
    empty.append(title, text, examples);
    els.messages.append(empty);
    return;
  }

  messages.forEach((message) => {
    const item = document.createElement("div");
    item.className = `message ${message.sender}`;
    const p = document.createElement("p");
    p.textContent = message.text;
    item.append(p);

    if (message.editId) {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      actions.append(button("Alterar", "small-button", () => navigate("edit", { editId: message.editId })));
      item.append(actions);
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

function button(text, className, onClick, type = "button") {
  const btn = document.createElement("button");
  btn.type = type;
  btn.className = className;
  btn.textContent = text;
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}

async function createFromChat(text) {
  addMessage({ sender: "user", text });
  const draft = parseLancamento(text, state.activeLaunchType);

  if (!draft.valor) {
    addMessage({
      sender: "bot",
      text: activeLaunchMode().missingValue,
    });
    return;
  }

  const nextItems = buildLancamentosFromDraft(draft);
  await saveLancamentos(nextItems);
  state.lancamentos = [...state.lancamentos, ...nextItems];
  addMessage({
    sender: "bot",
    text: savedText(nextItems),
    editId: nextItems[0].id,
  });
  refresh();
}

function filteredLancamentos() {
  const start = els.filterStart.value ? parseInputDate(els.filterStart.value) : null;
  const end = els.filterEnd.value ? parseInputDate(els.filterEnd.value) : null;
  if (end) end.setHours(23, 59, 59, 999);
  const type = els.filterType.value;

  return state.lancamentos
    .filter((item) => {
      const date = parseInputDate(item.dataOperacao);
      return (!start || date >= start) && (!end || date <= end) && (type === "todos" || item.tipo === type);
    })
    .sort((a, b) => b.dataOperacao.localeCompare(a.dataOperacao));
}

function sortedLancamentos() {
  return [...state.lancamentos].sort((a, b) => {
    const byDate = b.dataOperacao.localeCompare(a.dataOperacao);
    if (byDate) return byDate;
    return (b.dataCriacao || "").localeCompare(a.dataCriacao || "");
  });
}

function filteredEditLancamentos() {
  const start = els.editFilterStart.value ? parseInputDate(els.editFilterStart.value) : null;
  const end = els.editFilterEnd.value ? parseInputDate(els.editFilterEnd.value) : null;
  const type = els.editFilterType.value;
  const min = parseCurrency(els.editFilterMin.value);
  const max = parseCurrency(els.editFilterMax.value);
  if (end) end.setHours(23, 59, 59, 999);

  return sortedLancamentos().filter((item) => {
    const date = parseInputDate(item.dataOperacao);
    const matchesDate = (!start || date >= start) && (!end || date <= end);
    const matchesType = type === "todos" || item.tipo === type;
    const matchesMin = !min || item.valor >= min;
    const matchesMax = !max || item.valor <= max;
    return matchesDate && matchesType && matchesMin && matchesMax;
  });
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

  items.forEach((item) => els.transactionsList.append(transactionRow(item, false)));
}

function transactionRow(item, editable) {
  const row = document.createElement("div");
  row.className = "transaction-item";
  const parcela = item.parcelasTotal ? ` ${item.parcelaNumero}/${item.parcelasTotal}` : "";

  const details = document.createElement("div");
  const note = document.createElement("strong");
  note.textContent = item.nota;
  const date = document.createElement("small");
  date.textContent = `${formatDate(item.dataOperacao)}${parcela}`;
  details.append(note, date);

  const value = document.createElement("strong");
  value.className = item.tipo;
  value.textContent = `${item.tipo === "entrada" ? "+" : "-"} ${money.format(item.valor)}`;

  row.append(details, value);
  if (editable) {
    row.append(button("Alterar", "small-button", () => openSavedEdit(item.id)));
  }
  return row;
}

function renderEditList() {
  els.editList.innerHTML = "";
  const items = filteredEditLancamentos();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.lancamentos.length ? "Nenhum lancamento encontrado com esses filtros." : "Nenhum lancamento salvo ainda.";
    els.editList.append(empty);
    return;
  }

  items.forEach((item) => els.editList.append(transactionRow(item, true)));
}

function openEditDialog() {
  if (!els.editDialog.open) els.editDialog.showModal();
}

function closeEditDialog() {
  els.editDialog.close();
  els.editParcelWarning.classList.add("hidden");
  els.savedEditForm.classList.add("hidden");
}

function openSavedEdit(itemId) {
  const item = state.lancamentos.find((entry) => entry.id === itemId);
  if (!item) return;

  if (isParcelChild(item)) {
    showParcelChildWarning(item);
    return;
  }

  els.editParcelWarning.classList.add("hidden");
  els.editId.value = item.id;
  els.editType.value = item.tipo;
  els.editAmount.value = String(item.valor).replace(".", ",");
  els.editDate.value = item.dataOperacao;
  els.editNote.value = item.nota;
  if (isParcelMaster(item)) {
    els.parcelMasterFields.classList.remove("hidden");
    els.editTotalAmount.value = String(item.valorTotalParcelado || item.valor * item.parcelasTotal).replace(".", ",");
    els.editInstallments.value = item.parcelasTotal || parcelGroup(item.grupoParcelamentoId).length;
  } else {
    els.parcelMasterFields.classList.add("hidden");
    els.editTotalAmount.value = "";
    els.editInstallments.value = "";
  }
  els.savedEditForm.classList.remove("hidden");
  openEditDialog();
}

function showParcelChildWarning(item) {
  const master = parcelMaster(item);
  els.savedEditForm.classList.add("hidden");
  els.editParcelWarning.innerHTML = "";

  const title = document.createElement("strong");
  title.textContent = "Compra parcelada";
  const text = document.createElement("p");
  text.textContent = "Esta e uma parcela filha. Para o sistema recalcular tudo, altere o lancamento mestre.";
  const action = button("Alterar lancamento mestre", "small-button", () => openSavedEdit(master.id));

  els.editParcelWarning.append(title, text, action);
  els.editParcelWarning.classList.remove("hidden");
  openEditDialog();
}

async function saveEditedLancamento(event) {
  event.preventDefault();
  const item = state.lancamentos.find((entry) => entry.id === els.editId.value);
  if (!item) return;

  if (isParcelMaster(item)) {
    await saveEditedParcelGroup(item);
    return;
  }

  const updated = {
    ...item,
    tipo: els.editType.value,
    valor: roundMoney(parseCurrency(els.editAmount.value)),
    dataOperacao: els.editDate.value,
    nota: normalizeNote(els.editNote.value),
    dataAtualizacao: new Date().toISOString(),
  };

  await saveLancamentos([updated]);
  state.lancamentos = state.lancamentos.map((entry) => (entry.id === updated.id ? updated : entry));
  closeEditDialog();
  addMessage({ sender: "bot", text: "Alteracao realizada e salva." });
  refresh();
  renderEditList();
}

async function saveEditedParcelGroup(master) {
  const group = parcelGroup(master.grupoParcelamentoId);
  const parcelasTotal = Math.max(2, Math.min(72, Number(els.editInstallments.value || group.length || 2)));
  const valorTotalParcelado = roundMoney(parseCurrency(els.editTotalAmount.value) || parseCurrency(els.editAmount.value) * parcelasTotal);
  const valor = roundMoney(valorTotalParcelado / parcelasTotal);
  const updatedAt = new Date().toISOString();
  const createdAtByIndex = group.map((entry) => entry.dataCriacao);
  const ids = group.slice(0, parcelasTotal).map((entry) => entry.id);

  const nextGroup = buildLancamentosFromDraft({
    ids,
    createdAtByIndex,
    updatedAt,
    tipo: els.editType.value,
    valor,
    nota: normalizeNote(els.editNote.value),
    dataOperacao: els.editDate.value,
    parcelasTotal,
    valorTotalParcelado,
    textoOriginal: master.textoOriginal,
    grupoParcelamentoId: master.grupoParcelamentoId,
  });

  const removedIds = group.slice(parcelasTotal).map((entry) => entry.id);
  if (removedIds.length) await deleteLancamentos(removedIds);
  await saveLancamentos(nextGroup);

  const nextById = new Map(nextGroup.map((entry) => [entry.id, entry]));
  state.lancamentos = [
    ...state.lancamentos
      .filter((entry) => entry.grupoParcelamentoId !== master.grupoParcelamentoId || nextById.has(entry.id))
      .map((entry) => nextById.get(entry.id) || entry),
    ...nextGroup.filter((entry) => !state.lancamentos.some((current) => current.id === entry.id)),
  ];

  closeEditDialog();
  addMessage({ sender: "bot", text: "Parcelamento recalculado e salvo." });
  refresh();
  renderEditList();
}

function refresh() {
  renderMonthCard();
  renderReport();
  renderEditList();
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
  addMessage({ sender: "bot", text: "Backup restaurado." });
  refresh();
}

function escapePdfText(text) {
  return String(text).replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, " ");
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
  downloadBlob(makePdf(lines), `meu-caixa-relatorio-${toDateInputValue(today())}.pdf`);
}

function setDefaultFilters() {
  const now = today();
  els.filterStart.value = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  els.filterEnd.value = toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function bindEvents() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.launchType) state.activeLaunchType = button.dataset.launchType;
      navigate(button.dataset.screen);
    });
  });

  els.backButton.addEventListener("click", () => navigate("home"));

  els.entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = els.entryInput.value.trim();
    if (!text) return;
    els.entryInput.value = "";
    createFromChat(text);
  });

  [els.filterStart, els.filterEnd, els.filterType].forEach((input) => {
    input.addEventListener("change", renderReport);
  });

  [els.editFilterStart, els.editFilterEnd, els.editFilterType, els.editFilterMin, els.editFilterMax].forEach((input) => {
    input.addEventListener("input", renderEditList);
    input.addEventListener("change", renderEditList);
  });

  els.clearEditFilters.addEventListener("click", () => {
    els.editFilterStart.value = "";
    els.editFilterEnd.value = "";
    els.editFilterType.value = "todos";
    els.editFilterMin.value = "";
    els.editFilterMax.value = "";
    renderEditList();
  });

  els.savedEditForm.addEventListener("submit", saveEditedLancamento);
  els.closeEditDialog.addEventListener("click", closeEditDialog);
  els.editDialog.addEventListener("click", (event) => {
    if (event.target === els.editDialog) closeEditDialog();
  });
  els.cancelSavedEdit.addEventListener("click", closeEditDialog);
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
