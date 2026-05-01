const GIST_FILENAME = 'neto-sync-v1.json';

export class SyncError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'SyncError';
  }
}

async function githubFetch<T>(url: string, pat: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new SyncError('Invalid GitHub token', response.status);
    }
    if (response.status === 403) {
      throw new SyncError('GitHub API rate limit exceeded', response.status);
    }
    if (response.status === 404) {
      throw new SyncError('Gist not found', response.status);
    }
    throw new SyncError(`GitHub API error ${response.status}: ${body}`, response.status);
  }

  return response.json() as Promise<T>;
}

interface GistResponse {
  id: string;
  files: Record<string, { content: string }>;
}

export async function createGist(content: string, pat: string): Promise<string> {
  const data = await githubFetch<{ id: string }>('https://api.github.com/gists', pat, {
    method: 'POST',
    body: JSON.stringify({
      description: 'neto encrypted portfolio sync',
      public: false,
      files: {
        [GIST_FILENAME]: { content },
      },
    }),
  });
  return data.id;
}

export async function fetchGist(gistId: string, pat: string): Promise<{ content: string }> {
  const data = await githubFetch<GistResponse>(`https://api.github.com/gists/${gistId}`, pat);
  const file = data.files[GIST_FILENAME];
  if (!file) {
    throw new SyncError('Gist file missing');
  }
  return { content: file.content };
}

export async function updateGist(gistId: string, content: string, pat: string): Promise<void> {
  await githubFetch(`https://api.github.com/gists/${gistId}`, pat, {
    method: 'PATCH',
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content },
      },
    }),
  });
}

export async function findNetoGist(pat: string): Promise<string | null> {
  const gists = await githubFetch<Array<{ id: string; description: string | null; files: Record<string, unknown> }>>(
    'https://api.github.com/gists?per_page=100',
    pat
  );
  const match = gists.find(
    (g) => g.description === 'neto encrypted portfolio sync' && GIST_FILENAME in g.files
  );
  return match?.id ?? null;
}
