import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Link2,
  Plus,
  Search,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  Activity,
  MousePointerClick,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  fetchLinks,
  createLink,
  deleteLink,
  ApiClientError,
  type GoLink,
} from './api';
import { buildTargetUrl, type UrlProtocol } from './urlUtils';

export function App() {
  const [links, setLinks] = useState<GoLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string>('req_init');

  // Form state
  const [slug, setSlug] = useState('');
  const [protocol, setProtocol] = useState<UrlProtocol>('https://');
  const [targetUrl, setTargetUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<{
    message: string;
    code?: string;
    requestId?: string;
    fieldErrors?: Record<string, string[]>;
  } | null>(null);

  // Accessibility & feedback state
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Accessible IDs
  const slugInputId = useId();
  const slugErrorId = useId();
  const protocolSelectId = useId();
  const urlInputId = useId();
  const urlErrorId = useId();
  const descInputId = useId();
  const searchInputId = useId();

  const loadShortcuts = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const result = await fetchLinks(query);
      setLinks(result.data);
      setLastRequestId(result.requestId);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLoadError(`${err.message} (Request ID: ${err.requestId})`);
        setLastRequestId(err.requestId);
      } else {
        setLoadError('Unable to reach the Go Links backend server.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShortcuts(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, loadShortcuts]);

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const resolvedTargetUrl = buildTargetUrl(targetUrl, protocol);
      const result = await createLink({
        slug,
        targetUrl: resolvedTargetUrl,
        description,
      });

      setLastRequestId(result.requestId);
      setSlug('');
      setTargetUrl('');
      setDescription('');
      setLiveAnnouncement(`Created shortcut go/${result.data.slug}`);
      await loadShortcuts(searchQuery);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLastRequestId(err.requestId);
        setFormError({
          message: err.message,
          code: err.code,
          requestId: err.requestId,
          fieldErrors: err.details,
        });
      } else {
        setFormError({
          message: 'An unexpected network error occurred while saving the shortcut.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyShortcut = async (link: GoLink) => {
    const redirectUrl = `${window.location.origin}/go/${link.slug}`;
    try {
      await navigator.clipboard.writeText(redirectUrl);
      setCopiedId(link.id);
      setLiveAnnouncement(`Copied go/${link.slug} URL to clipboard`);
      setTimeout(() => {
        setCopiedId((prev) => (prev === link.id ? null : prev));
      }, 2000);
    } catch {
      setLiveAnnouncement(`Failed to copy go/${link.slug}`);
    }
  };

  const handleVisitShortcut = (link: GoLink) => {
    // Refresh click counter shortly after navigation opens in a new tab
    setTimeout(() => {
      void loadShortcuts(searchQuery);
    }, 450);
    setLiveAnnouncement(`Opening go/${link.slug} in a new tab`);
  };

  const handleDeleteShortcut = async (link: GoLink) => {
    try {
      const result = await deleteLink(link.id);
      setLastRequestId(result.requestId);
      setLinks((prev) => prev.filter((item) => item.id !== link.id));
      setLiveAnnouncement(`Deleted shortcut go/${link.slug}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLastRequestId(err.requestId);
        setLoadError(`${err.message} (Request ID: ${err.requestId})`);
      }
    }
  };

  const slugFieldError = formError?.fieldErrors?.slug?.[0];
  const urlFieldError = formError?.fieldErrors?.targetUrl?.[0];

  const totalClicks = links.reduce((acc, item) => acc + item.clicks, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Screen-reader polite status announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Top Navigation & Observability Status Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  go/links
                </h1>
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                  Internal Directory
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Memorable URL shortcuts for engineering, operations, and company tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <div
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-slate-700"
              title="Latest correlated X-Request-Id from backend API"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Trace: {lastRequestId}</span>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8 focus:outline-none"
      >
        {/* Create Shortcut Section */}
        <section
          aria-labelledby="create-shortcut-heading"
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                id="create-shortcut-heading"
                className="text-base font-semibold text-slate-900 flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                Create a Go Link
              </h2>
              <p className="text-sm text-slate-500">
                Map a short alias like <code className="font-mono text-indigo-600">go/oncall</code> to any internal or external URL.
              </p>
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex items-start gap-3"
            >
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">{formError.message}</p>
                {formError.requestId && (
                  <p className="text-xs text-red-600 mt-1 font-mono">
                    Error Code: {formError.code} · Request ID: {formError.requestId}
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Shortcut Slug Field */}
              <div className="md:col-span-4">
                <label
                  htmlFor={slugInputId}
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Shortcut Alias <span className="text-red-500">*</span>
                </label>
                <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/20 overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-slate-100 text-slate-500 font-mono text-sm border-r border-slate-300 select-none">
                    go/
                  </span>
                  <input
                    id={slugInputId}
                    name="slug"
                    type="text"
                    required
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      if (formError?.fieldErrors?.slug) {
                        setFormError((prev) =>
                          prev
                            ? {
                                ...prev,
                                fieldErrors: { ...prev.fieldErrors, slug: [] },
                              }
                            : null,
                        );
                      }
                    }}
                    placeholder="design-system"
                    aria-invalid={slugFieldError ? 'true' : undefined}
                    aria-describedby={slugFieldError ? slugErrorId : undefined}
                    className="w-full px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                {slugFieldError && (
                  <p id={slugErrorId} className="mt-1 text-xs text-red-600">
                    {slugFieldError}
                  </p>
                )}
              </div>

              {/* Destination URL Field */}
              <div className="md:col-span-8">
                <label
                  htmlFor={urlInputId}
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Destination URL <span className="text-red-500">*</span>
                </label>
                <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/20 overflow-hidden">
                  <label htmlFor={protocolSelectId} className="sr-only">
                    URL Protocol
                  </label>
                  <select
                    id={protocolSelectId}
                    name="protocol"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as UrlProtocol)}
                    className="inline-flex items-center px-3 py-2 bg-slate-100 text-slate-500 font-mono text-sm border-r border-slate-300 focus:outline-none hover:bg-slate-200/60 cursor-pointer transition-colors"
                  >
                    <option value="https://">https://</option>
                    <option value="http://">http://</option>
                  </select>
                  <input
                    id={urlInputId}
                    name="targetUrl"
                    type="text"
                    inputMode="url"
                    required
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={targetUrl}
                    onChange={(e) => {
                      setTargetUrl(e.target.value);
                      if (formError?.fieldErrors?.targetUrl) {
                        setFormError((prev) =>
                          prev
                            ? {
                                ...prev,
                                fieldErrors: { ...prev.fieldErrors, targetUrl: [] },
                              }
                            : null,
                        );
                      }
                    }}
                    placeholder="irvin-lopez.com or figma.com/file/design-system"
                    aria-invalid={urlFieldError ? 'true' : undefined}
                    aria-describedby={urlFieldError ? urlErrorId : undefined}
                    className="w-full px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                {urlFieldError && (
                  <p id={urlErrorId} className="mt-1 text-xs text-red-600">
                    {urlFieldError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
              <div className="flex-1">
                <label
                  htmlFor={descInputId}
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id={descInputId}
                  name="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this link point to? Who owns it?"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? 'Saving...' : 'Create Shortcut'}
              </button>
            </div>
          </form>
        </section>

        {/* Directory & Search Section */}
        <section aria-labelledby="directory-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 id="directory-heading" className="text-base font-semibold text-slate-900">
                Active Shortcuts
              </h2>
              <p className="text-xs text-slate-500">
                Showing {links.length} shortcut{links.length === 1 ? '' : 's'} · {totalClicks} total redirects recorded
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <label htmlFor={searchInputId} className="sr-only">
                Search shortcuts by alias, description, or URL
              </label>
              <Search
                className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id={searchInputId}
                name="q"
                type="search"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by alias, description, or URL..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          {loadError && (
            <div
              role="alert"
              className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex items-center gap-3"
            >
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
              <span>{loadError}</span>
            </div>
          )}

          {isLoading && links.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
              Loading shortcuts...
            </div>
          ) : links.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">No matching shortcuts found</p>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `No shortcuts matched "${searchQuery}". Try clearing your search filter.`
                  : 'Create your first shortcut above to get started.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <ul role="list" className="divide-y divide-slate-200">
                {links.map((link) => {
                  const isCopied = copiedId === link.id;
                  return (
                    <li
                      key={link.id}
                      className="p-4 sm:px-6 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <a
                            href={`/go/${link.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleVisitShortcut(link)}
                            className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 rounded"
                          >
                            <span>go/{link.slug}</span>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>

                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                            title="Total redirects through /go/:slug"
                          >
                            <MousePointerClick className="h-3 w-3 text-slate-500" aria-hidden="true" />
                            {link.clicks} {link.clicks === 1 ? 'visit' : 'visits'}
                          </span>

                          {link.lastAccessedAt && (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-slate-400"
                              title={`Last visited at ${new Date(link.lastAccessedAt).toLocaleString()}`}
                            >
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              Last used {new Date(link.lastAccessedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {link.description && (
                          <p className="text-sm text-slate-700">{link.description}</p>
                        )}

                        <p className="text-xs font-mono text-slate-400 truncate">
                          {link.targetUrl}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleCopyShortcut(link)}
                          aria-label={`Copy redirect URL for go/${link.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`/go/${link.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleVisitShortcut(link)}
                          aria-label={`Visit go/${link.slug} in a new tab`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
                        >
                          <span>Visit</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>

                        <button
                          type="button"
                          onClick={() => void handleDeleteShortcut(link)}
                          aria-label={`Delete shortcut go/${link.slug}`}
                          className="inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 cursor-pointer transition-colors"
                          title={`Delete go/${link.slug}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
