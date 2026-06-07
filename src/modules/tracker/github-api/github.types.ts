export type GithubApiErrorResponse = {
  error: { status: number; message: string; fullResponse: Response };
  data: null;
};

export type GithubApiSuccessResponse<T> = {
  error: null;
  data: T;
};

export type GithubApiResponse<T> =
  | GithubApiErrorResponse
  | GithubApiSuccessResponse<T>;

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  created_at: string;
  draft: boolean;
  prerelease: boolean;
  author: GitHubUser;
  body: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
}
