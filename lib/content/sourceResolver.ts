export function normalizeSourceNotes(sources: string[]) {
  return [...new Set(sources.map((source) => source.trim()).filter(Boolean))].slice(0, 8);
}

export function hasCredibleSource(sources: string[]) {
  return normalizeSourceNotes(sources).some(
    (source) => /^https?:\/\//i.test(source) || source.length >= 8
  );
}
