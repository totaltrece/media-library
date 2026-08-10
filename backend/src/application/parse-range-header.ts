export interface ByteRange {
  start: number;
  end: number;
}

export type ParsedRange =
  | { kind: "full" }
  | { kind: "partial"; range: ByteRange }
  | { kind: "unsatisfiable" };

export function parseRangeHeader(rangeHeader: string | undefined, fileSize: number): ParsedRange {
  if (rangeHeader === undefined) {
    return { kind: "full" };
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());

  if (!match || fileSize === 0) {
    return { kind: "unsatisfiable" };
  }

  const startPart = match[1] ?? "";
  const endPart = match[2] ?? "";

  if (startPart === "" && endPart === "") {
    return { kind: "unsatisfiable" };
  }

  let start: number;
  let end: number;

  if (startPart === "") {
    const suffixLength = Number(endPart);

    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { kind: "unsatisfiable" };
    }

    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startPart);
    end = endPart === "" ? fileSize - 1 : Number(endPart);

    if (!Number.isInteger(start) || start < 0) {
      return { kind: "unsatisfiable" };
    }

    if (endPart !== "" && (!Number.isInteger(end) || end < 0)) {
      return { kind: "unsatisfiable" };
    }
  }

  if (start >= fileSize || end < start) {
    return { kind: "unsatisfiable" };
  }

  end = Math.min(end, fileSize - 1);

  return {
    kind: "partial",
    range: { start, end },
  };
}
