/**
 * In-memory SQLite stand-in for Expo/Cursor web previews.
 * Never touches expo-sqlite WASM/OPFS — stores rows in JS Maps so demo seed works.
 */

type SqlValue = string | number | null | undefined | Uint8Array;
type Row = Record<string, SqlValue>;
type RunResult = { changes: number; lastInsertRowId: number };

const WEB_MEMORY_STORE_KEY = '__budgetTrackerWebMemoryStore__';

const TABLE_PRIMARY_KEYS: Record<string, string> = {
  categories: 'id',
  transactions: 'id',
  category_budgets: 'category_id',
  app_settings: 'key',
  simulated_accounts: 'id',
  merchant_overrides: 'original_name',
  savings_goals: 'id',
  recurring_payments: 'id',
  wealth_assets: 'id',
  loans: 'id',
  contacts: 'id',
};

type WebMemoryStore = {
  tables: Record<string, Row[]>;
  lastInsertRowId: number;
};

function getStore(): WebMemoryStore {
  const g = globalThis as typeof globalThis & { [WEB_MEMORY_STORE_KEY]?: WebMemoryStore };
  if (!g[WEB_MEMORY_STORE_KEY]) {
    g[WEB_MEMORY_STORE_KEY] = { tables: {}, lastInsertRowId: 0 };
  }
  return g[WEB_MEMORY_STORE_KEY]!;
}

function ensureTable(name: string): Row[] {
  const store = getStore();
  if (!store.tables[name]) store.tables[name] = [];
  return store.tables[name]!;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function bindParams(sql: string, params: SqlValue[] = []): { text: string; values: SqlValue[] } {
  // Keep `?` placeholders; values are consumed in order by helpers below.
  return { text: normalizeSql(sql), values: [...params] };
}

function nextParam(values: SqlValue[]): SqlValue {
  return values.shift() ?? null;
}

function unescapeLiteral(raw: string): string {
  return raw.replace(/''/g, "'");
}

function parseLiteralOrParam(token: string, values: SqlValue[]): SqlValue {
  const t = token.trim();
  if (t === '?') return nextParam(values);
  if (t === 'NULL' || t === 'null') return null;
  if (/^'.*'$/s.test(t)) return unescapeLiteral(t.slice(1, -1));
  if (/^".*"$/s.test(t)) return unescapeLiteral(t.slice(1, -1));
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function rowGet(row: Row, column: string): SqlValue {
  if (column in row) return row[column];
  const lower = column.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === lower) return row[key];
  }
  return null;
}

function compareValues(a: SqlValue, b: SqlValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function evalExpr(expr: string, row: Row, values: SqlValue[]): SqlValue {
  const e = expr.trim();
  if (!e) return null;

  // Correlated subquery: (SELECT SUM(...) FROM ... WHERE ...)
  if (/^\(\s*SELECT\b/i.test(e)) {
    const inner = e.replace(/^\(/, '').replace(/\)\s*$/, '').trim();
    const fromMatch = /\bFROM\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/i.exec(inner);
    const innerAlias = fromMatch?.[2] ?? fromMatch?.[1] ?? '';
    const rewritten = inner.replace(/\b([a-zA-Z_]\w*)\.(\w+)\b/g, (full, alias, col) => {
      if (alias === innerAlias) return full;
      const v = rowGet(row, col) ?? rowGet(row, `${alias}.${col}`);
      if (v == null) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    });
    const rows = executeSelect(rewritten, [...values]);
    const first = rows[0];
    if (!first) return null;
    const keys = Object.keys(first);
    return keys.length ? first[keys[0]!] ?? null : null;
  }

  const coalesce = /^COALESCE\((.+)\)$/i.exec(e);
  if (coalesce) {
    const parts = splitArgs(coalesce[1]);
    for (const part of parts) {
      const v = evalExpr(part, row, values);
      if (v != null) return v;
    }
    return null;
  }

  const sum = /^SUM\((.+)\)$/i.exec(e);
  if (sum) {
    // Aggregate handled upstream; single-row fallback.
    return evalExpr(sum[1], row, values);
  }

  const count = /^COUNT\((.+)\)$/i.exec(e);
  if (count) return 1;

  const datetime = /^datetime\((.+)\)$/i.exec(e);
  if (datetime) return evalExpr(datetime[1], row, values);

  const lower = /^lower\((.+)\)$/i.exec(e);
  if (lower) {
    const v = evalExpr(lower[1], row, values);
    return v == null ? null : String(v).toLowerCase();
  }

  const max = /^MAX\((.+)\)$/i.exec(e);
  if (max) return evalExpr(max[1], row, values);

  const instr = /^instr\((.+)\)$/i.exec(e);
  if (instr) {
    const args = splitArgs(instr[1]);
    const hay = String(evalExpr(args[0] ?? 'NULL', row, values) ?? '');
    const needle = String(evalExpr(args[1] ?? 'NULL', row, values) ?? '');
    const idx = hay.indexOf(needle);
    return idx >= 0 ? idx + 1 : 0;
  }

  // Binary concat: 'wealth:' || ?
  if (e.includes('||')) {
    return e
      .split('||')
      .map((part) => evalExpr(part.trim(), row, values))
      .map((v) => (v == null ? '' : String(v)))
      .join('');
  }

  // Arithmetic: balance + ?
  const arith = /^(.+?)\s*([+\-*/])\s*(.+)$/.exec(e);
  if (arith && !e.includes('(')) {
    const left = Number(evalExpr(arith[1], row, values) ?? 0);
    const right = Number(evalExpr(arith[3], row, values) ?? 0);
    switch (arith[2]) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return right === 0 ? null : left / right;
    }
  }

  // Qualified column: t.date / rp.id — prefer the prefixed key written at join time.
  const qualified = /^(\w+)\.(\w+)$/.exec(e);
  if (qualified) {
    const hasPrefixed = Object.keys(row).some((k) => k.toLowerCase() === e.toLowerCase());
    if (hasPrefixed) return rowGet(row, e);
    return rowGet(row, qualified[2]);
  }

  if (/^[a-zA-Z_][\w]*$/.test(e)) return rowGet(row, e);

  return parseLiteralOrParam(e, values);
}

function splitArgs(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let inStr: "'" | '"' | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inStr) {
      current += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inStr = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function evalWhere(where: string | null, row: Row, values: SqlValue[]): boolean {
  if (!where) return true;
  const w = where.trim();
  if (!w) return true;

  // Split top-level AND / OR (AND binds tighter for our simple queries).
  const orParts = splitTopLevel(w, 'OR');
  if (orParts.length > 1) {
    return orParts.some((part) => evalWhere(part, row, values));
  }
  const andParts = splitTopLevel(w, 'AND');
  if (andParts.length > 1) {
    return andParts.every((part) => evalWhere(part, row, values));
  }

  let expr = w;
  if (expr.startsWith('(') && expr.endsWith(')')) {
    expr = expr.slice(1, -1).trim();
  }

  const notExists = /^NOT EXISTS\s*\(/i.test(expr);
  if (notExists) {
    // Used by ensureCashAccount — treat as "no matching rows" helper handled in INSERT path.
    return true;
  }

  const inMatch = /^(.+?)\s+NOT\s+IN\s*\((.+)\)$/i.exec(expr);
  if (inMatch) {
    const left = evalExpr(inMatch[1], row, values);
    const list = splitArgs(inMatch[2]).map((item) => evalExpr(item, row, values));
    return !list.some((item) => compareValues(item, left) === 0);
  }

  const inMatch2 = /^(.+?)\s+IN\s*\((.+)\)$/i.exec(expr);
  if (inMatch2) {
    const left = evalExpr(inMatch2[1], row, values);
    const list = splitArgs(inMatch2[2]).map((item) => evalExpr(item, row, values));
    return list.some((item) => compareValues(item, left) === 0);
  }

  const like = /^(.+?)\s+LIKE\s+(.+)$/i.exec(expr);
  if (like) {
    const left = String(evalExpr(like[1], row, values) ?? '');
    const pattern = String(evalExpr(like[2], row, values) ?? '');
    const re = new RegExp(`^${pattern.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');
    return re.test(left);
  }

  const isNotNull = /^(.+?)\s+IS\s+NOT\s+NULL$/i.exec(expr);
  if (isNotNull) return evalExpr(isNotNull[1], row, values) != null;

  const isNull = /^(.+?)\s+IS\s+NULL$/i.exec(expr);
  if (isNull) return evalExpr(isNull[1], row, values) == null;

  const cmp = /^(.+?)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/.exec(expr);
  if (cmp) {
    const left = evalExpr(cmp[1], row, values);
    const right = evalExpr(cmp[3], row, values);
    const c = compareValues(left, right);
    switch (cmp[2]) {
      case '=':
        return c === 0;
      case '!=':
      case '<>':
        return c !== 0;
      case '>':
        return c > 0;
      case '<':
        return c < 0;
      case '>=':
        return c >= 0;
      case '<=':
        return c <= 0;
    }
  }

  // Bare truthy expr (e.g. instr(...) > 0 already matched above)
  const v = evalExpr(expr, row, values);
  return Boolean(v) && v !== 0;
}

function splitTopLevel(input: string, keyword: 'AND' | 'OR'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let inStr: "'" | '"' | null = null;
  const upper = input;
  for (let i = 0; i < upper.length; i += 1) {
    const ch = upper[i]!;
    if (inStr) {
      current += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inStr = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0) {
      const slice = upper.slice(i);
      const re = keyword === 'AND' ? /^AND\b/i : /^OR\b/i;
      if (re.test(slice)) {
        parts.push(current.trim());
        current = '';
        i += keyword.length - 1;
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [input];
}

function parseSelectList(list: string): Array<{ expr: string; alias: string }> {
  return splitArgs(list).map((item) => {
    const asMatch = /^(.+?)\s+AS\s+(\w+)$/i.exec(item.trim());
    if (asMatch) return { expr: asMatch[1].trim(), alias: asMatch[2] };
    const spaced = /^(.+\S)\s+(\w+)$/.exec(item.trim());
    // Avoid treating "t.id" as alias patterns — only trailing bare alias.
    if (spaced && !spaced[1].includes('(') && !/\./.test(spaced[2])) {
      const left = spaced[1].trim();
      if (!/^(FROM|WHERE|JOIN|LEFT|INNER|ON|ORDER|GROUP|LIMIT)$/i.test(spaced[2])) {
        // "c.name categoryName" style is rare; prefer last identifier after AS only.
      }
    }
    const bare = item.trim();
    const alias = bare.includes('.') ? bare.split('.').pop()! : bare.replace(/[^\w]/g, '_') || 'value';
    return { expr: bare, alias };
  });
}

function orderRows(
  rows: Row[],
  orderBy: string | null,
  values: SqlValue[],
): Row[] {
  if (!orderBy) return rows;
  const parts = splitArgs(orderBy).map((part) => {
    const m = /^(.+?)(?:\s+(ASC|DESC))?$/i.exec(part.trim());
    return {
      expr: m?.[1]?.trim() ?? part,
      dir: (m?.[2] ?? 'ASC').toUpperCase() === 'DESC' ? -1 : 1,
    };
  });
  return [...rows].sort((a, b) => {
    for (const part of parts) {
      // Clone values so ORDER BY literals with ? don't drain shared params incorrectly.
      const va = evalExpr(part.expr, a, [...values]);
      const vb = evalExpr(part.expr, b, [...values]);
      const c = compareValues(va, vb);
      if (c !== 0) return c * part.dir;
    }
    return 0;
  });
}

/** SQL keywords that must not be parsed as table aliases after FROM / JOIN. */
const SQL_CLAUSE_KEYWORDS = new Set([
  'where',
  'join',
  'left',
  'inner',
  'outer',
  'cross',
  'on',
  'order',
  'group',
  'having',
  'limit',
  'union',
  'except',
  'intersect',
  'set',
  'values',
]);

function isSqlClauseKeyword(token: string | undefined): boolean {
  return Boolean(token && SQL_CLAUSE_KEYWORDS.has(token.toLowerCase()));
}

function findMainFrom(sql: string): { selectList: string; rest: string } | null {
  if (!/^SELECT\b/i.test(sql)) return null;
  let depth = 0;
  let inStr: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]!;
    if (inStr) {
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inStr = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (depth === 0 && /\bFROM\b/i.test(sql.slice(i, i + 5))) {
      // Ensure word boundary before FROM
      if (i > 0 && /[A-Za-z0-9_]/.test(sql[i - 1]!)) continue;
      const selectList = sql.slice('SELECT'.length, i).trim();
      const rest = sql.slice(i + 4).trim();
      return { selectList, rest };
    }
  }
  return null;
}

function executeSelect(sql: string, params: SqlValue[]): Row[] {
  const { text, values } = bindParams(sql, params);
  const parsed = findMainFrom(text);
  if (!parsed) return [];

  let rest = parsed.rest;
  const selectList = parsed.selectList;

  // Aggregate-only shortcuts without needing full group-by.
  const isCountStar = /^COUNT\(\s*\*\s*\)$/i.test(selectList) || /^COUNT\(\*\)$/i.test(selectList);
  const isCountAs = /^COUNT\(\s*\*\s*\)\s+AS\s+(\w+)$/i.exec(selectList);
  const isSumAs = /^COALESCE\(\s*SUM\((.+?)\)\s*,\s*0\s*\)\s+AS\s+(\w+)$/i.exec(selectList);
  const isMinAs = /^MIN\((.+?)\)\s+AS\s+(\w+)$/i.exec(selectList);

  // Do not treat WHERE/JOIN/ORDER/… as an alias — e.g. `FROM app_settings WHERE key = ?`
  // previously consumed `WHERE` as the alias and dropped the filter entirely.
  const mainTableMatch = /^(\w+)(?:\s+(?:AS\s+)?(\w+))?/i.exec(rest);
  if (!mainTableMatch) return [];
  const mainTable = mainTableMatch[1]!;
  const rawAlias = mainTableMatch[2];
  const aliasIsKeyword = isSqlClauseKeyword(rawAlias);
  const mainAlias = rawAlias && !aliasIsKeyword ? rawAlias : mainTable;
  // When the optional alias matched a clause keyword, only consume the table name.
  rest = rest.slice(aliasIsKeyword ? mainTable.length : mainTableMatch[0].length).trim();

  type Join = { table: string; alias: string; on: string; left: boolean };
  const joins: Join[] = [];
  while (/^(?:LEFT\s+)?(?:INNER\s+)?JOIN\b/i.test(rest)) {
    const joinMatch =
      /^(LEFT\s+)?(?:INNER\s+)?JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?\s+ON\s+(.+?)(?=\s+(?:LEFT\s+)?(?:INNER\s+)?JOIN\b|\s+WHERE\b|\s+ORDER\b|\s+GROUP\b|\s+LIMIT\b|$)/i.exec(
        rest,
      );
    if (!joinMatch) break;
    const joinAliasRaw = joinMatch[3];
    joins.push({
      left: Boolean(joinMatch[1]),
      table: joinMatch[2]!,
      alias: joinAliasRaw && !isSqlClauseKeyword(joinAliasRaw) ? joinAliasRaw : joinMatch[2]!,
      on: joinMatch[4]!.trim(),
    });
    rest = rest.slice(joinMatch[0].length).trim();
  }

  const whereMatch = /\bWHERE\b(.+?)(?=\bORDER\b|\bGROUP\b|\bLIMIT\b|$)/i.exec(rest);
  const whereSql = whereMatch?.[1]?.trim() ?? null;
  const orderMatch = /\bORDER\s+BY\b(.+?)(?=\bLIMIT\b|$)/i.exec(rest);
  const orderSql = orderMatch?.[1]?.trim() ?? null;
  const limitMatch = /\bLIMIT\b\s+(\d+|\?)/i.exec(rest);

  const selectParamCount = (selectList.match(/\?/g) ?? []).length;
  const whereParamCount = (whereSql?.match(/\?/g) ?? []).length;
  const selectParams = values.slice(0, selectParamCount);
  const whereParams = values.slice(selectParamCount, selectParamCount + whereParamCount);
  const afterWhere = values.slice(selectParamCount + whereParamCount);
  let limit: number | null = null;
  if (limitMatch) {
    limit = limitMatch[1] === '?' ? Number(afterWhere[0]) : Number(limitMatch[1]);
    if (!Number.isFinite(limit)) limit = null;
  }

  let rows: Row[] = ensureTable(mainTable).map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v;
      out[`${mainAlias}.${k}`] = v;
    }
    return out;
  });

  for (const join of joins) {
    const rightRows = ensureTable(join.table);
    const next: Row[] = [];
    const isLeft = join.left;
    for (const left of rows) {
      let matched = false;
      for (const right of rightRows) {
        const merged: Row = { ...left };
        for (const [k, v] of Object.entries(right)) {
          // Always keep alias-prefixed keys; do not clobber left unqualified columns (id, etc.).
          merged[`${join.alias}.${k}`] = v;
          if (!(k in left) && !(`${mainAlias}.${k}` in left)) {
            merged[k] = v;
          }
        }
        if (evalWhere(join.on, merged, [])) {
          next.push(merged);
          matched = true;
        }
      }
      if (!matched && isLeft) {
        next.push(left);
      }
    }
    rows = next;
  }

  const filtered = rows.filter((row) => evalWhere(whereSql, row, [...whereParams]));

  if (isCountStar || isCountAs) {
    const alias = isCountAs?.[1] ?? 'count';
    return [{ [alias]: filtered.length }];
  }

  if (isSumAs) {
    const expr = isSumAs[1];
    const alias = isSumAs[2];
    let total = 0;
    for (const row of filtered) {
      total += Number(evalExpr(expr, row, []) ?? 0);
    }
    return [{ [alias]: total }];
  }

  if (isMinAs) {
    const expr = isMinAs[1];
    const alias = isMinAs[2];
    let min: SqlValue = null;
    for (const row of filtered) {
      const v = evalExpr(expr, row, []);
      if (min == null || compareValues(v, min) < 0) min = v;
    }
    return [{ [alias]: min }];
  }

  const caseSum =
    /^COALESCE\(\s*SUM\(\s*CASE\s+([\s\S]+?)\s+END\)\s*,\s*0\s*\)\s+AS\s+(\w+)$/i.exec(selectList);
  if (caseSum) {
    const alias = caseSum[2];
    let total = 0;
    for (const row of filtered) {
      const type = String(rowGet(row, 'type') ?? '');
      const amount = Number(rowGet(row, 'amount') ?? 0);
      if (type === 'income') total += amount;
      else if (type === 'expense') total -= amount;
    }
    return [{ [alias]: total }];
  }

  const columns = parseSelectList(selectList);
  const projected = filtered.map((row) => {
    const out: Row = {};
    for (const col of columns) {
      out[col.alias] = evalExpr(col.expr, row, [...selectParams]);
    }
    return out;
  });

  const ordered = orderRows(projected, orderSql, []);
  return limit != null ? ordered.slice(0, limit) : ordered;
}

function upsertRow(table: string, row: Row, pk: string): RunResult {
  const rows = ensureTable(table);
  const key = row[pk];
  const idx = rows.findIndex((r) => compareValues(rowGet(r, pk), key) === 0);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...row };
    return { changes: 1, lastInsertRowId: 0 };
  }
  rows.push(row);
  const store = getStore();
  store.lastInsertRowId += 1;
  return { changes: 1, lastInsertRowId: store.lastInsertRowId };
}

function executeInsert(sql: string, params: SqlValue[]): RunResult {
  const { text, values } = bindParams(sql, params);

  // INSERT … SELECT … WHERE NOT EXISTS (ensureCashAccount)
  if (/\bSELECT\b/i.test(text) && /\bWHERE\s+NOT\s+EXISTS\b/i.test(text)) {
    const tableMatch = /^INSERT\s+INTO\s+(\w+)/i.exec(text);
    if (!tableMatch) return { changes: 0, lastInsertRowId: 0 };
    const table = tableMatch[1];
    const existsMatch = /WHERE\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(\w+)\s+WHERE\s+(.+?)\)/i.exec(
      text,
    );
    if (existsMatch) {
      const checkTable = existsMatch[1];
      const checkWhere = existsMatch[2];
      // Params for SELECT values come first in ensureCashAccount, then none for WHERE kind='cash'
      const colsMatch = /^INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*SELECT\s+(.+?)\s+WHERE/i.exec(text);
      if (!colsMatch) return { changes: 0, lastInsertRowId: 0 };
      const cols = splitArgs(colsMatch[1]);
      const selectVals = splitArgs(colsMatch[2]).map((tok) => parseLiteralOrParam(tok, values));
      const exists = ensureTable(checkTable).some((row) => evalWhere(checkWhere, row, [...values]));
      if (exists) return { changes: 0, lastInsertRowId: 0 };
      const row: Row = {};
      cols.forEach((col, i) => {
        row[col.trim()] = selectVals[i] ?? null;
      });
      return upsertRow(table, row, TABLE_PRIMARY_KEYS[table] ?? 'id');
    }
  }

  const insertMatch =
    /^INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(.*)$/i.exec(
      text,
    );
  if (!insertMatch) return { changes: 0, lastInsertRowId: 0 };

  const table = insertMatch[1];
  const cols = splitArgs(insertMatch[2]);
  const rawVals = splitArgs(insertMatch[3]);
  const suffix = insertMatch[4] ?? '';
  const row: Row = {};
  cols.forEach((col, i) => {
    row[col.trim()] = parseLiteralOrParam(rawVals[i] ?? 'NULL', values);
  });

  const pk = TABLE_PRIMARY_KEYS[table] ?? 'id';
  const onConflict = /ON\s+CONFLICT\s*\((\w+)\)\s*DO\s+UPDATE\s+SET\s+(.+)$/i.exec(suffix);
  if (onConflict || /^INSERT\s+OR\s+REPLACE\b/i.test(text)) {
    const conflictPk = onConflict?.[1] ?? pk;
    const existingIdx = ensureTable(table).findIndex(
      (r) => compareValues(rowGet(r, conflictPk), row[conflictPk]) === 0,
    );
    if (existingIdx >= 0 && onConflict) {
      const sets = splitArgs(onConflict[2]);
      const current = { ...ensureTable(table)[existingIdx] };
      for (const set of sets) {
        const m = /^(\w+)\s*=\s*(.+)$/.exec(set.trim());
        if (!m) continue;
        const col = m[1];
        const rhs = m[2].trim();
        if (/^excluded\./i.test(rhs)) {
          const src = rhs.split('.')[1]!;
          current[col] = row[src] ?? row[col] ?? null;
        } else if (/^COALESCE\(excluded\./i.test(rhs)) {
          const srcMatch = /excluded\.(\w+)/i.exec(rhs);
          const src = srcMatch?.[1] ?? col;
          current[col] = row[src] ?? current[col] ?? null;
        } else {
          current[col] = parseLiteralOrParam(rhs, values);
        }
      }
      ensureTable(table)[existingIdx] = current;
      return { changes: 1, lastInsertRowId: 0 };
    }
    return upsertRow(table, row, conflictPk);
  }

  ensureTable(table).push(row);
  const store = getStore();
  store.lastInsertRowId += 1;
  return { changes: 1, lastInsertRowId: store.lastInsertRowId };
}

function executeUpdate(sql: string, params: SqlValue[]): RunResult {
  const { text, values } = bindParams(sql, params);
  const match = /^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i.exec(text);
  if (!match) return { changes: 0, lastInsertRowId: 0 };
  const table = match[1];
  const setSql = match[2];
  const whereSql = match[3] ?? null;
  const rows = ensureTable(table);
  const setParamCount = (setSql.match(/\?/g) ?? []).length;
  const whereParamCount = (whereSql?.match(/\?/g) ?? []).length;
  const setParams = values.slice(0, setParamCount);
  const whereParams = values.slice(setParamCount, setParamCount + whereParamCount);
  let changes = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (!evalWhere(whereSql, row, [...whereParams])) continue;
    const next = { ...row };
    const setParts = splitArgs(setSql);
    const localSetParams = [...setParams];
    for (const part of setParts) {
      const m = /^(\w+)\s*=\s*(.+)$/.exec(part.trim());
      if (!m) continue;
      next[m[1]] = evalExpr(m[2], next, localSetParams);
    }
    rows[i] = next;
    changes += 1;
  }
  return { changes, lastInsertRowId: 0 };
}

function executeDelete(sql: string, params: SqlValue[]): RunResult {
  const { text, values } = bindParams(sql, params);
  const match = /^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i.exec(text);
  if (!match) return { changes: 0, lastInsertRowId: 0 };
  const table = match[1];
  const whereSql = match[2] ?? null;
  const rows = ensureTable(table);
  const kept: Row[] = [];
  let changes = 0;
  for (const row of rows) {
    if (evalWhere(whereSql, row, [...values])) {
      changes += 1;
    } else {
      kept.push(row);
    }
  }
  getStore().tables[table] = kept;
  return { changes, lastInsertRowId: 0 };
}

function executePragma(sql: string): Row[] {
  const match = /PRAGMA\s+table_info\((\w+)\)/i.exec(sql);
  if (!match) return [];
  const table = match[1];
  const rows = ensureTable(table);
  if (rows.length === 0) {
    // Return empty — callers use this to decide ALTER TABLE ADD COLUMN.
    return [];
  }
  return Object.keys(rows[0]!).map((name, cid) => ({
    cid,
    name,
    type: 'TEXT',
    notnull: 0,
    dflt_value: null,
    pk: TABLE_PRIMARY_KEYS[table] === name ? 1 : 0,
  }));
}

function executeStatement(sql: string, params: SqlValue[] = []): { kind: 'run'; result: RunResult } | { kind: 'rows'; rows: Row[] } {
  const text = normalizeSql(sql);
  if (!text) return { kind: 'run', result: { changes: 0, lastInsertRowId: 0 } };

  if (/^PRAGMA\b/i.test(text)) {
    if (/^PRAGMA\s+journal_mode\b/i.test(text)) {
      return { kind: 'run', result: { changes: 0, lastInsertRowId: 0 } };
    }
    return { kind: 'rows', rows: executePragma(text) };
  }

  if (/^CREATE\s+TABLE\b/i.test(text) || /^CREATE\s+INDEX\b/i.test(text)) {
    const tableMatch = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i.exec(text);
    if (tableMatch) ensureTable(tableMatch[1]);
    return { kind: 'run', result: { changes: 0, lastInsertRowId: 0 } };
  }

  if (/^ALTER\s+TABLE\b/i.test(text)) {
    return { kind: 'run', result: { changes: 0, lastInsertRowId: 0 } };
  }

  if (/^SELECT\b/i.test(text)) {
    return { kind: 'rows', rows: executeSelect(text, params) };
  }
  if (/^INSERT\b/i.test(text)) {
    return { kind: 'run', result: executeInsert(text, params) };
  }
  if (/^UPDATE\b/i.test(text)) {
    return { kind: 'run', result: executeUpdate(text, params) };
  }
  if (/^DELETE\b/i.test(text)) {
    return { kind: 'run', result: executeDelete(text, params) };
  }

  return { kind: 'run', result: { changes: 0, lastInsertRowId: 0 } };
}

export function createWebMemorySqliteDatabase(): {
  databasePath: string;
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: SqlValue[]) => Promise<RunResult>;
  getFirstAsync: <T>(sql: string, params?: SqlValue[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, params?: SqlValue[]) => Promise<T[]>;
  getEachAsync: (sql: string, params?: SqlValue[]) => AsyncIterableIterator<Row>;
  prepareAsync: (sql: string) => Promise<{
    executeAsync: (params?: SqlValue[]) => Promise<RunResult>;
    executeForRawResultAsync: (params?: SqlValue[]) => Promise<RunResult>;
    getFirstAsync: <T>(params?: SqlValue[]) => Promise<T | null>;
    getAllAsync: <T>(params?: SqlValue[]) => Promise<T[]>;
    getEachAsync: (params?: SqlValue[]) => AsyncIterableIterator<Row>;
    finalizeAsync: () => Promise<void>;
    resetAsync: () => Promise<void>;
  }>;
  withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
  withExclusiveTransactionAsync: (task: (txn: unknown) => Promise<void>) => Promise<void>;
  closeAsync: () => Promise<void>;
  isInTransactionAsync: () => Promise<boolean>;
  serializeAsync: () => Promise<Uint8Array>;
} {
  const db = {
    databasePath: ':memory-js:',
    execAsync: async (sql: string) => {
      const parts = sql
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
      for (const part of parts) {
        executeStatement(part);
      }
    },
    runAsync: async (sql: string, params: SqlValue[] = []) => {
      const result = executeStatement(sql, params);
      return result.kind === 'run' ? result.result : { changes: 0, lastInsertRowId: 0 };
    },
    getFirstAsync: async <T,>(sql: string, params: SqlValue[] = []) => {
      const result = executeStatement(sql, params);
      const rows = result.kind === 'rows' ? result.rows : [];
      return (rows[0] as T) ?? null;
    },
    getAllAsync: async <T,>(sql: string, params: SqlValue[] = []) => {
      const result = executeStatement(sql, params);
      return (result.kind === 'rows' ? result.rows : []) as T[];
    },
    getEachAsync: async function* (sql: string, params: SqlValue[] = []) {
      const result = executeStatement(sql, params);
      const rows = result.kind === 'rows' ? result.rows : [];
      for (const row of rows) yield row;
    },
    prepareAsync: async (sql: string) => ({
      executeAsync: async (params: SqlValue[] = []) => {
        const result = executeStatement(sql, params);
        return result.kind === 'run' ? result.result : { changes: 0, lastInsertRowId: 0 };
      },
      executeForRawResultAsync: async (params: SqlValue[] = []) => {
        const result = executeStatement(sql, params);
        return result.kind === 'run' ? result.result : { changes: 0, lastInsertRowId: 0 };
      },
      getFirstAsync: async <T,>(params: SqlValue[] = []) => {
        const result = executeStatement(sql, params);
        const rows = result.kind === 'rows' ? result.rows : [];
        return (rows[0] as T) ?? null;
      },
      getAllAsync: async <T,>(params: SqlValue[] = []) => {
        const result = executeStatement(sql, params);
        return (result.kind === 'rows' ? result.rows : []) as T[];
      },
      getEachAsync: async function* (params: SqlValue[] = []) {
        const result = executeStatement(sql, params);
        const rows = result.kind === 'rows' ? result.rows : [];
        for (const row of rows) yield row;
      },
      finalizeAsync: async () => {},
      resetAsync: async () => {},
    }),
    withTransactionAsync: async (task: () => Promise<void>) => {
      await task();
    },
    withExclusiveTransactionAsync: async (task: (txn: unknown) => Promise<void>) => {
      await task(db);
    },
    closeAsync: async () => {},
    isInTransactionAsync: async () => false,
    serializeAsync: async () => new Uint8Array(),
  };

  return db;
}
