import Link from "next/link";
import { RipsMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 page-bg" aria-hidden="true" />
      <div className="relative text-center">
        <RipsMark size={40} className="mx-auto" />
        <h1 className="display mt-6 text-[40px]">Nothing here</h1>
        <p className="lede mx-auto mt-3 max-w-sm text-[14px]">
          That pack or page is not on the shelf. The current packs are one click away.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/packs" className="btn btn-violet">
            Browse packs
          </Link>
          <Link href="/" className="btn btn-quiet">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
