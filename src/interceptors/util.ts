export const makeIdGenerator = (prefix: string) => {
  let n = 0;
  const session = Math.random().toString(36).slice(2, 8);
  return () => `${prefix}-${session}-${(++n).toString(36)}`;
};

export const safeText = async (
  reader: () => Promise<string | null | undefined> | string | null | undefined,
): Promise<string | null> => {
  try {
    const value = await reader();
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
};
