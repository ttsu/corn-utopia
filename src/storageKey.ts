/**
 * localStorage is shared by every page on the origin, so PR previews (served under
 * `.../pr/pr-<N>/` next to production) get their own keys and can't overwrite production saves.
 */
export function storageKey(name: string): string {
  const preview = /\/pr\/pr-\d+\//.exec(location.pathname);
  return preview ? `${name}@${preview[0]}` : name;
}
