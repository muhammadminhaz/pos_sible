"use client";

import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RowActions } from "@/components/shared/DataTable";
import { financeErrorMessage } from "@/features/finance/financeError";
import { useCan } from "@/lib/auth/useCan";
import { useReport } from "@/lib/data/hooks/reports";
import { EXPIRY_WINDOWS, stockReports, type AdjustmentReportRow, type ExpiryRow, type ExpiryWindow, type StockRow } from "@/lib/data/services/reports/stock";
import { useFormat } from "@/lib/i18n/format";
import { useBrandLookup, useCategoryLookup, useUnitLookup } from "./lookups";
import { Stats } from "./parts";
import { ReportShell, useReportFilters } from "./ReportShell";
import { ReportTable, type Col } from "./ReportTable";

export function StockReport() {
  const t = useTranslations("reports");
  const rf = useReportFilters(["category", "brand", "unit"] as const);
  const categories = useCategoryLookup(), brands = useBrandLookup(), units = useUnitLookup();
  const filter = { ...rf.filter, categoryId: rf.url.category, brandId: rf.url.brand, unitId: rf.url.unit };
  const { data, isFetching } = useReport("stock", filter, () => stockReports.stock(filter));
  const cols: Col<StockRow>[] = [
    { key: "sku", label: t("sku") }, { key: "product", label: t("product"), render: (r) => (r.variation ? `${r.product} (${r.variation})` : r.product), csv: (r) => (r.variation ? `${r.product} (${r.variation})` : r.product) },
    { key: "category", label: t("category") }, { key: "brand", label: t("brand") }, { key: "unitPrice", label: t("unitSellPrice"), kind: "money" },
    { key: "stock", label: t("currentStock"), kind: "qty", total: true }, { key: "valueByCost", label: t("valueByCost"), kind: "money", total: true },
    { key: "valueBySale", label: t("valueBySale"), kind: "money", total: true }, { key: "potentialProfit", label: t("potentialProfit"), kind: "money", total: true },
    { key: "sold", label: t("unitsSold"), kind: "qty", total: true }, { key: "transferred", label: t("unitsTransferred"), kind: "qty", total: true }, { key: "adjusted", label: t("unitsAdjusted"), kind: "qty", total: true },
  ];
  const s = data?.totals;
  return (
    <ReportShell
      title={t("stockTitle")} description={t("stockDescription")} rf={rf}
      extraDefs={[{ key: "category", label: t("category"), type: "select", options: categories }, { key: "brand", label: t("brand"), type: "select", options: brands }, { key: "unit", label: t("unit"), type: "select", options: units }]}
    >
      {s && <Stats items={[{ label: t("valueByCost"), value: s.valueByCost ?? 0 }, { label: t("valueBySale"), value: s.valueBySale ?? 0 }, { label: t("potentialProfit"), value: s.potentialProfit ?? 0, tone: "success" }]} cols={3} />}
      <ReportTable id="stock" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}

const WINDOWS = Object.keys(EXPIRY_WINDOWS) as ExpiryWindow[];

export function StockExpiryReport() {
  const t = useTranslations("reports");
  const root = useTranslations();
  const f = useFormat();
  const can = useCan();
  const qc = useQueryClient();
  const rf = useReportFilters(["category", "brand"] as const);
  const categories = useCategoryLookup(), brands = useBrandLookup();
  const [window, setWindow] = useState<ExpiryWindow | "all">("all");
  const [edit, setEdit] = useState<ExpiryRow | null>(null);
  const [date, setDate] = useState("");
  const [del, setDel] = useState<ExpiryRow | null>(null);
  const filter = { locationId: rf.filter.locationId, categoryId: rf.url.category, brandId: rf.url.brand, window: window === "all" ? undefined : window };
  const { data, isFetching } = useReport("expiry", filter, () => stockReports.expiry(filter));
  const refresh = () => qc.invalidateQueries({ queryKey: ["transactions"] });
  const cols: Col<ExpiryRow>[] = [
    { key: "product", label: t("product"), render: (r) => (r.variation ? `${r.product} (${r.variation})` : r.product), csv: (r) => (r.variation ? `${r.product} (${r.variation})` : r.product) },
    { key: "sku", label: t("sku") }, { key: "locationName", label: t("location") }, { key: "lotNo", label: t("lotNo") }, { key: "expDate", label: t("expDate"), kind: "date" },
    { key: "daysLeft", label: t("daysLeft"), render: (r) => (r.daysLeft < 0 ? <Badge variant="outline" className="text-danger">{t("expiredBadge", { n: f.number(-r.daysLeft) })}</Badge> : <span className="tabular">{f.number(r.daysLeft)}</span>), csv: (r) => r.daysLeft },
    { key: "qty", label: t("qtyLeft"), kind: "qty", total: true, render: (r) => `${f.qty(r.qty)} ${r.unit}`, csv: (r) => r.qty }, { key: "value", label: t("valueByCost"), kind: "money", total: true },
    ...(can("product.update") || can("stock_adjustment.create") ? [{
      key: "lotId" as const, label: "", render: (r: ExpiryRow) => (
        <RowActions items={[
          { label: t("editExpiry"), icon: PencilIcon, onClick: () => { setEdit(r); setDate(r.expDate); }, hidden: !can("product.update") },
          { label: t("removeStock"), icon: Trash2Icon, destructive: true, onClick: () => setDel(r), hidden: !can("stock_adjustment.create") },
        ]} />
      ), csv: () => undefined,
    }] : []),
  ];
  return (
    <ReportShell
      title={t("expiryTitle")} description={t("expiryDescription")} rf={rf} noDate
      extraDefs={[{ key: "category", label: t("category"), type: "select", options: categories }, { key: "brand", label: t("brand"), type: "select", options: brands }]}
    >
      <Tabs value={window} onValueChange={(v) => setWindow(v as ExpiryWindow | "all")}>
        <TabsList className="flex-wrap"><TabsTrigger value="all">{t("window.all")}</TabsTrigger>{WINDOWS.map((w) => <TabsTrigger key={w} value={w}>{t(`window.${w}`)}</TabsTrigger>)}</TabsList>
      </Tabs>
      <ReportTable id="expiry" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} getRowId={(r) => r.lotId} />
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("editExpiry")}</DialogTitle></DialogHeader>
          <Input type="date" aria-label={t("expDate")} value={date} onChange={(e) => setDate(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>{t("cancel")}</Button>
            <Button disabled={!edit} onClick={async () => {
              try { await stockReports.editExpiry(edit!.lotId, date || null); await refresh(); toast.success(t("expiryUpdated")); setEdit(null); } catch (e) { toast.error(financeErrorMessage(e, root)); }
            }}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("removeStockTitle")} description={t("removeStockBody")} confirmLabel={t("removeStock")}
        onConfirm={async () => {
          try { const r = await stockReports.removeExpired(del!.lotId); await refresh(); toast.success(t("stockRemoved", { refNo: r.refNo })); } catch (e) { toast.error(financeErrorMessage(e, root)); }
        }}
      />
    </ReportShell>
  );
}

export function StockAdjustmentReport() {
  const t = useTranslations("reports");
  const rf = useReportFilters();
  const { data, isFetching } = useReport("adjustments", rf.filter, () => stockReports.adjustments(rf.filter));
  const cols: Col<AdjustmentReportRow>[] = [
    { key: "date", label: t("date"), kind: "datetime" }, { key: "refNo", label: t("refNo") }, { key: "locationName", label: t("location") },
    { key: "type", label: t("adjustmentType"), render: (r) => t(`adjType.${r.type}`), csv: (r) => t(`adjType.${r.type}`) },
    { key: "total", label: t("totalAmount"), kind: "money", total: true }, { key: "recovered", label: t("recovered"), kind: "money", total: true }, { key: "reason", label: t("reason") }, { key: "addedBy", label: t("addedBy") },
  ];
  const s = data?.summary;
  return (
    <ReportShell title={t("adjustmentTitle")} description={t("adjustmentDescription")} rf={rf}>
      {s && <Stats items={[{ label: t("adjType.normal"), value: s.normal }, { label: t("adjType.abnormal"), value: s.abnormal, tone: "danger" }, { label: t("recovered"), value: s.recovered, tone: "success" }, { label: t("netLoss"), value: s.netLoss, tone: "warning" }]} />}
      <ReportTable id="adjustments" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}
