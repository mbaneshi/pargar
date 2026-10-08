export interface RecentProject {
  name: string;
  lastModified: number;
  size: number;
}

export async function getRecentProjects(limit: number = 8): Promise<RecentProject[]> {
  try {
    const { listProjects } = await import('@nexus/file-io');
    const all = await listProjects();
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

export function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) {
    const h = Math.floor(diffHours);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    const d = Math.floor(diffDays);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
