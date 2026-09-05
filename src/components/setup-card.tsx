export function SetupCard() {
  return (
    <section className="py-16 sm:py-24">
      <div className="rounded-xl border border-dashed border-border p-8 sm:p-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Connect your GitHub
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Commit Atlas will show your profile and aggregate your commits and
          lines across your own repositories. It just needs a GitHub token to
          identify you.
        </p>
        <ol className="mt-8 list-decimal space-y-4 pl-5 text-sm leading-6">
          <li>
            Create a personal access token at{" "}
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-chart-1 underline-offset-4 hover:underline"
            >
              github.com/settings/tokens
            </a>{" "}
            — no scopes needed for public repos, add the{" "}
            <code className="rounded bg-muted px-1 py-0.5">repo</code> scope to
            include private ones.
          </li>
          <li>
            Put it in a file named{" "}
            <code className="rounded bg-muted px-1 py-0.5">.env.local</code> in
            the project root (it stays on your machine — never committed):
            <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-3 text-xs">
              <code>{`# .env.local
GITHUB_TOKEN=your_token_here`}</code>
            </pre>
          </li>
          <li>
            Restart the server — your profile and repositories load
            automatically.
          </li>
        </ol>
      </div>
    </section>
  );
}
