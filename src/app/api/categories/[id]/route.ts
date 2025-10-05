import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: { id: string } };

export const runtime = "nodejs";

/** DELETE /api/categories/:id
 *  Detaches all items (sets categoryId = null) then deletes the category.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    // detach items first (safe on SQLite where FK is restrictive by default)
    const cleared = await prisma.item.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    // then delete the category
    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ ok: true, itemsCleared: cleared.count });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}
