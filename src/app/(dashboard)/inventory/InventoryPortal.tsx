"use client";

import {
  addInventoryStock,
  adjustInventoryStock,
  createInventoryItem,
  recordInventorySale,
  setInventoryItemActive,
  updateInventoryItem,
} from "@/lib/inventoryActions";
import {
  Archive,
  Boxes,
  PackagePlus,
  Pencil,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { toast } from "react-toastify";

type InventoryItemRow = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  buyingPrice: number;
  sellingPrice: number;
  quantityInStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type InventoryMovementRow = {
  id: number;
  itemId: number;
  itemName: string;
  itemCategory: string | null;
  type: "PURCHASE" | "SALE" | "ADJUSTMENT";
  quantity: number;
  unitBuyingPrice: number | null;
  unitSellingPrice: number | null;
  totalAmount: number;
  note: string | null;
  createdAt: string;
};

type InventorySummary = {
  totalItems: number;
  totalStockValue: number;
  expectedSalesValue: number;
  totalSalesRevenue: number;
  totalSalesProfit: number;
  lowStockCount: number;
};

type PanelMode = "create" | "edit" | "purchase" | "sale" | "adjust";
type StockFilter = "active" | "all" | "low" | "inactive";

const emptyItemForm = {
  name: "",
  category: "",
  description: "",
  buyingPrice: "",
  sellingPrice: "",
};

const emptyMovementForm = {
  quantity: "",
  quantityDelta: "",
  unitPrice: "",
  note: "",
};

const currency = (amount: number) => `৳${Math.round(amount).toLocaleString()}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const stockStatus = (item: InventoryItemRow) => {
  if (!item.isActive) return { label: "Inactive", className: "bg-gray-100 text-gray-500" };
  if (item.quantityInStock === 0) return { label: "Out", className: "bg-red-50 text-red-600" };
  if (item.quantityInStock <= 5) return { label: "Low", className: "bg-amber-50 text-amber-600" };
  return { label: "In stock", className: "bg-green-50 text-green-600" };
};

export default function InventoryPortal({
  items,
  movements,
  summary,
}: {
  items: InventoryItemRow[];
  movements: InventoryMovementRow[];
  summary: InventorySummary;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("active");
  const [mode, setMode] = useState<PanelMode>("create");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && item.isActive) ||
        (filter === "inactive" && !item.isActive) ||
        (filter === "low" && item.isActive && item.quantityInStock <= 5);
      return matchesSearch && matchesFilter;
    });
  }, [filter, items, search]);

  const startNewItem = () => {
    setLoadingKey(null);
    setMode("create");
    setSelectedItemId(null);
    setItemForm({ ...emptyItemForm });
    setMovementForm({ ...emptyMovementForm });
  };

  const openPanel = (nextMode: PanelMode, item?: InventoryItemRow) => {
    setMode(nextMode);
    setSelectedItemId(item?.id ?? null);
    if (nextMode === "edit" && item) {
      setItemForm({
        name: item.name,
        category: item.category || "",
        description: item.description || "",
        buyingPrice: String(item.buyingPrice),
        sellingPrice: String(item.sellingPrice),
      });
    } else {
      setItemForm(emptyItemForm);
    }

    if (nextMode === "purchase" && item) {
      setMovementForm({
        ...emptyMovementForm,
        unitPrice: String(item.buyingPrice),
      });
    } else if (nextMode === "sale" && item) {
      setMovementForm({
        ...emptyMovementForm,
        unitPrice: String(item.sellingPrice),
      });
    } else {
      setMovementForm(emptyMovementForm);
    }
  };

  const handleCreateOrUpdate = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: itemForm.name,
      category: itemForm.category,
      description: itemForm.description,
      buyingPrice: Number(itemForm.buyingPrice),
      sellingPrice: Number(itemForm.sellingPrice),
    };

    setLoadingKey(mode);
    try {
      const result =
        mode === "edit" && selectedItem
          ? await updateInventoryItem(selectedItem.id, payload)
          : await createInventoryItem(payload);
      if (result.success) {
        toast.success(mode === "edit" ? "Item updated." : "Item created.");
        startNewItem();
        router.refresh();
      } else {
        toast.error(result.message || "Inventory item could not be saved.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoadingKey(null);
    }
  };

  const handleMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;

    setLoadingKey(mode);
    try {
      const result =
        mode === "purchase"
          ? await addInventoryStock(selectedItem.id, {
              quantity: Number(movementForm.quantity),
              unitBuyingPrice: Number(movementForm.unitPrice),
              note: movementForm.note,
            })
          : mode === "sale"
          ? await recordInventorySale(selectedItem.id, {
              quantity: Number(movementForm.quantity),
              unitSellingPrice: Number(movementForm.unitPrice),
              note: movementForm.note,
            })
          : await adjustInventoryStock(selectedItem.id, {
              quantityDelta: Number(movementForm.quantityDelta),
              note: movementForm.note,
            });

      if (result.success) {
        toast.success(
          mode === "purchase"
            ? "Stock added."
            : mode === "sale"
            ? "Sale recorded."
            : "Stock adjusted."
        );
        setMovementForm(
          mode === "purchase"
            ? { ...emptyMovementForm, unitPrice: String(selectedItem.buyingPrice) }
            : mode === "sale"
            ? { ...emptyMovementForm, unitPrice: String(selectedItem.sellingPrice) }
            : emptyMovementForm
        );
        router.refresh();
      } else {
        toast.error(result.message || "Inventory movement could not be saved.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoadingKey(null);
    }
  };

  const handleToggleActive = async (item: InventoryItemRow) => {
    if (item.isActive && !confirm(`Deactivate "${item.name}"?`)) return;

    setLoadingKey(`status-${item.id}`);
    try {
      const result = await setInventoryItemActive(item.id, !item.isActive);
      if (result.success) {
        toast.success(item.isActive ? "Item deactivated." : "Item reactivated.");
        if (selectedItemId === item.id && item.isActive) startNewItem();
        router.refresh();
      } else {
        toast.error(result.message || "Item status could not be updated.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoadingKey(null);
    }
  };

  const panelTitle =
    mode === "create"
      ? "Add Item"
      : mode === "edit"
      ? "Edit Item"
      : mode === "purchase"
      ? "Add Stock"
      : mode === "sale"
      ? "Record Sale"
      : "Adjust Stock";

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Stock, sale revenue, and purchase costs for school-managed items.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Active Items"
          value={summary.totalItems.toLocaleString()}
          helper={`${summary.lowStockCount} low or out`}
          tone="sky"
        />
        <MetricCard
          label="Stock Cost"
          value={currency(summary.totalStockValue)}
          helper="Current buying value"
          tone="purple"
        />
        <MetricCard
          label="Potential Sales"
          value={currency(summary.expectedSalesValue)}
          helper="Current selling value"
          tone="green"
        />
        <MetricCard
          label="Sales Revenue"
          value={currency(summary.totalSalesRevenue)}
          helper="Recorded inventory sales"
          tone="amber"
        />
        <MetricCard
          label="Gross Profit"
          value={currency(summary.totalSalesProfit)}
          helper="Sales minus item cost"
          tone="gray"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-50 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {(["active", "all", "low", "inactive"] as StockFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filter === value
                        ? "bg-gray-800 text-white"
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {value === "active"
                      ? "Active"
                      : value === "all"
                      ? "All"
                      : value === "low"
                      ? "Low Stock"
                      : "Inactive"}
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:w-72">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search items..."
                  className="pl-9 ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all placeholder:text-gray-300"
                />
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center gap-2">
                <Boxes className="text-gray-300" size={34} />
                <p className="text-sm font-bold text-gray-500">No inventory items found</p>
                <p className="text-xs text-gray-400">Change the filter or add a new item.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="p-4">Item</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Buying</th>
                      <th className="p-4">Selling</th>
                      <th className="p-4">Profit/Unit</th>
                      <th className="p-4">Value</th>
                      <th className="p-4 text-right w-[270px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const status = stockStatus(item);
                      const profit = item.sellingPrice - item.buyingPrice;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-gray-50 text-gray-700 hover:bg-slate-50/50 transition-colors ${
                            !item.isActive ? "opacity-60" : ""
                          }`}
                        >
                          <td className="p-4 min-w-52">
                            <p className="font-bold text-gray-800">{item.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[9px] uppercase font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                {item.category || "Uncategorized"}
                              </span>
                              <span
                                className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="text-base font-black text-gray-900">
                              {item.quantityInStock}
                            </span>
                          </td>
                          <td className="p-4 font-extrabold text-gray-900">
                            {currency(item.buyingPrice)}
                          </td>
                          <td className="p-4 font-extrabold text-gray-900">
                            {currency(item.sellingPrice)}
                          </td>
                          <td
                            className={`p-4 font-extrabold ${
                              profit >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {currency(profit)}
                          </td>
                          <td className="p-4 font-extrabold text-gray-900">
                            {currency(item.quantityInStock * item.buyingPrice)}
                          </td>
                          <td className="p-4 w-[270px]">
                            <div className="ml-auto grid w-[250px] grid-cols-[68px_94px_64px] gap-2">
                              <ActionButton
                                label="Edit item"
                                text="Edit"
                                onClick={() => openPanel("edit", item)}
                                icon={<Pencil size={14} />}
                              />
                              <ActionButton
                                label="Add stock"
                                text="Add Stock"
                                onClick={() => openPanel("purchase", item)}
                                icon={<PackagePlus size={14} />}
                                disabled={!item.isActive}
                              />
                              <ActionButton
                                label="Record sale"
                                text="Sell"
                                onClick={() => openPanel("sale", item)}
                                icon={<ShoppingCart size={14} />}
                                disabled={!item.isActive || item.quantityInStock === 0}
                              />
                              <ActionButton
                                label="Adjust stock"
                                text="Adjust"
                                onClick={() => openPanel("adjust", item)}
                                icon={<SlidersHorizontal size={14} />}
                                disabled={!item.isActive}
                              />
                              <ActionButton
                                label={item.isActive ? "Deactivate item" : "Reactivate item"}
                                text={item.isActive ? "Disable" : "Enable"}
                                onClick={() => handleToggleActive(item)}
                                icon={
                                  item.isActive ? <Archive size={14} /> : <RotateCcw size={14} />
                                }
                                disabled={loadingKey === `status-${item.id}`}
                                danger={item.isActive}
                                className="col-span-2"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-800">Recent Movements</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Latest purchase, sale, and adjustment records.</p>
            </div>

            {movements.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-2">
                <Boxes className="text-gray-300" size={30} />
                <p className="text-xs text-gray-400 font-semibold">No movement history yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="p-4">Date</th>
                      <th className="p-4">Item</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Qty</th>
                      <th className="p-4">Unit Price</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const signedQuantity =
                        movement.type === "SALE"
                          ? -movement.quantity
                          : movement.type === "ADJUSTMENT"
                          ? movement.quantity
                          : movement.quantity;
                      const unitPrice =
                        movement.type === "SALE"
                          ? movement.unitSellingPrice
                          : movement.unitBuyingPrice;
                      return (
                        <tr key={movement.id} className="border-b border-gray-50 text-gray-700">
                          <td className="p-4 font-semibold text-gray-400">
                            {formatDate(movement.createdAt)}
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-gray-800">{movement.itemName}</p>
                            <p className="text-[10px] text-gray-400">
                              {movement.itemCategory || "Uncategorized"}
                            </p>
                          </td>
                          <td className="p-4">
                            <span
                              className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${
                                movement.type === "SALE"
                                  ? "bg-green-50 text-green-600"
                                  : movement.type === "PURCHASE"
                                  ? "bg-lamaPurpleLight text-lamaPurple"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {movement.type}
                            </span>
                          </td>
                          <td
                            className={`p-4 font-black ${
                              signedQuantity < 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {signedQuantity > 0 ? `+${signedQuantity}` : signedQuantity}
                          </td>
                          <td className="p-4 font-bold text-gray-800">
                            {unitPrice ? currency(unitPrice) : "N/A"}
                          </td>
                          <td className="p-4 font-extrabold text-gray-900">
                            {movement.type === "ADJUSTMENT"
                              ? "N/A"
                              : currency(movement.totalAmount)}
                          </td>
                          <td className="p-4 text-gray-400 max-w-56 truncate">
                            {movement.note || "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm h-fit xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-bold text-gray-800">{panelTitle}</h2>
              {selectedItem && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {selectedItem.name} · {selectedItem.quantityInStock} in stock
                </p>
              )}
            </div>
            {mode !== "create" && (
              <button
                type="button"
                onClick={startNewItem}
                className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 inline-flex items-center justify-center transition-colors"
                title="Close action panel"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {mode === "create" || mode === "edit" ? (
            <form onSubmit={handleCreateOrUpdate} className="flex flex-col gap-2.5">
              <TextField
                label="Item Name"
                value={itemForm.name}
                onChange={(value) => setItemForm((prev) => ({ ...prev, name: value }))}
                placeholder="Book, notebook, uniform"
                required
              />
              <TextField
                label="Category"
                value={itemForm.category}
                onChange={(value) => setItemForm((prev) => ({ ...prev, category: value }))}
                placeholder="Books"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <TextField
                  label="Buying Price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={itemForm.buyingPrice}
                  onChange={(value) =>
                    setItemForm((prev) => ({ ...prev, buyingPrice: value }))
                  }
                  placeholder="80"
                  required
                />
                <TextField
                  label="Selling Price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={itemForm.sellingPrice}
                  onChange={(value) =>
                    setItemForm((prev) => ({ ...prev, sellingPrice: value }))
                  }
                  placeholder="100"
                  required
                />
              </div>
              <TextArea
                label="Description"
                value={itemForm.description}
                onChange={(value) => setItemForm((prev) => ({ ...prev, description: value }))}
                placeholder="Optional details"
              />
              <button
                type="submit"
                disabled={loadingKey === mode}
                className="w-full bg-lamaSky hover:bg-[#1e40af] text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={15} />
                {loadingKey === mode ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Item"}
              </button>
            </form>
          ) : selectedItem ? (
            <form onSubmit={handleMovement} className="flex flex-col gap-2.5">
              {mode === "adjust" ? (
                <TextField
                  label="Quantity Change"
                  type="number"
                  step="1"
                  value={movementForm.quantityDelta}
                  onChange={(value) =>
                    setMovementForm((prev) => ({ ...prev, quantityDelta: value }))
                  }
                  placeholder="-2 or 5"
                  required
                />
              ) : (
                <>
                  <TextField
                    label="Quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={movementForm.quantity}
                    onChange={(value) =>
                      setMovementForm((prev) => ({ ...prev, quantity: value }))
                    }
                    placeholder="10"
                    required
                  />
                  <TextField
                    label={mode === "purchase" ? "Buying Price" : "Selling Price"}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={movementForm.unitPrice}
                    onChange={(value) =>
                      setMovementForm((prev) => ({ ...prev, unitPrice: value }))
                    }
                    placeholder={mode === "purchase" ? "80" : "100"}
                    required
                  />
                </>
              )}
              <TextArea
                label="Note"
                value={movementForm.note}
                onChange={(value) => setMovementForm((prev) => ({ ...prev, note: value }))}
                placeholder="Optional note"
              />
              <button
                type="submit"
                disabled={loadingKey === mode}
                className={`w-full text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
                  mode === "sale"
                    ? "bg-green-600 hover:bg-green-700"
                    : mode === "purchase"
                    ? "bg-lamaPurple hover:bg-[#a394f7]"
                    : "bg-gray-800 hover:bg-gray-900"
                }`}
              >
                {mode === "sale" ? (
                  <ShoppingCart size={15} />
                ) : mode === "purchase" ? (
                  <PackagePlus size={15} />
                ) : (
                  <SlidersHorizontal size={15} />
                )}
                {loadingKey === mode
                  ? "Saving..."
                  : mode === "sale"
                  ? "Record Sale"
                  : mode === "purchase"
                  ? "Add Stock"
                  : "Save Adjustment"}
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "sky" | "purple" | "green" | "amber" | "gray";
}) {
  const toneClass =
    tone === "sky"
      ? "bg-lamaSky"
      : tone === "purple"
      ? "bg-lamaPurple"
      : tone === "green"
      ? "bg-green-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-gray-700";

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${toneClass}`} />
      <div className={`w-10 h-10 rounded-full ${toneClass} bg-opacity-10 flex items-center justify-center`}>
        <Boxes size={18} className={tone === "gray" ? "text-gray-700" : "text-gray-700"} />
      </div>
      <div className="min-w-0">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</span>
        <h3 className="text-lg font-black text-gray-800 mt-0.5 truncate">{value}</h3>
        <p className="text-[9px] text-gray-400 font-medium">{helper}</p>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  text,
  icon,
  onClick,
  disabled,
  danger,
  className = "",
}: {
  label: string;
  text: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={`min-h-9 px-2.5 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      } ${className}`}
    >
      {icon}
      <span>{text}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  step,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  min?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        min={type === "number" ? min : undefined}
        step={type === "number" ? step : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="ring-1 ring-gray-200 px-3 py-2 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all placeholder:text-gray-300"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="ring-1 ring-gray-200 px-3 py-2 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all placeholder:text-gray-300 resize-none"
      />
    </div>
  );
}
