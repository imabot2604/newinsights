import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

export interface MonthlyPnL {
  month: number;
  year: number;
  roomsAvailable: number;
  roomsSold: number;
  occupancyPct: number;
  adr: number;
  revpar: number;
  totalRevenue: number;
  departmentalExpenses: number;
  undistributedExpenses: number;
  gop: number;
  ebitda: number;
}

export interface AnnualPnL {
  year: number;
  monthly: MonthlyPnL[];
  roomsAvailable: number;
  roomsSold: number;
  occupancyPct: number;
  adr: number;
  revpar: number;
  totalRevenue: number;
  departmentalExpenses: number;
  undistributedExpenses: number;
  gop: number;
  ebitda: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function safeNum(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function findRowByLabel(sheet: XLSX.WorkSheet, labels: string[]): number | null {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z200");
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "string") {
        const cellVal = cell.v.toLowerCase().trim();
        for (const lbl of labels) {
          if (cellVal.includes(lbl.toLowerCase())) {
            return r;
          }
        }
      }
    }
  }
  return null;
}

function getRowValues(sheet: XLSX.WorkSheet, row: number, startCol: number, count: number): number[] {
  const vals: number[] = [];
  for (let c = startCol; c < startCol + count; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c })];
    vals.push(cell ? safeNum(cell.v) : 0);
  }
  return vals;
}

function detectMonthColumns(sheet: XLSX.WorkSheet): { startCol: number; count: number; year: number } {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z200");
  for (let r = 0; r <= Math.min(5, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "string") {
        const v = cell.v.trim();
        if (v.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
          let count = 0;
          let startC = c;
          for (let cc = c; cc <= range.e.c; cc++) {
            const mc = sheet[XLSX.utils.encode_cell({ r, c: cc })];
            if (mc && typeof mc.v === "string" && mc.v.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
              count++;
            } else if (count > 0) {
              break;
            }
          }
          if (count >= 6) {
            return { startCol: startC, count, year: 2025 };
          }
        }
      }
    }
  }
  return { startCol: 1, count: 12, year: 2025 };
}

function extractYearFromSheetName(name: string): number {
  const m = name.match(/20(\d{2})/);
  return m ? 2000 + parseInt(m[1]) : 2025;
}

export function parseExcelFile(filePath: string): AnnualPnL[] {
  if (!fs.existsSync(filePath)) return [];
  
  const workbook = XLSX.readFile(filePath);
  const results: AnnualPnL[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const year = extractYearFromSheetName(sheetName);
    const { startCol, count } = detectMonthColumns(sheet);

    const rowRevenue = findRowByLabel(sheet, ["total revenue", "total operating revenue", "total revenues"]);
    const rowRoomsAvail = findRowByLabel(sheet, ["rooms available", "available rooms"]);
    const rowRoomsSold = findRowByLabel(sheet, ["rooms sold", "rooms occupied"]);
    const rowOccupancy = findRowByLabel(sheet, ["occupancy", "occ %", "occ%"]);
    const rowADR = findRowByLabel(sheet, ["adr", "average daily rate"]);
    const rowRevPAR = findRowByLabel(sheet, ["revpar", "rev par", "revenue per available"]);
    const rowGOP = findRowByLabel(sheet, ["gross operating profit", "gop", "g.o.p"]);
    const rowEBITDA = findRowByLabel(sheet, ["ebitda", "noi", "net operating income"]);
    const rowDeptExp = findRowByLabel(sheet, ["departmental expenses", "dept expenses", "total dept"]);
    const rowUndist = findRowByLabel(sheet, ["undistributed", "total undistributed"]);

    const monthlyData: MonthlyPnL[] = [];
    const numMonths = Math.min(count, 12);

    for (let i = 0; i < numMonths; i++) {
      const col = startCol + i;
      const monthNum = i + 1;

      const revenue = rowRevenue != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowRevenue, c: col })]?.v) : 0;
      const roomsAvail = rowRoomsAvail != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowRoomsAvail, c: col })]?.v) : 0;
      const roomsSold = rowRoomsSold != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowRoomsSold, c: col })]?.v) : 0;
      const occupancy = rowOccupancy != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowOccupancy, c: col })]?.v) : (roomsAvail > 0 ? roomsSold / roomsAvail : 0);
      const adr = rowADR != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowADR, c: col })]?.v) : (roomsSold > 0 ? revenue / roomsSold : 0);
      const revpar = rowRevPAR != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowRevPAR, c: col })]?.v) : (roomsAvail > 0 ? revenue / roomsAvail : 0);
      const gop = rowGOP != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowGOP, c: col })]?.v) : 0;
      const ebitda = rowEBITDA != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowEBITDA, c: col })]?.v) : gop;
      const deptExp = rowDeptExp != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowDeptExp, c: col })]?.v) : 0;
      const undist = rowUndist != null ? safeNum(sheet[XLSX.utils.encode_cell({ r: rowUndist, c: col })]?.v) : 0;

      monthlyData.push({
        month: monthNum,
        year,
        roomsAvailable: roomsAvail,
        roomsSold,
        occupancyPct: occupancy > 1 ? occupancy / 100 : occupancy,
        adr,
        revpar,
        totalRevenue: revenue,
        departmentalExpenses: deptExp,
        undistributedExpenses: undist,
        gop,
        ebitda,
      });
    }

    const totals = monthlyData.reduce(
      (acc, m) => ({
        roomsAvailable: acc.roomsAvailable + m.roomsAvailable,
        roomsSold: acc.roomsSold + m.roomsSold,
        totalRevenue: acc.totalRevenue + m.totalRevenue,
        departmentalExpenses: acc.departmentalExpenses + m.departmentalExpenses,
        undistributedExpenses: acc.undistributedExpenses + m.undistributedExpenses,
        gop: acc.gop + m.gop,
        ebitda: acc.ebitda + m.ebitda,
      }),
      { roomsAvailable: 0, roomsSold: 0, totalRevenue: 0, departmentalExpenses: 0, undistributedExpenses: 0, gop: 0, ebitda: 0 }
    );

    const occupancyPct = totals.roomsAvailable > 0 ? totals.roomsSold / totals.roomsAvailable : 0;
    const adr = totals.roomsSold > 0 ? totals.totalRevenue / totals.roomsSold : 0;
    const revpar = totals.roomsAvailable > 0 ? totals.totalRevenue / totals.roomsAvailable : 0;

    results.push({
      year,
      monthly: monthlyData,
      ...totals,
      occupancyPct,
      adr,
      revpar,
    });
  }

  return results;
}

export function getAllExcelData(dataDir: string): AnnualPnL[] {
  if (!fs.existsSync(dataDir)) return [];
  
  const files = fs.readdirSync(dataDir).filter(f => f.match(/\.(xlsx|xls|XLSX|XLS)$/));
  const allData: AnnualPnL[] = [];

  for (const file of files) {
    const parsed = parseExcelFile(path.join(dataDir, file));
    allData.push(...parsed);
  }

  // Deduplicate by year — later parse wins
  const byYear = new Map<number, AnnualPnL>();
  for (const d of allData) {
    byYear.set(d.year, d);
  }

  return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
}

export const MONTH_NAMES_EXPORT = MONTH_NAMES;
