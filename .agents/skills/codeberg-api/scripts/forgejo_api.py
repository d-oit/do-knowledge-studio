#!/usr/bin/env python3
"""
Forgejo API CLI — wraps common Forgejo REST v1 operations.
Usage: python forgejo_api.py <command> [options]

Supports both Codeberg (https://codeberg.org) and self-hosted Forgejo instances.
Set FORGEJO_BASE_URL to use a custom instance.
"""
import argparse
import base64
import json
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import httpx
    def _get(url, token=None):
        headers = {"Authorization": f"token {token}"} if token else {}
        r = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
        r.raise_for_status()
        return r.json()
    def _post(url, token, data):
        r = httpx.post(url, headers={"Authorization": f"token {token}", "Content-Type": "application/json"},
                       content=json.dumps(data), timeout=15)
        r.raise_for_status()
        return r.json()
    def _put(url, token, data):
        r = httpx.put(url, headers={"Authorization": f"token {token}", "Content-Type": "application/json"},
                      json=data, timeout=15)
        r.raise_for_status()
        return r.json()
except ImportError:
    print("ERROR: httpx not installed. Run: pip install httpx", file=sys.stderr)
    sys.exit(1)

# Support both Codeberg and self-hosted Forgejo
BASE = os.environ.get("FORGEJO_BASE_URL", "https://codeberg.org/api/v1")
TOKEN = os.environ.get("FORGEJO_TOKEN", os.environ.get("CODEBERG_TOKEN", ""))


def repos(owner: str):
    url = f"{BASE}/users/{owner}/repos?limit=50"
    data = _get(url, TOKEN)
    for r in data:
        print(f"  {r['full_name']}  [{r['description'] or '—'}]")


def get_file(owner: str, repo: str, path: str, branch: str = "main"):
    url = f"{BASE}/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    data = _get(url, TOKEN)
    content = base64.b64decode(data["content"]).decode("utf-8")
    print(content)
    return data.get("sha")


def put_file(owner: str, repo: str, path: str, content: str, message: str, branch: str = "main"):
    # Try to get existing SHA - required by Forgejo API for file operations
    sha = None
    try:
        url = f"{BASE}/repos/{owner}/{repo}/contents/{path}?ref={branch}"
        existing = _get(url, TOKEN)
        sha = existing.get("sha")
    except Exception:
        pass

    encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")
    payload = {"message": message, "content": encoded, "branch": branch}
    if sha:
        payload["sha"] = sha

    url = f"{BASE}/repos/{owner}/{repo}/contents/{path}"
    try:
        result = _put(url, TOKEN, payload)
        print(f"OK: {result['content']['html_url']}")
    except Exception as e:
        if "SHA" in str(e) and not sha:
            print(f"ERROR: Forgejo requires SHA for file updates. The file '{path}' does not exist yet.")
            print("To create new files, use the web interface or provide the SHA of an existing file to update.")
        else:
            raise


def list_issues(owner: str, repo: str, state: str = "open"):
    url = f"{BASE}/repos/{owner}/{repo}/issues?type=issues&state={state}&limit=50"
    data = _get(url, TOKEN)
    for issue in data:
        print(f"  #{issue['number']}  [{issue['state']}]  {issue['title']}")


def create_issue(owner: str, repo: str, title: str, body: str = ""):
    url = f"{BASE}/repos/{owner}/{repo}/issues"
    result = _post(url, TOKEN, {"title": title, "body": body})
    print(f"Created #{result['number']}: {result['html_url']}")


def list_branches(owner: str, repo: str):
    url = f"{BASE}/repos/{owner}/{repo}/branches"
    data = _get(url, TOKEN)
    for branch in data:
        commit_id = branch.get('commit', {}).get('id', 'unknown')[:7]
        print(f"  {branch['name']}  (commit: {commit_id})")


def list_releases(owner: str, repo: str):
    url = f"{BASE}/repos/{owner}/{repo}/releases"
    data = _get(url, TOKEN)
    for release in data:
        print(f"  {release['tag_name']}  [{release.get('state', 'published')}]  {release.get('name', release['tag_name'])}")


def search_repos(query: str):
    url = f"{BASE}/repos/search?q={query}&limit=20"
    response = _get(url, TOKEN)
    data = response.get('data', response) if isinstance(response, dict) else response
    if not data:
        print("  No results found")
        return
    for repo in data:
        if isinstance(repo, dict):
            print(f"  {repo.get('full_name', 'unknown')}  [{repo.get('description') or '—'}]")
        else:
            print(f"  {repo}")


def get_repo(owner: str, repo: str):
    url = f"{BASE}/repos/{owner}/{repo}"
    data = _get(url, TOKEN)
    print(f"Repository: {data['full_name']}")
    print(f"  Description: {data.get('description', '—')}")
    print(f"  Default branch: {data.get('default_branch', 'main')}")
    print(f"  Stars: {data.get('stars_count', 0)}")
    print(f"  Forks: {data.get('forks_count', 0)}")
    print(f"  Open issues: {data.get('open_issues_count', 0)}")
    print(f"  URL: {data.get('html_url')}")


def main():
    parser = argparse.ArgumentParser(description="Forgejo API CLI")
    sub = parser.add_subparsers(dest="command")

    p_repos = sub.add_parser("repos"); p_repos.add_argument("--owner", required=True)

    p_get = sub.add_parser("get-file")
    p_get.add_argument("--owner", required=True); p_get.add_argument("--repo", required=True)
    p_get.add_argument("--path", required=True); p_get.add_argument("--branch", default="main")

    p_put = sub.add_parser("put-file")
    p_put.add_argument("--owner", required=True); p_put.add_argument("--repo", required=True)
    p_put.add_argument("--path", required=True); p_put.add_argument("--content", required=True)
    p_put.add_argument("--message", required=True); p_put.add_argument("--branch", default="main")

    p_li = sub.add_parser("list-issues")
    p_li.add_argument("--owner", required=True); p_li.add_argument("--repo", required=True)
    p_li.add_argument("--state", default="open")

    p_ci = sub.add_parser("create-issue")
    p_ci.add_argument("--owner", required=True); p_ci.add_argument("--repo", required=True)
    p_ci.add_argument("--title", required=True); p_ci.add_argument("--body", default="")

    p_branches = sub.add_parser("branches")
    p_branches.add_argument("--owner", required=True); p_branches.add_argument("--repo", required=True)

    p_releases = sub.add_parser("releases")
    p_releases.add_argument("--owner", required=True); p_releases.add_argument("--repo", required=True)

    p_search = sub.add_parser("search")
    p_search.add_argument("query", help="Search query")

    p_info = sub.add_parser("repo")
    p_info.add_argument("--owner", required=True); p_info.add_argument("--repo", required=True)

    args = parser.parse_args()
    if args.command == "repos":
        repos(args.owner)
    elif args.command == "get-file":
        get_file(args.owner, args.repo, args.path, args.branch)
    elif args.command == "put-file":
        put_file(args.owner, args.repo, args.path, args.content, args.message, args.branch)
    elif args.command == "list-issues":
        list_issues(args.owner, args.repo, args.state)
    elif args.command == "create-issue":
        create_issue(args.owner, args.repo, args.title, args.body)
    elif args.command == "branches":
        list_branches(args.owner, args.repo)
    elif args.command == "releases":
        list_releases(args.owner, args.repo)
    elif args.command == "search":
        search_repos(args.query)
    elif args.command == "repo":
        get_repo(args.owner, args.repo)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()