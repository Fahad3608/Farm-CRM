import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Photos live in the database, so they are served through this authenticated route. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const wantThumb = new URL(req.url).searchParams.get("v") === "thumb";

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { mimeType: true, data: !wantThumb, thumb: wantThumb },
  });
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const bytes = (wantThumb ? photo.thumb : photo.data) as unknown as Buffer;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
