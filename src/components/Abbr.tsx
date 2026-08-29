import { ABBR, type AbbrKey } from "@/lib/abbr";

export function Abbr({
  of,
  extra,
}: {
  of: AbbrKey;
  extra?: string;
}) {
  const { short, long } = ABBR[of];
  return (
    <span className="normal-case tracking-normal">
      <abbr title={long} className="font-medium no-underline">
        {short}
      </abbr>{" "}
      <span className="font-normal opacity-75">({long})</span>
      {extra ? ` ${extra}` : null}
    </span>
  );
}
