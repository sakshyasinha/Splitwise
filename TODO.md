- [ ] Fix gh-pages 404 for SPA static asset loading by ensuring Vite `base` is correctly set to `/<repo>/`.
- [ ] Rebuild client and redeploy to gh-pages.
- [ ] Verify in browser DevTools that failed 404 URL is under `/<repo>/assets/...` not `/assets/...`.
- [ ] If still failing, inspect failing resource URL (screenshot/URL) and patch base/publicUrl or router handling accordingly.

