"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, dec, reqStr, str } from "@/lib/form";
import { saleProductPreset } from "@/lib/domain";

type State = { error?: string; ok?: string } | undefined;

/** Money is stored to the paisa, quantities to three decimals. */
const round2 = (n: number) => Math.round(n * 100) / 100;

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

/**
 * Bills a whole month in one entry: the total quantity taken that month at an
 * agreed price. Re-billing a month replaces its previous entry, so correcting
 * a figure after the buyer says they took more never double-counts.
 */
export async function recordMonthlyBillAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const customerId = reqStr(fd, "customerId");
  try {
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } });
    const terms = await resolveSaleTerms(fd, customerId);

    const month = reqStr(fd, "month", "Month");
    if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose a month." };
    const [year, monthNumber] = month.split("-").map(Number);
    // Stored at midday on the 1st, matching how every other date is kept.
    const date = new Date(year, monthNumber - 1, 1, 12, 0, 0, 0);
    const monthEnd = new Date(year, monthNumber, 0, 23, 59, 59, 999);

    const quantity = dec(fd, "quantity");
    if (quantity === null || quantity <= 0) return { error: "Enter the total quantity for the month." };

    const totalQty = round2(quantity);
    const amount = round2(totalQty * terms.unitPrice);
    const label = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    // One bill per product per month: clear this month's before writing the
    // new one so an edited figure replaces rather than stacks. Linked income
    // entries cascade away with their sale.
    await prisma.sale.deleteMany({
      where: { customerId, product: terms.product, date: { gte: new Date(year, monthNumber - 1, 1), lte: monthEnd } },
    });

    const sale = await prisma.sale.create({
      data: {
        customerId,
        rateId: terms.rateId,
        date,
        product: terms.product,
        unit: terms.unit,
        quantity: totalQty,
        unitPrice: terms.unitPrice,
        amount,
        category: terms.category,
        notes: str(fd, "notes"),
        createdById: user.id,
      },
    });

    await prisma.transaction.create({
      data: {
        date,
        type: "INCOME",
        category: terms.category,
        amount,
        description: `${terms.product} — ${label}: ${totalQty} ${terms.unit} × ${terms.unitPrice} · ${customer.name}`,
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
    return { ok: `${label} billed: ${totalQty} ${terms.unit} — ${amount.toLocaleString()}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
}

/** Removes a whole month's bill for one product. */
export async function deleteMonthlyBillAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const customerId = reqStr(fd, "customerId");
  const product = reqStr(fd, "product");
  const month = reqStr(fd, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Choose a month.");
  const [year, monthNumber] = month.split("-").map(Number);

  await prisma.sale.deleteMany({
    where: {
      customerId, product,
      date: { gte: new Date(year, monthNumber - 1, 1), lte: new Date(year, monthNumber, 0, 23, 59, 59, 999) },
    },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

