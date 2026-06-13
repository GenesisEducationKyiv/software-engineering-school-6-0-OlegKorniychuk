import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const mockGithubServer = setupServer(
  http.get('http://tracker-mock/repos/:owner/:repo/verify', ({ params }) => {
    const { owner } = params;
    if (owner === 'nonexistent') {
      return HttpResponse.json(
        { type: 'notFound', message: 'Repository not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json({ ok: true });
  }),
  http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
    const { owner, repo } = params;
    if (owner === 'nonexistent') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      id: 12345,
      full_name: `${owner}/${repo}`,
      tag_name: 'v1.0.0',
    });
  }),
  http.get(
    'https://api.github.com/repos/:owner/:repo/releases/latest',
    ({ params }) => {
      const { owner } = params;
      if (owner === 'nonexistent') {
        return new HttpResponse(null, { status: 404 });
      }
      return HttpResponse.json({
        tag_name: 'v1.0.0',
      });
    },
  ),
);
