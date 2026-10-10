"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, dec, reqDate, reqStr, str } from "@/lib/form";
import { saleProductPreset } from "@/lib/domain";

type State = { error?: string; ok?: string } | undefined;

/** Money is stored to the paisa, quantities to three decimals. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A sale's ledger line: who bought what, how much of it, at what rate. */
function saleDescription(customerName: string, product: string, quantity: number, unit: string, unitPrice: number) {
  return `${product} — ${quantity} ${unit} × ${unitPrice} · ${customerName}`;
}

export async function saveCustomerAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const id = str(fd, "id");
  let newId = id;
  try {
    const data = {
      name: reqStr(fd, "name", "Customer name"),
      phone: str(fd, "phone"),
      address: str(fd, "address"),
      notes: str(fd, "notes"),
      active: id ? bool(fd, "active") : true,
    };

    if (id) {
      await prisma.customer.update({ where: { id }, data });
    } else {
      const customer = await prisma.customer.create({ data });
      newId = customer.id;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath("/customers");
  if (newId && newId !== id) redirect(`/customers/${newId}`);
  if (id) revalidatePath(`/customers/${id}`);
  return { ok: "Customer saved." };
}

export async function deleteCustomerAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  // Rates, deliveries and the income entries linked to them go with it (cascade).
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  redirect("/customers");
}

/** Adds or updates one line of a customer's rate card: product, unit, price. */
export async function saveRateAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const customerId = reqStr(fd, "customerId");
  const id = str(fd, "id");
  try {
    const product = reqStr(fd, "product", "Product");
    const preset = saleProductPreset(product);
    const unitPrice = dec(fd, "unitPrice");
    if (unitPrice === null || unitPrice <= 0) return { error: "Enter a unit price greater than zero." };

    const dailyQty = dec(fd, "dailyQty");
    if (dailyQty !== null && dailyQty < 0) return { error: "Daily quantity can't be negative." };

    const data = {
      product,
      unit: str(fd, "unit") ?? preset?.unit ?? "litre",
      unitPrice,
      dailyQty,
      category: str(fd, "category") ?? preset?.category ?? "Other Income",
      notes: str(fd, "notes"),
      active: id ? bool(fd, "active") : true,
    };

    if (id) await prisma.customerRate.update({ where: { id }, data });
    else await prisma.customerRate.create({ data: { ...data, customerId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save.";
    return { error: msg.includes("Unique constraint") ? "This customer already has a price for that product." : msg };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { ok: "Price saved." };
}

export async function deleteRateAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  const rate = await prisma.customerRate.findUnique({ where: { id }, select: { customerId: true } });
  // Deliveries already logged keep their own copy of the product and price,
  // so removing a rate never changes what was sold.
  await prisma.customerRate.delete({ where: { id } });
  if (rate) revalidatePath(`/customers/${rate.customerId}`);
  revalidatePath("/customers");
}

/** Reads the product/unit/price for a delivery, either from a rate card line or typed in. */
async function resolveSaleTerms(fd: FormData, customerId: string) {
  const rateId = str(fd, "rateId");
  if (rateId) {
    const rate = await prisma.customerRate.findUnique({ where: { id: rateId } });
    if (!rate || rate.customerId !== customerId) throw new Error("That price no longer belongs to this customer.");
    const override = dec(fd, "unitPrice");
    return {
      rateId: rate.id,
      product: rate.product,
      unit: rate.unit,
      category: rate.category,
      unitPrice: override !== null && override > 0 ? override : Number(rate.unitPrice),
      defaultQty: rate.dailyQty === null ? null : Number(rate.dailyQty),
    };
  }

  const product = reqStr(fd, "product", "Product");
  const preset = saleProductPreset(product);
  const unitPrice = dec(fd, "unitPrice");
  if (unitPrice === null || unitPrice <= 0) throw new Error("Enter a unit price greater than zero.");
  return {
    rateId: null,
    product,
    unit: str(fd, "unit") ?? preset?.unit ?? "litre",
    category: str(fd, "category") ?? preset?.category ?? "Other Income",
    unitPrice,
    defaultQty: null,
  };
}

/** Logs one delivery and the income entry that goes with it. */
export async function recordSaleAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const customerId = reqStr(fd, "customerId");
  try {
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } });
    const terms = await resolveSaleTerms(fd, customerId);

    const quantity = dec(fd, "quantity") ?? terms.defaultQty;
    if (quantity === null || quantity <= 0) return { error: "Enter a quantity greater than zero." };

    const date = reqDate(fd, "date", "Date");
    const amount = round2(quantity * terms.unitPrice);
    const notes = str(fd, "notes");

    const sale = await prisma.sale.create({
      data: {
        customerId,
        rateId: terms.rateId,
        date,
        product: terms.product,
        unit: terms.unit,
        quantity,
        unitPrice: terms.unitPrice,
        amount,
        category: terms.category,
        notes,
        createdById: user.id,
      },
    });

    await prisma.transaction.create({
      data: {
        date,
        type: "INCOME",
        category: terms.category,
        amount,
        description: saleDescription(customer.name, terms.product, quantity, terms.unit, terms.unitPrice),
        vendor: customer.name,
        notAnimalSpecific: true,
        saleId: sale.id,
        createdById: user.id,
      },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: "Delivery recorded." };
}

/**
 * Logs one monthly sale for the entire date range — total quantity is
 * daily qty × days, recorded as a single Sale + Transaction entry.
 */
export async function recordSaleRangeAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const customerId = reqStr(fd, "customerId");
  try {
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } });
    const terms = await resolveSaleTerms(fd, customerId);

    const dailyQty = dec(fd, "quantity") ?? terms.defaultQty;
    if (dailyQty === null || dailyQty <= 0) return { error: "Enter a daily quantity greater than zero." };

    const from = reqDate(fd, "from", "From");
    const to = reqDate(fd, "to", "To");
    if (to < from) return { error: "The end date is before the start date." };

    const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    if (days > 366) return { error: "That's more than a year — record it a month or a season at a time." };

    const totalQty = round2(dailyQty * days);
    const amount = round2(totalQty * terms.unitPrice);
    const notes = str(fd, "notes");
    const fmtFrom = from.toISOString().slice(0, 10);
    const fmtTo = to.toISOString().slice(0, 10);

    const sale = await prisma.sale.create({
      data: {
        customerId,
        rateId: terms.rateId,
        date: from,
        product: terms.product,
        unit: terms.unit,
        quantity: totalQty,
        unitPrice: terms.unitPrice,
        amount,
        category: terms.category,
        notes: [notes, `${dailyQty} ${terms.unit}/day × ${days} days (${fmtFrom} to ${fmtTo})`].filter(Boolean).join(" · "),
        createdById: user.id,
      },
    });

    await prisma.transaction.create({
      data: {
        date: from,
        type: "INCOME",
        category: terms.category,
        amount,
        description: `${terms.product} — ${totalQty} ${terms.unit} (${dailyQty}/day × ${days} days) × ${terms.unitPrice} · ${customer.name}`,
        vendor: customer.name,
        notAnimalSpecific: true,
        saleId: sale.id,
        createdById: user.id,
      },
    });

    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/customers");
    revalidatePath("/finance");
    revalidatePath("/dashboard");
    return {
      ok: `Recorded ${totalQty} ${terms.unit} over ${days} days — ${round2(amount).toLocaleString()} total.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
}

export async function deleteSaleAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  const sale = await prisma.sale.findUnique({ where: { id }, select: { customerId: true } });
  // The linked income entry is removed with it (cascade), so the ledger stays in step.
  await prisma.sale.delete({ where: { id } });
  if (sale) revalidatePath(`/customers/${sale.customerId}`);
  revalidatePath("/customers");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
